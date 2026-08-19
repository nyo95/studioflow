# CRUD Conventions — Master Data

> **Status:** Active · Last updated: 2026-08-12
> **Scope:** `src/subapps/master-data/` CRUD dialogs, hooks, and shared utilities.

---

## 1. Sheet vs Dialog — The One Rule

| Use | When | Examples |
|-----|------|---------|
| **Sheet** (right side panel) | Entity-level CRUD — forms that are long, have multiple sections, or need the user to keep page context behind them | Brand, SKU/Material, Party/Supplier |
| **Dialog** (center modal) | Relationship/quick-action forms — short, single-purpose, user focus should be pulled away from the page | Price entry, Assign Supplier, Add Contact, Confirm delete |

**Never use a center Dialog for multi-section entity forms.** Sheet allows the user to scroll, see the entity they're editing in context, and navigate away without losing orientation.

### Sheet imports

Always import Sheet components from `@/ui_engine`, never directly from `@/components/ui/sheet`:

```tsx
import {
  Sheet, SheetBody, SheetContent, SheetFooter,
  SheetHeader, SheetTitle,
} from "@/ui_engine";
```

### Standard Sheet structure

```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>{mode === "CREATE" ? "Tambah X" : form.name}</SheetTitle>
      {/* Edit button if EDIT mode and not yet editing */}
    </SheetHeader>

    <SheetBody>
      {/* All form sections here */}
    </SheetBody>

    <SheetFooter>
      {editable && <Button onClick={save}>Simpan</Button>}
    </SheetFooter>
  </SheetContent>
</Sheet>
```

---

## 2. `ReadValue` — Display Mode Fields

Import from the shared component — never write the `cn(...)` block inline:

```tsx
import { ReadValue } from "./shared/ReadValue";

// In JSX:
{editable ? (
  <Input value={form.name} onChange={...} />
) : (
  <ReadValue>{form.name}</ReadValue>
)}
```

**File:** `src/subapps/master-data/components/shared/ReadValue.tsx`

The component renders a subtle-background pill with an em-dash placeholder when empty. Pass `className` to add extra Tailwind classes if needed.

---

## 3. `DeleteConfirmDialog` — Confirm-Before-Delete

Replace any `AlertDialog` delete-confirmation block with this shared wrapper:

```tsx
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";

// State:
const [deleteTarget, setDeleteTarget] = React.useState<MyRow | null>(null);

// In JSX (anywhere in the return):
<DeleteConfirmDialog
  open={!!deleteTarget}
  onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
  title="Delete contact?"
  description={`${deleteTarget?.name} will be permanently removed.`}
  loading={isDeleting}
  onConfirm={handleDelete}
/>
```

**File:** `src/subapps/master-data/components/shared/DeleteConfirmDialog.tsx`

Props: `open`, `onOpenChange`, `title` (default: "Delete item?"), `description`, `loading`, `onConfirm`, `confirmLabel` (default: "Delete").

---

## 4. `useEntityForm` — State Triad

Centralizes `isEditing / isSaving / isDeleting / editable / canSave`. Use it in every entity CRUD sheet:

```tsx
import { useEntityForm } from "../hooks/use-entity-form";

const { isEditing, isSaving, editable, canSave, startSave, stopSave, setIsEditing } =
  useEntityForm({
    mode,           // "CREATE" | "EDIT"
    canManage,      // user has permission to mutate
    canSaveCheck: () => Boolean(form.name.trim()),
  });
```

**Returns:**
- `isEditing` — whether the form is currently editable
- `isSaving` — true while save is in flight
- `isDeleting` — true while delete is in flight
- `editable` — `isEditing && canManage` shorthand
- `canSave` — result of `canSaveCheck()`
- `startEdit / cancelEdit` — manual toggle
- `startSave / stopSave` — bracket an async save
- `startDelete / stopDelete` — bracket an async delete
- `setIsEditing` — escape hatch for complex reset flows

**File:** `src/subapps/master-data/hooks/use-entity-form.ts`

### Edit button pattern

```tsx
{mode === "EDIT" && canManage && !isEditing && (
  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
    <Edit3 /> Ubah
  </Button>
)}
```

### Save button pattern

```tsx
{editable && (
  <Button
    disabled={!canSave || isSaving}
    onClick={() => void save()}
    className={cn(
      "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
      UI_ENGINE_RADIUS_ACTION
    )}
  >
    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
    Simpan
  </Button>
)}
```

---

## 5. Design System Imports

All UI primitives **must** come from `@/ui_engine`. Never import directly from `@/components/ui/*` in subapp code, except:
- `alert-dialog` — not re-exported via `@/ui_engine`; use `DeleteConfirmDialog` wrapper instead

```tsx
// ✅ Correct
import { Button, Input, Label, Select, ... } from "@/ui_engine";

// ❌ Wrong
import { Button } from "@/components/ui/button";
```

CSS design tokens (margins, radii, typography) are also exported from `@/ui_engine`:
```tsx
import {
  UI_ENGINE_RADIUS_ACTION,   // rounded-* for interactive controls
  UI_ENGINE_RADIUS_CONTROL,  // rounded-* for inputs
  UI_ENGINE_TYPE_META,       // label / caption text
  UI_ENGINE_TYPE_BODY,       // body text
  UI_ENGINE_BG_SUBTLE,       // subtle background (used in ReadValue)
  UI_ENGINE_BORDER_SUBTLE,   // subtle border
} from "@/ui_engine";
```

---

## 6. Toast Strings

All toast messages use **Indonesian**:
- Create success: `toast.success("X ditambahkan")`
- Update success: `toast.success("X diperbarui")`
- Delete success: `toast.success("X dihapus")`
- Error: `toast.error(err.message ?? "X tidak dapat disimpan")`

---

## 7. Quick Reference — Which File to Edit

| Task | File |
|------|------|
| Add/modify a Brand form | `components/MasterDataBrandDialog.tsx` |
| Add/modify a SKU/Material form | `components/MasterDataProductDialog.tsx` |
| Add/modify a Party/Supplier form | `components/PartyDialog.tsx` |
| Change display-mode field look | `components/shared/ReadValue.tsx` |
| Change delete confirmation look | `components/shared/DeleteConfirmDialog.tsx` |
| Change edit/save/delete state logic | `hooks/use-entity-form.ts` |
| Add a quick-entry option picker | `hooks/use-quick-entry.ts` |
| Update Sheet vs Dialog rule | This file |
