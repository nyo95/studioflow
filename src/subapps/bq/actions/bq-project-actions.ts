"use server";

/**
 * BQ — server action untuk project dan struktur tiga lapis.
 *
 * ============================================================================
 * DUA ATURAN YANG DITEGAKKAN DI SETIAP AKSI TULIS
 * ============================================================================
 * 1. **Object terkunci tidak boleh disentuh.** Diperiksa `assertObjectEditable()`
 *    di server, bukan dengan menonaktifkan tombol. PRD BQ Bab "Menjalankan
 *    prototype": *"aksi lewat jalur lain ditolak dengan pesan
 *    `403 UNAUTHORIZED_ACTION`"* — menyembunyikan tombol saja bukan pengamanan,
 *    aturan yang sama dengan AGENTS.md §11.3 untuk status SKU.
 *
 * 2. **Snapshot dibekukan saat baris dibuat.** Aksi yang membuat baris L3
 *    membaca master data SEKALI, di sini, lalu menyalin nilainya ke kolom
 *    `snapshot_*`. Sesudah itu tidak ada jalur baca yang kembali ke master
 *    (PRD §5.4). Baris lama tetap lama; kalau material yang sama dipilih lagi
 *    nanti, snapshot barunya boleh berbeda.
 *
 * ============================================================================
 * MASTER DATA ADALAH SSOT
 * ============================================================================
 * Tidak ada aksi di berkas ini yang MENULIS ke `master_data`. Bahan atau jasa
 * yang belum ada di sana harus diminta ke staff lewat Master Data lebih dulu
 * (keputusan owner 2026-08-19). Yang boleh dilakukan estimator adalah
 * menyunting nilai SNAPSHOT di baris BQ-nya sendiri — suntingan itu ditandai
 * `is_manual_override` dan tidak pernah merambat balik.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { insertAuditLog } from "@/actions/_shared";
import {
  MAX_SECTION_DEPTH,
  sectionCodeForDepth,
} from "../lib/section-tree";
import type { PrismaTransaction } from "@/types/common";
import type { Role } from "@/generated/prisma";
import { loadMaterialCandidate, loadServiceCandidate } from "../services/master-data-service";

// ---------------------------------------------------------------------------
// Penjaga
// ---------------------------------------------------------------------------

function assertPerm(role: Role, permission: PERMISSION): void {
  if (!hasPermission(role, permission)) {
    throw new ActionError("You are not allowed to perform this action.", "UNAUTHORIZED_ACTION");
  }
}

/**
 * Object yang dikunci menolak SELURUH mutasi di bawahnya, termasuk lewat
 * sub-object dan baris L3 — karena itulah pengecekannya menaiki relasi, bukan
 * memeriksa baris yang disentuh saja. Mengunci object tapi masih bisa
 * mengubah harga sebuah baris di dalamnya membuat kunci itu tidak berarti apa
 * pun.
 */
async function assertObjectEditable(tx: PrismaTransaction, objectId: string): Promise<void> {
  const obj = await tx.bqObject.findFirst({
    where: { id: objectId, deleted_at: null },
    select: { locked_at: true },
  });
  if (!obj) throw new ActionError("This object no longer exists.", "NOT_FOUND");
  if (obj.locked_at) {
    throw new ActionError(
      "This object is locked. Unlock it before making changes.",
      "OBJECT_LOCKED"
    );
  }
}

async function assertSubObjectEditable(tx: PrismaTransaction, subObjectId: string): Promise<string> {
  const sub = await tx.bqSubObject.findUnique({
    where: { id: subObjectId },
    select: { object_id: true, object: { select: { locked_at: true, deleted_at: true } } },
  });
  if (!sub || sub.object.deleted_at) throw new ActionError("This sub-object no longer exists.", "NOT_FOUND");
  if (sub.object.locked_at) {
    throw new ActionError(
      "This object is locked. Unlock it before making changes.",
      "OBJECT_LOCKED"
    );
  }
  return sub.object_id;
}

/** `revalidatePath` untuk halaman project. Dikumpulkan di satu fungsi supaya
 *  tidak ada aksi yang lupa dan meninggalkan angka basi di layar. */
function revalidateProject(projectId: string): void {
  revalidatePath("/bq");
  revalidatePath(`/bq/${projectId}`);
}

async function projectIdOfObject(tx: PrismaTransaction, objectId: string): Promise<string> {
  const row = await tx.bqObject.findUnique({
    where: { id: objectId },
    select: { project_id: true },
  });
  if (!row) throw new ActionError("This object no longer exists.", "NOT_FOUND");
  return row.project_id;
}

async function projectIdOfSubObject(tx: PrismaTransaction, subObjectId: string): Promise<string> {
  const row = await tx.bqSubObject.findUnique({
    where: { id: subObjectId },
    select: { object: { select: { project_id: true } } },
  });
  if (!row) throw new ActionError("This sub-object no longer exists.", "NOT_FOUND");
  return row.object.project_id;
}

/**
 * Nomor urut berikutnya di dalam sebuah induk.
 *
 * `max + 1`, bukan `count`. `count` akan menabrakkan urutan segera setelah
 * satu baris di tengah dihapus — dua baris berbagi `sort_order` dan urutan
 * tampilnya jadi bergantung pada `created_at` yang jadi pemecah seri. Itu
 * berfungsi, tapi diam-diam mengabaikan urutan yang disusun estimator.
 */
async function nextSortOrder(
  current: { sort_order: number }[]
): Promise<number> {
  if (current.length === 0) return 0;
  return Math.max(...current.map((r) => r.sort_order)) + 1;
}

function resolveSelectedMaterialPrice(
  candidate: Awaited<ReturnType<typeof loadMaterialCandidate>>,
  skuPriceId: string
) {
  const selected = candidate?.priceOptions.find((option) => option.skuPriceId === skuPriceId) ?? null;
  if (!selected) {
    throw new ActionError(
      "That supplier price is no longer available in Master Data. Pick a current supplier price and try again.",
      "NOT_FOUND"
    );
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Skema masukan
// ---------------------------------------------------------------------------

/** Persentase diterima dari UI sebagai PERSEN (10 = 10%) dan disimpan sebagai
 *  FRAKSI (0.1). Konversinya terjadi tepat di sini supaya tidak ada tempat
 *  lain yang harus ingat membagi 100. */
const percentToFraction = z
  .number()
  .min(0, "Percentage cannot be negative.")
  .max(1000, "Percentage looks wrong.")
  .transform((v) => v / 100);

/** `null` berarti "tidak di-override" dan BERBEDA dari `0`, yang berarti
 *  "override ke nol dan menangkan atas seluruh default" (PRD §4.1, AT-04).
 *  `.nullable()` di sini bukan kelonggaran — ia bagian dari aturannya. */
const optionalPercent = percentToFraction.nullable();

const nonNegative = z.number().min(0, "This value cannot be negative.");
const positive = z.number().gt(0, "This value must be greater than zero.");

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const createBqProjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_PROJECT_MANAGE);

    const project = await tx.bqProject.create({
      data: {
        name: input.name.trim(),
        code: input.code?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by_id: ctx.userId,
        created_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "CREATE", "BqProject", project.id, ctx.userId, {
      // Sengaja `bq_project_id`, bukan `project_id`: `insertAuditLog`
      // menyimpulkan `AuditLog.project_id` dari kunci bernama `project_id`,
      // dan kolom itu FK ke `studioflow.Project` — sebuah id project BQ di
      // sana akan melanggar constraint.
      bq_project_id: project.id,
      name: project.name,
    });

    revalidatePath("/bq");
    return { id: project.id };
  },
  {
    schema: z.object({
      name: z.string().min(1, "Project name is required."),
      code: z.string().optional(),
      notes: z.string().optional(),
    }),
  }
);

export const updateBqProjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_PROJECT_MANAGE);

    await tx.bqProject.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "UPDATE", "BqProject", input.id, ctx.userId, {
      bq_project_id: input.id,
    });

    revalidateProject(input.id);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    }),
  }
);

/**
 * Soft delete. Object, sub-object, dan baris L3 di bawahnya TIDAK disentuh —
 * mereka tetap ada dan tetap membawa snapshot harganya.
 *
 * Alasannya sama dengan kenapa `SkuPrice` dipertahankan saat SKU dihapus
 * (AGENTS.md §3.7): yang dihapus adalah keberadaan project di daftar, bukan
 * bukti bagaimana angkanya pernah dihitung.
 */
export const deleteBqProjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_PROJECT_MANAGE);

    await tx.bqProject.update({
      where: { id: input.id },
      data: { deleted_at: new Date(), updated_by_name: ctx.user.name ?? null },
    });

    await insertAuditLog(tx, "DELETE", "BqProject", input.id, ctx.userId, {
      bq_project_id: input.id,
    });

    revalidatePath("/bq");
    return { id: input.id };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);


/**
 * Menentukan induk sebuah baris L3, dan memastikan induknya boleh disunting.
 *
 * Baris boleh menempel ke L1 (item sederhana) atau ke L2 (item komposit) —
 * tepat satu, tidak boleh dua, tidak boleh nol. Ditegakkan juga oleh CHECK
 * constraint di database; pemeriksaan di sini ada supaya pesannya bisa
 * dimengerti manusia, bukan berupa pelanggaran constraint.
 *
 * Mengembalikan potongan `data` yang siap disebar ke `create`, plus `where`
 * untuk mencari saudara sebaris saat menghitung `sort_order`.
 */
async function resolveLineParent(
  tx: PrismaTransaction,
  input: { objectId?: string; subObjectId?: string }
): Promise<{
  /** Salah satu terisi, satunya `undefined` — Prisma memperlakukan `undefined`
   *  sebagai "tidak disebut", jadi bentuk ini aman untuk `create` maupun
   *  `where` tanpa perlu union diskriminan yang menyulitkan tipe Prisma. */
  data: { object_id?: string; sub_object_id?: string };
  where: { object_id?: string; sub_object_id?: string };
  objectId: string;
}> {
  const hasObject = !!input.objectId;
  const hasSub = !!input.subObjectId;
  if (hasObject === hasSub) {
    throw new ActionError(
      "A line must belong to exactly one parent: a work item or a sub-item.",
      "VALIDATION_ERROR"
    );
  }

  if (hasSub) {
    const objectId = await assertSubObjectEditable(tx, input.subObjectId!);
    return {
      data: { sub_object_id: input.subObjectId! },
      where: { sub_object_id: input.subObjectId!, object_id: undefined },
      objectId,
    };
  }

  await assertObjectEditable(tx, input.objectId!);
  return {
    data: { object_id: input.objectId! },
    where: { object_id: input.objectId!, sub_object_id: undefined },
    objectId: input.objectId!,
  };
}

/**
 * Versi untuk baris yang SUDAH ada di database.
 *
 * Sesudah hirarki diluruskan, baris L3 bisa menempel langsung ke L1 atau tetap
 * lewat L2. Aksi edit/hapus tidak boleh lagi mengasumsikan `sub_object_id`
 * selalu ada.
 */
async function resolveStoredLineParent(
  tx: PrismaTransaction,
  input: { object_id: string | null; sub_object_id: string | null }
): Promise<{ objectId: string; subObjectId: string | null }> {
  if (input.sub_object_id) {
    const objectId = await assertSubObjectEditable(tx, input.sub_object_id);
    return { objectId, subObjectId: input.sub_object_id };
  }

  if (input.object_id) {
    await assertObjectEditable(tx, input.object_id);
    return { objectId: input.object_id, subObjectId: null };
  }

  throw new ActionError(
    "This line is missing its parent. Re-open the project and try again.",
    "VALIDATION_ERROR"
  );
}

/** Skema induk baris, dipakai keempat aksi tambah-baris. */
const lineParentSchema = {
  /** Isi SALAH SATU. objectId = baris menempel langsung ke item. */
  objectId: z.string().min(1).optional(),
  subObjectId: z.string().min(1).optional(),
};

// ---------------------------------------------------------------------------
// L0 — Section
// ---------------------------------------------------------------------------

/**
 * Kedalaman sebuah pengelompok: 0 untuk L0 Section, 1 untuk L1 Sub Section,
 * 2 untuk L2 Sub Section.
 *
 * Ditelusuri ke atas dengan loop BERBATAS, bukan rekursi terbuka: data yang
 * berputar tidak boleh berujung query tak berhingga di jalur tulis. Kalau
 * batasnya terlewat, angka yang dikembalikan sudah cukup besar untuk membuat
 * pemanggilnya menolak.
 */
async function sectionDepth(
  tx: PrismaTransaction,
  sectionId: string,
): Promise<number> {
  let depth = 0;
  let cursor: string | null = sectionId;

  for (let hop = 0; hop <= MAX_SECTION_DEPTH; hop += 1) {
    if (!cursor) return depth;
    const row: { parent_id: string | null } | null = await tx.bqSection.findUnique({
      where: { id: cursor },
      select: { parent_id: true },
    });
    if (!row?.parent_id) return depth;
    depth += 1;
    cursor = row.parent_id;
  }

  return depth;
}

export const createBqSectionAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    // L0 Section -> L1 Sub Section -> L2 Sub Section, lalu berhenti.
    //
    // Batasnya BUKAN teknis: `rollupSectionSubtotals` sanggup kedalaman berapa
    // pun dan ada testnya untuk empat lapis. Batasnya dokumenter — penomoran BQ
    // kantor cuma punya tiga bentuk (A/B/C, I/II/III, 1/2/3), dan lapis keempat
    // tidak punya bentuk cetak. Karena itu ditegakkan di jalur TULIS saja;
    // jalur baca tetap menampilkan apa pun yang terlanjur ada.
    let parentDepth = -1;
    if (input.parentId) {
      const parent = await tx.bqSection.findFirst({
        where: { id: input.parentId, project_id: input.projectId, deleted_at: null },
        select: { id: true },
      });
      if (!parent) throw new ActionError("Parent section not found.", "NOT_FOUND");

      parentDepth = await sectionDepth(tx, parent.id);
      if (parentDepth + 1 >= MAX_SECTION_DEPTH) {
        throw new ActionError(
          `Sections can only nest ${MAX_SECTION_DEPTH} levels deep.`,
          "VALIDATION_ERROR",
        );
      }

      const directObjects = await tx.bqObject.count({
        where: {
          project_id: input.projectId,
          section_id: input.parentId,
          deleted_at: null,
        },
      });
      if (directObjects > 0) {
        throw new ActionError(
          "This section already contains work items. Move them into divisions first, or keep this section flat.",
          "VALIDATION_ERROR",
        );
      }
    }

    const siblings = await tx.bqSection.findMany({
      where: {
        project_id: input.projectId,
        parent_id: input.parentId ?? null,
        deleted_at: null,
      },
      select: { sort_order: true },
    });

    // Kode diberi otomatis mengikuti kedalaman — A/B/C, I/II/III, lalu 1/2/3.
    // Lihat `lib/section-tree.ts`. Membiarkan pengguna mengetik sendiri membuka
    // pintu ke dua "B" dalam satu dokumen; `input.code` tetap boleh menimpanya
    // untuk kantor yang sengaja melompati nomor.
    const autoCode = sectionCodeForDepth(parentDepth + 1, siblings.length);

    const section = await tx.bqSection.create({
      data: {
        project_id: input.projectId,
        parent_id: input.parentId ?? null,
        code: input.code?.trim() || autoCode,
        name: input.name.trim(),
        sort_order: await nextSortOrder(siblings),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "CREATE", "BqSection", section.id, ctx.userId, {
      bq_project_id: input.projectId,
      name: section.name,
    });

    revalidateProject(input.projectId);
    return { id: section.id, code: section.code };
  },
  {
    schema: z.object({
      projectId: z.string().min(1),
      /** Kosong = seksi tingkat atas. Terisi = DIVISI di dalam seksi itu. */
      parentId: z.string().min(1).optional(),
      name: z.string().min(1, "Section name is required."),
      /** Kosong = diberi otomatis A/B/C (seksi) atau I/II/III (divisi). */
      code: z.string().optional(),
    }),
  }
);

export const updateBqSectionAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const section = await tx.bqSection.findFirst({
      where: { id: input.id, deleted_at: null },
      select: { project_id: true },
    });
    if (!section) throw new ActionError("Section not found.", "NOT_FOUND");

    await tx.bqSection.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim() || null } : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    revalidateProject(section.project_id);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
    }),
  }
);

/**
 * Menghapus seksi TIDAK menghapus pekerjaan di dalamnya.
 *
 * `onDelete: SetNull` di skema hanya bekerja pada hard delete, sedangkan di
 * sini seksinya di-soft delete. Tanpa melepas `section_id` secara eksplisit,
 * pekerjaannya akan tetap menunjuk seksi yang sudah tidak dimuat — dan lenyap
 * dari grid tanpa jejak, padahal datanya utuh. Melepasnya membuat pekerjaan itu
 * turun ke kelompok tanpa judul: tetap terlihat, tetap terhitung, tinggal
 * dipindahkan ke seksi lain.
 */
export const deleteBqSectionAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const section = await tx.bqSection.findFirst({
      where: { id: input.id, deleted_at: null },
      select: { project_id: true, name: true },
    });
    if (!section) throw new ActionError("Section not found.", "NOT_FOUND");

    // Divisi anak ikut terhapus lewat cascade, jadi pekerjaan DI DALAMNYA juga
    // harus dilepas — kalau tidak, ia lenyap bersama divisinya.
    const children = await tx.bqSection.findMany({
      where: { parent_id: input.id },
      select: { id: true },
    });
    const released = await tx.bqObject.updateMany({
      where: { section_id: { in: [input.id, ...children.map((c) => c.id)] } },
      data: { section_id: null },
    });

    await tx.bqSection.update({
      where: { id: input.id },
      data: { deleted_at: new Date(), updated_by_name: ctx.user.name ?? null },
    });

    await insertAuditLog(tx, "DELETE", "BqSection", input.id, ctx.userId, {
      bq_project_id: section.project_id,
      name: section.name,
      released_objects: released.count,
    });

    revalidateProject(section.project_id);
    return { id: input.id, releasedObjects: released.count };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

// ---------------------------------------------------------------------------
// L1 — Object
// ---------------------------------------------------------------------------

export const createBqObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    if (input.sectionId) {
      const section = await tx.bqSection.findFirst({
        where: {
          id: input.sectionId,
          project_id: input.projectId,
          deleted_at: null,
        },
        select: { id: true, parent_id: true },
      });
      if (!section) throw new ActionError("Section not found.", "NOT_FOUND");

      if (!section.parent_id) {
        const childDivisions = await tx.bqSection.count({
          where: {
            project_id: input.projectId,
            parent_id: section.id,
            deleted_at: null,
          },
        });
        if (childDivisions > 0) {
          throw new ActionError(
            "This section already uses divisions. Add the work item inside a division instead.",
            "VALIDATION_ERROR",
          );
        }
      }
    }

    const siblings = await tx.bqObject.findMany({
      where: { project_id: input.projectId, deleted_at: null },
      select: { sort_order: true },
    });

    const object = await tx.bqObject.create({
      data: {
        project_id: input.projectId,
        section_id: input.sectionId ?? null,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        qty: input.qty,
        unit: input.unit.trim() || "unit",
        sort_order: await nextSortOrder(siblings),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "CREATE", "BqObject", object.id, ctx.userId, {
      bq_project_id: input.projectId,
      name: object.name,
    });

    revalidateProject(input.projectId);
    return { id: object.id };
  },
  {
    schema: z.object({
      projectId: z.string().min(1),
      /** Seksi induk. Kosong = pekerjaan tanpa seksi, yang di grid muncul di
       *  kelompok tanpa judul paling bawah. */
      sectionId: z.string().min(1).optional(),
      name: z.string().min(1, "Object name is required."),
      code: z.string().optional(),
      qty: positive.default(1),
      unit: z.string().default("unit"),
    }),
  }
);

export const updateBqObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    await assertObjectEditable(tx, input.id);

    const projectId = await projectIdOfObject(tx, input.id);

    await tx.bqObject.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim() || null } : {}),
        ...(input.qty !== undefined ? { qty: input.qty } : {}),
        ...(input.unit !== undefined ? { unit: input.unit.trim() || "unit" } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        // `wasteOverridePct` sengaja dibedakan antara "tidak dikirim"
        // (`undefined`, jangan sentuh) dan "dikirim sebagai null" (hapus
        // override). Menyamakan keduanya membuat override tidak bisa dicabut.
        ...(input.wasteOverridePct !== undefined
          ? { waste_override_pct: input.wasteOverridePct }
          : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "UPDATE", "BqObject", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      qty: positive.optional(),
      unit: z.string().optional(),
      wasteOverridePct: optionalPercent.optional(),
      notes: z.string().optional(),
    }),
  }
);

export const setBqObjectLockAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const projectId = await projectIdOfObject(tx, input.id);

    await tx.bqObject.update({
      where: { id: input.id },
      data: input.locked
        ? { locked_at: new Date(), locked_by_name: ctx.user.name ?? null }
        : { locked_at: null, locked_by_name: null },
    });

    await insertAuditLog(tx, input.locked ? "LOCK" : "UNLOCK", "BqObject", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id, locked: input.locked };
  },
  {
    schema: z.object({ id: z.string().min(1), locked: z.boolean() }),
  }
);

export const deleteBqObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    await assertObjectEditable(tx, input.id);

    const projectId = await projectIdOfObject(tx, input.id);

    await tx.bqObject.update({
      where: { id: input.id },
      data: { deleted_at: new Date(), updated_by_name: ctx.user.name ?? null },
    });

    await insertAuditLog(tx, "DELETE", "BqObject", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

// ---------------------------------------------------------------------------
// L2 — Sub-object
// ---------------------------------------------------------------------------

export const createBqSubObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    await assertObjectEditable(tx, input.objectId);

    const siblings = await tx.bqSubObject.findMany({
      where: { object_id: input.objectId },
      select: { sort_order: true },
    });

    const sub = await tx.bqSubObject.create({
      data: {
        object_id: input.objectId,
        name: input.name.trim(),
        qty: input.qty,
        sort_order: await nextSortOrder(siblings),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    const projectId = await projectIdOfObject(tx, input.objectId);
    await insertAuditLog(tx, "CREATE", "BqSubObject", sub.id, ctx.userId, {
      bq_project_id: projectId,
      name: sub.name,
    });

    revalidateProject(projectId);
    return { id: sub.id };
  },
  {
    schema: z.object({
      objectId: z.string().min(1),
      name: z.string().min(1, "Sub-object name is required."),
      /** Pengali L2. Inilah kolom yang membuat alat ini lebih cepat dari
       *  Excel (PRD §2.1) — ubah dari 3 ke 5 dan seluruh bahan di bawahnya
       *  ikut, tanpa satu pun angka diketik ulang. */
      qty: positive.default(1),
    }),
  }
);

export const updateBqSubObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    await assertSubObjectEditable(tx, input.id);

    const projectId = await projectIdOfSubObject(tx, input.id);

    await tx.bqSubObject.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.qty !== undefined ? { qty: input.qty } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "UPDATE", "BqSubObject", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      qty: positive.optional(),
      notes: z.string().optional(),
    }),
  }
);

export const deleteBqSubObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    await assertSubObjectEditable(tx, input.id);

    const projectId = await projectIdOfSubObject(tx, input.id);

    // Hard delete: baris L3 di bawahnya ikut lewat `onDelete: Cascade`.
    // Berbeda dari project dan object yang soft-delete — sub-object tidak
    // membawa keputusan komersial apa pun sendiri, dan menyimpannya sebagai
    // tombstone hanya menambah baris yang harus difilter setiap query.
    await tx.bqSubObject.delete({ where: { id: input.id } });

    await insertAuditLog(tx, "DELETE", "BqSubObject", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

// ---------------------------------------------------------------------------
// Helper: copy-on-write detach dari template L2
// ---------------------------------------------------------------------------

/**
 * Saat sub-object adalah instance (⧉, `library_sub_object_id` tidak null),
 * setiap perubahan pada baris L3-nya — tambah, hapus, sunting qty/waste,
 * refresh/override snapshot — harus memutusnya dari template sehingga menjadi
 * standalone (◇).
 *
 * Baris TIDAK disalin ulang di sini: mereka sudah disalin saat link dibuat
 * (`loadFromLibrarySubObjectAction`). Yang dilakukan detach hanya menghapus
 * penunjuk ke template, supaya perubahan berikutnya tidak tampak sebagai
 * "perubahan instance dari template yang dibuat orang lain".
 *
 * Dipanggil sebelum mutasi baris apa pun. Kalau sub-object sudah standalone,
 * fungsi ini no-op dan langsung return null.
 */
async function detachFromTemplate(
  tx: PrismaTransaction,
  subObjectId: string,
  updatedByName: string | null = null
): Promise<string | null> {
  const sub = await tx.bqSubObject.findUnique({
    where: { id: subObjectId },
    select: { library_sub_object_id: true },
  });
  if (!sub?.library_sub_object_id) return null;

  await tx.bqSubObject.update({
    where: { id: subObjectId },
    data: { library_sub_object_id: null, updated_by_name: updatedByName },
  });
  return sub.library_sub_object_id;
}

// ---------------------------------------------------------------------------
// L3 — baris bahan
// ---------------------------------------------------------------------------

/**
 * Tambah baris bahan dari Master Data.
 *
 * `skuId` WAJIB. Tidak ada jalur untuk menambahkan bahan karangan: master data
 * adalah SSOT, dan bahan yang belum ada di sana diminta ke staff lewat Master
 * Data lebih dulu (keputusan owner 2026-08-19). Yang boleh disunting estimator
 * adalah nilai SNAPSHOT-nya sesudah baris dibuat — lihat
 * `overrideBqMaterialLineSnapshotAction`.
 *
 * `readiness` diperiksa ULANG di sini meskipun picker sudah menyaringnya.
 * Picker adalah UI; ini server. Sebuah SKU bisa kehilangan harganya di antara
 * daftar dimuat dan tombol ditekan.
 */
export const addBqMaterialLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    const parent = await resolveLineParent(tx, input);
    // Menambah baris memutus tautan ke template library (copy-on-write) —
    // hanya relevan untuk baris yang menempel di L2, karena tautan itu memang
    // milik L2.
    if (input.subObjectId) {
      await detachFromTemplate(tx, input.subObjectId, ctx.user.name ?? null);
    }

    const candidate = await loadMaterialCandidate(input.skuId);
    if (!candidate) {
      throw new ActionError("That material no longer exists in Master Data.", "NOT_FOUND");
    }
    if (!candidate.readiness.ok) {
      throw new ActionError(candidate.readiness.detail, candidate.readiness.reason);
    }

    const price = resolveSelectedMaterialPrice(candidate, input.skuPriceId);

    const siblings = await tx.bqMaterialLine.findMany({
      where: parent.where,
      select: { sort_order: true },
    });

    const line = await tx.bqMaterialLine.create({
      data: {
        ...parent.data,
        sku_id: candidate.skuId,
        sku_price_id: price.skuPriceId,
        supplier_party_id: price.supplierPartyId,
        qty_per_sub: input.qtyPerSub,
        waste_override_pct: input.wasteOverridePct ?? null,

        // --- snapshot, dibekukan di sini dan tidak pernah dibaca ulang -----
        snapshot_name: candidate.name,
        snapshot_code: candidate.code,
        snapshot_brand_name: candidate.brandName,
        snapshot_category_path: candidate.categoryPath,
        snapshot_supplier_name: price.supplierName,
        snapshot_usage_unit: price.unit,
        snapshot_purchase_unit: price.unit,
        snapshot_conversion: null,
        snapshot_price: price.price,
        snapshot_currency: price.currency,
        snapshot_material_default_waste_pct: null,
        snapshot_category_default_waste_pct: null,
        snapshot_minimum_order: null,
        snapshot_rounding_increment: 1,
        snapshot_taken_at: new Date(),

        sort_order: await nextSortOrder(siblings),
        notes: input.notes?.trim() || null,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    // `parent.objectId` sudah diketahui apa pun jalur induknya, jadi tidak
    // perlu menelusuri ulang dari sub-object yang mungkin memang tidak ada.
    const projectId = await projectIdOfObject(tx, parent.objectId);
    await insertAuditLog(tx, "CREATE", "BqMaterialLine", line.id, ctx.userId, {
      bq_project_id: projectId,
      sku_id: candidate.skuId,
    });

    revalidateProject(projectId);
    return { id: line.id };
  },
  {
    schema: z.object({
      ...lineParentSchema,
      skuId: z.string().min(1, "Pick a material from Master Data."),
      skuPriceId: z.string().min(1, "Pick a supplier price from Master Data."),
      /** Koefisien untuk SATU sub-object, dalam unit harga snapshot. */
      qtyPerSub: nonNegative,
      wasteOverridePct: optionalPercent.optional(),
      notes: z.string().optional(),
    }),
  }
);

export const addBqLocalMaterialLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    const parent = await resolveLineParent(tx, input);
    // Menambah baris memutus tautan ke template library (copy-on-write) —
    // hanya relevan untuk baris yang menempel di L2, karena tautan itu memang
    // milik L2.
    if (input.subObjectId) {
      await detachFromTemplate(tx, input.subObjectId, ctx.user.name ?? null);
    }

    const siblings = await tx.bqMaterialLine.findMany({
      where: parent.where,
      select: { sort_order: true },
    });
    const line = await tx.bqMaterialLine.create({
      data: {
        ...parent.data,
        source: "PROJECT_LOCAL",
        qty_per_sub: input.qtyPerSub,
        waste_override_pct: input.wasteOverridePct ?? null,
        snapshot_name: input.name.trim(),
        snapshot_code: input.code?.trim() || null,
        snapshot_brand_name: input.brandName?.trim() || null,
        snapshot_supplier_name: input.supplierName?.trim() || null,
        snapshot_usage_unit: input.purchaseUnit?.trim() || input.usageUnit?.trim() || null,
        snapshot_purchase_unit: input.purchaseUnit?.trim() || input.usageUnit?.trim() || null,
        snapshot_conversion: null,
        snapshot_price: input.price,
        snapshot_currency: input.currency.trim() || "IDR",
        snapshot_material_default_waste_pct: null,
        snapshot_category_default_waste_pct: null,
        snapshot_minimum_order: null,
        snapshot_rounding_increment: 1,
        snapshot_taken_at: new Date(),
        sort_order: await nextSortOrder(siblings),
        notes: input.notes?.trim() || null,
        updated_by_name: ctx.user.name ?? null,
      },
    });
    // `parent.objectId` sudah diketahui apa pun jalur induknya, jadi tidak
    // perlu menelusuri ulang dari sub-object yang mungkin memang tidak ada.
    const projectId = await projectIdOfObject(tx, parent.objectId);
    await insertAuditLog(tx, "CREATE", "BqMaterialLine", line.id, ctx.userId, {
      bq_project_id: projectId,
      source: "PROJECT_LOCAL",
    });
    revalidateProject(projectId);
    return { id: line.id };
  },
  {
    schema: z.object({
      ...lineParentSchema,
      name: z.string().min(1, "Material name is required."),
      code: z.string().optional(),
      brandName: z.string().optional(),
      supplierName: z.string().optional(),
      usageUnit: z.string().optional(),
      purchaseUnit: z.string().optional(),
      conversion: positive.nullable().default(null),
      price: nonNegative,
      currency: z.string().default("IDR"),
      qtyPerSub: nonNegative,
      wasteOverridePct: optionalPercent.optional(),
      defaultWastePct: optionalPercent.optional(),
      minimumOrder: nonNegative.nullable().optional(),
      roundingIncrement: positive.nullable().optional(),
      notes: z.string().optional(),
    }),
  }
);

export const updateBqMaterialLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const line = await tx.bqMaterialLine.findUnique({
      where: { id: input.id },
      select: { object_id: true, sub_object_id: true },
    });
    if (!line) throw new ActionError("This line no longer exists.", "NOT_FOUND");
    const parent = await resolveStoredLineParent(tx, line);
    if (parent.subObjectId) {
      await detachFromTemplate(tx, parent.subObjectId, ctx.user.name ?? null);
    }

    await tx.bqMaterialLine.update({
      where: { id: input.id },
      data: {
        ...(input.qtyPerSub !== undefined ? { qty_per_sub: input.qtyPerSub } : {}),
        ...(input.wasteOverridePct !== undefined
          ? { waste_override_pct: input.wasteOverridePct }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        ...(input.name !== undefined ? { snapshot_name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { snapshot_code: input.code.trim() || null } : {}),
        ...(input.usageUnit !== undefined ? { snapshot_usage_unit: input.usageUnit.trim() || null } : {}),
        ...(input.purchaseUnit !== undefined ? { snapshot_purchase_unit: input.purchaseUnit.trim() || null } : {}),
        ...(input.price !== undefined ? { snapshot_price: input.price, is_manual_override: true } : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    const projectId = await projectIdOfObject(tx, parent.objectId);
    revalidateProject(projectId);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      usageUnit: z.string().optional(),
      purchaseUnit: z.string().optional(),
      price: nonNegative.optional(),
      qtyPerSub: nonNegative.optional(),
      wasteOverridePct: optionalPercent.optional(),
      notes: z.string().optional(),
    }),
  }
);

/**
 * Sunting nilai snapshot sebuah baris DI DALAM BQ.
 *
 * Keputusan owner 2026-08-19: *"kalau mau diedit via BQ saja bisa — nanti jadi
 * snapshot saja levelnya, tiap project BQ punya snapshot sendiri."*
 *
 * Yang perlu dipegang: ini TIDAK pernah menulis ke `master_data`. Kalau harga
 * di master memang salah, yang benar adalah memperbaikinya di Master Data,
 * dan aksi ini bukan jalan pintasnya — ia untuk kasus di mana project INI
 * memang memakai angka yang berbeda (nego khusus, sisa stok, harga lama yang
 * disepakati).
 *
 * Baris yang di-override berhenti ikut deteksi drift: angkanya memang sengaja
 * berbeda dari master, dan melaporkannya sebagai "harga berubah" akan mengajak
 * orang membatalkan keputusannya sendiri setiap kali halaman dibuka.
 */
export const overrideBqMaterialLineSnapshotAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const line = await tx.bqMaterialLine.findUnique({
      where: { id: input.id },
      select: { object_id: true, sub_object_id: true },
    });
    if (!line) throw new ActionError("This line no longer exists.", "NOT_FOUND");
    const parent = await resolveStoredLineParent(tx, line);
    if (parent.subObjectId) {
      await detachFromTemplate(tx, parent.subObjectId, ctx.user.name ?? null);
    }

    await tx.bqMaterialLine.update({
      where: { id: input.id },
      data: {
        ...(input.price !== undefined ? { snapshot_price: input.price } : {}),
        ...(input.conversion !== undefined ? { snapshot_conversion: input.conversion } : {}),
        ...(input.purchaseUnit !== undefined
          ? { snapshot_purchase_unit: input.purchaseUnit.trim() }
          : {}),
        ...(input.usageUnit !== undefined ? { snapshot_usage_unit: input.usageUnit.trim() } : {}),
        ...(input.minimumOrder !== undefined ? { snapshot_minimum_order: input.minimumOrder } : {}),
        ...(input.roundingIncrement !== undefined
          ? { snapshot_rounding_increment: input.roundingIncrement }
          : {}),
        is_manual_override: true,
        override_note: input.overrideNote?.trim() || null,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    const projectId = await projectIdOfObject(tx, parent.objectId);
    await insertAuditLog(tx, "OVERRIDE", "BqMaterialLine", input.id, ctx.userId, {
      bq_project_id: projectId,
    });

    revalidateProject(projectId);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      price: nonNegative.optional(),
      conversion: positive.optional(),
      purchaseUnit: z.string().min(1).optional(),
      usageUnit: z.string().min(1).optional(),
      minimumOrder: nonNegative.nullable().optional(),
      roundingIncrement: positive.optional(),
      overrideNote: z.string().optional(),
    }),
  }
);

export const deleteBqMaterialLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const line = await tx.bqMaterialLine.findUnique({
      where: { id: input.id },
      select: { object_id: true, sub_object_id: true },
    });
    if (!line) throw new ActionError("This line no longer exists.", "NOT_FOUND");
    const parent = await resolveStoredLineParent(tx, line);
    if (parent.subObjectId) {
      await detachFromTemplate(tx, parent.subObjectId, ctx.user.name ?? null);
    }

    const projectId = await projectIdOfObject(tx, parent.objectId);
    await tx.bqMaterialLine.delete({ where: { id: input.id } });

    revalidateProject(projectId);
    return { id: input.id };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

// ---------------------------------------------------------------------------
// L3 — baris jasa
// ---------------------------------------------------------------------------
// Perhatikan tidak ada satu pun field waste atau konversi di bawah ini. Itu
// bukan kelalaian — tabelnya memang tidak punya kolomnya (PRD §3.2, AT-07).
// ---------------------------------------------------------------------------

export const addBqServiceLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    const parent = await resolveLineParent(tx, input);
    // Menambah baris memutus tautan ke template library (copy-on-write) —
    // hanya relevan untuk baris yang menempel di L2, karena tautan itu memang
    // milik L2.
    if (input.subObjectId) {
      await detachFromTemplate(tx, input.subObjectId, ctx.user.name ?? null);
    }

    const candidate = await loadServiceCandidate(input.workPriceId);
    if (!candidate) {
      throw new ActionError("That service no longer exists in Master Data.", "NOT_FOUND");
    }

    const siblings = await tx.bqServiceLine.findMany({
      where: parent.where,
      select: { sort_order: true },
    });

    const line = await tx.bqServiceLine.create({
      data: {
        ...parent.data,
        work_price_id: candidate.workPriceId,
        vendor_party_id: candidate.vendorPartyId,
        qty_per_sub: input.qtyPerSub,
        snapshot_name: candidate.name,
        snapshot_code: candidate.code,
        snapshot_category_path: candidate.categoryPath,
        snapshot_vendor_name: candidate.vendorName,
        snapshot_rate_unit: candidate.rateUnit,
        snapshot_price: candidate.price,
        snapshot_currency: candidate.currency,
        snapshot_scope_note: candidate.scopeNote,
        snapshot_has_material: candidate.hasMaterial,
        snapshot_taken_at: new Date(),
        sort_order: await nextSortOrder(siblings),
        notes: input.notes?.trim() || null,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    // `parent.objectId` sudah diketahui apa pun jalur induknya, jadi tidak
    // perlu menelusuri ulang dari sub-object yang mungkin memang tidak ada.
    const projectId = await projectIdOfObject(tx, parent.objectId);
    await insertAuditLog(tx, "CREATE", "BqServiceLine", line.id, ctx.userId, {
      bq_project_id: projectId,
      work_price_id: candidate.workPriceId,
    });

    revalidateProject(projectId);
    return { id: line.id };
  },
  {
    schema: z.object({
      ...lineParentSchema,
      workPriceId: z.string().min(1, "Pick a service from Master Data."),
      qtyPerSub: nonNegative,
      notes: z.string().optional(),
    }),
  }
);

export const addBqLocalServiceLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);
    const parent = await resolveLineParent(tx, input);
    // Menambah baris memutus tautan ke template library (copy-on-write) —
    // hanya relevan untuk baris yang menempel di L2, karena tautan itu memang
    // milik L2.
    if (input.subObjectId) {
      await detachFromTemplate(tx, input.subObjectId, ctx.user.name ?? null);
    }

    const siblings = await tx.bqServiceLine.findMany({
      where: parent.where,
      select: { sort_order: true },
    });
    const line = await tx.bqServiceLine.create({
      data: {
        ...parent.data,
        source: "PROJECT_LOCAL",
        work_price_id: null,
        vendor_party_id: null,
        qty_per_sub: input.qtyPerSub,
        snapshot_name: input.name.trim(),
        snapshot_code: input.code?.trim() || null,
        snapshot_vendor_name: input.vendorName?.trim() || null,
        snapshot_rate_unit: input.rateUnit.trim(),
        snapshot_price: input.price,
        snapshot_currency: input.currency.trim() || "IDR",
        snapshot_scope_note: input.scopeNote?.trim() || null,
        snapshot_has_material: input.hasMaterial,
        snapshot_taken_at: new Date(),
        sort_order: await nextSortOrder(siblings),
        notes: input.notes?.trim() || null,
        updated_by_name: ctx.user.name ?? null,
      },
    });
    // `parent.objectId` sudah diketahui apa pun jalur induknya, jadi tidak
    // perlu menelusuri ulang dari sub-object yang mungkin memang tidak ada.
    const projectId = await projectIdOfObject(tx, parent.objectId);
    await insertAuditLog(tx, "CREATE", "BqServiceLine", line.id, ctx.userId, {
      bq_project_id: projectId,
      source: "PROJECT_LOCAL",
    });
    revalidateProject(projectId);
    return { id: line.id };
  },
  {
    schema: z.object({
      ...lineParentSchema,
      name: z.string().min(1, "Service name is required."),
      code: z.string().optional(),
      vendorName: z.string().optional(),
      rateUnit: z.string().min(1, "Rate unit is required."),
      price: nonNegative,
      currency: z.string().default("IDR"),
      qtyPerSub: nonNegative,
      hasMaterial: z.boolean().default(false),
      scopeNote: z.string().optional(),
      notes: z.string().optional(),
    }),
  }
);

export const updateBqServiceLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const line = await tx.bqServiceLine.findUnique({
      where: { id: input.id },
      select: { object_id: true, sub_object_id: true },
    });
    if (!line) throw new ActionError("This line no longer exists.", "NOT_FOUND");
    const parent = await resolveStoredLineParent(tx, line);
    if (parent.subObjectId) {
      await detachFromTemplate(tx, parent.subObjectId, ctx.user.name ?? null);
    }

    await tx.bqServiceLine.update({
      where: { id: input.id },
      data: {
        ...(input.qtyPerSub !== undefined ? { qty_per_sub: input.qtyPerSub } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        ...(input.name !== undefined ? { snapshot_name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { snapshot_code: input.code.trim() || null } : {}),
        ...(input.rateUnit !== undefined ? { snapshot_rate_unit: input.rateUnit.trim() } : {}),
        ...(input.price !== undefined
          ? { snapshot_price: input.price, is_manual_override: true }
          : {}),
        ...(input.overrideNote !== undefined
          ? { override_note: input.overrideNote.trim() || null }
          : {}),
        updated_by_name: ctx.user.name ?? null,
      },
    });

    const projectId = await projectIdOfObject(tx, parent.objectId);
    revalidateProject(projectId);
    return { id: input.id };
  },
  {
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      rateUnit: z.string().min(1).optional(),
      qtyPerSub: nonNegative.optional(),
      price: nonNegative.optional(),
      overrideNote: z.string().optional(),
      notes: z.string().optional(),
    }),
  }
);

export const deleteBqServiceLineAction = createAction(
  async ({ input, ctx, tx }) => {
    assertPerm(ctx.role, PERMISSION.BQ_BREAKDOWN_EDIT);

    const line = await tx.bqServiceLine.findUnique({
      where: { id: input.id },
      select: { object_id: true, sub_object_id: true },
    });
    if (!line) throw new ActionError("This line no longer exists.", "NOT_FOUND");
    const parent = await resolveStoredLineParent(tx, line);
    if (parent.subObjectId) {
      await detachFromTemplate(tx, parent.subObjectId, ctx.user.name ?? null);
    }

    const projectId = await projectIdOfObject(tx, parent.objectId);
    await tx.bqServiceLine.delete({ where: { id: input.id } });

    revalidateProject(projectId);
    return { id: input.id };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);
