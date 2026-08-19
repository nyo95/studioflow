import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { autoLinkSyncedMaterial, autoLinkSyncedFixture, planCodeConvergence } from "@/extensions/sketchup/actions/sketchup-actions";

async function getProjectFromAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const apiKey = authHeader.split(" ")[1];
  return prisma.sketchupProject.findUnique({
    where: { api_key: apiKey },
  });
}

type IncomingIdentity = { uuid?: unknown; code?: unknown };

function duplicateIdentityGroups(
  items: unknown[],
  key: "uuid" | "code",
  normalize: (value: string) => string
) {
  const groups = new Map<string, { value: string; codes: string[] }>();
  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const item = candidate as IncomingIdentity;
    const raw = item[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = normalize(raw.trim());
    const current = groups.get(normalized) ?? { value: raw.trim(), codes: [] };
    if (typeof item.code === "string" && item.code.trim()) current.codes.push(item.code.trim());
    groups.set(normalized, current);
  }
  return [...groups.values()].filter((group) => group.codes.length > 1);
}

function normalizeIncomingCode(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = /^([A-Z][A-Z0-9]*)-0*(\d+)$/.exec(normalized);
  return match ? `${match[1]}-${Number(match[2])}` : normalized;
}

export async function GET(req: NextRequest) {
  try {
    const sketchupProject = await getProjectFromAuth(req);
    if (!sketchupProject) {
      return NextResponse.json({ error: "Missing or invalid Authorization header or API key" }, { status: 401 });
    }

    // Fetch pending merge actions to return to SketchUp
    const pendingActions = await prisma.sketchupMergeAction.findMany({
      where: {
        sketchup_project_id: sketchupProject.id,
        executed_at: null,
      },
      select: {
        id: true,
        source_code: true,
        target_code: true,
      },
      orderBy: [
        { queue_order: "asc" },
        { created_at: "asc" },
        { id: "asc" },
      ],
    });

    const merge_actions = pendingActions.map(a => ({
      id: a.id,
      source: a.source_code,
      target: a.target_code,
    }));

    return NextResponse.json({
      success: true,
      projectId: sketchupProject.project_id,
      merge_actions,
    });
  } catch (error) {
    console.error("[SKETCHUP_SYNC_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sketchupProject = await getProjectFromAuth(req);
    if (!sketchupProject) {
      return NextResponse.json({ error: "Missing or invalid Authorization header or API key" }, { status: 401 });
    }

    const payload = await req.json();
    const {
      materials: rawMaterials = [],
      ffes: rawFfes = [],
      ffe: rawFfe = [],
      full_snapshot = false,
    } = payload;
    if (!Array.isArray(rawMaterials) || !Array.isArray(rawFfes) || !Array.isArray(rawFfe)) {
      return NextResponse.json({
        success: false,
        error: "Invalid SketchUp payload: materials and fixtures must be arrays.",
      }, { status: 400 });
    }
    const materials = rawMaterials;
    const ffes = rawFfes;
    const ffe = rawFfe;
    const ffeList = [...ffes, ...ffe];

    // IDENTITY HARD STOP. SketchUp can clone a material's attribute dictionary,
    // including its UUID. Multiple upserts with that UUID would collapse into a
    // single staging row even though the payload contains multiple codes. Reject
    // the entire request before any write/prune; plugin v1.1.9 repairs duplicates
    // locally and can then retry with a lossless payload.
    const invalidMaterialCodes = materials
      .filter((item: IncomingIdentity) =>
        typeof item?.code !== "string" || !item.code.trim() ||
        !/^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/.test(item.code.trim()) ||
        typeof item?.uuid !== "string" || !item.uuid.trim()
      )
      .map((item: IncomingIdentity) => typeof item?.code === "string" ? item.code : "(missing code)");
    const invalidFixtureCodes = ffeList
      .filter((item: IncomingIdentity) =>
        typeof item?.code !== "string" || !item.code.trim() ||
        !/^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/.test(item.code.trim())
      )
      .map((item: IncomingIdentity) => typeof item?.code === "string" ? item.code : "(missing code)");
    const duplicateMaterialUuids = duplicateIdentityGroups(
      materials,
      "uuid",
      (value) => value.toLowerCase()
    );
    const duplicateMaterialCodes = duplicateIdentityGroups(
      materials,
      "code",
      normalizeIncomingCode
    );
    const duplicateFfeCodes = duplicateIdentityGroups(
      ffeList,
      "code",
      normalizeIncomingCode
    );
    if (
      invalidMaterialCodes.length > 0 ||
      invalidFixtureCodes.length > 0 ||
      duplicateMaterialUuids.length > 0 ||
      duplicateMaterialCodes.length > 0 ||
      duplicateFfeCodes.length > 0
    ) {
      return NextResponse.json({
        success: false,
        error: "SketchUp push stopped before writing because the payload contains invalid or duplicate identities.",
        detail: duplicateMaterialUuids.length > 0
          ? "Duplicate material UUIDs were detected. Restart SketchUp to load plugin v1.1.9, then push again so the copied material IDs can be repaired safely."
          : "Material/fixture codes and material UUIDs must be present and unique.",
        invalid_material_codes: invalidMaterialCodes,
        invalid_fixture_codes: invalidFixtureCodes,
        duplicate_material_uuids: duplicateMaterialUuids,
        duplicate_material_codes: duplicateMaterialCodes,
        duplicate_fixture_codes: duplicateFfeCodes,
      }, { status: 422 });
    }

    // We will do a transaction for all upserts to ensure data integrity
    const operations = [];

    // FF&E technical metadata arrives as a complete plugin payload, but the JSON
    // also stores StudioFlow-managed catalog fields. Merge the technical keys
    // into the existing object so a SketchUp sync cannot erase board edits.
    const incomingFfeCodes = ffeList
      .map((item: { code?: unknown }) => item.code)
      .filter((code: unknown): code is string => typeof code === "string" && code.length > 0);
    const existingFfes = incomingFfeCodes.length > 0
      ? await prisma.sketchupFFE.findMany({
          where: { sketchup_project_id: sketchupProject.id, code: { in: incomingFfeCodes } },
          select: { code: true, metadata: true },
        })
      : [];
    const existingFfeMetadataByCode = new Map(
      existingFfes.map((item) => [
        item.code,
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? item.metadata as Record<string, unknown>
          : {},
      ])
    );

    const syncedMaterialUuids = materials
      .map((material: { uuid?: unknown }) => material.uuid)
      .filter((uuid: unknown): uuid is string => typeof uuid === "string" && uuid.length > 0);
    const syncedUuidSet = new Set<string>(syncedMaterialUuids);

    // RENAME RECONCILIATION (delete-in-SketchUp + recreate-same-code):
    // If an incoming material's code matches an existing row that has a
    // DIFFERENT uuid and is NOT in this push (its old material was removed in
    // SketchUp), treat it as a rename: carry the old row's StudioFlow-side work
    // (edits + schedule link + reservation) onto the new uuid, then delete the
    // old row. This keeps edits and the Product Schedule link attached instead
    // of leaving a duplicate-code ghost card. Only fires when exactly one stale
    // same-code row carries work; ambiguous cases are skipped (the read-side
    // dedupe still prevents a crash).
    const renameCarryByUuid = new Map<string, Record<string, unknown>>();
    const reconciledOldUuids: string[] = [];
    try {
      const existingMaterials = await prisma.sketchupMaterial.findMany({
        where: { sketchup_project_id: sketchupProject.id },
        select: {
          uuid: true, code: true, brand: true, type: true, finish: true, image_url: true, reference_url: true,
          location_notes: true, item_no: true, qty: true, unit: true, color_size: true,
          unit_cost: true, notes: true, catalog_fields: true, linked_entry_id: true, is_reserved: true,
        },
      });
      const carriesWork = (row: (typeof existingMaterials)[number]) =>
        row.linked_entry_id !== null || row.is_reserved || Boolean(
          row.brand || row.type || row.finish || row.image_url || row.reference_url || row.location_notes ||
          row.item_no || row.unit || row.color_size || row.notes ||
          row.qty != null || row.unit_cost != null || row.catalog_fields != null
        );
      for (const mat of materials) {
        const stale = existingMaterials.filter(
          (row) => row.code.toUpperCase() === String(mat.code).toUpperCase()
            && row.uuid !== mat.uuid && !syncedUuidSet.has(row.uuid) && carriesWork(row)
        );
        if (stale.length === 1) {
          const old = stale[0];
          const carry: Record<string, unknown> = {
            brand: old.brand, type: old.type, finish: old.finish, image_url: old.image_url,
            reference_url: old.reference_url,
            location_notes: old.location_notes, item_no: old.item_no, qty: old.qty, unit: old.unit,
            color_size: old.color_size, unit_cost: old.unit_cost, notes: old.notes,
            linked_entry_id: old.linked_entry_id, is_reserved: old.is_reserved,
          };
          if (old.catalog_fields != null) carry.catalog_fields = old.catalog_fields as Prisma.InputJsonValue;
          renameCarryByUuid.set(mat.uuid, carry);
          reconciledOldUuids.push(old.uuid);
        } else if (stale.length > 1) {
          console.warn(`[SKETCHUP_SYNC] Ambiguous rename: ${stale.length} stale rows share code ${mat.code}; skipping auto-merge.`);
        }
      }
    } catch (reconcileError) {
      // Reconciliation is a convenience; never let it break a plain sync.
      console.error("[SKETCHUP_SYNC] Rename reconciliation skipped:", reconcileError);
      renameCarryByUuid.clear();
      reconciledOldUuids.length = 0;
    }

    for (const mat of materials) {
      const carry = renameCarryByUuid.get(mat.uuid) ?? {};
      operations.push(
        prisma.sketchupMaterial.upsert({
          where: {
            sketchup_project_id_uuid: {
              sketchup_project_id: sketchupProject.id,
              uuid: mat.uuid,
            },
          },
          create: {
            sketchup_project_id: sketchupProject.id,
            code: mat.code,
            uuid: mat.uuid,
            area: mat.area ?? null,
            face_count: mat.face_count ?? null,
            backface_count: mat.backface_count ?? null,
            layers: mat.layers ?? null,
            parents: mat.parents ?? null,
            brand: null,
            type: null,
            finish: null,
            image_url: null,
            reference_url: null,
            location_notes: null,
            linked_entry_id: null,
            // Carry StudioFlow-side edits/link from the renamed (deleted) row.
            ...carry,
          },
          update: {
            code: mat.code,
            uuid: mat.uuid,
            area: mat.area ?? null,
            face_count: mat.face_count ?? null,
            backface_count: mat.backface_count ?? null,
            layers: mat.layers ?? null,
            parents: mat.parents ?? null,
          },
        })
      );
    }

    // Remove the old (renamed) rows whose work we just carried forward. These
    // carry edits so the safety-guard prune below would otherwise keep them.
    if (reconciledOldUuids.length > 0) {
      operations.push(
        prisma.sketchupMaterial.deleteMany({
          where: { sketchup_project_id: sketchupProject.id, uuid: { in: reconciledOldUuids } },
        })
      );
    }

    for (const item of ffeList) {
      const metadata = {
        ...(existingFfeMetadataByCode.get(item.code) ?? {}),
        definition_names: item.definition_names ?? [],
        layers: item.layers ?? [],
        locations: item.locations ?? [],
      };
      operations.push(
        prisma.sketchupFFE.upsert({
          where: {
            sketchup_project_id_code: {
              sketchup_project_id: sketchupProject.id,
              code: item.code,
            },
          },
          create: {
            sketchup_project_id: sketchupProject.id,
            code: item.code,
            instance_count: item.instance_count ?? 1,
            metadata,
          },
          update: {
            instance_count: item.instance_count ?? 1,
            metadata,
          },
        })
      );
    }

    // PRUNE STAGING ONLY. The plugin posts what it believes is a complete coded
    // material snapshot, but a scan can be partial (for example when a newly
    // coded material has not received a persistent UUID yet). An absent UUID may
    // remove the transient SketchUp staging row, but MUST NEVER delete its linked
    // Product Schedule entry. That entry owns StudioFlow-managed notes/specs and
    // survives as a schedule-only Catalog Board card until explicitly deleted.
    //
    // ANTI-WIPE GUARD: pruning requires an explicit full_snapshot attestation
    // from the current plugin and at least one material. Older clients and
    // partial/ad-hoc payloads remain additive-only. An empty payload almost
    // always means a scan glitch or unrelated push, not "delete everything".
    // Rename-reconciled old rows are excluded (handled above; their work + link
    // were carried onto the new UUID).
    if (full_snapshot === true && materials.length > 0) {
      const keptUuids = [...syncedMaterialUuids, ...reconciledOldUuids];
      operations.push(
        prisma.sketchupMaterial.deleteMany({
          where: {
            sketchup_project_id: sketchupProject.id,
            uuid: { notIn: keptUuids },
            is_reserved: false,
          },
        })
      );
    }

    await prisma.$transaction(operations);

    // SYNC TO SCHEDULE: every coded material/fixture just pushed is reconciled
    // with its Product Schedule entry — created if missing, otherwise the
    // linked entry is OVERWRITTEN to match the SketchUp item (SketchUp is the
    // source of truth on re-sync; the material UUID / FF&E link is the stable
    // key). This keeps the SketchUp API, the schedule, and the plugin always
    // in sync with no manual push step. Each item is independent so one bad
    // item can't fail the whole sync.
    const scheduleSyncErrors: { kind: "material" | "fixture"; code: string; detail: string }[] = [];
    if (syncedMaterialUuids.length > 0) {
      const syncedRows = await prisma.sketchupMaterial.findMany({
        where: { sketchup_project_id: sketchupProject.id, uuid: { in: syncedMaterialUuids } },
        select: { id: true, code: true },
      });
      for (const row of syncedRows) {
        try {
          const linkedEntryId = await autoLinkSyncedMaterial(row.id, sketchupProject.project_id);
          if (!linkedEntryId) {
            scheduleSyncErrors.push({
              kind: "material",
              code: row.code,
              detail: "Material was received but could not be linked to a Product Catalog entry.",
            });
          }
        } catch (error) {
          console.error(`[SKETCHUP_SYNC] Schedule sync threw for material ${row.code}:`, error);
          scheduleSyncErrors.push({
            kind: "material",
            code: row.code,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (incomingFfeCodes.length > 0) {
      const syncedFfeRows = await prisma.sketchupFFE.findMany({
        where: { sketchup_project_id: sketchupProject.id, code: { in: incomingFfeCodes } },
        select: { id: true, code: true },
      });
      for (const row of syncedFfeRows) {
        try {
          const linkedEntryId = await autoLinkSyncedFixture(row.id, sketchupProject.project_id);
          if (!linkedEntryId) {
            scheduleSyncErrors.push({
              kind: "fixture",
              code: row.code,
              detail: "Fixture was received but could not be linked to a Product Catalog entry.",
            });
          }
        } catch (error) {
          console.error(`[SKETCHUP_SYNC] Schedule sync threw for fixture ${row.code}:`, error);
          scheduleSyncErrors.push({
            kind: "fixture",
            code: row.code,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // CODE CONVERGENCE. Every item is linked by now, so the model and the
    // schedule can be compared as a whole and any rename the model still owes
    // the schedule is queued in one planned batch (temporary-code hops
    // included, so swaps and longer cycles resolve). Runs after linking and
    // before the queue is read below, so anything planned here ships back to
    // the plugin in THIS response rather than waiting for another round trip.
    await planCodeConvergence(sketchupProject.id, sketchupProject.project_id);

    // Acknowledgement is derived from rows actually persisted, never echoed
    // from the request. This makes a count/code mismatch visible to the plugin.
    const persistedMaterials = syncedMaterialUuids.length > 0
      ? await prisma.sketchupMaterial.findMany({
          where: { sketchup_project_id: sketchupProject.id, uuid: { in: syncedMaterialUuids } },
          select: { code: true, uuid: true },
        })
      : [];
    const persistedFfes = incomingFfeCodes.length > 0
      ? await prisma.sketchupFFE.findMany({
          where: { sketchup_project_id: sketchupProject.id, code: { in: incomingFfeCodes } },
          select: { code: true },
        })
      : [];
    const persistedMaterialCodeSet = new Set(persistedMaterials.map((item) => item.code));
    const persistedFfeCodeSet = new Set(persistedFfes.map((item) => item.code));
    const sentMaterialCodes = materials
      .map((item: { code?: unknown }) => item.code)
      .filter((code: unknown): code is string => typeof code === "string");
    const sentFfeCodes = ffeList
      .map((item: { code?: unknown }) => item.code)
      .filter((code: unknown): code is string => typeof code === "string");
    const missingPersistedMaterialCodes = sentMaterialCodes.filter((code) => !persistedMaterialCodeSet.has(code));
    const missingPersistedFfeCodes = sentFfeCodes.filter((code) => !persistedFfeCodeSet.has(code));
    for (const code of missingPersistedMaterialCodes) {
      scheduleSyncErrors.push({
        kind: "material",
        code,
        detail: "Material was present in the request but no unique staging row was persisted.",
      });
    }
    for (const code of missingPersistedFfeCodes) {
      scheduleSyncErrors.push({
        kind: "fixture",
        code,
        detail: "Fixture was present in the request but no unique staging row was persisted.",
      });
    }

    const received = {
      material_count: persistedMaterials.length,
      material_codes: persistedMaterials.map((item) => item.code).sort(),
      fixture_count: persistedFfes.length,
      fixture_codes: persistedFfes.map((item) => item.code).sort(),
    };

    if (scheduleSyncErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: "SketchUp payload was received, but Product Catalog synchronization was incomplete.",
        projectId: sketchupProject.project_id,
        received,
        sync_errors: scheduleSyncErrors,
      }, { status: 500 });
    }

    // Fetch pending merge actions to return to SketchUp
    const pendingActions = await prisma.sketchupMergeAction.findMany({
      where: {
        sketchup_project_id: sketchupProject.id,
        executed_at: null,
      },
      select: {
        id: true,
        source_code: true,
        target_code: true,
      },
      orderBy: [
        { queue_order: "asc" },
        { created_at: "asc" },
        { id: "asc" },
      ],
    });

    const merge_actions = pendingActions.map(a => ({
      id: a.id,
      source: a.source_code,
      target: a.target_code,
    }));

    return NextResponse.json({
      success: true,
      projectId: sketchupProject.project_id,
      received,
      merge_actions,
    });
  } catch (error) {
    console.error("[SKETCHUP_SYNC_POST_ERROR]", error);
    // Surface the real cause to the plugin dialog — this is a local dev tool and
    // a bare "Internal Server Error" makes sync failures impossible to diagnose.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal Server Error", detail: message }, { status: 500 });
  }
}
