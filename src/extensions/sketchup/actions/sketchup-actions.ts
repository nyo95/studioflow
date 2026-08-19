"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { createScheduleOption, updateScheduleOptionSnapshot } from "@/extensions/schedule/services/schedule-option-writer";
import { ScheduleSnapshotSchema, type ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { z } from "zod";
import { Prisma, ProductType } from "@/generated/prisma";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { ScheduleService } from "@/extensions/schedule/services/schedule-service";
import { requireSession } from "@/lib/auth";
import { resolveCategoryLabel, CANONICAL_CATEGORY_LABELS } from "@/extensions/schedule/lib/category-labels";
import { hasPermission, isAdminLevel, PERMISSION } from "@/core/rbac/rbac";
import { Role } from "@/generated/prisma";
import { LibraryItemStatus } from "@/extensions/library/types";
import type { PrismaTransaction } from "@/types/common";
import { LibraryService } from "@/extensions/library/services/library-service";
import type { ProductCatalogInput } from "@/extensions/library/types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";
import { planConvergenceHops } from "@/extensions/sketchup/lib/catalog-ownership";
// findNextFreeIncrement tersedia di @/extensions/sketchup/lib/template-slot-guard
// untuk dipakai saat R-SCHED-TPL-2e mengimplementasikan "cari slot bebas + buat entry baru".

// The catalog IS the Product Schedule, so its CRUD uses the schedule RBAC
// permissions (DIC/DRIC add & edit, DIC deletes, STAFF views, ADMIN all) —
// NOT an ADMIN-only gate. This is what lets designers use the web app without
// the SketchUp plugin (the plugin is a personal optimisation, not required).
function canSchedule(role: Role, permission: PERMISSION): boolean {
  return hasPermission(role, permission);
}
const NO_PERMISSION = "You don't have permission to do that in this schedule.";
const NOT_A_MEMBER = "View only — this schedule belongs to another designer's project.";

// Everyone with PLUGIN_SCHEDULE_VIEW may LOOK at any project's schedule, but
// mutations require project membership: ADMIN, or the project's assigned
// designer/drafter. This is what lets designers browse each other's schedules
// without being able to change them.
async function requireCatalogEditor(projectId: string, permission: PERMISSION) {
  const { role, userId } = await requireSession();
  if (!canSchedule(role, permission)) throw new Error(NO_PERMISSION);
  // Admin-level (ADMIN, DEVELOPER) edit any project's schedule; everyone else
  // must be the project's assigned designer/drafter. (This is the web Product
  // Schedule, not the SketchUp plugin — ADMIN is allowed here.)
  if (!isAdminLevel(role)) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { pic_designer_id: true, pic_drafter_id: true },
    });
    if (!project) throw new Error("Project was not found.");
    if (project.pic_designer_id !== userId && project.pic_drafter_id !== userId) {
      throw new Error(NOT_A_MEMBER);
    }
  }
  return { role, userId };
}

/**
 * Catalog architecture (current state):
 *
 * The Catalog Board IS the Product Schedule. The old table/board schedule UI
 * (ProjectScheduleMain + table/* + board/*) has been deleted — the route that
 * used to render it (/projects/[id]/extensions/product-catalog) now renders
 * CatalogBoard directly, and /sketchup/catalog redirects there.
 *
 * SketchUpMaterial/SketchupFFE are still technical staging records (geometry:
 * code, uuid, area, face_count, layers, parents), and ProjectScheduleEntry /
 * ProjectScheduleOption remain the actual project specification (snapshot).
 * The sync route (`src/app/api/sketchup/sync/route.ts`) now auto-links every
 * coded, unlinked material/fixture to a matching schedule entry the moment it
 * arrives from SketchUp (`autoLinkSyncedMaterial`/`autoLinkSyncedFixture`,
 * matched by normalised code + section) — creating the entry if none exists.
 * This means there is no more manual "push" step and no unlinked-duplicate
 * state for anything synced after this change; `scripts/backfill-catalog-links.mjs`
 * is a one-off, idempotent script to link pre-existing unlinked rows.
 *
 * Edits from the catalog card UI still write to BOTH the staging row (brand/
 * type/item_no/qty/unit/color_size/unit_cost/notes/image_url/catalog_fields)
 * and mirror into the linked entry's snapshot (`syncLinkedMaterialEntry`,
 * `syncFixtureEntry`) in the same call, so the two are always consistent as
 * long as edits go through these actions. `getProjectCatalogDocument` reads
 * with staging-first precedence, falling back to the snapshot.
 *
 * Deferred (not done): fully retiring SketchupMaterial's editable columns in
 * favour of the schedule entry/option as the sole write target (a schema-
 * level collapse), and porting Sample Request + Library product-picker
 * (previously only in the deleted table view) onto the card UI.
 */
const CATALOG_FIELD_KEYS = [
  "type",
  "brand",
  "item_no",
  "qty",
  "color",
  "size",
  "finish",
  "unit_cost",
  "location",
  "url",
  "notes",
] as const;

export type CatalogFieldKey = (typeof CATALOG_FIELD_KEYS)[number];

const CatalogFieldKeySchema = z.enum(CATALOG_FIELD_KEYS);
const CatalogFieldsSchema = z.array(CatalogFieldKeySchema).max(CATALOG_FIELD_KEYS.length);

// Stored per-card field lists may predate the Color/Size split (a single
// "color_size" key). Map that legacy key to the two new ones instead of
// discarding the whole preference.
function migrateLegacyFieldKeys(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const mapped: string[] = [];
  for (const key of value) {
    if (key === "color_size") mapped.push("color", "size");
    else if (typeof key === "string") mapped.push(key);
  }
  return mapped.filter((key) => (CATALOG_FIELD_KEYS as readonly string[]).includes(key));
}

const FFEMetaSchema = z.object({
  brand: z.string().optional().nullable(),
  product_name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  reference_url: z.string().optional().nullable(),
  location_notes: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  item_no: z.string().optional().nullable(),
  qty: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  color_size: z.string().optional().nullable(),
  unit_cost: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  // preprocess: legacy stored "color_size" field keys must not fail the whole
  // metadata parse — they map to the new "color"+"size" keys instead.
  catalog_fields: z.preprocess(migrateLegacyFieldKeys, CatalogFieldsSchema).optional().nullable(),
  linked_entry_id: z.string().uuid().optional().nullable(),
  definition_names: z.array(z.string()).optional().default([]),
  layers: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
});

const MaterialCodeActionSchema = z.object({
  projectId: z.string().uuid(),
  sketchupProjectId: z.string().uuid(),
});

const QueueMaterialMergeSchema = MaterialCodeActionSchema.extend({
  sourceMaterialId: z.string().uuid(),
  targetMaterialId: z.string().uuid(),
});

const SetMaterialReservedSchema = MaterialCodeActionSchema.extend({
  materialId: z.string().uuid(),
  isReserved: z.boolean(),
});

const NormalizeMaterialCodesSchema = MaterialCodeActionSchema.extend({
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]*$/),
  orderedMaterialIds: z.array(z.string().uuid()).min(1),
});

const MATERIAL_CODE_PATTERN = /^([A-Z][A-Z0-9]*)-(\d+)$/;

function parseMaterialCode(code: string) {
  const match = MATERIAL_CODE_PATTERN.exec(code.trim().toUpperCase());
  if (!match) return null;

  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) return null;

  return { prefix: match[1], number };
}

function getActionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function getNextMergeQueueOrder(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sketchupProjectId: string
) {
  const latest = await tx.sketchupMergeAction.aggregate({
    where: { sketchup_project_id: sketchupProjectId },
    _max: { queue_order: true },
  });

  return (latest._max.queue_order ?? 0) + 1;
}

async function assertNoPendingMergeActions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sketchupProjectId: string
) {
  const pending = await tx.sketchupMergeAction.findFirst({
    where: {
      sketchup_project_id: sketchupProjectId,
      executed_at: null,
    },
    select: { id: true },
  });

  if (pending) {
    throw new Error("Sync the pending material changes in SketchUp before creating another change.");
  }
}

// Add/delete on the web Catalog Board can shift the sort order of a category
// and (via ScheduleService.normalizeCodes) renumber the OTHER entries already
// in it — including ones linked to a SketchUp material/fixture. That renumber
// previously happened with no bridge-queue awareness at all: a plugin-side
// rename queued via Code Manager could be silently invalidated by an
// unrelated web-side add. Reusing the same pending-queue guard the Code
// Manager already uses closes that gap: while a rename is queued for this
// project's SketchUp model, web-side add/delete is blocked with a clear
// error instead of running underneath it. No-op for projects with no
// connected SketchUp model.
async function assertNoPendingSketchupQueueForProject(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  projectId: string
) {
  const sketchupProject = await tx.sketchupProject.findFirst({
    where: { project_id: projectId },
    select: { id: true },
  });
  if (!sketchupProject) return;
  await assertNoPendingMergeActions(tx, sketchupProject.id);
}

type NormalizableMaterial = { code: string; is_reserved: boolean };

type TempHopChange = { sourceCode: string; temporaryCode: string; targetCode: string };

// Pure: compute the gap-free renumbering for ONE prefix group, expressed as
// two-hop changes (source -> temporary -> target) so a rename can't collide
// with a code that hasn't been vacated yet. Reserved codes keep their exact
// number and are skipped in the target sequence. Returns { duplicate: true }
// when the group has repeated numbers and cannot be safely renumbered.
function planPrefixNormalization(
  prefix: string,
  orderedMaterials: NormalizableMaterial[]
): { duplicate: boolean; tempChanges: TempHopChange[] } {
  const parsedCodes = orderedMaterials.map((material) => parseMaterialCode(material.code));
  if (parsedCodes.some((parsed) => parsed === null)) {
    return { duplicate: true, tempChanges: [] };
  }

  const existingNumbers = parsedCodes.map((parsed) => parsed!.number);
  if (new Set(existingNumbers).size !== existingNumbers.length) {
    return { duplicate: true, tempChanges: [] };
  }

  const reservedNumbers = new Set(
    orderedMaterials
      .filter((material) => material.is_reserved)
      .map((material) => parseMaterialCode(material.code)!.number)
  );

  let nextNumber = 1;
  const changes = orderedMaterials.flatMap((material) => {
    if (material.is_reserved) return [];
    while (reservedNumbers.has(nextNumber)) nextNumber += 1;
    const targetCode = `${prefix}-${nextNumber}`;
    nextNumber += 1;
    return material.code === targetCode ? [] : [{ sourceCode: material.code, targetCode }];
  });

  if (changes.length === 0) return { duplicate: false, tempChanges: [] };

  const occupiedNumbers = new Set<number>([
    ...existingNumbers,
    ...changes.map((change) => parseMaterialCode(change.targetCode)!.number),
  ]);
  let temporaryNumber = Math.max(0, ...occupiedNumbers) + 1;
  const tempChanges = changes.map((change) => {
    while (occupiedNumbers.has(temporaryNumber)) temporaryNumber += 1;
    const temporaryCode = `${prefix}-${temporaryNumber}`;
    occupiedNumbers.add(temporaryNumber);
    temporaryNumber += 1;
    return { sourceCode: change.sourceCode, temporaryCode, targetCode: change.targetCode };
  });

  return { duplicate: false, tempChanges };
}

function tempChangesToRows(
  sketchupProjectId: string,
  tempChanges: TempHopChange[],
  nextQueueOrder: () => number
) {
  // All source -> temporary hops are queued before all temporary -> target
  // hops so that, at execution time, every original code is vacated before
  // any final target number is claimed.
  return [
    ...tempChanges.map((change) => ({
      sketchup_project_id: sketchupProjectId,
      source_code: change.sourceCode,
      target_code: change.temporaryCode,
      queue_order: nextQueueOrder(),
    })),
    ...tempChanges.map((change) => ({
      sketchup_project_id: sketchupProjectId,
      source_code: change.temporaryCode,
      target_code: change.targetCode,
      queue_order: nextQueueOrder(),
    })),
  ];
}

// Single-model per project, officially: getProjectCatalogDocument and other
// read paths key off `findFirst({ where: { project_id } })`, so a second
// SketchupProject row for the same project would silently become invisible
// to the Catalog Board rather than supported multi-model data. Until that
// read path is rebuilt for multiple models, block creating a second key
// instead of allowing an orphaned, inaccessible one — nothing existing is
// touched, this only stops a new ambiguous row from being added.
export async function generateApiKeyAction(projectId: string, sketchupModelName: string = "Main Design Model") {
  try {
    const { role } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const existing = await prisma.sketchupProject.findFirst({
      where: { project_id: projectId },
      select: { id: true },
    });
    if (existing) {
      return { error: "This project already has a SketchUp model connected. Only one model per project is currently supported — revoke the existing API key first if you need to reconnect." };
    }

    const randomString = crypto.randomBytes(16).toString("hex");
    const apiKey = `sf_sk_${randomString}`;

    await prisma.sketchupProject.create({
      data: {
        project_id: projectId,
        sketchup_model_name: sketchupModelName,
        api_key: apiKey,
      },
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[GENERATE_API_KEY_ERROR]", error);
    return { error: "Failed to generate API key." };
  }
}

export async function revokeApiKeyAction(sketchupProjectId: string, projectId: string) {
  try {
    const { role } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    const randomString = crypto.randomBytes(16).toString("hex");
    await prisma.sketchupProject.update({
      where: { id: sketchupProjectId, project_id: projectId },
      data: { api_key: `sf_sk_${randomString}` },
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[REVOKE_API_KEY_ERROR]", error);
    return { error: "Failed to revoke API key." };
  }
}

export async function queueMergeAction(sketchupProjectId: string, sourceCode: string, targetCode: string, projectId: string) {
  try {
    const { role } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    const latest = await prisma.sketchupMergeAction.aggregate({
      where: { sketchup_project_id: sketchupProjectId },
      _max: { queue_order: true },
    });

    await prisma.sketchupMergeAction.create({
      data: {
        sketchup_project_id: sketchupProjectId,
        source_code: sourceCode,
        target_code: targetCode,
        queue_order: (latest._max.queue_order ?? 0) + 1,
      },
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[QUEUE_MERGE_ERROR]", error);
    return { error: "Failed to queue merge action." };
  }
}

export async function queueSketchupMaterialMergeAction(input: {
  projectId: string;
  sketchupProjectId: string;
  sourceMaterialId: string;
  targetMaterialId: string;
}) {
  try {
    const data = QueueMaterialMergeSchema.parse(input);
    const { role, userId } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const sketchupProject = await tx.sketchupProject.findFirst({
        where: { id: data.sketchupProjectId, project_id: data.projectId },
        select: { id: true },
      });
      if (!sketchupProject) throw new Error("SketchUp model was not found for this project.");

      if (data.sourceMaterialId === data.targetMaterialId) {
        throw new Error("Choose two different materials to merge.");
      }

      await assertNoPendingMergeActions(tx, sketchupProject.id);

      const materials = await tx.sketchupMaterial.findMany({
        where: {
          sketchup_project_id: sketchupProject.id,
          id: { in: [data.sourceMaterialId, data.targetMaterialId] },
        },
        select: { id: true, code: true, is_reserved: true },
      });

      if (materials.length !== 2) throw new Error("One or both selected materials are no longer available.");

      const source = materials.find((material) => material.id === data.sourceMaterialId)!;
      const target = materials.find((material) => material.id === data.targetMaterialId)!;
      const sourceCode = parseMaterialCode(source.code);
      const targetCode = parseMaterialCode(target.code);

      if (!sourceCode || !targetCode) {
        throw new Error("Only materials with a valid code can be merged.");
      }
      if (sourceCode.prefix !== targetCode.prefix) {
        throw new Error("Materials can only be merged within the same code group.");
      }
      if (source.is_reserved) {
        throw new Error("Remove the reservation before merging this source material.");
      }

      const action = await tx.sketchupMergeAction.create({
        data: {
          sketchup_project_id: sketchupProject.id,
          source_code: source.code,
          target_code: target.code,
          queue_order: await getNextMergeQueueOrder(tx, sketchupProject.id),
        },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_QUEUE_MATERIAL_MERGE, "SketchupMaterial", source.id, userId, {
        project_id: data.projectId,
        sketchup_project_id: sketchupProject.id,
        source_code: source.code,
        target_code: target.code,
      });

      return action;
    });

    revalidatePath(`/projects/${data.projectId}/sketchup`);
    return { success: true, actionId: result.id };
  } catch (error) {
    console.error("[QUEUE_SKETCHUP_MATERIAL_MERGE_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to queue material merge.") };
  }
}

export async function setSketchupMaterialReservedAction(input: {
  projectId: string;
  sketchupProjectId: string;
  materialId: string;
  isReserved: boolean;
}) {
  try {
    const data = SetMaterialReservedSchema.parse(input);
    const { role, userId } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    await prisma.$transaction(async (tx) => {
      const material = await tx.sketchupMaterial.findFirst({
        where: {
          id: data.materialId,
          sketchup_project_id: data.sketchupProjectId,
          sketchup_project: { project_id: data.projectId },
        },
        select: { id: true, code: true },
      });
      if (!material) throw new Error("Material was not found for this SketchUp model.");
      if (!parseMaterialCode(material.code)) {
        throw new Error("Only materials with a valid code can be reserved.");
      }

      await tx.sketchupMaterial.update({
        where: { id: material.id },
        data: { is_reserved: data.isReserved },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_SET_MATERIAL_RESERVED, "SketchupMaterial", material.id, userId, {
        project_id: data.projectId,
        sketchup_project_id: data.sketchupProjectId,
        code: material.code,
        is_reserved: data.isReserved,
      });
    });

    revalidatePath(`/projects/${data.projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[SET_SKETCHUP_MATERIAL_RESERVED_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to update material reservation.") };
  }
}

export async function normalizeSketchupMaterialCodesAction(input: {
  projectId: string;
  sketchupProjectId: string;
  prefix: string;
  orderedMaterialIds: string[];
}) {
  try {
    const data = NormalizeMaterialCodesSchema.parse(input);
    const { role, userId } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const sketchupProject = await tx.sketchupProject.findFirst({
        where: { id: data.sketchupProjectId, project_id: data.projectId },
        select: { id: true },
      });
      if (!sketchupProject) throw new Error("SketchUp model was not found for this project.");

      await assertNoPendingMergeActions(tx, sketchupProject.id);

      const allMaterials = await tx.sketchupMaterial.findMany({
        where: { sketchup_project_id: sketchupProject.id },
        select: { id: true, code: true, is_reserved: true },
      });
      const groupMaterials = allMaterials.filter((material) => parseMaterialCode(material.code)?.prefix === data.prefix);
      const requestedIds = new Set(data.orderedMaterialIds);

      if (requestedIds.size !== data.orderedMaterialIds.length || requestedIds.size !== groupMaterials.length) {
        throw new Error("The code group changed. Refresh the page and try again.");
      }
      if (groupMaterials.some((material) => !requestedIds.has(material.id))) {
        throw new Error("All materials in this code group must stay in the normalization list.");
      }

      const materialById = new Map(groupMaterials.map((material) => [material.id, material]));
      const orderedMaterials = data.orderedMaterialIds.map((id) => materialById.get(id)!);

      const plan = planPrefixNormalization(
        data.prefix,
        orderedMaterials.map((material) => ({ code: material.code, is_reserved: material.is_reserved }))
      );
      if (plan.duplicate) {
        throw new Error("Duplicate material numbers must be resolved before normalizing this group.");
      }
      const temporaryChanges = plan.tempChanges;
      if (temporaryChanges.length === 0) return { queued: 0 };

      let queueOrder = await getNextMergeQueueOrder(tx, sketchupProject.id);
      const nextQueueOrder = () => queueOrder++;
      await tx.sketchupMergeAction.createMany({
        data: tempChangesToRows(sketchupProject.id, temporaryChanges, nextQueueOrder),
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_NORMALIZE_MATERIAL_CODES, "SketchupProject", sketchupProject.id, userId, {
        project_id: data.projectId,
        sketchup_project_id: sketchupProject.id,
        prefix: data.prefix,
        changed_codes: temporaryChanges.map(({ sourceCode, targetCode }) => ({ sourceCode, targetCode })),
        reserved_codes: orderedMaterials.filter((material) => material.is_reserved).map((material) => material.code),
      });

      return { queued: temporaryChanges.length * 2 };
    });

    revalidatePath(`/projects/${data.projectId}/sketchup`);
    return { success: true, queued: result.queued };
  } catch (error) {
    console.error("[NORMALIZE_SKETCHUP_MATERIAL_CODES_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to normalize material codes.") };
  }
}

// Bulk variant: renumber EVERY prefix group in one shot (gap-free, reserved
// codes fixed) instead of one category at a time. Ordering within each group
// is by current number ascending. Groups that can't be safely renumbered
// (duplicate numbers) are skipped and reported rather than aborting the whole
// operation. Same locking rule applies: blocked if there are pending changes.
export async function normalizeAllSketchupMaterialCodesAction(input: {
  projectId: string;
  sketchupProjectId: string;
}) {
  try {
    const data = MaterialCodeActionSchema.parse(input);
    const { role, userId } = await requireSession();
    if (role !== "DEVELOPER") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const sketchupProject = await tx.sketchupProject.findFirst({
        where: { id: data.sketchupProjectId, project_id: data.projectId },
        select: { id: true },
      });
      if (!sketchupProject) throw new Error("SketchUp model was not found for this project.");

      await assertNoPendingMergeActions(tx, sketchupProject.id);

      const allMaterials = await tx.sketchupMaterial.findMany({
        where: { sketchup_project_id: sketchupProject.id },
        select: { id: true, code: true, is_reserved: true },
      });

      // Group valid-coded materials by prefix, ordered by number ascending.
      const groups = new Map<string, { code: string; is_reserved: boolean; number: number }[]>();
      for (const material of allMaterials) {
        const parsed = parseMaterialCode(material.code);
        if (!parsed) continue;
        const bucket = groups.get(parsed.prefix) ?? [];
        bucket.push({ code: material.code, is_reserved: material.is_reserved, number: parsed.number });
        groups.set(parsed.prefix, bucket);
      }

      let queueOrder = await getNextMergeQueueOrder(tx, sketchupProject.id);
      const nextQueueOrder = () => queueOrder++;

      const rows: ReturnType<typeof tempChangesToRows> = [];
      const auditByPrefix: { prefix: string; changed_codes: { sourceCode: string; targetCode: string }[] }[] = [];
      const skippedPrefixes: string[] = [];

      for (const prefix of Array.from(groups.keys()).sort()) {
        const ordered = groups
          .get(prefix)!
          .sort((left, right) => left.number - right.number || left.code.localeCompare(right.code));

        const plan = planPrefixNormalization(
          prefix,
          ordered.map((material) => ({ code: material.code, is_reserved: material.is_reserved }))
        );
        if (plan.duplicate) {
          skippedPrefixes.push(prefix);
          continue;
        }
        if (plan.tempChanges.length === 0) continue;

        rows.push(...tempChangesToRows(sketchupProject.id, plan.tempChanges, nextQueueOrder));
        auditByPrefix.push({
          prefix,
          changed_codes: plan.tempChanges.map(({ sourceCode, targetCode }) => ({ sourceCode, targetCode })),
        });
      }

      if (rows.length > 0) {
        await tx.sketchupMergeAction.createMany({ data: rows });
        await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_NORMALIZE_MATERIAL_CODES, "SketchupProject", sketchupProject.id, userId, {
          project_id: data.projectId,
          sketchup_project_id: sketchupProject.id,
          bulk: true,
          groups: auditByPrefix,
          skipped_prefixes: skippedPrefixes,
        });
      }

      return { queued: rows.length, skipped: skippedPrefixes };
    });

    revalidatePath(`/projects/${data.projectId}/sketchup`);
    return { success: true, queued: result.queued, skipped: result.skipped };
  } catch (error) {
    console.error("[NORMALIZE_ALL_SKETCHUP_MATERIAL_CODES_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to normalize all material codes.") };
  }
}

// ── Catalog (card-style) export ────────────────────────────────────────────
// Richer per-item shape for the printable catalog layout. Everything is
// resolved from the linked schedule entry's final snapshot; missing values
// stay null so the print view can render an em dash.
export type CatalogItem = {
  id: string;
  source: "sketchup" | "schedule";
  entry_id: string | null;
  option_id: string | null;
  kind: "material" | "fixture";
  code: string;
  title: string;
  type_label: string | null;
  description: string | null;
  image_url: string | null;
  name: string | null;
  brand: string | null;
  item_no: string | null;
  qty: number | null;
  unit: string | null;
  color_size: string | null;
  color: string | null;
  pattern: string | null;
  size: string | null;
  finish: string | null;
  unit_cost: number | null;
  notes: string | null;
  location: string | null;
  url: string | null;
  catalog_fields: CatalogFieldKey[] | null;
};

export type CatalogCodeManagerItem = {
  entry_id: string;
  material_id: string | null;
  code: string;
  bridge_code: string | null;
  prefix: string;
  category: string;
  brand: string | null;
  type_label: string | null;
  is_reserved: boolean;
};

export type ProjectCatalogDocument = {
  materials: CatalogItem[];
  fixtures: CatalogItem[];
  code_manager_items: CatalogCodeManagerItem[];
  project_id: string;
  sketchup_project_id: string;
  pending_action_count: number;
};

function joinParts(parts: (string | null | undefined)[], sep = " "): string | null {
  const cleaned = parts
    .map((p) => (p ?? "").toString().trim())
    .filter((p) => p.length > 0 && !isPlaceholderish(p));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)).join(sep) : null;
}

function isPlaceholderish(value: string): boolean {
  return ["N/A", "PENDING", "DRAFT", "GENERIC", "CUSTOM", "-", "—", "[RESERVED]"].includes(
    value.trim().toUpperCase()
  );
}

function realStr(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed && !isPlaceholderish(trimmed) ? trimmed : null;
}

// Normalise a code to PREFIX-<increment without leading zeros> so "CT-01" and
// "CT-1" compare equal. Used to match SketchUp material codes (unpadded) with
// schedule entry codes (padded) that refer to the same logical item.
function normalizeCatalogCode(code: string): string {
  const match = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/.exec((code ?? "").trim());
  return match ? `${match[1].toUpperCase()}-${Number(match[2])}` : (code ?? "").trim().toUpperCase();
}
function catalogFieldsFromJson(value: unknown): CatalogFieldKey[] | null {
  const parsed = CatalogFieldsSchema.safeParse(migrateLegacyFieldKeys(value));
  return parsed.success ? parsed.data : null;
}

function selectedCatalogOption(entry: { active_index: number; options: { id: string; is_final: boolean; data_snapshot: unknown }[] }) {
  return entry.options.find((option) => option.is_final) ?? entry.options[entry.active_index] ?? entry.options[0] ?? null;
}

export async function getProjectCatalogDocument(projectId: string): Promise<ProjectCatalogDocument> {
  // generateApiKeyAction now blocks creating a second SketchupProject per
  // project, but this read path still only surfaces one — guard against any
  // pre-existing duplicate (created before that check existed) by picking
  // deterministically (oldest) and logging so it's discoverable, instead of
  // silently depending on whatever order the database happens to return.
  const sketchupProjectCount = await prisma.sketchupProject.count({ where: { project_id: projectId } });
  if (sketchupProjectCount > 1) {
    console.warn(`[CATALOG_DOCUMENT] Project ${projectId} has ${sketchupProjectCount} SketchupProject rows; only the oldest is shown. Multi-model is not yet supported end-to-end.`);
  }
  const [sketchupProject, scheduleEntries] = await Promise.all([
    prisma.sketchupProject.findFirst({
      where: { project_id: projectId },
      orderBy: { created_at: "asc" },
      include: {
        materials: true,
        ffes: true,
        merge_actions: {
          where: { executed_at: null },
          select: { id: true },
        },
      },
    }),
    prisma.projectScheduleEntry.findMany({
      where: { project_id: projectId },
      include: { options: { orderBy: { option_label: "asc" } } },
      orderBy: [{ section: "asc" }, { schedule_sort_order: "asc" }],
    }),
  ]);

  const entryMapById = new Map<string, (typeof scheduleEntries)[number]>();
  const entryMapByCode = new Map<string, (typeof scheduleEntries)[number]>();
  for (const entry of scheduleEntries) {
    entryMapById.set(entry.id, entry);
    const padded = `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(2, "0")}`;
    const unpadded = `${entry.schedule_prefix}-${entry.schedule_increment}`;
    entryMapByCode.set(padded.toUpperCase(), entry);
    entryMapByCode.set(unpadded.toUpperCase(), entry);
  }

  const representedEntryIds = new Set<string>();
  const materials: CatalogItem[] = (sketchupProject?.materials ?? []).map((mat) => {
    const entry = mat.linked_entry_id ? entryMapById.get(mat.linked_entry_id) : undefined;
    if (entry) representedEntryIds.add(entry.id);
    const option = entry ? selectedCatalogOption(entry) : null;
    const parsed = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
    const snapshot = parsed.success ? parsed.data : null;
    const displayCode = entry
      ? normalizeCatalogCode(`${entry.schedule_prefix}-${entry.schedule_increment}`)
      : normalizeCatalogCode(mat.code);
    const categoryLabel = resolveCategoryLabel(
      entry?.schedule_prefix ?? mat.code.split("-")[0],
      entry?.schedule_category ?? null
    );
    const name = snapshot ? realStr(snapshot.catalog_product_name) : null;

    // SNAPSHOT-FIRST. The Product Schedule owns catalog content, so its
    // snapshot is read first and the dormant staging columns are only a
    // fallback for rows not yet migrated by
    // scripts/backfill-catalog-snapshots.mjs. This is the inverse of the old
    // precedence: with staging first, clearing a field on the card (which now
    // only writes the snapshot) would appear to do nothing because the stale
    // staging value kept winning the read.
    const snapshotColorSize = snapshot
      ? joinParts([snapshot.specs.catalog_color, snapshot.specs.catalog_dimensions], " / ")
      : null;
    const colorSize = snapshotColorSize ?? realStr(mat.color_size);
    const snapshotFields = snapshot
      ? catalogFieldsFromJson((snapshot.specs.catalog_metadata as Record<string, unknown> | undefined)?.catalog_fields)
      : null;

    return {
      id: mat.id,
      source: "sketchup" as const,
      entry_id: entry?.id ?? null,
      option_id: option?.id ?? null,
      kind: "material" as const,
      code: displayCode,
      title: name || categoryLabel || displayCode,
      type_label: (snapshot ? realStr(snapshot.catalog_sub_category) : null) || realStr(mat.type) || categoryLabel || null,
      description: snapshot
        ? joinParts([snapshot.catalog_sub_category, snapshot.specs.catalog_finishing, snapshot.specs.catalog_motif], " · ")
        : joinParts([mat.type, mat.finish], " · "),
      image_url: (snapshot ? realStr(snapshot.catalog_image_url) : null) || realStr(mat.image_url) || null,
      name,
      brand: (snapshot ? realStr(snapshot.catalog_brand) : null) || realStr(mat.brand),
      item_no: (snapshot ? realStr(snapshot.specs.catalog_sku) : null) || realStr(mat.item_no),
      qty: entry?.schedule_qty ?? mat.qty ?? null,
      unit: entry?.schedule_unit || realStr(mat.unit) || null,
      color_size: colorSize,
      color: realStr(splitColorSize(colorSize).color),
      pattern: snapshot ? realStr(snapshot.specs.catalog_motif) : null,
      size: realStr(splitColorSize(colorSize).dimensions),
      finish: (snapshot ? realStr(snapshot.specs.catalog_finishing) : null) || realStr(mat.finish),
      unit_cost: snapshot?.catalog_price ?? mat.unit_cost ?? null,
      notes: (snapshot ? realStr(snapshot.catalog_notes) : null) || realStr(mat.notes) || null,
      location: entry?.schedule_location || realStr(mat.location_notes) || null,
      url: (snapshot ? realStr(snapshot.catalog_reference_url) || realStr(snapshot.specs.catalog_reference_url) : null) || realStr(mat.reference_url),
      catalog_fields: snapshotFields ?? catalogFieldsFromJson(mat.catalog_fields),
    };
  });

  const fixtures: CatalogItem[] = (sketchupProject?.ffes ?? []).map((ffe) => {
    const parsedMeta = FFEMetaSchema.safeParse(ffe.metadata);
    const meta = parsedMeta.success ? parsedMeta.data : null;
    // Identity before code: the stored link survives a code divergence, so a
    // fixture mid-convergence still resolves to its own entry instead of
    // whatever entry happens to sit at its current code.
    const entry =
      (meta?.linked_entry_id ? entryMapById.get(meta.linked_entry_id) : undefined) ??
      entryMapByCode.get(ffe.code.toUpperCase());
    if (entry) representedEntryIds.add(entry.id);
    const option = entry ? selectedCatalogOption(entry) : null;
    const parsed = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
    const snapshot = parsed.success ? parsed.data : null;
    const categoryLabel = resolveCategoryLabel(ffe.code.split("-")[0], entry?.schedule_category ?? meta?.category ?? null);
    const name = (snapshot ? realStr(snapshot.catalog_product_name) : null) || realStr(meta?.product_name);

    // Snapshot-first, dormant metadata as fallback — see the material branch.
    const snapshotColorSize = snapshot
      ? joinParts([snapshot.specs.catalog_color, snapshot.specs.catalog_dimensions], " / ")
      : null;
    const colorSize = snapshotColorSize ?? realStr(meta?.color_size);
    const snapshotFields = snapshot
      ? catalogFieldsFromJson((snapshot.specs.catalog_metadata as Record<string, unknown> | undefined)?.catalog_fields)
      : null;

    return {
      id: ffe.id,
      source: "sketchup" as const,
      entry_id: entry?.id ?? null,
      option_id: option?.id ?? null,
      kind: "fixture" as const,
      code: ffe.code,
      title: name || categoryLabel || ffe.code,
      type_label: (snapshot ? realStr(snapshot.catalog_sub_category) : null) || realStr(meta?.type) || categoryLabel || null,
      description: snapshot
        ? joinParts([snapshot.catalog_sub_category, snapshot.specs.catalog_finishing, snapshot.specs.catalog_motif], " · ")
        : realStr(meta?.type),
      image_url: (snapshot ? realStr(snapshot.catalog_image_url) : null) || realStr(meta?.image_url) || null,
      name,
      brand: (snapshot ? realStr(snapshot.catalog_brand) : null) || realStr(meta?.brand),
      item_no: (snapshot ? realStr(snapshot.specs.catalog_sku) : null) || realStr(meta?.item_no),
      qty: entry?.schedule_qty ?? meta?.qty ?? ffe.instance_count ?? null,
      unit: entry?.schedule_unit || realStr(meta?.unit) || "pcs",
      color_size: colorSize,
      color: realStr(splitColorSize(colorSize).color),
      pattern: snapshot ? realStr(snapshot.specs.catalog_motif) : null,
      size: realStr(splitColorSize(colorSize).dimensions),
      finish: (snapshot ? realStr(snapshot.specs.catalog_finishing) : null) || realStr(meta?.finish),
      unit_cost: snapshot?.catalog_price ?? meta?.unit_cost ?? null,
      notes: (snapshot ? realStr(snapshot.catalog_notes) : null) || realStr(meta?.notes) || null,
      location: entry?.schedule_location || realStr(meta?.location_notes) || null,
      url: (snapshot ? realStr(snapshot.catalog_reference_url) || realStr(snapshot.specs.catalog_reference_url) : null) || realStr(meta?.reference_url),
      catalog_fields: snapshotFields ?? catalogFieldsFromJson(meta?.catalog_fields),
    };
  });

  for (const entry of scheduleEntries) {
    if (representedEntryIds.has(entry.id)) continue;
    const option = selectedCatalogOption(entry);
    const parsed = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
    if (!parsed.success) continue;
    const snapshot = parsed.data;
    // Display codes follow the SketchUp plugin convention: PREFIX-NUMBER,
    // unpadded (e.g. "CT-2", not "CT-02").
    const code = `${entry.schedule_prefix.toUpperCase()}-${entry.schedule_increment}`;
    const categoryLabel = resolveCategoryLabel(entry.schedule_prefix, entry.schedule_category);
    const name = realStr(snapshot.catalog_product_name);
    const metadata = snapshot.specs.catalog_metadata as Record<string, unknown> | undefined;
    const item: CatalogItem = {
      id: entry.id,
      source: "schedule",
      entry_id: entry.id,
      option_id: option?.id ?? null,
      kind: entry.section === ProductType.fixture ? "fixture" : "material",
      code,
      title: name || categoryLabel || code,
      type_label: realStr(snapshot.catalog_sub_category) || categoryLabel || null,
      description: joinParts([snapshot.catalog_sub_category, snapshot.specs.catalog_finishing, snapshot.specs.catalog_motif], " · "),
      image_url: snapshot.catalog_image_url || null,
      name,
      brand: realStr(snapshot.catalog_brand),
      item_no: realStr(snapshot.specs.catalog_sku) || code,
      qty: entry.schedule_qty ?? null,
      unit: entry.schedule_unit ?? null,
      color_size: joinParts([snapshot.specs.catalog_color, snapshot.specs.catalog_dimensions], " / "),
      color: realStr(snapshot.specs.catalog_color),
      pattern: realStr(snapshot.specs.catalog_motif),
      size: realStr(snapshot.specs.catalog_dimensions),
      finish: realStr(snapshot.specs.catalog_finishing),
      unit_cost: snapshot.catalog_price ?? null,
      notes: snapshot.catalog_notes ?? null,
      location: entry.schedule_location ?? null,
      url: realStr(snapshot.catalog_reference_url) || realStr(snapshot.specs.catalog_reference_url),
      catalog_fields: catalogFieldsFromJson(metadata?.catalog_fields),
    };
    if (item.kind === "fixture") fixtures.push(item);
    else materials.push(item);
  }

  // Collapse duplicate cards for the same logical item. This catches two cases:
  //   1. a delete+recreate in SketchUp before sync reconciliation caught it, and
  //   2. a SketchUp material ("CT-1") and a schedule entry ("CT-01") that map to
  //      the same code but were never linked (padded vs unpadded increment).
  // The key is the NORMALISED code (prefix + increment with leading zeros
  // stripped), and we keep the card carrying a schedule link / real data /
  // image so editing stays on the entry-backed card instead of spawning a new
  // duplicate entry.
  const dedupeByCode = (items: CatalogItem[]): CatalogItem[] => {
    const byCode = new Map<string, CatalogItem>();
    const score = (item: CatalogItem) =>
      (item.entry_id ? 4 : 0) + (item.image_url ? 2 : 0) + (realStr(item.name) || item.brand ? 1 : 0);
    for (const item of items) {
      const key = normalizeCatalogCode(item.code);
      const existing = byCode.get(key);
      if (!existing || score(item) > score(existing)) byCode.set(key, item);
    }
    return Array.from(byCode.values());
  };

  // Sort by prefix (A→Z) then numerically (CT-1, CT-2, … CT-10 — not CT-1,
  // CT-10, CT-2). Non-conforming codes fall to the end alphabetically.
  const codeSortKey = (code: string): [string, number, string] => {
    const match = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/.exec((code || "").trim());
    if (match) return [match[1].toUpperCase(), Number(match[2]), ""];
    return ["￿", Number.MAX_SAFE_INTEGER, (code || "").toUpperCase()];
  };
  const compareByCode = (a: CatalogItem, b: CatalogItem) => {
    const [pa, na, fa] = codeSortKey(a.code);
    const [pb, nb, fb] = codeSortKey(b.code);
    return pa.localeCompare(pb) || na - nb || fa.localeCompare(fb);
  };
  // Display codes normalised to the unpadded plugin format, everywhere.
  const normalizeDisplay = (items: CatalogItem[]) =>
    items.map((item) => ({ ...item, code: normalizeCatalogCode(item.code) }));

  const dedupedMaterials = normalizeDisplay(dedupeByCode(materials)).sort(compareByCode);
  const dedupedFixtures = normalizeDisplay(dedupeByCode(fixtures)).sort(compareByCode);
  const stagedMaterialByEntryId = new Map(
    (sketchupProject?.materials ?? []).flatMap((material) =>
      material.linked_entry_id
        ? [[material.linked_entry_id, material] as const]
        : []
    )
  );
  const codeManagerItems: CatalogCodeManagerItem[] = scheduleEntries
    .filter((entry) => entry.section === ProductType.material)
    .map((entry) => {
      const stagedMaterial = stagedMaterialByEntryId.get(entry.id) ?? null;
      const option = selectedCatalogOption(entry);
      const parsed = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
      const snapshot = parsed.success ? parsed.data : null;
      const code = normalizeCatalogCode(
        `${entry.schedule_prefix}-${entry.schedule_increment}`
      );
      return {
        entry_id: entry.id,
        material_id: stagedMaterial?.id ?? null,
        code,
        bridge_code: stagedMaterial ? normalizeCatalogCode(stagedMaterial.code) : null,
        prefix: entry.schedule_prefix.trim().toUpperCase(),
        category: entry.schedule_category,
        brand: realStr(stagedMaterial?.brand) || (snapshot ? realStr(snapshot.catalog_brand) : null),
        type_label:
          realStr(stagedMaterial?.type) ||
          (snapshot ? realStr(snapshot.catalog_sub_category) : null) ||
          resolveCategoryLabel(entry.schedule_prefix, entry.schedule_category),
        is_reserved: stagedMaterial?.is_reserved ?? false,
      };
    })
    .sort((left, right) => {
      const [leftPrefix, leftNumber, leftFallback] = codeSortKey(left.code);
      const [rightPrefix, rightNumber, rightFallback] = codeSortKey(right.code);
      return (
        leftPrefix.localeCompare(rightPrefix) ||
        leftNumber - rightNumber ||
        leftFallback.localeCompare(rightFallback)
      );
    });
  return {
    materials: dedupedMaterials,
    fixtures: dedupedFixtures,
    code_manager_items: codeManagerItems,
    project_id: projectId,
    sketchup_project_id: sketchupProject?.id ?? "",
    pending_action_count: sketchupProject?.merge_actions.length ?? 0,
  };
}
const CatalogUrlSchema = z.string().trim().max(4000).refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, "URL must start with http:// or https://.");

const CatalogItemPatchSchema = z.object({
  type: z.string().trim().max(500).nullable().optional(),
  brand: z.string().trim().max(500).nullable().optional(),
  product_name: z.string().trim().max(500).nullable().optional(),
  finish: z.string().trim().max(500).nullable().optional(),
  location_notes: z.string().trim().max(2000).nullable().optional(),
  item_no: z.string().trim().max(500).nullable().optional(),
  qty: z.number().finite().nonnegative().nullable().optional(),
  unit: z.string().trim().max(100).nullable().optional(),
  color_size: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().max(500).nullable().optional(),
  size: z.string().trim().max(500).nullable().optional(),
  unit_cost: z.number().finite().nonnegative().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  image_url: z.string().trim().max(4000).nullable().optional(),
  url: CatalogUrlSchema.nullable().optional(),
  catalog_fields: CatalogFieldsSchema.nullable().optional(),
});

export type CatalogItemPatch = z.infer<typeof CatalogItemPatchSchema>;

// The staging layer (and the SketchUp plugin round-trip) stores colour + size
// in ONE "color / size" string; the card UI edits them as two separate fields.
// This folds a color/size patch back into the combined column, preserving the
// half that wasn't edited. Size-only values get an explicit "—" colour slot so
// splitColorSize can't mistake the size for a colour ("—" is a placeholder and
// renders as empty).
function mergeColorSize(color: string | null, size: string | null): string | null {
  const colorPart = (color ?? "").trim();
  const sizePart = (size ?? "").trim();
  if (colorPart && sizePart) return `${colorPart} / ${sizePart}`;
  if (colorPart) return colorPart;
  if (sizePart) return `— / ${sizePart}`;
  return null;
}

// If the patch carries the split color/size keys, resolve them against the
// current combined value and rewrite the patch to the legacy color_size key
// (which every downstream path already understands).
function foldColorSizePatch(data: CatalogItemPatch, currentColorSize: string | null | undefined): CatalogItemPatch {
  if (data.color === undefined && data.size === undefined) return data;
  const current = splitColorSize(currentColorSize);
  const nextColor = data.color !== undefined ? data.color : realStr(current.color);
  const nextSize = data.size !== undefined ? data.size : realStr(current.dimensions);
  const rest = { ...data };
  delete rest.color;
  delete rest.size;
  return { ...rest, color_size: mergeColorSize(nextColor, nextSize) };
}

// A change to `catalog_fields` only affects which rows are *displayed* on the
// card — it must never create or re-sync a Product Schedule entry. Auto-link
// should fire only on real data edits.
function hasDataPatch(data: CatalogItemPatch) {
  return Object.keys(data).some((key) => key !== "catalog_fields");
}

function revalidateCatalog(projectId: string) {
  revalidatePath(`/projects/${projectId}/sketchup`);
  revalidatePath(`/projects/${projectId}/sketchup/catalog`);
  revalidatePath(`/projects/${projectId}/extensions/product-catalog`);
  revalidatePath(`/projects/${projectId}/schedule`);
}

export async function linkSketchupMaterialAction(materialId: string, linkedEntryId: string | null, projectId: string) {
  try {
    const { role } = await requireSession();
    if (role !== "DEVELOPER") return { error: "Unauthorized SketchUp Action. Premium feature only." };
    const material = await prisma.sketchupMaterial.findFirst({
      where: { id: materialId, sketchup_project: { project_id: projectId } },
      select: { id: true },
    });
    if (!material) return { error: "Material was not found for this project." };
    if (linkedEntryId) {
      const entry = await prisma.projectScheduleEntry.findFirst({ where: { id: linkedEntryId, project_id: projectId } });
      if (!entry) return { error: "Schedule entry was not found for this project." };
    }
    await prisma.sketchupMaterial.update({ where: { id: materialId }, data: { linked_entry_id: linkedEntryId } });
    revalidateCatalog(projectId);
    return { success: true };
  } catch (error) {
    console.error("[LINK_SKETCHUP_MATERIAL_ERROR]", error);
    return { error: "Failed to link material." };
  }
}

// Write a card edit into the Product Schedule, which owns catalog content.
//
// The patch is applied onto the entry's CURRENT snapshot; the staging row is
// read only for the code (SketchUp-owned) and as a dormant-column fallback
// for content that has not been backfilled into the snapshot yet. Nothing
// catalog-related is written back to the staging row — see catalog-ownership.ts.
//
// Takes an existing transaction client so this and its caller commit or roll
// back together (see the "atomic card save" note on updateSketchupMaterialAction).
async function syncLinkedMaterialEntry(
  tx: PrismaTransaction,
  materialId: string,
  projectId: string,
  userId: string,
  patch: CatalogItemPatch = {}
) {
  {
    const material = await tx.sketchupMaterial.findFirst({
      where: { id: materialId, sketchup_project: { project_id: projectId } },
    });
    if (!material?.linked_entry_id) throw new Error("Material is not linked to a schedule entry.");
    const entry = await tx.projectScheduleEntry.findFirst({
      where: { id: material.linked_entry_id, project_id: projectId },
      include: { options: true },
    });
    if (!entry) throw new Error("Linked schedule entry was not found.");
    const option = entry.options.find((candidate) => candidate.is_final) ?? entry.options[0];
    const parsedCurrent = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
    const current = parsedCurrent.success ? parsedCurrent.data : null;
    const wasPatched = (key: keyof CatalogItemPatch) =>
      Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined;

    // The entry's own code is authoritative; the material code is only used
    // when the entry somehow has none (shouldn't happen for a linked row).
    const entryCode = `${entry.schedule_prefix}-${entry.schedule_increment}`;
    const snapshot = ScheduleSnapshotSchema.parse(
      applyCatalogPatchToSnapshot(current, patch, {
        code: normalizeCatalogCode(entryCode) || material.code,
        category: entry.schedule_category,
        catalogType: "material",
        fallback: {
          brand: material.brand,
          type: material.type,
          finish: material.finish,
          item_no: material.item_no,
          color_size: material.color_size,
          unit_cost: material.unit_cost,
          notes: material.notes,
          image_url: material.image_url,
          reference_url: material.reference_url,
          catalog_fields: catalogFieldsFromJson(material.catalog_fields),
        },
      })
    );
    const isComplete = Boolean(realStr(snapshot.catalog_brand) && realStr(snapshot.catalog_sub_category));
    if (option) {
      await updateScheduleOptionSnapshot(tx, option.id, snapshot, { status: isComplete ? "APPROVED" : "DRAFT" });
    } else {
      await createScheduleOption(tx, { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot });
    }
    // qty / unit / location live on the entry itself (still Schedule-owned),
    // so they are patched there rather than in the snapshot. Unpatched values
    // keep the entry's own value, falling back to the dormant staging column
    // only when the entry has nothing.
    await tx.projectScheduleEntry.update({
      where: { id: entry.id },
      data: {
        schedule_qty: wasPatched("qty") ? patch.qty ?? null : entry.schedule_qty ?? material.qty,
        schedule_unit: wasPatched("unit")
          ? realStr(patch.unit)
          : entry.schedule_unit ?? realStr(material.unit),
        schedule_location: wasPatched("location_notes")
          ? realStr(patch.location_notes)
          : entry.schedule_location ?? realStr(material.location_notes),
      },
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "ProjectScheduleEntry", entry.id, userId, {
      project_id: projectId,
      sketchup_material_id: material.id,
      source: "catalog_edit",
    });
    return entry.id;
  }
}

// Fixture equivalent of syncLinkedMaterialEntry: the patch is applied onto the
// entry's CURRENT snapshot rather than rebuilt from FFE metadata.
//
// This is the change that makes the fixture path safe once metadata stops
// carrying catalog content. The old body called buildFFESnapshot(fixture, ...),
// which reconstructs the entire snapshot from `fixture.metadata` — with the
// catalog keys now dormant that would have overwritten every specified fixture
// with an empty snapshot on the next save.
//
// Takes an existing transaction client — see syncLinkedMaterialEntry above.
async function syncFixtureEntry(
  tx: PrismaTransaction,
  fixtureId: string,
  projectId: string,
  userId: string,
  patch: CatalogItemPatch = {}
) {
  {
    const fixture = await tx.sketchupFFE.findFirst({
      where: { id: fixtureId, sketchup_project: { project_id: projectId } },
    });
    if (!fixture) throw new Error("Fixture was not found for this project.");
    const codeMatch = fixture.code.match(/^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/);
    if (!codeMatch) throw new Error(`Invalid fixture code format: "${fixture.code}".`);
    const prefix = codeMatch[1].toUpperCase();
    const increment = Number(codeMatch[2]);
    const parsedMeta = FFEMetaSchema.safeParse(fixture.metadata);
    const meta = parsedMeta.success ? parsedMeta.data : FFEMetaSchema.parse({});
    const wasPatched = (key: keyof CatalogItemPatch) =>
      Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined;
    let dictionary = await tx.prefixDictionary.findFirst({ where: { prefix, section: ProductType.fixture } });
    if (!dictionary) {
      dictionary = await tx.prefixDictionary.create({
        data: { prefix, section: ProductType.fixture, schedule_category: (meta.category || prefix).toUpperCase() },
      });
    }
    // Identity first: an existing link is the join key, so a fixture whose
    // code diverged from its entry still resolves to the same entry instead
    // of silently creating a duplicate at the new code.
    let entry = meta.linked_entry_id
      ? await tx.projectScheduleEntry.findFirst({
          where: { id: meta.linked_entry_id, project_id: projectId, section: ProductType.fixture },
          include: { options: true },
        })
      : null;
    if (!entry) {
      entry = await tx.projectScheduleEntry.findFirst({
        where: { project_id: projectId, section: ProductType.fixture, schedule_prefix: prefix, schedule_increment: increment },
        include: { options: true },
      });
    }
    if (!entry) {
      const created = await tx.projectScheduleEntry.create({
        data: {
          project_id: projectId,
          schedule_category: dictionary.schedule_category,
          section: ProductType.fixture,
          schedule_prefix: prefix,
          schedule_increment: increment,
          index_number: increment,
          schedule_sort_order: increment,
          schedule_qty: meta.qty ?? fixture.instance_count,
          schedule_unit: realStr(meta.unit) || "pcs",
          schedule_location: meta.location_notes,
          prefix_id: dictionary.id,
        },
      });
      entry = { ...created, options: [] };
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", entry.id, userId, {
        project_id: projectId,
        sketchup_ffe_id: fixture.id,
        source: "catalog_auto_link",
      });
    }
    const option = entry.options.find((candidate) => candidate.is_final) ?? entry.options[0];
    const parsedCurrent = ScheduleSnapshotSchema.safeParse(option?.data_snapshot);
    const current = parsedCurrent.success ? parsedCurrent.data : null;
    const entryCode = `${entry.schedule_prefix}-${entry.schedule_increment}`;
    const snapshot = ScheduleSnapshotSchema.parse(
      applyCatalogPatchToSnapshot(current, patch, {
        code: normalizeCatalogCode(entryCode) || fixture.code,
        category: entry.schedule_category,
        catalogType: "fixture",
        fallback: {
          brand: meta.brand,
          type: meta.type,
          product_name: meta.product_name,
          finish: meta.finish,
          item_no: meta.item_no,
          color_size: meta.color_size,
          unit_cost: meta.unit_cost,
          notes: meta.notes,
          image_url: meta.image_url,
          reference_url: meta.reference_url,
          catalog_fields: meta.catalog_fields ?? null,
        },
      })
    );
    const isComplete = Boolean(
      realStr(snapshot.catalog_brand) &&
      (realStr(snapshot.catalog_product_name) || realStr(snapshot.catalog_sub_category))
    );
    if (option) {
      await updateScheduleOptionSnapshot(tx, option.id, snapshot, { status: isComplete ? "APPROVED" : "DRAFT" });
    } else {
      await createScheduleOption(tx, { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot });
    }
    await tx.projectScheduleEntry.update({
      where: { id: entry.id },
      data: {
        schedule_qty: wasPatched("qty")
          ? patch.qty ?? null
          : entry.schedule_qty ?? meta.qty ?? fixture.instance_count,
        schedule_unit: wasPatched("unit")
          ? realStr(patch.unit)
          : entry.schedule_unit ?? realStr(meta.unit) ?? "pcs",
        schedule_location: wasPatched("location_notes")
          ? realStr(patch.location_notes)
          : entry.schedule_location ?? realStr(meta.location_notes),
      },
    });
    // Only the join key is written back to the fixture row; the dormant
    // catalog keys are left exactly as they are (never extended, never
    // refreshed) so they stay a frozen pre-redesign snapshot.
    const metadata = fixture.metadata && typeof fixture.metadata === "object" && !Array.isArray(fixture.metadata)
      ? { ...(fixture.metadata as Record<string, unknown>), linked_entry_id: entry.id }
      : { linked_entry_id: entry.id };
    await tx.sketchupFFE.update({ where: { id: fixture.id }, data: { metadata: metadata as Prisma.InputJsonValue } });
    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "ProjectScheduleEntry", entry.id, userId, {
      project_id: projectId,
      sketchup_ffe_id: fixture.id,
      source: "catalog_edit",
    });
    return entry.id;
  }
}

// Takes an existing transaction client — see syncLinkedMaterialEntry above.
async function syncLinkedCatalogFields(
  tx: PrismaTransaction,
  entryId: string,
  projectId: string,
  catalogFields: CatalogFieldKey[] | null,
  userId: string
) {
  {
    const entry = await tx.projectScheduleEntry.findFirst({
      where: { id: entryId, project_id: projectId },
      include: { options: true },
    });
    if (!entry) throw new Error("Linked schedule entry was not found.");
    const option = selectedCatalogOption(entry);
    if (!option) return;
    const parsed = ScheduleSnapshotSchema.safeParse(option.data_snapshot);
    if (!parsed.success) throw new Error("Linked catalog snapshot is invalid.");
    const current = parsed.data;
    const metadata = {
      ...((current.specs.catalog_metadata as Record<string, unknown>) || {}),
    };
    if (catalogFields === null) delete metadata.catalog_fields;
    else metadata.catalog_fields = catalogFields;
    const snapshot = ScheduleSnapshotSchema.parse({
      ...current,
      specs: {
        ...current.specs,
        catalog_metadata: metadata,
      },
      snapshot_captured_at: new Date().toISOString(),
    });
    await updateScheduleOptionSnapshot(tx, option.id, snapshot);
    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT,
      "ProjectScheduleEntry",
      entry.id,
      userId,
      {
        project_id: projectId,
        source: "catalog_fields",
        catalog_fields: catalogFields,
      }
    );
  }
}

// The staging-row write and its schedule-entry sync used to run as two
// separate prisma.$transaction calls: if the second (schedule sync) failed,
// the first (material edit) had already committed, leaving the card's staged
// fields changed with no matching schedule update — a partial save the user
// only discovered as a generic error toast. Everything below now runs inside
// one transaction so a failure at any step rolls the whole edit back.
export async function updateSketchupMaterialAction(materialId: string, rawData: CatalogItemPatch, projectId: string) {
  try {
    const parsedPatch = CatalogItemPatchSchema.parse(rawData);
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.sketchupMaterial.findFirst({
        where: { id: materialId, sketchup_project: { project_id: projectId } },
        select: {
          id: true,
          linked_entry_id: true,
          color_size: true,
          linked_entry: {
            select: {
              active_index: true,
              options: { select: { id: true, is_final: true, data_snapshot: true } },
            },
          },
        },
      });
      if (!material) return { error: "Material was not found for this project." };
      const linkedOption = material.linked_entry ? selectedCatalogOption(material.linked_entry) : null;
      const parsedLinkedSnapshot = ScheduleSnapshotSchema.safeParse(linkedOption?.data_snapshot);
      const snapshotColorSize = parsedLinkedSnapshot.success
        ? joinParts([
            parsedLinkedSnapshot.data.specs.catalog_color,
            parsedLinkedSnapshot.data.specs.catalog_dimensions,
          ], " / ")
        : null;
      // Colour/size is still resolved against the snapshot first, with the
      // dormant staging column only as a fallback for un-backfilled rows.
      const data = foldColorSizePatch(parsedPatch, snapshotColorSize ?? material.color_size);
      // NOTE: the SketchupMaterial catalog columns are deliberately NOT
      // written here any more. The Product Schedule snapshot is the single
      // write target for catalog content (see catalog-ownership.ts); the
      // staging columns keep their pre-redesign values as a read fallback
      // and rollback net until scripts/backfill-catalog-snapshots.mjs has run.
      let entryId = material.linked_entry_id;
      if (hasDataPatch(data)) {
        // An unlinked material gets its entry created first, then the patch is
        // applied to it. The create step still seeds the snapshot from the
        // dormant columns (correct — that is the un-backfilled fallback), so
        // the patch has to run afterwards or the user's edit would be lost.
        if (!entryId) {
          const pushed = await pushMaterialAsNewEntryTx(tx, materialId, projectId, userId);
          entryId = pushed.entryId;
        }
        entryId = await syncLinkedMaterialEntry(tx, materialId, projectId, userId, data);
      }
      if (data.catalog_fields !== undefined) {
        if (entryId) {
          await syncLinkedCatalogFields(tx, entryId, projectId, data.catalog_fields, userId);
        } else {
          // Field visibility is a display-only preference and must never
          // create a schedule entry on its own. For a card with no entry yet
          // the staging column is the only place it can live; once the item
          // links, applyCatalogPatchToSnapshot carries it into the snapshot.
          await tx.sketchupMaterial.update({
            where: { id: materialId },
            data: {
              catalog_fields: data.catalog_fields === null ? Prisma.DbNull : data.catalog_fields,
            },
          });
        }
      }
      await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_UPDATE_CATALOG_ITEM, "SketchupMaterial", materialId, userId, {
        project_id: projectId,
        fields: Object.keys(data),
        linked_entry_id: entryId,
      });
      return { success: true as const, entry_id: entryId };
    });

    if ("error" in result) return result;
    revalidateCatalog(projectId);
    return result;
  } catch (error) {
    console.error("[UPDATE_SKETCHUP_MATERIAL_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to update material catalog data.") };
  }
}

// Same atomicity fix as updateSketchupMaterialAction: the fixture metadata
// write and its schedule-entry sync now share one transaction instead of two,
// so a failure partway through can't leave the card edited but unsynced.
export async function updateSketchupFFEAction(fixtureId: string, rawData: CatalogItemPatch, projectId: string) {
  try {
    const parsedPatch = CatalogItemPatchSchema.parse(rawData);
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    const result = await prisma.$transaction(async (tx) => {
    const fixture = await tx.sketchupFFE.findFirst({ where: { id: fixtureId, sketchup_project: { project_id: projectId } } });
    if (!fixture) return { error: "Fixture was not found for this project." };
    const metadata = fixture.metadata && typeof fixture.metadata === "object" && !Array.isArray(fixture.metadata)
      ? { ...(fixture.metadata as Record<string, unknown>) }
      : {};
    const existingLinkedEntryId = typeof metadata.linked_entry_id === "string"
      ? metadata.linked_entry_id
      : null;

    // Resolve the current colour/size from the SNAPSHOT (the owner), falling
    // back to the dormant metadata key only for fixtures not yet backfilled.
    // The old code did the reverse and additionally copied the whole snapshot
    // back into metadata on every save; that mirror is gone — metadata no
    // longer holds catalog content, so there is nothing to keep in step.
    let snapshotColorSize: string | null = null;
    if (existingLinkedEntryId) {
      const linkedEntry = await tx.projectScheduleEntry.findFirst({
        where: { id: existingLinkedEntryId, project_id: projectId, section: ProductType.fixture },
        include: { options: true },
      });
      const linkedOption = linkedEntry ? selectedCatalogOption(linkedEntry) : null;
      const parsedLinked = ScheduleSnapshotSchema.safeParse(linkedOption?.data_snapshot);
      if (parsedLinked.success) {
        snapshotColorSize = joinParts(
          [parsedLinked.data.specs.catalog_color, parsedLinked.data.specs.catalog_dimensions],
          " / "
        );
      }
    }
    const data = foldColorSizePatch(
      parsedPatch,
      snapshotColorSize ?? (typeof metadata.color_size === "string" ? metadata.color_size : null)
    );
    // Catalog content is not written back to fixture metadata — see
    // catalog-ownership.ts. syncFixtureEntry writes the patch into the
    // schedule snapshot and refreshes only the linked_entry_id join key.
    // A catalog_fields-only change must not reach syncFixtureEntry, which
    // would create an entry: field visibility is display-only.
    const entryId = hasDataPatch(data)
      ? await syncFixtureEntry(tx, fixtureId, projectId, userId, data)
      : existingLinkedEntryId;
    if (data.catalog_fields !== undefined) {
      if (entryId) {
        await syncLinkedCatalogFields(tx, entryId, projectId, data.catalog_fields, userId);
      } else {
        // No entry to hold the preference yet — keep it on the fixture row
        // (the one dormant key still written, for the same reason as the
        // material path above).
        const next = { ...metadata };
        if (data.catalog_fields === null) delete next.catalog_fields;
        else next.catalog_fields = data.catalog_fields;
        await tx.sketchupFFE.update({
          where: { id: fixtureId },
          data: { metadata: next as Prisma.InputJsonValue },
        });
      }
    }
    await insertAuditLog(tx, AUDIT_ACTIONS.SKETCHUP_UPDATE_CATALOG_ITEM, "SketchupFFE", fixtureId, userId, {
      project_id: projectId,
      fields: Object.keys(data),
      linked_entry_id: entryId,
    });
    return { success: true as const, entry_id: entryId };
    });

    if ("error" in result) return result;
    revalidateCatalog(projectId);
    return result;
  } catch (error) {
    console.error("[UPDATE_SKETCHUP_FFE_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to update fixture catalog data.") };
  }
}
export async function updateManualCatalogItemAction(optionId: string, rawData: CatalogItemPatch, projectId: string) {
  try {
    const parsedPatch = CatalogItemPatchSchema.parse(rawData);
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_EDIT);
    await prisma.$transaction(async (tx) => {
      const option = await tx.projectScheduleOption.findFirst({
        where: { id: optionId, entry: { project_id: projectId } },
        include: { entry: true },
      });
      if (!option) throw new Error("Manual catalog item was not found for this project.");
      const parsed = ScheduleSnapshotSchema.safeParse(option.data_snapshot);
      if (!parsed.success) throw new Error("Manual catalog snapshot is invalid and cannot be edited safely.");
      const current = parsed.data;
      const data = foldColorSizePatch(
        parsedPatch,
        mergeColorSize(realStr(current.specs.catalog_color), realStr(current.specs.catalog_dimensions))
      );
      const colorSize = data.color_size !== undefined ? splitColorSize(data.color_size) : null;
      const metadata = { ...((current.specs.catalog_metadata as Record<string, unknown>) || {}) };
      if (data.catalog_fields !== undefined) {
        if (data.catalog_fields === null) delete metadata.catalog_fields;
        else metadata.catalog_fields = data.catalog_fields;
      }
      const snapshot = ScheduleSnapshotSchema.parse({
        ...current,
        catalog_sub_category: data.type !== undefined ? data.type : current.catalog_sub_category,
        catalog_product_name: data.product_name !== undefined ? data.product_name : current.catalog_product_name,
        catalog_brand: data.brand !== undefined ? data.brand || "Custom" : current.catalog_brand,
        catalog_price: data.unit_cost !== undefined ? data.unit_cost : current.catalog_price,
        catalog_notes: data.notes !== undefined ? data.notes : current.catalog_notes,
        catalog_image_url: data.image_url !== undefined ? data.image_url : current.catalog_image_url,
        catalog_reference_url: data.url !== undefined ? data.url : current.catalog_reference_url,
        specs: {
          ...current.specs,
          catalog_sku: data.item_no !== undefined ? data.item_no : current.specs.catalog_sku,
          catalog_color: colorSize ? colorSize.color : current.specs.catalog_color,
          catalog_dimensions: colorSize ? colorSize.dimensions || "N/A" : current.specs.catalog_dimensions,
          catalog_finishing: data.finish !== undefined ? data.finish : current.specs.catalog_finishing,
          catalog_reference_url: data.url !== undefined ? data.url : current.specs.catalog_reference_url,
          catalog_metadata: metadata,
        },
        snapshot_captured_at: new Date().toISOString(),
      });
      // A display-only field-visibility toggle must not flip the option back
      // to DRAFT; only real data edits do.
      await updateScheduleOptionSnapshot(tx, option.id, snapshot, {
        status: hasDataPatch(data) ? "DRAFT" : option.status as "DRAFT" | "APPROVED" | "NOT_USED",
      });
      if (data.qty !== undefined || data.unit !== undefined || data.location_notes !== undefined) {
        await tx.projectScheduleEntry.update({
          where: { id: option.entry_id },
          data: {
            schedule_qty: data.qty !== undefined ? data.qty : option.entry.schedule_qty,
            schedule_unit: data.unit !== undefined ? data.unit : option.entry.schedule_unit,
            schedule_location: data.location_notes !== undefined ? data.location_notes : option.entry.schedule_location,
          },
        });
      }
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "ProjectScheduleOption", option.id, userId, {
        project_id: projectId,
        entry_id: option.entry_id,
        fields: Object.keys(data),
        source: "catalog_manual_item",
      });
    });
    revalidateCatalog(projectId);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_MANUAL_CATALOG_ITEM_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to update manual catalog item.") };
  }
}

// Resolve which schedule_category (and therefore prefix) a manual add should
// land in. `categoryPrefix` is the board's category key (e.g. "CT"). We keep
// the code prefix stable by reusing an existing PrefixDictionary for that
// prefix, or seeding one from the canonical label so `addEntryToSchedule`
// doesn't fall back to its naive first-two-letters guess.
async function resolveScheduleCategoryForPrefix(
  tx: PrismaTransaction,
  categoryPrefix: string,
  section: ProductType
): Promise<string> {
  const prefix = categoryPrefix.trim().toUpperCase();
  const byPrefix = await tx.prefixDictionary.findFirst({ where: { prefix, section } });
  if (byPrefix) return byPrefix.schedule_category;
  const label = (CANONICAL_CATEGORY_LABELS[prefix] ?? prefix).toUpperCase();
  const byCategory = await tx.prefixDictionary.findFirst({
    where: { section, schedule_category: { equals: label, mode: "insensitive" } },
  });
  if (!byCategory) {
    await tx.prefixDictionary.create({ data: { section, schedule_category: label, prefix } });
  }
  return label;
}

export async function addManualCatalogItemAction(
  projectId: string,
  kind: "material" | "fixture",
  categoryPrefix?: string | null
) {
  try {
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_ADD);
    const result = await prisma.$transaction(async (tx) => {
      await assertNoPendingSketchupQueueForProject(tx, projectId);
      const section = kind === "fixture" ? ProductType.fixture : ProductType.material;
      const category = categoryPrefix
        ? kind === "fixture"
          ? categoryPrefix.trim().toUpperCase()
          : await resolveScheduleCategoryForPrefix(tx, categoryPrefix, section)
        : kind === "fixture" ? "FIXTURE" : "MATERIAL";
      // Reserve mode intentionally bypasses duplicate-product checks; the
      // placeholder snapshot is replaced immediately with this item's unique
      // normalized schedule code before the transaction commits.
      const { entry } = await ScheduleService.addEntryToSchedule(
        tx,
        projectId,
        category,
        "reserve",
        undefined,
        undefined,
        section,
        userId
      );
      const normalizedEntry = await tx.projectScheduleEntry.findUniqueOrThrow({ where: { id: entry.id } });
      const code = `${normalizedEntry.schedule_prefix}-${String(normalizedEntry.schedule_increment).padStart(2, "0")}`;
      const draftSnapshot = ScheduleSnapshotSchema.parse({
        snapshot_source_kind: "manual",
        snapshot_source_origin: "manual",
        snapshot_source_external_id: null,
        product_catalog_id: null,
        catalog_type: section,
        schedule_category: category,
        catalog_sub_category: kind === "fixture" ? "Fixture" : "Material",
        catalog_product_name: "Manual Item",
        catalog_brand: "Custom",
        catalog_initials_type: null,
        catalog_price: null,
        catalog_notes: null,
        catalog_image_url: null,
        catalog_reference_url: null,
        catalog_contact_name: null,
        catalog_contact_phone: null,
        catalog_contact_email: null,
        catalog_has_sample: false,
        specs: {
          catalog_sku: code,
          catalog_motif: null,
          catalog_structured_tags: [],
          catalog_dimensions: "N/A",
          catalog_dimension_p: null,
          catalog_dimension_l: null,
          catalog_dimension_t: null,
          catalog_dimension_unit: "cm",
          catalog_color: null,
          catalog_finishing: null,
          catalog_reference_url: null,
          catalog_metadata: {},
        },
        schedule_code: code,
        snapshot_captured_at: new Date().toISOString(),
      });
      const option = await tx.projectScheduleOption.findFirstOrThrow({
        where: { entry_id: entry.id },
        orderBy: { option_label: "asc" },
      });
      await updateScheduleOptionSnapshot(tx, option.id, draftSnapshot, { status: "DRAFT", is_final: true });
      return {
        entryId: entry.id,
        optionId: option.id,
        schedulePrefix: normalizedEntry.schedule_prefix,
        code,
      };
    });
    revalidateCatalog(projectId);
    return { success: true, ...result };
  } catch (error) {
    console.error("[ADD_MANUAL_CATALOG_ITEM_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to add manual catalog item.") };
  }
}

// Catalog-based add (searchCatalogLibraryProductsAction / addCatalogItemFromLibraryAction)
// was removed 2026-08-04 in favor of cross-project reuse below — decision
// recorded in PLAN-AUDIT-ROADMAP-2026Q3.md §2.2 R2 / §5. "Add item" now
// sources exclusively from what's already been specced on other projects
// (searchReusableCatalogItemsAction / addCatalogItemFromReuseAction), not
// the global ProductCatalog. CSV import and the manual/"reserve" path above
// are unaffected — they don't go through this picker.

const CatalogReuseSearchSchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().trim().max(200).default(""),
  kind: z.enum(["material", "fixture"]),
});

export type CatalogReuseItem = {
  /** ProjectScheduleOption id — the "sample" this group is represented by. */
  id: string;
  productName: string | null;
  brand: string | null;
  color: string | null;
  finishing: string | null;
  imageUrl: string | null;
  /** How many past entries (across all projects) share this exact spec. */
  usageCount: number;
  lastUsedAt: string;
};

/**
 * Cross-project reuse pool search — "pernah dipakai". Read-only, scoped to
 * the current tab's section (material/fixture) so a Fixture-tab search can't
 * surface a Material result. See ScheduleService.searchReusableSpecs and
 * PLAN-AUDIT-ROADMAP-2026Q3.md §2.2 R2.
 */
export async function searchReusableCatalogItemsAction(
  projectId: string,
  query: string,
  kind: "material" | "fixture"
) {
  try {
    const data = CatalogReuseSearchSchema.parse({ projectId, query, kind });
    await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_ADD);
    const section = data.kind === "fixture" ? ProductType.fixture : ProductType.material;
    const results = await prisma.$transaction((tx) =>
      ScheduleService.searchReusableSpecs(tx, data.query, 30, section)
    );
    const items: CatalogReuseItem[] = results.map((r) => ({
      id: r.sample_option_id,
      productName: r.spec_product_name,
      brand: r.spec_brand_name,
      color: r.spec_color,
      finishing: r.spec_finishing,
      imageUrl: r.catalog_image_url,
      usageCount: r.usage_count,
      lastUsedAt: r.last_used_at.toISOString(),
    }));
    return { success: true, items };
  } catch (error) {
    console.error("[SEARCH_REUSABLE_CATALOG_ITEMS_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to search past projects."), items: [] };
  }
}

export async function addCatalogItemFromReuseAction(projectId: string, sourceOptionId: string) {
  try {
    const parsedProjectId = z.string().uuid().parse(projectId);
    const parsedSourceOptionId = z.string().uuid().parse(sourceOptionId);
    const { userId } = await requireCatalogEditor(parsedProjectId, PERMISSION.PLUGIN_SCHEDULE_ADD);
    const result = await prisma.$transaction(async (tx) => {
      await assertNoPendingSketchupQueueForProject(tx, parsedProjectId);
      const source = await tx.projectScheduleOption.findUnique({
        where: { id: parsedSourceOptionId },
        select: { data_snapshot: true },
      });
      if (!source) throw new Error("That past item is no longer available.");
      const snapshot = source.data_snapshot as unknown as ScheduleSnapshot;
      const category = snapshot.schedule_category;
      const section = snapshot.catalog_type === "fixture" ? ProductType.fixture : ProductType.material;
      if (!category) {
        throw new Error("That past item has no category to reuse.");
      }

      const { entry } = await ScheduleService.addEntryToSchedule(
        tx,
        parsedProjectId,
        category,
        "reuse",
        null,
        undefined,
        section,
        userId,
        parsedSourceOptionId
      );
      const normalizedEntry = await tx.projectScheduleEntry.findUniqueOrThrow({
        where: { id: entry.id },
        select: { schedule_prefix: true, schedule_increment: true },
      });
      return {
        entryId: entry.id,
        schedulePrefix: normalizedEntry.schedule_prefix,
        code: `${normalizedEntry.schedule_prefix}-${String(normalizedEntry.schedule_increment).padStart(2, "0")}`,
      };
    });
    revalidateCatalog(parsedProjectId);
    return { success: true, ...result };
  } catch (error) {
    console.error("[ADD_CATALOG_ITEM_FROM_REUSE_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to add this past item.") };
  }
}

/**
 * Recurring schedule template (PLAN-AUDIT-ROADMAP-2026Q3.md §2.1 R1). New
 * projects already get this automatically on creation (project-service.ts);
 * this is the explicit trigger for projects that existed before a category
 * was marked as a default, or that skipped it for any other reason.
 * Additive/idempotent — see ScheduleService.applyDefaultTemplateEntries.
 */
export async function applyDefaultScheduleTemplateAction(projectId: string) {
  try {
    const parsedProjectId = z.string().uuid().parse(projectId);
    const { userId } = await requireCatalogEditor(parsedProjectId, PERMISSION.PLUGIN_SCHEDULE_ADD);
    const result = await prisma.$transaction(async (tx) => {
      await assertNoPendingSketchupQueueForProject(tx, parsedProjectId);
      return ScheduleService.applyDefaultTemplateEntries(tx, parsedProjectId, userId);
    });
    revalidateCatalog(parsedProjectId);
    return { success: true, ...result };
  } catch (error) {
    console.error("[APPLY_DEFAULT_SCHEDULE_TEMPLATE_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to apply the default template.") };
  }
}

// Delete a catalog card. `id` is the SketchupMaterial/SketchupFFE id for
// plugin-sourced items, or the ProjectScheduleEntry id for manual (schedule)
// items. Plugin-sourced deletes also remove the linked schedule entry so the
// item leaves the Product Schedule too; note it can reappear on the next sync
// if the material still exists in the SketchUp model.
export async function deleteCatalogItemAction(
  projectId: string,
  input: { source: "sketchup" | "schedule"; kind: "material" | "fixture"; id: string; entryId?: string | null }
) {
  try {
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const resyncRisk = await prisma.$transaction(async (tx) => {
      await assertNoPendingSketchupQueueForProject(tx, projectId);
      if (input.source === "schedule") {
        const entry = await tx.projectScheduleEntry.findFirst({
          where: { id: input.id, project_id: projectId },
          select: { id: true },
        });
        if (!entry) throw new Error("Catalog item was not found for this project.");
        await tx.sketchupMaterial.updateMany({ where: { linked_entry_id: entry.id }, data: { linked_entry_id: null } });
        await tx.projectScheduleEntry.delete({ where: { id: entry.id } });
        await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "ProjectScheduleEntry", entry.id, userId, {
          project_id: projectId,
          source: "catalog_delete",
        });
        return false;
      }

      let linkedEntryId = input.entryId ?? null;
      if (input.kind === "fixture") {
        const fixture = await tx.sketchupFFE.findFirst({
          where: { id: input.id, sketchup_project: { project_id: projectId } },
        });
        if (!fixture) throw new Error("Fixture was not found for this project.");
        if (!linkedEntryId && fixture.metadata && typeof fixture.metadata === "object" && !Array.isArray(fixture.metadata)) {
          const meta = fixture.metadata as Record<string, unknown>;
          if (typeof meta.linked_entry_id === "string") linkedEntryId = meta.linked_entry_id;
        }
        await tx.sketchupFFE.delete({ where: { id: fixture.id } });
      } else {
        const material = await tx.sketchupMaterial.findFirst({
          where: { id: input.id, sketchup_project: { project_id: projectId } },
          select: { id: true, linked_entry_id: true },
        });
        if (!material) throw new Error("Material was not found for this project.");
        linkedEntryId = linkedEntryId ?? material.linked_entry_id;
        await tx.sketchupMaterial.delete({ where: { id: material.id } });
      }

      if (linkedEntryId) {
        const entry = await tx.projectScheduleEntry.findFirst({
          where: { id: linkedEntryId, project_id: projectId },
          select: { id: true },
        });
        if (entry) {
          await tx.sketchupMaterial.updateMany({ where: { linked_entry_id: entry.id }, data: { linked_entry_id: null } });
          await tx.projectScheduleEntry.delete({ where: { id: entry.id } });
        }
      }
      return true;
    });

    revalidateCatalog(projectId);
    return { success: true, resyncRisk };
  } catch (error) {
    console.error("[DELETE_CATALOG_ITEM_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to delete catalog item.") };
  }
}

// ── System-context auto-link (called from the SketchUp sync route) ─────────
// These are NOT session-gated: the sync endpoint authenticates via the
// project's API key, not a user session, so requireSession() would reject it.
// They ensure every coded, unlinked material/fixture attaches to a matching
// ProjectScheduleEntry (creating one if none exists) the moment it arrives
// from SketchUp — so the schedule and the catalog are always the same data,
// with no separate manual "push" step and no unlinked-duplicate risk.

const CODE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/;

export async function autoLinkSyncedMaterial(materialId: string, projectId: string): Promise<string | null> {
  const mat = await prisma.sketchupMaterial.findUnique({ where: { id: materialId } });
  if (!mat) return null;
  const match = CODE_PATTERN.exec(mat.code.trim());
  const prefix = match ? match[1].toUpperCase() : null;
  const increment = match ? Number(match[2]) : null;

  // Plugin sync owns technical identity/geometry; the Product Schedule owns
  // catalog content AND the code. See catalog-ownership.ts.
  try {
    return await prisma.$transaction(async (tx) => {
      // ── Already linked: the entry's code stands. A push reporting a
      // different code is a DIVERGENCE, not an instruction.
      if (mat.linked_entry_id) {
        const linked = await tx.projectScheduleEntry.findFirst({
          where: { id: mat.linked_entry_id, project_id: projectId },
          include: { options: true },
        });
        if (linked) {
          // The entry's code stands; the model converges onto it. Detecting
          // and queueing that rename is NOT done here — it is planned once
          // per sync for the whole project by planCodeConvergence() below.
          //
          // It used to be done here, per material, and that deadlocked on a
          // swap: with GL-1 and GL-2 exchanged between model and schedule,
          // each material's target was "still held by the other", so neither
          // could be queued and the divergence never resolved. Only a
          // project-wide view can plan the temporary-code hops a cycle needs.
          //
          // Quantity/unit/location stay Schedule-owned; only fill them from
          // the model where the Schedule has nothing at all.
          await tx.projectScheduleEntry.update({
            where: { id: linked.id },
            data: {
              schedule_qty: linked.schedule_qty ?? mat.qty,
              schedule_unit: linked.schedule_unit ?? realStr(mat.unit),
              schedule_location: linked.schedule_location ?? realStr(mat.location_notes),
            },
          });
          return linked.id;
        }
        // Dangling link (entry deleted) — clear it and re-create below.
        await tx.sketchupMaterial.update({ where: { id: materialId }, data: { linked_entry_id: null } });
      }

      if (!prefix || increment == null) return null;

      const existing = await tx.projectScheduleEntry.findFirst({
        where: { project_id: projectId, section: ProductType.material, schedule_prefix: prefix, schedule_increment: increment },
        include: { options: true },
      });

      if (existing) {
        const claimedBy = await tx.sketchupMaterial.findFirst({ where: { linked_entry_id: existing.id }, select: { id: true } });
        if (claimedBy) {
          console.warn(`[SKETCHUP_SYNC] Entry ${prefix}-${increment} already linked to another material; skipping auto-link for ${mat.code}.`);
          return null;
        }
        // Guard: jangan rampas slot template yang belum diklaim.
        // category/prefixDict/snapshot belum tersedia di scope ini (dideklarasikan di
        // "create" path di bawah), sehingga digunakan pendekatan minimal:
        // skip (return null) dengan warning daripada mencari slot baru.
        // Perbaikan penuh (cari slot bebas + buat entry baru) direncanakan di
        // R-SCHED-TPL-2e (OUT OF SCOPE Fase 4). Lihat template-slot-guard.ts.
        if (existing.template_item_id !== null) {
          console.warn(
            `[SKETCHUP_SYNC] Slot ${prefix}-${increment} dipegang template ` +
            `(template_item_id: ${existing.template_item_id}). ` +
            `Auto-link ${mat.code} dilewati (R-SCHED-TPL-2d). ` +
            `Gunakan findNextFreeIncrement (template-slot-guard.ts) di R-SCHED-TPL-2e untuk cari slot bebas.`
          );
          return null;
        }
        // Linking an existing entry to a freshly-synced material: the entry
        // already carries the specification, so nothing is copied back into
        // the staging row (the old hydrateMaterialFromEntry mirror is gone —
        // see catalog-ownership.ts). Schedule values win; the model only
        // fills gaps.
        await tx.sketchupMaterial.update({ where: { id: materialId }, data: { linked_entry_id: existing.id } });
        await tx.projectScheduleEntry.update({
          where: { id: existing.id },
          data: {
            schedule_qty: existing.schedule_qty ?? mat.qty,
            schedule_unit: existing.schedule_unit ?? realStr(mat.unit),
            schedule_location: existing.schedule_location ?? realStr(mat.location_notes),
          },
        });
        return existing.id;
      }

      // No matching entry: create one. The material's own code number is used
      // directly as schedule_increment (guaranteed free by the lookup above,
      // enforced by the entry's unique constraint) — no bulk renumbering needed.
      let prefixDict = await tx.prefixDictionary.findFirst({ where: { prefix, section: ProductType.material } });
      const category = (prefixDict?.schedule_category || prefix).toUpperCase();
      if (!prefixDict) {
        prefixDict = await tx.prefixDictionary.create({ data: { schedule_category: category, prefix, section: ProductType.material } });
      }
      const isComplete = Boolean(realStr(mat.brand) && realStr(mat.type));
      const snapshot = ScheduleSnapshotSchema.parse(buildMaterialSnapshot({
        code: mat.code, brand: mat.brand, type: mat.type, finish: mat.finish, image_url: mat.image_url,
        category, item_no: mat.item_no, color_size: mat.color_size, unit_cost: mat.unit_cost,
        notes: mat.notes, reference_url: mat.reference_url,
        catalog_fields: catalogFieldsFromJson(mat.catalog_fields),
      }, isComplete));
      const lastEntry = await tx.projectScheduleEntry.findFirst({
        where: { project_id: projectId, section: ProductType.material, schedule_category: category },
        orderBy: { schedule_sort_order: "desc" },
      });
      const entry = await tx.projectScheduleEntry.create({
        data: {
          project_id: projectId, schedule_category: category, section: ProductType.material,
          schedule_sort_order: (lastEntry?.schedule_sort_order ?? 0) + 1,
          index_number: increment, schedule_prefix: prefix, schedule_increment: increment,
          prefix_id: prefixDict.id, schedule_qty: mat.qty, schedule_unit: realStr(mat.unit),
          schedule_location: realStr(mat.location_notes),
        },
      });
      await createScheduleOption(tx, { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot });
      await tx.sketchupMaterial.update({ where: { id: materialId }, data: { linked_entry_id: entry.id } });
      return entry.id;
    });
  } catch (error) {
    console.error(`[SKETCHUP_SYNC] Auto-link failed for material ${mat.code}:`, error);
    throw error;
  }
}

export async function autoLinkSyncedFixture(fixtureId: string, projectId: string): Promise<string | null> {
  const fixture = await prisma.sketchupFFE.findUnique({ where: { id: fixtureId } });
  if (!fixture) return null;
  const meta = FFEMetaSchema.safeParse(fixture.metadata);
  const linkedEntryId = meta.success && typeof meta.data.linked_entry_id === "string" ? meta.data.linked_entry_id : null;
  const match = CODE_PATTERN.exec(fixture.code.trim());
  if (!match) return linkedEntryId;
  const prefix = match[1].toUpperCase();
  const increment = Number(match[2]);

  try {
    return await prisma.$transaction(async (tx) => {
      const metaData = meta.success ? meta.data : FFEMetaSchema.parse({});

      // Already linked: the entry's code stands and the model converges onto
      // it. The rename itself is planned project-wide by planCodeConvergence()
      // rather than here — see the note in autoLinkSyncedMaterial.
      let entry = linkedEntryId
        ? await tx.projectScheduleEntry.findFirst({ where: { id: linkedEntryId, project_id: projectId, section: ProductType.fixture }, include: { options: true } })
        : null;

      if (!entry) {
        entry = await tx.projectScheduleEntry.findFirst({
          where: { project_id: projectId, section: ProductType.fixture, schedule_prefix: prefix, schedule_increment: increment },
          include: { options: true },
        });
        // Guard: jika ditemukan via code-match (bukan via established linkedEntryId),
        // dan slot dipegang template, jangan klaim — skip dengan warning.
        // Perbaikan penuh (cari slot bebas) direncanakan di R-SCHED-TPL-2e.
        if (entry && entry.template_item_id !== null) {
          console.warn(
            `[SKETCHUP_SYNC] Slot ${prefix}-${increment} dipegang template ` +
            `(template_item_id: ${entry.template_item_id}). ` +
            `Auto-link fixture ${fixture.code} dilewati (R-SCHED-TPL-2d).`
          );
          return null;
        }
      }
      const category = entry?.schedule_category || (realStr(metaData.category) || prefix).toUpperCase();

      if (!entry) {
        let prefixDict = await tx.prefixDictionary.findFirst({ where: { prefix, section: ProductType.fixture } });
        if (!prefixDict) {
          prefixDict = await tx.prefixDictionary.create({ data: { schedule_category: category, prefix, section: ProductType.fixture } });
        }
        entry = await tx.projectScheduleEntry.create({
          data: {
            project_id: projectId, schedule_category: category, section: ProductType.fixture,
            schedule_sort_order: increment, index_number: increment, schedule_prefix: prefix, schedule_increment: increment,
            prefix_id: prefixDict.id, schedule_qty: metaData.qty ?? fixture.instance_count,
            schedule_unit: realStr(metaData.unit) || "pcs", schedule_location: realStr(metaData.location_notes),
          },
          include: { options: true },
        });
      }

      const option = entry.options.find((candidate) => candidate.is_final) ?? entry.options[0];
      // Only the join key is written back to the fixture row. The old code
      // mirrored the whole snapshot into metadata here ("hydrate missing FF&E
      // metadata"); that reverse copy is obsolete now that metadata holds no
      // catalog content — see catalog-ownership.ts.
      const nextMetadata = fixture.metadata && typeof fixture.metadata === "object" && !Array.isArray(fixture.metadata)
        ? { ...(fixture.metadata as Record<string, unknown>), linked_entry_id: entry.id }
        : { linked_entry_id: entry.id } as Record<string, unknown>;
      if (!option) {
        // Brand-new entry for a fixture the Schedule has never seen: seed the
        // snapshot from whatever the plugin knows (and, for pre-redesign rows,
        // the dormant metadata). This is the only direction metadata still
        // flows, and only when there is no snapshot to protect.
        const isComplete = Boolean(realStr(metaData.brand) && (realStr(metaData.product_name) || realStr(metaData.type)));
        const snapshot = ScheduleSnapshotSchema.parse(buildFFESnapshot(fixture, entry.schedule_category, isComplete));
        await createScheduleOption(tx, { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot });
      }
      await tx.projectScheduleEntry.update({
        where: { id: entry.id },
        data: {
          schedule_qty: entry.schedule_qty ?? metaData.qty ?? fixture.instance_count,
          schedule_unit: entry.schedule_unit ?? realStr(metaData.unit) ?? "pcs",
          schedule_location: entry.schedule_location ?? realStr(metaData.location_notes),
        },
      });
      await tx.sketchupFFE.update({ where: { id: fixtureId }, data: { metadata: nextMetadata as Prisma.InputJsonValue } });
      return entry.id;
    });
  } catch (error) {
    console.error(`[SKETCHUP_SYNC] Auto-link failed for fixture ${fixture.code}:`, error);
    throw error;
  }
}

/**
 * Plan and queue every rename needed to bring the SketchUp model in line with
 * the Product Schedule, for one project, in one pass.
 *
 * Called once at the end of a sync, after every material/fixture has been
 * linked — NOT per item. A per-item planner cannot resolve a swap: with two
 * items holding each other's target code, each one looks un-queueable on its
 * own. planConvergenceHops() sees the whole picture and emits temporary-code
 * hops so cycles of any length resolve (see catalog-ownership.ts).
 *
 * No-ops when a queue is already pending for this project: those actions are
 * in flight and the model has not caught up yet, so anything planned now
 * would be planned against a stale picture.
 */
export async function planCodeConvergence(
  sketchupProjectId: string,
  projectId: string
): Promise<number> {
  try {
    return await prisma.$transaction(async (tx) => {
      const pending = await tx.sketchupMergeAction.findFirst({
        where: { sketchup_project_id: sketchupProjectId, executed_at: null },
        select: { id: true },
      });
      if (pending) return 0;

      // Every material in the model, not just the linked ones: the unlinked
      // ones never move, but their codes are occupied and must be excluded
      // from the temporary-code band the plan allocates.
      const allMaterials = await tx.sketchupMaterial.findMany({
        where: { sketchup_project_id: sketchupProjectId },
        select: { code: true, linked_entry: { select: { schedule_prefix: true, schedule_increment: true } } },
      });

      const items = allMaterials
        .filter((mat) => mat.linked_entry)
        .map((mat) => ({
          modelCode: mat.code,
          scheduleCode: `${mat.linked_entry!.schedule_prefix}-${mat.linked_entry!.schedule_increment}`,
        }));

      // Reserved: every code the model currently holds (materials and
      // fixtures share the model's namespace), plus every code the schedule
      // has assigned in this project — a temp must not shadow either.
      const [allFixtures, allEntries] = await Promise.all([
        tx.sketchupFFE.findMany({
          where: { sketchup_project_id: sketchupProjectId },
          select: { code: true },
        }),
        tx.projectScheduleEntry.findMany({
          where: { project_id: projectId },
          select: { schedule_prefix: true, schedule_increment: true },
        }),
      ]);
      const reservedCodes = [
        ...allMaterials.map((mat) => mat.code),
        ...allFixtures.map((ffe) => ffe.code),
        ...allEntries.map((entry) => `${entry.schedule_prefix}-${entry.schedule_increment}`),
      ];

      const hops = planConvergenceHops(items, reservedCodes);
      if (hops.length === 0) return 0;

      let queueOrder = await getNextMergeQueueOrder(tx, sketchupProjectId);
      await tx.sketchupMergeAction.createMany({
        data: hops.map((hop) => ({
          sketchup_project_id: sketchupProjectId,
          source_code: hop.sourceCode,
          target_code: hop.targetCode,
          queue_order: queueOrder++,
        })),
      });

      console.warn(
        `[SKETCHUP_SYNC] Code divergence in project ${projectId}: queued ${hops.length} hop(s) so the model converges on the schedule.`
      );
      return hops.length;
    });
  } catch (error) {
    // Convergence planning is a reconciliation aid, never a reason to fail a
    // push that already stored the model's data successfully.
    console.error(`[SKETCHUP_SYNC] Convergence planning failed for project ${projectId}:`, error);
    return 0;
  }
}

// Bulk-remove empty placeholder schedule items: entries that are NOT backed by
// any SketchUp material/fixture AND carry no real content (name/brand/image/
// type/sku/color/finishing/notes/price/qty/location all blank or placeholder).
// Used to clear stale leftover slots without touching anything you've filled in.
export async function cleanupEmptyCatalogItemsAction(projectId: string) {
  try {
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const [entries, sketchupProject] = await Promise.all([
      prisma.projectScheduleEntry.findMany({
        where: { project_id: projectId },
        include: { options: { where: { is_final: true } } },
      }),
      prisma.sketchupProject.findFirst({
        where: { project_id: projectId },
        include: { materials: { select: { linked_entry_id: true } }, ffes: { select: { metadata: true } } },
      }),
    ]);

    // Entry ids that a SketchUp material/fixture points at — never delete these.
    const representedEntryIds = new Set<string>();
    for (const mat of sketchupProject?.materials ?? []) {
      if (mat.linked_entry_id) representedEntryIds.add(mat.linked_entry_id);
    }
    for (const ffe of sketchupProject?.ffes ?? []) {
      const meta = ffe.metadata && typeof ffe.metadata === "object" && !Array.isArray(ffe.metadata)
        ? ffe.metadata as Record<string, unknown>
        : {};
      if (typeof meta.linked_entry_id === "string") representedEntryIds.add(meta.linked_entry_id);
    }

    const PLACEHOLDER_NAMES = new Set(["MANUAL ITEM", "NEW ITEM"]);
    const toDelete: string[] = [];
    for (const entry of entries) {
      if (representedEntryIds.has(entry.id)) continue;
      const code = `${entry.schedule_prefix.toUpperCase()}-${entry.schedule_increment}`;
      // Values that merely echo the code or the category name ("Ceramic Tile"
      // on a CT item) are placeholders, not real content.
      const categoryEcho = new Set(
        [
          resolveCategoryLabel(entry.schedule_prefix, entry.schedule_category),
          entry.schedule_category,
          entry.schedule_prefix,
        ].map((v) => (v || "").trim().toUpperCase())
      );
      const isEcho = (v: string | null) =>
        !v || categoryEcho.has(v.trim().toUpperCase()) || normalizeCatalogCode(v) === code;
      const parsed = ScheduleSnapshotSchema.safeParse(entry.options[0]?.data_snapshot);
      const s = parsed.success ? parsed.data : null;

      const name = s ? realStr(s.catalog_product_name) : null;
      const nameReal = name && !PLACEHOLDER_NAMES.has(name.toUpperCase()) && !isEcho(name) ? name : null;
      const sku = s ? realStr(s.specs.catalog_sku) : null;
      const skuReal = sku && !isEcho(sku) ? sku : null;
      const color = s ? realStr(s.specs.catalog_color) : null;
      const colorReal = color && !isEcho(color) ? color : null;
      const subCat = s ? realStr(s.catalog_sub_category) : null;
      const subCatReal = subCat && !isEcho(subCat) ? subCat : null;
      const finishing = s ? realStr(s.specs.catalog_finishing) : null;
      const finishingReal = finishing && !isEcho(finishing) ? finishing : null;

      const hasContent = Boolean(
        nameReal ||
        (s && realStr(s.catalog_brand)) ||
        (s && realStr(s.catalog_image_url)) ||
        subCatReal ||
        finishingReal ||
        (s && realStr(s.specs.catalog_motif)) ||
        (s && realStr(s.catalog_notes)) ||
        (s && s.catalog_price != null) ||
        skuReal || colorReal ||
        entry.schedule_qty != null ||
        realStr(entry.schedule_location)
      );
      if (!hasContent) toDelete.push(entry.id);
    }

    if (toDelete.length === 0) {
      return { success: true, removed: 0 };
    }

    await prisma.$transaction(async (tx) => {
      await tx.sketchupMaterial.updateMany({ where: { linked_entry_id: { in: toDelete } }, data: { linked_entry_id: null } });
      await tx.projectScheduleEntry.deleteMany({ where: { id: { in: toDelete }, project_id: projectId } });
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "ProjectScheduleEntry", toDelete[0], userId, {
        project_id: projectId,
        source: "catalog_bulk_cleanup",
        removed_count: toDelete.length,
        removed_ids: toDelete,
      });
    });

    revalidateCatalog(projectId);
    return { success: true, removed: toDelete.length };
  } catch (error) {
    console.error("[CLEANUP_EMPTY_CATALOG_ITEMS_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to clean up empty catalog items.") };
  }
}

// FULL RESET: delete EVERY schedule entry (materials + fixtures) and all
// SketchUp staging rows for the project. Destructive — the UI must double-confirm.
// The SketchUp model itself is untouched; a fresh push repopulates everything.
export async function resetCatalogAction(projectId: string) {
  try {
    // "Remove all" is a bulk version of the per-card delete, so anyone who can
    // delete cards (DELETE permission — ADMIN and DIC) may reset the whole
    // schedule — but only on a project they're a member of. Any SketchUp
    // staging cleared here is recoverable on the next plugin push (SketchUp
    // remains the source of truth for synced items).
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const result = await prisma.$transaction(async (tx) => {
      const entries = await tx.projectScheduleEntry.findMany({
        where: { project_id: projectId },
        select: { id: true },
      });
      const ids = entries.map((e) => e.id);
      await tx.sketchupMaterial.updateMany({
        where: { linked_entry_id: { in: ids } },
        data: { linked_entry_id: null },
      });
      const deleted = await tx.projectScheduleEntry.deleteMany({ where: { project_id: projectId } });
      // Clear staging too so the next push starts clean.
      const sp = await tx.sketchupProject.findFirst({ where: { project_id: projectId }, select: { id: true } });
      if (sp) {
        await tx.sketchupMaterial.deleteMany({ where: { sketchup_project_id: sp.id } });
        await tx.sketchupFFE.deleteMany({ where: { sketchup_project_id: sp.id } });
        await tx.sketchupMergeAction.deleteMany({ where: { sketchup_project_id: sp.id } });
      }
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "Project", projectId, userId, {
        project_id: projectId,
        source: "catalog_full_reset",
        removed_count: deleted.count,
      });
      return deleted.count;
    });

    revalidateCatalog(projectId);
    return { success: true, removed: result };
  } catch (error) {
    console.error("[RESET_CATALOG_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to reset the schedule.") };
  }
}

const CatalogCodeOrderGroupSchema = z.object({
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]*$/).max(20),
  orderedEntryIds: z.array(z.string().uuid()).min(1).max(500),
  reservedEntryIds: z.array(z.string().uuid()).max(500),
});

const CatalogCodeOrderBatchSchema = z
  .array(CatalogCodeOrderGroupSchema)
  .min(1)
  .max(50)
  .superRefine((groups, ctx) => {
    const usedPrefixes = new Set<string>();
    const usedEntryIds = new Set<string>();
    groups.forEach((group, groupIndex) => {
      if (usedPrefixes.has(group.prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Code group ${group.prefix} appears more than once.`,
          path: [groupIndex, "prefix"],
        });
      }
      usedPrefixes.add(group.prefix);

      const orderedIds = new Set(group.orderedEntryIds);
      if (orderedIds.size !== group.orderedEntryIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Code group ${group.prefix} contains a duplicate item.`,
          path: [groupIndex, "orderedEntryIds"],
        });
      }
      for (const entryId of group.reservedEntryIds) {
        if (!orderedIds.has(entryId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A reserved item must belong to its reviewed code group.",
            path: [groupIndex, "reservedEntryIds"],
          });
        }
      }
      for (const entryId of group.orderedEntryIds) {
        if (usedEntryIds.has(entryId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "An item can only appear in one reviewed code group.",
            path: [groupIndex, "orderedEntryIds"],
          });
        }
        usedEntryIds.add(entryId);
      }
    });
  });

type CatalogCodeSnapshotEntry = {
  schedule_prefix: string;
  options: { id: string; data_snapshot: Prisma.JsonValue | null }[];
};

async function patchCatalogSnapshotCode(
  tx: PrismaTransaction,
  entry: CatalogCodeSnapshotEntry,
  oldIncrement: number,
  newIncrement: number
) {
  const oldCode = normalizeCatalogCode(`${entry.schedule_prefix}-${oldIncrement}`);
  const newCode = normalizeCatalogCode(`${entry.schedule_prefix}-${newIncrement}`);
  if (oldCode === newCode) return;

  for (const option of entry.options) {
    const snapshot = option.data_snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;
    const snapshotObject = { ...(snapshot as Record<string, unknown>) };
    const specs = (
      snapshotObject.specs &&
      typeof snapshotObject.specs === "object" &&
      !Array.isArray(snapshotObject.specs)
    )
      ? { ...(snapshotObject.specs as Record<string, unknown>) }
      : {};
    let dirty = false;

    if (
      typeof snapshotObject.schedule_code === "string" &&
      normalizeCatalogCode(snapshotObject.schedule_code) === oldCode
    ) {
      snapshotObject.schedule_code = newCode;
      dirty = true;
    }
    if (
      typeof specs.catalog_sku === "string" &&
      normalizeCatalogCode(specs.catalog_sku) === oldCode
    ) {
      specs.catalog_sku = newCode;
      snapshotObject.specs = specs;
      dirty = true;
    }
    if (dirty) {
      await updateScheduleOptionSnapshot(tx, option.id, ScheduleSnapshotSchema.parse(snapshotObject));
    }
  }
}

// Unified Catalog Board code management. The Product Schedule is updated
// immediately and atomically; SketchUp rows are only bridge identities used
// to derive the queued model renames for the next Pull/Sync.
export async function applyCatalogCodeOrderAction(projectId: string, input: unknown) {
  try {
    const { role, userId } = await requireCatalogEditor(
      projectId,
      PERMISSION.PLUGIN_SCHEDULE_EDIT
    );
    const parsedInput = CatalogCodeOrderBatchSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        error:
          parsedInput.error.issues[0]?.message ||
          "The reviewed code order is invalid.",
      };
    }

    const groups = parsedInput.data;
    const result = await prisma.$transaction(async (tx) => {
      const sketchupProject = await tx.sketchupProject.findFirst({
        where: { project_id: projectId },
        select: { id: true },
      });
      const allEntryIds = groups.flatMap((group) => group.orderedEntryIds);
      const selectedEntries = await tx.projectScheduleEntry.findMany({
        where: {
          project_id: projectId,
          id: { in: allEntryIds },
          section: ProductType.material,
        },
        include: { options: true, prefix_ref: true },
      });
      if (selectedEntries.length !== allEntryIds.length) {
        throw new Error("One or more reviewed materials are no longer available.");
      }
      const selectedById = new Map(selectedEntries.map((entry) => [entry.id, entry]));

      const stagedMaterials = sketchupProject
        ? await tx.sketchupMaterial.findMany({
            where: { sketchup_project_id: sketchupProject.id },
            select: {
              id: true,
              code: true,
              linked_entry_id: true,
              is_reserved: true,
            },
          })
        : [];
      const stagedByEntryId = new Map(
        stagedMaterials.flatMap((material) =>
          material.linked_entry_id
            ? [[material.linked_entry_id, material] as const]
            : []
        )
      );

      const plannedGroups: {
        prefix: string;
        categoryEntries: typeof selectedEntries;
        desiredOrder: string[];
        targetIncrementById: Map<string, number>;
        desiredReservedEntryIds: Set<string>;
      }[] = [];

      for (const group of groups) {
        const firstEntry = selectedById.get(group.orderedEntryIds[0]);
        if (!firstEntry) throw new Error("The reviewed code group is no longer available.");
        if (
          firstEntry.schedule_prefix.trim().toUpperCase() !== group.prefix ||
          group.orderedEntryIds.some((entryId) => {
            const entry = selectedById.get(entryId);
            return (
              !entry ||
              entry.section !== ProductType.material ||
              entry.schedule_category !== firstEntry.schedule_category ||
              entry.schedule_prefix.trim().toUpperCase() !== group.prefix
            );
          })
        ) {
          throw new Error("Each code group must contain one complete material category.");
        }

        const categoryEntries = await tx.projectScheduleEntry.findMany({
          where: {
            project_id: projectId,
            section: ProductType.material,
            schedule_category: firstEntry.schedule_category,
          },
          include: { options: true, prefix_ref: true },
          orderBy: [
            { schedule_increment: "asc" },
            { created_at: "asc" },
            { id: "asc" },
          ],
        });
        const categoryIds = new Set(categoryEntries.map((entry) => entry.id));
        if (
          categoryEntries.length !== group.orderedEntryIds.length ||
          group.orderedEntryIds.some((entryId) => !categoryIds.has(entryId))
        ) {
          throw new Error(
            `The ${group.prefix} group changed while reviewing this draft. Nothing was applied.`
          );
        }

        const desiredReservedEntryIds = new Set(group.reservedEntryIds);
        const reservedNumbers = new Set<number>();
        for (const entryId of desiredReservedEntryIds) {
          const entry = categoryEntries.find((candidate) => candidate.id === entryId);
          const staged = stagedByEntryId.get(entryId);
          if (!entry || !staged) {
            throw new Error("Only materials linked to SketchUp can reserve a code.");
          }
          if (
            entry.schedule_increment < 1 ||
            entry.schedule_increment > categoryEntries.length ||
            reservedNumbers.has(entry.schedule_increment)
          ) {
            throw new Error(
              `${group.prefix} has a reserved number outside the normalized range. Unreserve it before applying this order.`
            );
          }
          reservedNumbers.add(entry.schedule_increment);
        }

        const entryById = new Map(categoryEntries.map((entry) => [entry.id, entry]));
        const targetIncrementById = new Map<string, number>();
        let nextIncrement = 1;
        for (const entryId of group.orderedEntryIds) {
          const entry = entryById.get(entryId);
          if (!entry) throw new Error("The reviewed code group is incomplete.");
          if (desiredReservedEntryIds.has(entryId)) {
            targetIncrementById.set(entryId, entry.schedule_increment);
            continue;
          }
          while (reservedNumbers.has(nextIncrement)) nextIncrement += 1;
          targetIncrementById.set(entryId, nextIncrement);
          nextIncrement += 1;
        }

        if (
          new Set(targetIncrementById.values()).size !== categoryEntries.length ||
          [...targetIncrementById.values()].some(
            (increment) => increment < 1 || increment > categoryEntries.length
          )
        ) {
          throw new Error(
            `The ${group.prefix} reservation plan cannot produce a safe sequence. Nothing was applied.`
          );
        }

        const desiredOrder = [...group.orderedEntryIds].sort(
          (leftId, rightId) =>
            targetIncrementById.get(leftId)! - targetIncrementById.get(rightId)!
        );
        plannedGroups.push({
          prefix: group.prefix,
          categoryEntries,
          desiredOrder,
          targetIncrementById,
          desiredReservedEntryIds,
        });
      }

      const stagedCodeChanges = plannedGroups.flatMap((plan) =>
        plan.categoryEntries.flatMap((entry) => {
          const staged = stagedByEntryId.get(entry.id);
          const targetIncrement = plan.targetIncrementById.get(entry.id);
          if (!staged || !targetIncrement) return [];
          const targetCode = normalizeCatalogCode(
            `${entry.schedule_prefix}-${targetIncrement}`
          );
          const sourceCode = normalizeCatalogCode(staged.code);
          return sourceCode === targetCode
            ? []
            : [{ material: staged, sourceCode, targetCode, prefix: plan.prefix }];
        })
      );
      const reservationChanges = plannedGroups.flatMap((plan) =>
        plan.categoryEntries.flatMap((entry) => {
          const staged = stagedByEntryId.get(entry.id);
          if (!staged) return [];
          const isReserved = plan.desiredReservedEntryIds.has(entry.id);
          return staged.is_reserved === isReserved
            ? []
            : [{ material: staged, entryId: entry.id, isReserved }];
        })
      );

      if ((stagedCodeChanges.length > 0 || reservationChanges.length > 0) && role !== "DEVELOPER") {
        throw new Error(
          "Only the plugin admin can apply code changes that affect a linked SketchUp model."
        );
      }
      if ((stagedCodeChanges.length > 0 || reservationChanges.length > 0) && !sketchupProject) {
        throw new Error("The linked SketchUp model is no longer available.");
      }
      if (sketchupProject && (stagedCodeChanges.length > 0 || reservationChanges.length > 0)) {
        await assertNoPendingMergeActions(tx, sketchupProject.id);
      }

      const changingSourceCodes = new Set(
        stagedCodeChanges.map((change) => change.sourceCode)
      );
      const stagedByCode = new Map(
        stagedMaterials.map((material) => [normalizeCatalogCode(material.code), material])
      );
      for (const change of stagedCodeChanges) {
        const occupant = stagedByCode.get(change.targetCode);
        if (occupant && !changingSourceCodes.has(change.targetCode)) {
          throw new Error(
            `${change.targetCode} is still occupied by another SketchUp material. Sync or link it before applying this order.`
          );
        }
      }

      for (const reservation of reservationChanges) {
        await tx.sketchupMaterial.update({
          where: { id: reservation.material.id },
          data: { is_reserved: reservation.isReserved },
        });
      }

      let changedEntries = 0;
      for (const plan of plannedGroups) {
        const reorderResult = await ScheduleService.applyReviewedEntryOrder(
          tx,
          projectId,
          plan.desiredOrder,
          userId
        );
        const changeById = new Map(
          reorderResult.changes.map((change) => [change.id, change])
        );
        for (const entry of plan.categoryEntries) {
          const change = changeById.get(entry.id);
          const expectedIncrement = plan.targetIncrementById.get(entry.id);
          if (!change || change.afterIncrement !== expectedIncrement) {
            throw new Error(
              `The ${plan.prefix} sequence changed while applying this draft. Nothing was applied.`
            );
          }
          if (change.beforeIncrement !== change.afterIncrement) {
            changedEntries += 1;
            await patchCatalogSnapshotCode(
              tx,
              entry,
              change.beforeIncrement,
              change.afterIncrement
            );
          }
        }
      }

      let queuedChanges = 0;
      if (sketchupProject && stagedCodeChanges.length > 0) {
        const nextTemporaryNumber = new Map<string, number>();
        for (const material of stagedMaterials) {
          const parsedCode = parseMaterialCode(material.code);
          if (!parsedCode) continue;
          nextTemporaryNumber.set(
            parsedCode.prefix,
            Math.max(
              nextTemporaryNumber.get(parsedCode.prefix) ?? 1,
              parsedCode.number + 1
            )
          );
        }
        const tempChanges: TempHopChange[] = stagedCodeChanges.map((change) => {
          const temporaryNumber = nextTemporaryNumber.get(change.prefix) ?? 1;
          nextTemporaryNumber.set(change.prefix, temporaryNumber + 1);
          return {
            sourceCode: change.material.code,
            temporaryCode: `${change.prefix}-${temporaryNumber}`,
            targetCode: change.targetCode,
          };
        });
        let queueOrder = await getNextMergeQueueOrder(tx, sketchupProject.id);
        const nextQueueOrder = () => queueOrder++;
        const queueRows = tempChangesToRows(
          sketchupProject.id,
          tempChanges,
          nextQueueOrder
        );
        if (queueRows.length > 0) {
          await tx.sketchupMergeAction.createMany({ data: queueRows });
          queuedChanges = queueRows.length;
        }
      }

      await insertAuditLog(
        tx,
        AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT,
        "Project",
        projectId,
        userId,
        {
          project_id: projectId,
          source: "catalog_code_manager_apply",
          groups: plannedGroups.map((plan) => ({
            prefix: plan.prefix,
            ordered_entry_ids: plan.desiredOrder,
            reserved_entry_ids: [...plan.desiredReservedEntryIds],
          })),
          changed_entry_count: changedEntries,
          reservation_change_count: reservationChanges.length,
          queued_change_count: queuedChanges,
        }
      );

      return {
        groups: plannedGroups.length,
        changedEntries,
        reservationChanges: reservationChanges.length,
        queued: queuedChanges > 0,
        queuedChanges,
      };
    });

    revalidateCatalog(projectId);
    return { success: true, ...result };
  } catch (error) {
    console.error("[APPLY_CATALOG_CODE_ORDER_ERROR]", error);
    return {
      error: getActionErrorMessage(
        error,
        "Failed to apply the reviewed code order."
      ),
    };
  }
}

const CatalogSwapPairSchema = z.object({
  aEntryId: z.string().uuid(),
  bEntryId: z.string().uuid(),
});

const CatalogSwapBatchSchema = z.array(CatalogSwapPairSchema).min(1).max(50).superRefine((pairs, ctx) => {
  const usedEntryIds = new Set<string>();

  pairs.forEach((pair, index) => {
    if (pair.aEntryId === pair.bEntryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose two different items to swap.",
        path: [index],
      });
    }

    for (const entryId of [pair.aEntryId, pair.bEntryId]) {
      if (usedEntryIds.has(entryId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An item can only appear in one pending swap.",
          path: [index],
        });
      }
      usedEntryIds.add(entryId);
    }
  });
});

// Browser code swaps are submitted as one reviewed batch. Until this action is
// called, the draft exists only in client memory. Once called, every schedule
// swap, snapshot adjustment, audit row, and SketchUp queue row succeeds or
// rolls back together in a single transaction.
export async function applyCatalogItemSwapsAction(projectId: string, input: unknown) {
  try {
    const { role, userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_EDIT);
    const parsedInput = CatalogSwapBatchSchema.safeParse(input);
    if (!parsedInput.success) {
      return { error: parsedInput.error.issues[0]?.message || "The pending swaps are invalid." };
    }

    const swaps = parsedInput.data;
    const entryIds = swaps.flatMap((pair) => [pair.aEntryId, pair.bEntryId]);

    const result = await prisma.$transaction(async (tx) => {
      const entries = await tx.projectScheduleEntry.findMany({
        where: { id: { in: entryIds }, project_id: projectId },
        include: { options: true },
      });
      if (entries.length !== entryIds.length) {
        throw new Error("One or more items were not found for this project.");
      }

      const entryById = new Map(entries.map((entry) => [entry.id, entry]));
      const stagedMaterials = await tx.sketchupMaterial.findMany({
        where: {
          linked_entry_id: { in: entryIds },
          sketchup_project: { project_id: projectId },
        },
        select: { id: true, code: true, linked_entry_id: true, is_reserved: true },
      });
      const stagedByEntryId = new Map(
        stagedMaterials.flatMap((material) =>
          material.linked_entry_id ? [[material.linked_entry_id, material] as const] : []
        )
      );

      const allFfes = await tx.sketchupFFE.findMany({
        where: { sketchup_project: { project_id: projectId } },
        select: { metadata: true },
      });
      const linkedFfeEntryIds = new Set<string>();
      for (const ffe of allFfes) {
        const metadata = ffe.metadata;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
        const linkedEntryId = (metadata as Record<string, unknown>).linked_entry_id;
        if (typeof linkedEntryId === "string") linkedFfeEntryIds.add(linkedEntryId);
      }

      const pairs = swaps.map((pair) => {
        const entryA = entryById.get(pair.aEntryId);
        const entryB = entryById.get(pair.bEntryId);
        if (!entryA || !entryB) throw new Error("One or more items were not found for this project.");
        if (entryA.section !== entryB.section) {
          throw new Error("Materials and fixtures can't swap codes with each other.");
        }
        if (
          entryA.schedule_category !== entryB.schedule_category ||
          entryA.schedule_prefix.toUpperCase() !== entryB.schedule_prefix.toUpperCase()
        ) {
          throw new Error("Items can only swap codes within the same category.");
        }
        if (linkedFfeEntryIds.has(entryA.id) || linkedFfeEntryIds.has(entryB.id)) {
          throw new Error("Synced fixtures can't swap codes from here — rename them in SketchUp and push.");
        }

        const stagedA = stagedByEntryId.get(entryA.id) ?? null;
        const stagedB = stagedByEntryId.get(entryB.id) ?? null;
        if ((stagedA === null) !== (stagedB === null)) {
          throw new Error("A synced item can only swap with another synced item (or manual with manual).");
        }
        if (stagedA && stagedB) {
          if (role !== "DEVELOPER") {
            throw new Error("Only the plugin admin can swap synced items (the change must be applied in SketchUp).");
          }
          if (stagedA.is_reserved || stagedB.is_reserved) {
            throw new Error("Remove the reservation before swapping these materials.");
          }
          const parsedA = parseMaterialCode(stagedA.code);
          const parsedB = parseMaterialCode(stagedB.code);
          if (!parsedA || !parsedB) throw new Error("Only materials with a valid code can be swapped.");
          if (parsedA.prefix !== parsedB.prefix) {
            throw new Error("Items can only swap codes within the same category.");
          }
        }

        return { entryA, entryB, stagedA, stagedB };
      });

      const syncedPairs = pairs.filter((pair) => pair.stagedA && pair.stagedB);
      let queuedChanges = 0;
      if (syncedPairs.length > 0) {
        const sketchupProject = await tx.sketchupProject.findFirst({
          where: { project_id: projectId },
          select: { id: true },
        });
        if (!sketchupProject) throw new Error("SketchUp model was not found for this project.");
        await assertNoPendingMergeActions(tx, sketchupProject.id);

        const allMaterials = await tx.sketchupMaterial.findMany({
          where: { sketchup_project_id: sketchupProject.id },
          select: { code: true },
        });
        const nextTemporaryNumber = new Map<string, number>();
        for (const material of allMaterials) {
          const parsedCode = parseMaterialCode(material.code);
          if (!parsedCode) continue;
          nextTemporaryNumber.set(
            parsedCode.prefix,
            Math.max(nextTemporaryNumber.get(parsedCode.prefix) ?? 1, parsedCode.number + 1)
          );
        }

        const tempChanges: TempHopChange[] = [];
        for (const pair of syncedPairs) {
          if (!pair.stagedA || !pair.stagedB) continue;
          const parsedA = parseMaterialCode(pair.stagedA.code);
          if (!parsedA) throw new Error("Only materials with a valid code can be swapped.");
          const tempA = nextTemporaryNumber.get(parsedA.prefix) ?? 1;
          const tempB = tempA + 1;
          nextTemporaryNumber.set(parsedA.prefix, tempB + 1);
          tempChanges.push(
            {
              sourceCode: pair.stagedA.code,
              temporaryCode: `${parsedA.prefix}-${tempA}`,
              targetCode: pair.stagedB.code,
            },
            {
              sourceCode: pair.stagedB.code,
              temporaryCode: `${parsedA.prefix}-${tempB}`,
              targetCode: pair.stagedA.code,
            }
          );
        }

        let queueOrder = await getNextMergeQueueOrder(tx, sketchupProject.id);
        const nextQueueOrder = () => queueOrder++;
        const queueRows = tempChangesToRows(sketchupProject.id, tempChanges, nextQueueOrder);
        if (queueRows.length > 0) {
          await tx.sketchupMergeAction.createMany({ data: queueRows });
          queuedChanges = queueRows.length;
        }
      }

      const patchSnapshotCode = async (
        entry: (typeof entries)[number],
        oldIncrement: number,
        newIncrement: number
      ) => {
        const oldCode = normalizeCatalogCode(`${entry.schedule_prefix}-${oldIncrement}`);
        const newCode = normalizeCatalogCode(`${entry.schedule_prefix}-${newIncrement}`);
        if (oldCode === newCode) return;

        for (const option of entry.options) {
          const snapshot = option.data_snapshot;
          if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;
          const snapshotObject = { ...(snapshot as Record<string, unknown>) };
          const specs = (
            snapshotObject.specs &&
            typeof snapshotObject.specs === "object" &&
            !Array.isArray(snapshotObject.specs)
          )
            ? { ...(snapshotObject.specs as Record<string, unknown>) }
            : {};
          let dirty = false;

          if (
            typeof snapshotObject.schedule_code === "string" &&
            normalizeCatalogCode(snapshotObject.schedule_code) === oldCode
          ) {
            snapshotObject.schedule_code = newCode;
            dirty = true;
          }
          if (
            typeof specs.catalog_sku === "string" &&
            normalizeCatalogCode(specs.catalog_sku) === oldCode
          ) {
            specs.catalog_sku = newCode;
            snapshotObject.specs = specs;
            dirty = true;
          }
          if (dirty) {
            await updateScheduleOptionSnapshot(tx, option.id, ScheduleSnapshotSchema.parse(snapshotObject));
          }
        }
      };

      // Rebuild each affected category from the codes the user reviewed, apply
      // all disjoint position swaps, and normalize once per category. This
      // avoids false stale-draft failures caused by legacy sort-order drift.
      const swapResult = await ScheduleService.swapEntriesBatch(
        tx,
        projectId,
        pairs.map((pair) => ({ idA: pair.entryA.id, idB: pair.entryB.id })),
        userId
      );
      const codeChangeByEntryId = new Map(
        swapResult.changes.map((change) => [change.id, change])
      );

      for (const pair of pairs) {
        const changeA = codeChangeByEntryId.get(pair.entryA.id);
        const changeB = codeChangeByEntryId.get(pair.entryB.id);
        if (!changeA || !changeB) {
          throw new Error("The swapped entries could not be reloaded.");
        }
        if (
          changeA.beforeIncrement !== pair.entryA.schedule_increment ||
          changeB.beforeIncrement !== pair.entryB.schedule_increment ||
          changeA.afterIncrement !== pair.entryB.schedule_increment ||
          changeB.afterIncrement !== pair.entryA.schedule_increment
        ) {
          throw new Error(
            "The category changed while applying this draft. Nothing was applied."
          );
        }
        await patchSnapshotCode(pair.entryA, changeA.beforeIncrement, changeA.afterIncrement);
        await patchSnapshotCode(pair.entryB, changeB.beforeIncrement, changeB.afterIncrement);
      }

      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "Project", projectId, userId, {
        project_id: projectId,
        source: "catalog_bulk_swap_apply",
        swap_count: pairs.length,
        swaps: pairs.map((pair) => ({
          entry_a_id: pair.entryA.id,
          entry_b_id: pair.entryB.id,
          code_a: `${pair.entryA.schedule_prefix}-${pair.entryA.schedule_increment}`,
          code_b: `${pair.entryB.schedule_prefix}-${pair.entryB.schedule_increment}`,
        })),
        queued_to_sketchup: queuedChanges > 0,
        queued_change_count: queuedChanges,
      });

      return {
        applied: pairs.length,
        queued: queuedChanges > 0,
        queuedChanges,
      };
    });

    revalidateCatalog(projectId);
    return { success: true, ...result };
  } catch (error) {
    console.error("[APPLY_CATALOG_ITEM_SWAPS_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to apply the pending swaps.") };
  }
}

// Backward-compatible single-pair entry point. New browser UI submits the
// reviewed batch through applyCatalogItemSwapsAction.
export async function swapCatalogItemsAction(projectId: string, aEntryId: string, bEntryId: string) {
  return applyCatalogItemSwapsAction(projectId, [{ aEntryId, bEntryId }]);
}

// "Push to Library" — promote a schedule/catalog item into the shared, vendor-
// scoped ProductCatalog (the Library). Every board item is backed by a schedule
// entry+option whose data_snapshot already uses catalog_* fields that map 1:1
// to ProductCatalog, so this is a straight field copy through the existing,
// battle-tested LibraryService.createProduct (vendor resolution + SKU/brand
// dedupe + validation). The linked option records product_catalog_id so the
// item is recognised as "in Library". Gated to ADMIN/STAFF, matching the rest
// of Library creation (STAFF entries land as PENDING for admin review); this
// never touches the SketchUp model.
const PROJECT_CODE_TOKEN = /\b[A-Za-z]{1,4}-\d+\b/g;

function isProjectRelativeRef(
  value: string | null | undefined,
  projectCodes: ReadonlySet<string>
): boolean {
  const normalized = (value ?? "").trim();
  if (!normalized) return false;
  const tokens = normalized.match(PROJECT_CODE_TOKEN) ?? [];
  return tokens.some((token) => projectCodes.has(normalizeCatalogCode(token)));
}

export async function saveCatalogItemToLibraryAction(projectId: string, entryId: string) {
  try {
    const { role, userId } = await requireSession();
    // Library curation (not a SketchUp-plugin action): admin-level (ADMIN,
    // DEVELOPER) and STAFF may push. Kept in sync with page's canSaveToLibrary.
    if (!isAdminLevel(role) && role !== "STAFF") {
      return { error: "Only admins and staff can save items to the shared Library." };
    }

    const option = await prisma.projectScheduleOption.findFirst({
      where: { entry: { id: entryId, project_id: projectId } },
      orderBy: [{ is_final: "desc" }, { option_label: "asc" }],
      include: { entry: true },
    });
    if (!option) return { error: "Catalog item was not found for this project." };
    // A recorded link only counts if the Library product still exists. Library
    // deletes are soft (deleted_at) and don't cascade the FK to null, so a
    // previously-pushed item keeps a stale sku_id after it's removed
    // in the Library. Treat that as unlinked so the user can push again; the
    // stale id is overwritten in the transaction below.
    if (option.sku_id) {
      const linkedProduct = await prisma.sku.findUnique({
        where: { id: option.sku_id },
        select: { id: true, deleted_at: true },
      });
      if (linkedProduct && !linkedProduct.deleted_at) {
        return { error: "This item is already saved to the Library." };
      }
    }

    const parsed = ScheduleSnapshotSchema.safeParse(option.data_snapshot);
    if (!parsed.success) {
      return { error: "This item's data is incomplete; fill it in before saving to the Library." };
    }
    const snap = parsed.data;

    const brand = realStr(snap.catalog_brand);
    if (!brand || isPlaceholderish(brand)) {
      return { error: "Add a real Brand to this item before saving it to the Library." };
    }
    const vendorId = realStr(snap.catalog_vendor_id);
    if (!vendorId) {
      return {
        error:
          "No vendor linked yet. Add the Material from Master Data so the vendor isn't guessed dari Brand.",
      };
    }
    // Identity must come from real product data — NEVER the project code
    // (e.g. "PL-1"), which is an internal per-project sequence, not a vendor
    // SKU. The same code can mean different products across projects, so using
    // it as the Library key would cause false-duplicate collisions.
    //
    // The studio's own convention puts the SKU-ish identity in TYPE (e.g.
    // "ESG 5800N The Frost", or a generic "Emulsion Paint" when the exact
    // product isn't known yet), so Type counts as identity too — but only when
    // it's genuinely typed content, not an echo of the category label ("High
    // Pressure Laminate" on a PL card says nothing about the product).
    const categoryLabel = resolveCategoryLabel(option.entry.schedule_prefix, option.entry.schedule_category);
    const typeRaw = realStr(snap.catalog_sub_category);
    const typeEcho = new Set(
      [categoryLabel, option.entry.schedule_category, option.entry.schedule_prefix]
        .map((value) => (value || "").trim().toUpperCase())
    );
    const typeIdentity = typeRaw && !typeEcho.has(typeRaw.toUpperCase()) ? typeRaw : null;
    const sku = realStr(snap.specs.catalog_sku);
    const name = realStr(snap.catalog_product_name) || typeIdentity;
    if (!sku && !name) {
      return { error: "Fill in at least one of Item No, Name, or Type (e.g. \"ESG 5800N The Frost\") before saving to the Library — the project code (PL-1) isn't a product identity." };
    }

    const rawMotif = realStr(snap.specs.catalog_motif);
    const rawColor = realStr(snap.specs.catalog_color);
    const rawFinishing = realStr(snap.specs.catalog_finishing);
    const projectCodeRows = await prisma.projectScheduleEntry.findMany({
      where: { project_id: projectId },
      select: { schedule_prefix: true, schedule_increment: true },
    });
    const projectCodes = new Set(
      projectCodeRows.map((entry) => normalizeCatalogCode(`${entry.schedule_prefix}-${entry.schedule_increment}`))
    );

    const input: ProductCatalogInput = {
      brand_id: vendorId,
      catalog_brand: brand,
      catalog_category: (snap.schedule_category || option.entry.schedule_category || "GENERAL").trim().toUpperCase(),
      catalog_type: snap.catalog_type === "fixture" ? ProductType.fixture : ProductType.material,
      catalog_sub_category: realStr(snap.catalog_sub_category) || undefined,
      // Guaranteed non-empty by the identity check above (sku or name).
      catalog_sku: (sku || name) as string,
      catalog_product_name: (name || sku) as string,
      catalog_motif: rawMotif && !isProjectRelativeRef(rawMotif, projectCodes) ? rawMotif : undefined,
      catalog_tags: Array.isArray(snap.specs.catalog_structured_tags) ? snap.specs.catalog_structured_tags : [],
      catalog_dimension_p: realStr(snap.specs.catalog_dimension_p) || undefined,
      catalog_dimension_l: realStr(snap.specs.catalog_dimension_l) || undefined,
      catalog_dimension_t: realStr(snap.specs.catalog_dimension_t) || undefined,
      catalog_dimension_unit: realStr(snap.specs.catalog_dimension_unit) || "cm",
      // Was `: "N/A"`. Colour is nullable now, so an unknown colour is stored
      // as NULL instead of the placeholder string the import rules forbid.
      catalog_color: rawColor && !isProjectRelativeRef(rawColor, projectCodes) ? rawColor : "",
      catalog_finishing: rawFinishing && !isProjectRelativeRef(rawFinishing, projectCodes) ? rawFinishing : undefined,
      catalog_image_url: realStr(snap.catalog_image_url) || undefined,
      catalog_reference_url: realStr(snap.catalog_reference_url) || realStr(snap.specs.catalog_reference_url) || undefined,
      catalog_price: snap.catalog_price ?? null,
      // Always land as PENDING: "push to Library" proposes the item; formal
      // APPROVAL (which hard-requires image + color + vendor) stays a deliberate
      // action in the Library UI, so a photo-less card never fails at push time.
      catalog_status: LibraryItemStatus.PENDING,
    };

    const result = await prisma.$transaction(async (tx) => {
      let product: { id: string };
      let reused = false;
      try {
        product = await LibraryService.createProduct(input, userId, tx);
      } catch (createError) {
        // If the same brand+SKU already lives in the Library, link to it rather
        // than failing — the intent is "this item is in the Library".
        const message = createError instanceof Error ? createError.message : String(createError);
        if (/duplicate/i.test(message)) {
          const existing = await tx.sku.findFirst({
            where: {
              // Master Data v2: Brand.name (was brand_name), Sku.code (was catalog_sku).
              brand: { name: { equals: brand, mode: "insensitive" } },
              code: input.catalog_sku,
              deleted_at: null,
            },
            select: { id: true },
          });
          if (!existing) throw createError;
          product = existing;
          reused = true;
        } else {
          throw createError;
        }
      }
      // eslint-disable-next-line no-restricted-syntax -- non-snapshot update: only links sku_id, no data_snapshot
      await tx.projectScheduleOption.update({
        where: { id: option.id },
        data: { sku_id: product.id },
      });
      await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_CREATE, "Sku", product.id, userId, {
        project_id: projectId,
        entry_id: entryId,
        source: "catalog_save_to_library",
        sku: input.catalog_sku,
        reused,
      });
      return { productId: product.id, reused };
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    revalidateCatalog(projectId);
    return { success: true, productId: result.productId, reused: result.reused, sku: input.catalog_sku };
  } catch (error) {
    console.error("[SAVE_TO_LIBRARY_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to save this item to the Library.") };
  }
}

function calculateInitialsType(data: { catalog_motif?: string | null; catalog_color?: string | null; catalog_finishing?: string | null }) {
  return Array.from(new Set([data.catalog_motif, data.catalog_color, data.catalog_finishing])).filter(Boolean).join(" / ") || null;
}

function splitColorSize(value: string | null | undefined) {
  const normalized = realStr(value);
  if (!normalized) return { color: null, dimensions: null };
  const parts = normalized.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { color: normalized, dimensions: null };
  return { color: parts[0] || null, dimensions: parts.slice(1).join(" / ") || null };
}

function buildMaterialSnapshot(
  mat: {
    code: string;
    brand: string | null;
    type: string | null;
    finish: string | null;
    image_url: string | null;
    category: string;
    item_no?: string | null;
    color_size?: string | null;
    unit_cost?: number | null;
    notes?: string | null;
    reference_url?: string | null;
    catalog_fields?: CatalogFieldKey[] | null;
  },
  _isComplete: boolean
): ScheduleSnapshot {
  void _isComplete;
  const colorSize = splitColorSize(mat.color_size);
  // No echo fallbacks: an empty field stays empty. Previously the material code
  // was written into color/sku (and Type into name/finishing) so sparse synced
  // drafts would pass validation — that leaked "CT-3" into Color, "PL-1" into
  // the Library SKU, and duplicated the Type as a card title. Sparse synced
  // drafts are now allowed by ScheduleSnapshotSchema via the sketchup_plugin
  // origin exemption instead.
  const color = colorSize.color;
  const finishing = realStr(mat.finish);
  return {
    snapshot_source_kind: "manual",
    snapshot_source_origin: "sketchup_plugin",
    snapshot_source_external_id: mat.code,
    product_catalog_id: null,
    catalog_type: "material",
    schedule_category: mat.category,
    catalog_sub_category: realStr(mat.type),
    catalog_product_name: null,
    catalog_brand: realStr(mat.brand) || "Custom",
    catalog_initials_type: calculateInitialsType({
      catalog_motif: null,
      catalog_color: color,
      catalog_finishing: finishing,
    }),
    catalog_price: mat.unit_cost ?? null,
    catalog_notes: mat.notes ?? null,
    catalog_image_url: realStr(mat.image_url),
    catalog_reference_url: realStr(mat.reference_url),
    catalog_contact_name: null,
    catalog_contact_phone: null,
    catalog_contact_email: null,
    catalog_has_sample: false,
    specs: {
      catalog_sku: realStr(mat.item_no),
      catalog_motif: null,
      catalog_structured_tags: [],
      catalog_dimensions: colorSize.dimensions || "N/A",
      catalog_dimension_p: null,
      catalog_dimension_l: null,
      catalog_dimension_t: null,
      catalog_dimension_unit: "cm",
      catalog_color: color,
      catalog_finishing: finishing,
      catalog_reference_url: realStr(mat.reference_url),
      catalog_metadata: mat.catalog_fields !== null && mat.catalog_fields !== undefined
        ? { catalog_fields: mat.catalog_fields }
        : {},
    },
    snapshot_source_payload: undefined,
    schedule_code: mat.code,
    snapshot_captured_at: new Date().toISOString(),
  };
}

function buildFFESnapshot(
  ffe: { code: string; metadata: unknown },
  category: string,
  _isComplete: boolean
): ScheduleSnapshot {
  void _isComplete;
  const parsedMeta = FFEMetaSchema.safeParse(ffe.metadata);
  const meta = parsedMeta.success ? parsedMeta.data : FFEMetaSchema.parse({});
  const colorSize = splitColorSize(meta.color_size);
  // No echo fallbacks (see buildMaterialSnapshot). A fixture keeps its real
  // plugin-provided product name if any, but never echoes Type or the code.
  const color = colorSize.color;
  return {
    snapshot_source_kind: "manual",
    snapshot_source_origin: "sketchup_plugin",
    snapshot_source_external_id: ffe.code,
    product_catalog_id: null,
    catalog_type: "fixture",
    schedule_category: category,
    catalog_sub_category: realStr(meta.type),
    catalog_product_name: realStr(meta.product_name),
    catalog_brand: realStr(meta.brand) || "Custom",
    catalog_initials_type: calculateInitialsType({
      catalog_motif: null,
      catalog_color: color,
      catalog_finishing: null,
    }),
    catalog_price: meta.unit_cost ?? null,
    catalog_notes: meta.notes ?? null,
    catalog_image_url: realStr(meta.image_url),
    catalog_reference_url: realStr(meta.reference_url),
    catalog_contact_name: null,
    catalog_contact_phone: null,
    catalog_contact_email: null,
    catalog_has_sample: false,
    specs: {
      catalog_sku: realStr(meta.item_no),
      catalog_motif: null,
      catalog_structured_tags: [],
      catalog_dimensions: colorSize.dimensions || "N/A",
      catalog_dimension_p: null,
      catalog_dimension_l: null,
      catalog_dimension_t: null,
      catalog_dimension_unit: "cm",
      catalog_color: color,
      catalog_finishing: null,
      catalog_reference_url: realStr(meta.reference_url),
      catalog_metadata: meta.catalog_fields !== null && meta.catalog_fields !== undefined
        ? { catalog_fields: meta.catalog_fields }
        : {},
    },
    snapshot_source_payload: undefined,
    schedule_code: ffe.code,
    snapshot_captured_at: new Date().toISOString(),
  };
}

// ── Schedule-owned catalog content ─────────────────────────────────────────
// Apply a card edit directly onto the schedule snapshot.
//
// This replaces the old "write the staging columns, then rebuild the snapshot
// from them" flow. Catalog content now has exactly one write target (the
// snapshot), so a patch must be merged onto the CURRENT snapshot instead of
// being reconstructed from a staging row that no longer receives updates —
// rebuilding from staging after the redesign would silently revert the card
// to its pre-redesign values.
//
// `fallback` supplies the dormant staging values (see catalog-ownership.ts)
// so a project that has not yet run scripts/backfill-catalog-snapshots.mjs
// does not lose content the first time a card is edited. It is consulted only
// where the snapshot has nothing; once a field exists in the snapshot the
// fallback can never override it.
function applyCatalogPatchToSnapshot(
  current: ScheduleSnapshot | null,
  patch: CatalogItemPatch,
  context: {
    code: string;
    category: string;
    catalogType: "material" | "fixture";
    fallback?: {
      brand?: string | null;
      type?: string | null;
      product_name?: string | null;
      finish?: string | null;
      item_no?: string | null;
      color_size?: string | null;
      unit_cost?: number | null;
      notes?: string | null;
      image_url?: string | null;
      reference_url?: string | null;
      catalog_fields?: CatalogFieldKey[] | null;
    };
  }
): ScheduleSnapshot {
  const fallback = context.fallback ?? {};
  const patched = (key: keyof CatalogItemPatch) =>
    Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined;

  // An explicit patch always wins (including clearing a field to null).
  // Otherwise keep what the snapshot holds, and only then fall back to the
  // dormant staging value.
  const pickString = (
    key: keyof CatalogItemPatch,
    currentValue: string | null | undefined,
    fallbackValue: string | null | undefined
  ): string | null => {
    if (patched(key)) return realStr(patch[key] as string | null | undefined);
    return realStr(currentValue) ?? realStr(fallbackValue);
  };
  const pickNumber = (
    key: keyof CatalogItemPatch,
    currentValue: number | null | undefined,
    fallbackValue: number | null | undefined
  ): number | null => {
    if (patched(key)) return (patch[key] as number | null | undefined) ?? null;
    return currentValue ?? fallbackValue ?? null;
  };

  const currentColorSize = current
    ? joinParts([current.specs.catalog_color, current.specs.catalog_dimensions], " / ")
    : null;
  const resolvedColorSize = patched("color_size")
    ? realStr(patch.color_size)
    : realStr(currentColorSize) ?? realStr(fallback.color_size);
  const colorSize = splitColorSize(resolvedColorSize);

  const finishing = pickString("finish", current?.specs.catalog_finishing, fallback.finish);
  const referenceUrl = pickString(
    "url",
    current?.catalog_reference_url ?? current?.specs.catalog_reference_url,
    fallback.reference_url
  );

  // catalog_fields controls which rows the card displays. It lives in the
  // snapshot's free-form metadata bag, which must otherwise be preserved.
  const metadata: Record<string, unknown> = {
    ...((current?.specs.catalog_metadata as Record<string, unknown> | undefined) ?? {}),
  };
  if (patched("catalog_fields")) {
    if (patch.catalog_fields === null) delete metadata.catalog_fields;
    else metadata.catalog_fields = patch.catalog_fields;
  } else if (
    !Object.prototype.hasOwnProperty.call(metadata, "catalog_fields") &&
    fallback.catalog_fields != null
  ) {
    metadata.catalog_fields = fallback.catalog_fields;
  }

  return {
    // Identity/provenance of the snapshot is preserved when one already
    // exists — a card edit must not relabel a Library-sourced item as a
    // plugin-sourced one.
    snapshot_source_kind: current?.snapshot_source_kind ?? "manual",
    snapshot_source_origin: current?.snapshot_source_origin ?? "sketchup_plugin",
    snapshot_source_external_id: context.code,
    product_catalog_id: current?.product_catalog_id ?? null,
    catalog_type: context.catalogType,
    schedule_category: context.category,
    catalog_sub_category: pickString("type", current?.catalog_sub_category, fallback.type),
    catalog_product_name: pickString("product_name", current?.catalog_product_name, fallback.product_name),
    catalog_brand: pickString("brand", current?.catalog_brand, fallback.brand) || "Custom",
    catalog_initials_type: calculateInitialsType({
      catalog_motif: current?.specs.catalog_motif ?? null,
      catalog_color: colorSize.color,
      catalog_finishing: finishing,
    }),
    catalog_price: pickNumber("unit_cost", current?.catalog_price, fallback.unit_cost),
    catalog_notes: pickString("notes", current?.catalog_notes, fallback.notes),
    catalog_image_url: pickString("image_url", current?.catalog_image_url, fallback.image_url),
    catalog_reference_url: referenceUrl,
    catalog_contact_name: current?.catalog_contact_name ?? null,
    catalog_contact_phone: current?.catalog_contact_phone ?? null,
    catalog_contact_email: current?.catalog_contact_email ?? null,
    catalog_has_sample: current?.catalog_has_sample ?? false,
    specs: {
      ...(current?.specs ?? {}),
      catalog_sku: pickString("item_no", current?.specs.catalog_sku, fallback.item_no),
      catalog_motif: current?.specs.catalog_motif ?? null,
      catalog_structured_tags: current?.specs.catalog_structured_tags ?? [],
      catalog_dimensions: colorSize.dimensions || "N/A",
      catalog_dimension_p: current?.specs.catalog_dimension_p ?? null,
      catalog_dimension_l: current?.specs.catalog_dimension_l ?? null,
      catalog_dimension_t: current?.specs.catalog_dimension_t ?? null,
      catalog_dimension_unit: current?.specs.catalog_dimension_unit ?? "cm",
      catalog_color: colorSize.color,
      catalog_finishing: finishing,
      catalog_reference_url: referenceUrl,
      catalog_metadata: metadata,
    },
    snapshot_source_payload: current?.snapshot_source_payload,
    schedule_code: context.code,
    snapshot_captured_at: new Date().toISOString(),
  };
}

// Core logic shared by the standalone action below and by
// updateSketchupMaterialAction, which needs this to run inside its own
// outer transaction (see the "atomic card save" note on that function) so a
// failure here can't leave the staging row's edits committed without the
// schedule entry that's supposed to carry them.
async function pushMaterialAsNewEntryTx(
  tx: PrismaTransaction,
  materialId: string,
  projectId: string,
  userId: string
): Promise<{ entryId: string }> {
  const mat = await tx.sketchupMaterial.findUnique({
        where: { id: materialId },
      });

      if (!mat) {
        throw new Error("Material not found.");
      }

      if (mat.linked_entry_id) {
        throw new Error("Material is already linked to a schedule entry.");
      }

      // Parse code to find prefix. E.g. "PT-1" -> "PT"
      const match = mat.code.match(/^([A-Za-z]+)-/);
      const prefix = match ? match[1].toUpperCase() : "ITEM";

      // Resolve category: lookup prefix in PrefixDictionary for materials
      let prefixDict = await tx.prefixDictionary.findFirst({
        where: {
          prefix: prefix,
          section: ProductType.material,
        },
      });

      let category = prefixDict?.schedule_category || prefix;
      category = category.toUpperCase();

      if (!prefixDict) {
        prefixDict = await tx.prefixDictionary.create({
          data: {
            schedule_category: category,
            prefix: prefix,
            section: ProductType.material,
          },
        });
      }

      // Determine if metadata is complete (brand and type exist)
      const hasBrand = mat.brand && mat.brand.trim() !== "" && mat.brand !== "PENDING" && mat.brand !== "Custom" && mat.brand !== "Generic";
      const hasType = mat.type && mat.type.trim() !== "" && mat.type !== "PENDING" && mat.type !== "Custom" && mat.type !== "Generic";
      const isComplete = !!(hasBrand && hasType);

      // Build snapshot
      const snapshot = buildMaterialSnapshot({
        code: mat.code,
        brand: mat.brand,
        type: mat.type,
        finish: mat.finish,
        image_url: mat.image_url,
        category: category,
        item_no: mat.item_no,
        color_size: mat.color_size,
        unit_cost: mat.unit_cost,
        notes: mat.notes,
        reference_url: mat.reference_url,
        catalog_fields: catalogFieldsFromJson(mat.catalog_fields),
      }, isComplete);

      const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

      // Find next sort order
      const lastEntry = await tx.projectScheduleEntry.findFirst({
        where: { project_id: projectId, section: ProductType.material, schedule_category: category },
        orderBy: { schedule_sort_order: "desc" },
      });
      const nextSortOrder = (lastEntry?.schedule_sort_order ?? 0) + 1;

      // Create new schedule entry. The placeholder increment must be <= 0:
      // normalizeCodes (gentle) only assigns a real number to entries it
      // doesn't already consider valid, and treats any positive value —
      // including a literal 9999 — as already-valid and leaves it untouched.
      const entry = await tx.projectScheduleEntry.create({
        data: {
          project_id: projectId,
          schedule_category: category,
          section: ProductType.material,
          schedule_sort_order: nextSortOrder,
          index_number: 0, // Temp, will be normalized
          schedule_prefix: prefix,
          schedule_increment: -nextSortOrder, // Temp, will be normalized
          prefix_id: prefixDict.id,
          schedule_qty: mat.qty,
          schedule_unit: realStr(mat.unit),
          schedule_location: mat.location_notes || null,
        },
      });

      // Create final option
      await createScheduleOption(tx, {
        entry_id: entry.id,
        option_label: "A",
        is_final: true,
        status: isComplete ? "APPROVED" : "DRAFT",
        data_snapshot: validatedSnapshot,
      });

      // Normalize increments/codes
      await ScheduleService.normalizeCodes(tx, projectId, ProductType.material, category);

      // Link material to entry
      await tx.sketchupMaterial.update({
        where: { id: materialId },
        data: {
          linked_entry_id: entry.id,
        },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", entry.id, userId, {
        project_id: projectId,
        schedule_category: category,
        sketchup_material_id: materialId,
      });

      return { entryId: entry.id };
}

export async function pushMaterialAsNewEntryAction(
  materialId: string,
  projectId: string,
  _userId?: string
) {
  void _userId;
  try {
    // Reachable from the catalog edit path (a first edit on an unlinked
    // material), so it uses the schedule ADD permission, not an ADMIN gate.
    const { userId } = await requireCatalogEditor(projectId, PERMISSION.PLUGIN_SCHEDULE_ADD);

    const res = await prisma.$transaction((tx) => pushMaterialAsNewEntryTx(tx, materialId, projectId, userId));

    revalidateCatalog(projectId);
    return { success: true, ...res };
  } catch (error) {
    console.error("[PUSH_MATERIAL_AS_NEW_ENTRY_ERROR]", error);
    return { error: getActionErrorMessage(error, "Failed to push material as new entry.") };
  }
}
