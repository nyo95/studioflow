"use server";

/**
 * BQ — membangun kerangka project dari template standar kantor.
 *
 * ============================================================================
 * APA YANG DITUANG, DAN APA YANG TIDAK
 * ============================================================================
 * Aksi ini menuang KERANGKA saja:
 *
 *   seksi A/B/C            -> BqSection (parent NULL)   pengelompok
 *   divisi I/II/III        -> BqSection (parent terisi) pengelompok
 *   item                   -> TIDAK dibuat. Ia jadi SARAN di baris divisi.
 *
 * Divisi tetap pengelompok BqSection (L1). Item yang punya satuan tidak dituang
 * otomatis; ia ditawarkan sebagai saran Works (L3), lalu baris pembentuknya
 * menjadi Sub-Works (L4) hanya ketika estimator memilih saran itu.
 *
 * ============================================================================
 * KENAPA ITEM TIDAK IKUT DIBUAT
 * ============================================================================
 * Versi pertama aksi ini menuang seluruh 97 item sekaligus, dan hasilnya salah
 * arah: BQ baru langsung berisi 97 sub-pekerjaan bernilai Rp 0 — Security,
 * Insurance, Fire Retardant — yang mayoritasnya tidak ada di project itu.
 * Estimator jadi harus MENGHAPUS, dan menghapus lebih berisiko daripada
 * menambah: satu baris yang lupa dibuang tetap tercetak ke penawaran sebagai
 * pekerjaan bernilai nol.
 *
 * Sekarang template cuma TAHU isinya. "Preliminaries" tahu bahwa penyusunnya
 * bisa Mobilization, Electrical & Water Supply, Loading/Unloading dan
 * seterusnya, lalu menawarkannya sebagai chip di baris pekerjaan itu. Yang
 * tidak diklik tidak pernah ada. Lihat `lib/bq-template-lookup.ts` untuk cara
 * pekerjaan dicocokkan dengan grup templatenya.
 *
 * Baris L4 dari template SELALU `PROJECT_LOCAL` dengan harga 0, tidak peduli
 * kategorinya. Alasannya bukan kemalasan: template menyebut "Material HT"
 * tanpa menunjuk SKU tertentu, dan menebak SKU mana yang dimaksud adalah cara
 * tercepat memasukkan harga yang salah ke penawaran. Estimator mengganti baris
 * itu dengan bahan dari Master Data saat ia tahu HT mana yang dipakai —
 * atau mengetik harganya sendiri kalau memang tidak ada di Master Data
 * (ALAT / BIAYA_UMUM / TRANSPORT_AKOMODASI memang begitu adanya).
 *
 * Konsekuensinya disengaja: BQ hasil template bernilai Rp 0 sampai estimator
 * mengisinya. Itu jujur — kerangka kosong memang belum punya harga. Yang
 * berbahaya adalah kerangka yang tampak sudah berharga padahal angkanya
 * karangan.
 *
 * ============================================================================
 * KENAPA BARIS L4 DIBUAT SEBAGAI JASA
 * ============================================================================
 * `BqMaterialLine` menuntut kolom snapshot bahan (unit beli, konversi, waste)
 * yang tidak ada di template. `BqServiceLine` cuma butuh nama, satuan, dan
 * harga — cukup untuk menampung baris kerangka apa pun. Kategori aslinya tetap
 * tersimpan di `cost_category`, jadi tidak ada informasi yang hilang: baris
 * ber-kategori MATERIAL tetap terbaca sebagai material di rekap, dan estimator
 * menggantinya dengan baris bahan sungguhan saat SKU-nya sudah pasti.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { insertAuditLog } from "@/actions/_shared";
import {
  BQ_TEMPLATE_SECTIONS,
  BQ_TEMPLATE_SUMMARY,
  type BqTemplateCategory,
} from "../lib/bq-template-data";
import {
  displayName,
  findTemplateItem,
  getTemplateItemByKey,
} from "../lib/bq-template-lookup";

/** Kategori yang memang tidak punya padanan di Master Data. */
const NON_MASTER: ReadonlySet<BqTemplateCategory> = new Set([
  "ALAT",
  "BIAYA_UMUM",
  "TRANSPORT_AKOMODASI",
]);

export const applyBqTemplateAction = createAction(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT)) {
      throw new ActionError(
        "You are not allowed to perform this action.",
        "UNAUTHORIZED_ACTION",
      );
    }

    const project = await tx.bqProject.findFirst({
      where: { id: input.projectId, deleted_at: null },
      select: { id: true },
    });
    if (!project) throw new ActionError("BQ project not found.", "NOT_FOUND");

    // Template hanya boleh dituang ke project yang MASIH KOSONG. Menuang ke
    // project berisi akan menggandakan seksi dan membuat penomoran A/B/C
    // muncul dua kali — dan tidak ada cara aman menebak mana yang mau dibuang.
    const existing = await tx.bqObject.count({
      where: { project_id: input.projectId, deleted_at: null },
    });
    if (existing > 0) {
      throw new ActionError(
        "This BQ already has work items. The template can only be applied to an empty BQ.",
        "VALIDATION_ERROR",
      );
    }

    const author = ctx.user.name ?? null;

    let sectionOrder = 0;
    let divisionOrder = 0;
    const counts = { sections: 0, divisions: 0 };

    for (const section of BQ_TEMPLATE_SECTIONS) {
      const createdSection = await tx.bqSection.create({
        data: {
          project_id: input.projectId,
          code: section.code,
          name: section.name,
          sort_order: sectionOrder++,
          updated_by_name: author,
        },
      });
      counts.sections++;

      // Seksi yang di dokumen tidak punya divisi (PRELIMINARIES) memakai grup
      // implisit bernama sama — itu tidak dibuat sebagai divisi, karena
      // "A PRELIMINARIES > Preliminaries" adalah judul yang sama dua kali.
      // Itemnya menggantung langsung di seksi.
      for (const group of section.groups) {
        const isImplicit =
          group.code === null ||
          group.name.trim().toLowerCase() === section.name.trim().toLowerCase();
        if (isImplicit) continue;

        await tx.bqSection.create({
          data: {
            project_id: input.projectId,
            parent_id: createdSection.id,
            code: group.code,
            name: group.name,
            sort_order: divisionOrder++,
            updated_by_name: author,
          },
        });
        counts.divisions++;
      }
    }

    await insertAuditLog(tx, "CREATE", "BqProject", input.projectId, ctx.userId, {
      action: "apply_template",
      ...counts,
    });

    revalidatePath(`/bq/${input.projectId}`);
    revalidatePath("/bq");

    return counts;
  },
  { schema: z.object({ projectId: z.string().min(1) }) },
);

/**
 * Menyisipkan SATU item template sebagai Works (L3), beserta pembentuknya.
 *
 * Inilah yang berjalan saat estimator mengklik chip saran di baris seksi atau
 * divisi. Item mewarisi SATUANNYA dari dokumen sumber (sqm / ls / nos) — itu
 * yang membuatnya bisa dicetak sebagai baris BQ yang sah.
 *
 * Pembentuknya menempel LANGSUNG sebagai Sub-Works (L4), tanpa lapis resep
 * tambahan. L2 adalah Sub Section pengelompok opsional, bukan bagian komposisi
 * Works.
 *
 * Baris dibuat sebagai jasa `PROJECT_LOCAL` berharga 0 — template menyebut
 * "Material HT" tanpa menunjuk SKU, dan menebak SKU mana yang dimaksud adalah
 * cara tercepat memasukkan harga salah ke penawaran.
 */
export const addTemplateItemAction = createAction(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT)) {
      throw new ActionError(
        "You are not allowed to perform this action.",
        "UNAUTHORIZED_ACTION",
      );
    }

    const section = await tx.bqSection.findFirst({
      where: { id: input.sectionId, deleted_at: null },
      select: { id: true, name: true, project_id: true },
    });
    if (!section) throw new ActionError("Section not found.", "NOT_FOUND");

    const item = input.templateKey
      ? getTemplateItemByKey(input.templateKey)
      : findTemplateItem(input.groupName ?? section.name, input.itemName);
    if (!item) throw new ActionError("That template item was not found.", "NOT_FOUND");

    const name = displayName(item);
    const author = ctx.user.name ?? null;

    // Klik ganda pada chip yang sama tidak boleh melahirkan dua baris kembar.
    const duplicate = await tx.bqObject.findFirst({
      where: {
        section_id: section.id,
        name,
        unit: item.unit,
        notes: item.spec,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ActionError(`"${name}" is already in this section.`, "VALIDATION_ERROR");
    }

    const siblings = await tx.bqObject.findMany({
      where: { project_id: section.project_id, deleted_at: null },
      select: { sort_order: true },
    });
    const nextOrder =
      siblings.reduce((max, o) => Math.max(max, o.sort_order), -1) + 1;

    const created = await tx.bqObject.create({
      data: {
        project_id: section.project_id,
        section_id: section.id,
        name,
        qty: 1,
        unit: item.unit,
        sort_order: nextOrder,
        notes: item.spec,
        updated_by_name: author,
      },
    });

    let lineOrder = 0;
    for (const line of item.lines) {
      await tx.bqServiceLine.create({
        data: {
          object_id: created.id,
          source: "PROJECT_LOCAL",
          cost_category: line.category,
          qty_per_sub: line.coef ?? 0,
          snapshot_name: line.name,
          snapshot_rate_unit: line.unit,
          snapshot_price: 0,
          snapshot_currency: "IDR",
          snapshot_scope_note: NON_MASTER.has(line.category)
            ? "Harga diisi per project — tidak ada di Master Data."
            : "Ganti dengan baris dari Master Data bila SKU sudah pasti.",
          sort_order: lineOrder++,
          updated_by_name: author,
        },
      });
    }

    await insertAuditLog(tx, "CREATE", "BqObject", created.id, ctx.userId, {
      bq_project_id: section.project_id,
      action: "add_template_item",
      name,
      unit: item.unit,
      lines: item.lines.length,
    });

    revalidatePath(`/bq/${section.project_id}`);
    return { id: created.id, name, lineCount: item.lines.length };
  },
  {
    schema: z.object({
      /** Seksi ATAU divisi tempat item ini ditaruh. */
      sectionId: z.string().min(1),
      /** Nama TAMPIL item (sudah termasuk awalan area, bila ada). */
      itemName: z.string().min(1),
      /** Identitas stabil item template, untuk nama yang bisa kembar. */
      templateKey: z.string().min(1).optional(),
      /** Grup asal item. Kosong = simpulkan dari nama seksi/divisi. */
      groupName: z.string().min(1).optional(),
    }),
  },
);

/** Ringkasan template untuk ditampilkan sebelum pengguna menuangnya. */
export const getBqTemplateSummaryAction = createAction(
  async () => BQ_TEMPLATE_SUMMARY,
  { schema: z.object({}) },
);
