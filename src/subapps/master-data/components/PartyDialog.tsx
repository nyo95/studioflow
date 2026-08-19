"use client";

import * as React from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { createCompanyAction, updateCompanyAction } from "../actions/party-actions";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import type { PartyData, PartyInput, PartyContactInput } from "../types/party";
import { PARTY_ROLE_LABEL, PARTY_ROLE_ORDER } from "../types/party";
import type { PartyRoleKind } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const EMPTY_CONTACT: PartyContactInput = {
  contact_person: "",
  contact_role: "",
  phone_number: "",
  email: "",
};

const EMPTY_FORM: PartyInput = {
  name: "",
  legal_name: "",
  address: "",
  notes: "",
  contacts: [],
  links: [],
  roles: [],
};

function toForm(company?: PartyData | null): PartyInput {
  if (!company) return EMPTY_FORM;
  return {
    name: company.name ?? "",
    legal_name: company.legal_name ?? "",
    address: company.address ?? "",
    notes: company.notes ?? "",
    roles: company.roles ?? [],
    contacts: (company.contacts ?? []).map((c) => ({
      id: c.id,
      contact_person: c.contact_person ?? "",
      contact_role: c.contact_role ?? "",
      phone_number: c.phone_number ?? "",
      email: c.email ?? "",
    })),
    links: (company.links ?? []).map((l) => ({
      id: l.id,
      kind: l.kind,
      url: l.url ?? "",
      label: l.label ?? "",
    })),
  };
}

// ---------------------------------------------------------------------------
// ReadValue — display mode cell
// ---------------------------------------------------------------------------
function ReadValue({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-h-[2.5rem] whitespace-pre-wrap px-[calc(var(--ui-section-px)/2)] py-[calc(var(--ui-section-py)/2)] text-slate-950",
        UI_ENGINE_BG_SUBTLE,
        UI_ENGINE_RADIUS_CONTROL,
        UI_ENGINE_TYPE_BODY
      )}
    >
      {children || <span className="text-slate-400">—</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PartyDialog
// ---------------------------------------------------------------------------
export function PartyDialog({
  open,
  mode,
  company,
  canManage,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "CREATE" | "EDIT";
  company?: PartyData | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (company: PartyData) => void;
}) {
  const [form, setForm] = React.useState<PartyInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);

  /**
   * Bisa disunting = punya izin. Titik.
   *
   * State `isEditing` dihapus 2026-08-14 bersama View-First Protocol. Di berkas
   * ini ia sebenarnya sudah tidak berfungsi sejak lama: efeknya menyetel
   * `isEditing` ke `mode === "CREATE" || canManage`, sementara tombol "Modify"
   * baru muncul bila `canManage && !isEditing` — dua syarat yang tidak pernah
   * bisa benar bersamaan. Tombolnya ada di kode, tidak pernah ada di layar.
   */
  const editable = canManage;

  /**
   * Pengganti gatekeeper "Modify": bertanya di pintu KELUAR, dan hanya kepada
   * orang yang benar-benar mengubah sesuatu. Dideklarasikan SEBELUM efek
   * pengisi form karena efek itu memanggil `markPristine`.
   */
  const guard = useUnsavedChangesGuard({ open, value: form, onOpenChange, enabled: editable });

  React.useEffect(() => {
    if (!open) return;
    const next = toForm(company);
    setForm(next);
    // Baseline dipasang dengan nilai yang BARU dibangun, bukan dari state —
    // pada titik ini `form` masih berisi nilai dialog sebelumnya.
    guard.markPristine(next);
    // `guard` stabil kecuali `onOpenChange` berubah; memasukkannya ke deps
    // hanya akan menjalankan ulang inisialisasi form setiap render induk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, mode, open]);

  const set = <K extends keyof PartyInput>(key: K, value: PartyInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ---- contacts ----
  const addContact = () =>
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, { ...EMPTY_CONTACT }] }));

  const removeContact = (i: number) =>
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }));

  const updateContact = (i: number, field: keyof PartyContactInput, value: string) =>
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }));

  // ---- links ----
  // Editor link dihapus 2026-08-14 (item 5). `form.links` sengaja tetap ada di
  // state dan tetap dikirim saat save: menghapus UI-nya tidak boleh berarti
  // menghapus data yang sudah terlanjur terisi.

  // ---- validation ----
  const canSave = Boolean(form.name.trim());



  // ---- save ----
  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    const payload: PartyInput = {
      ...form,
      name: form.name.trim(),
      contacts: form.contacts.filter((c) => c.contact_person.trim()),
      links: form.links.filter((l) => l.url.trim()),
    };
    try {
      let saved: PartyData;
      if (mode === "CREATE") {
        saved = unwrapActionResult(await createCompanyAction(payload));
        toast.success("Party added");
      } else {
        if (!company?.id) throw new Error("ID not found");
        saved = unwrapActionResult(await updateCompanyAction({ id: company.id, data: payload }));
        toast.success("Party updated");
      }
      guard.closeAfterSave();
      onSaved(saved);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[var(--ui-dialog-width-lg)] overflow-y-auto border bg-white p-[var(--ui-section-py)]",
          UI_ENGINE_BORDER_SUBTLE,
          UI_ENGINE_RADIUS_CARD
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-[var(--ui-section-gap)]">
            <DialogTitle className={UI_ENGINE_TYPE_H3}>
              {mode === "CREATE" ? "Add Party" : form.name}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--ui-section-gap)]">
          {/* Identity */}
          <div className="grid gap-[var(--ui-section-gap)] md:grid-cols-2">
            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
              <Label htmlFor="co-name" className={UI_ENGINE_TYPE_META}>
                Party name <span className="text-red-500">*</span>
              </Label>
              {editable ? (
                <Input
                  id="co-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. TACO Group"
                  className={UI_ENGINE_RADIUS_CONTROL}
                />
              ) : (
                <ReadValue>{form.name}</ReadValue>
              )}
            </div>

            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
              <Label htmlFor="co-legal" className={UI_ENGINE_TYPE_META}>
                PT / CV (optional)
              </Label>
              {editable ? (
                <Input
                  id="co-legal"
                  value={form.legal_name}
                  onChange={(e) => set("legal_name", e.target.value)}
                  placeholder="e.g. PT Tangkas Cipta Optimal"
                  className={UI_ENGINE_RADIUS_CONTROL}
                />
              ) : (
                <ReadValue>{form.legal_name}</ReadValue>
              )}
            </div>

            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)] md:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>Categories</Label>
              {editable ? (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {PARTY_ROLE_ORDER.map((role) => (
                    <label
                      key={role}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={(e) =>
                          set(
                            "roles",
                            e.target.checked
                              ? [...form.roles, role]
                              : form.roles.filter((r) => r !== role)
                          )
                        }
                      />
                      {PARTY_ROLE_LABEL[role]}
                    </label>
                  ))}
                </div>
              ) : (
                <ReadValue>
                  {form.roles.length > 0
                    ? form.roles.map((r) => PARTY_ROLE_LABEL[r as PartyRoleKind]).join(", ")
                    : ""}
                </ReadValue>
              )}
              {editable && (
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  Only parties marked <strong>Supplier</strong> can be picked as a
                  supplier on the Pricing pages. Leave all of them off for a party
                  that just owns brands.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)] md:col-span-2">
              <Label htmlFor="co-address" className={UI_ENGINE_TYPE_META}>
                Address
              </Label>
              {editable ? (
                <textarea
                  id="co-address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  className={cn(
                    "resize-y border border-slate-200 bg-white p-[calc(var(--ui-section-py)/2)] outline-none focus:border-[var(--ui-border-focus)]",
                    UI_ENGINE_RADIUS_CONTROL,
                    UI_ENGINE_TYPE_BODY
                  )}
                />
              ) : (
                <ReadValue>{form.address}</ReadValue>
              )}
            </div>

            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)] md:col-span-2">
              <Label htmlFor="co-notes" className={UI_ENGINE_TYPE_META}>
                Notes
              </Label>
              {editable ? (
                <textarea
                  id="co-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                  className={cn(
                    "resize-y border border-slate-200 bg-white p-[calc(var(--ui-section-py)/2)] outline-none focus:border-[var(--ui-border-focus)]",
                    UI_ENGINE_RADIUS_CONTROL,
                    UI_ENGINE_TYPE_BODY
                  )}
                />
              ) : (
                <ReadValue>{form.notes}</ReadValue>
              )}
            </div>
          </div>

          {/* ── Section "Links & Drive" DIHAPUS 2026-08-14 (feedback item 5) ──
              Link katalog dan folder Drive dipakai extension Library untuk
              menarik visual material ke dalam desain — dan yang punya visual
              adalah BRAND, bukan perusahaan yang menjualnya. Supplier tidak
              memberi pengaruh apa pun ke desain, jadi field ini tidak pernah
              punya pembaca.

              Kolom `PartyLink` TIDAK dihapus dari database dan `form.links`
              tetap dikirim apa adanya saat save, supaya data lama (kalau ada)
              tidak terhapus diam-diam hanya karena formnya ditutup. Link brand
              tetap dikelola di dialog Brand → Katalog & Link. */}

          {/* Contacts */}
          <section className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
            <div className="flex items-center justify-between">
              <h3 className={UI_ENGINE_TYPE_H3}>Contacts</h3>
              {editable && (
                <Button type="button" variant="outline" onClick={addContact} className={UI_ENGINE_RADIUS_ACTION}>
                  <Plus className="size-[var(--ui-icon-size-sm)]" />
                  Tambah kontak
                </Button>
              )}
            </div>

            {form.contacts.length === 0 && !editable && (
              <p className={cn("text-slate-400", UI_ENGINE_TYPE_BODY)}>No contacts yet.</p>
            )}

            {form.contacts.map((contact, i) => (
              <div
                key={i}
                className={cn(
                  "grid gap-[calc(var(--ui-section-gap)/2)] border p-[calc(var(--ui-section-py)/2)] md:grid-cols-2",
                  UI_ENGINE_BORDER_SUBTLE,
                  UI_ENGINE_RADIUS_CARD
                )}
              >
                {(
                  [
                    ["contact_person", "Name", "text", "e.g. Budi Santoso"],
                    ["contact_role", "Role", "text", "e.g. Sales"],
                    ["phone_number", "Phone", "text", "e.g. 0812-xxxx"],
                    ["email", "Email", "email", "e.g. budi@taco.co.id"],
                  ] as const
                ).map(([field, labelText, type, placeholder]) => (
                  <div key={field} className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                    <Label className={UI_ENGINE_TYPE_META}>{labelText}</Label>
                    {editable ? (
                      <Input
                        type={type}
                        value={contact[field] ?? ""}
                        onChange={(e) => updateContact(i, field, e.target.value)}
                        placeholder={placeholder}
                        className={UI_ENGINE_RADIUS_CONTROL}
                      />
                    ) : (
                      <ReadValue>{contact[field]}</ReadValue>
                    )}
                  </div>
                ))}
                {editable && (
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeContact(i)}
                      className={cn("text-[var(--ui-change-before)]", UI_ENGINE_RADIUS_ACTION)}
                    >
                      <Trash2 className="size-[var(--ui-icon-size-sm)]" />
                      Delete kontak
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <DialogFooter>
          {editable && (
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!canSave || isSaving}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              {isSaving ? (
                <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
              ) : (
                <Save className="size-[var(--ui-icon-size-sm)]" />
              )}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Saudara, bukan anak: AlertDialog di DALAM Dialog yang sedang menutup
        ikut ter-unmount bersama induknya. */}
    <UnsavedChangesPrompt guard={guard} />
    </>
  );
}
