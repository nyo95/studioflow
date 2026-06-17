"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { ScheduleSnapshotSchema, type ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { z } from "zod";
import { ProductType } from "@/generated/prisma";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { ScheduleService } from "@/extensions/schedule/services/schedule-service";
import { requireSession } from "@/lib/auth";

const FFEMetaSchema = z.object({
  brand: z.string().optional().nullable(),
  product_name: z.string().optional().nullable(),
  location_notes: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  definition_names: z.array(z.string()).optional().default([]),
  layers: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
});

export async function generateApiKeyAction(projectId: string, sketchupModelName: string = "Main Design Model") {
  try {
    const { role } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
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
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    await prisma.sketchupProject.delete({
      where: { id: sketchupProjectId },
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
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    await prisma.sketchupMergeAction.create({
      data: {
        sketchup_project_id: sketchupProjectId,
        source_code: sourceCode,
        target_code: targetCode,
      },
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[QUEUE_MERGE_ERROR]", error);
    return { error: "Failed to queue merge action." };
  }
}

export type MaterialScheduleRow = {
  code: string;
  category: string | null;
  material_type: string | null;   // sub_category
  brand: string | null;
  type_sku: string | null;        // catalog_sku + " - " + catalog_product_name
  image_url: string | null;
  location: string | null;
  is_initials: boolean;           // true if catalog_sku is missing/null
};

export type FFEScheduleRow = {
  code: string;
  category: string | null;
  product_name: string | null;
  qty: number;
  brand: string | null;
  location: string | null;
};

export type ProjectScheduleDocument = {
  materials: MaterialScheduleRow[];
  ffes: FFEScheduleRow[];
  project_id: string;
  sketchup_project_id: string;
};

export async function getProjectScheduleDocument(projectId: string): Promise<ProjectScheduleDocument> {
  try {
    // 1. Fetch SketchUp project for this project
    const sketchupProject = await prisma.sketchupProject.findFirst({
      where: { project_id: projectId },
      include: {
        materials: true,
        ffes: true,
      },
    });

    if (!sketchupProject) {
      return {
        materials: [],
        ffes: [],
        project_id: projectId,
        sketchup_project_id: "",
      };
    }

    // 2. Fetch all schedule entries for this project in a single query to prevent N+1 queries
    const scheduleEntries = await prisma.projectScheduleEntry.findMany({
      where: { project_id: projectId },
      include: {
        options: {
          where: { is_final: true },
        },
      },
    });

    // Index schedule entries for efficient O(1) lookups
    const entryMapById = new Map<string, typeof scheduleEntries[0]>();
    const entryMapByCode = new Map<string, typeof scheduleEntries[0]>();

    for (const entry of scheduleEntries) {
      entryMapById.set(entry.id, entry);

      const prefix = entry.schedule_prefix;
      const inc = entry.schedule_increment;
      const codePadded = `${prefix}-${String(inc).padStart(2, "0")}`;
      const codeUnpadded = `${prefix}-${inc}`;

      entryMapByCode.set(codePadded.toUpperCase(), entry);
      entryMapByCode.set(codeUnpadded.toUpperCase(), entry);
    }

    // 3. Resolve Materials
    const resolvedMaterials: MaterialScheduleRow[] = sketchupProject.materials.map((mat) => {
      const linkedEntryId = mat.linked_entry_id;
      let category: string | null = null;
      let material_type: string | null = null;
      let brand: string | null = null;
      let type_sku: string | null = null;
      let image_url: string | null = null;
      let is_initials = false;

      if (linkedEntryId) {
        const entry = entryMapById.get(linkedEntryId);
        const finalOption = entry?.options?.[0];
        const parsed = ScheduleSnapshotSchema.safeParse(finalOption?.data_snapshot);

        category = entry?.section || null;

        if (parsed.success) {
          const snapshot = parsed.data;
          material_type = snapshot.catalog_sub_category || snapshot.schedule_category || null;
          brand = snapshot.catalog_brand || null;

          const sku = snapshot.specs.catalog_sku || "";
          const name = snapshot.catalog_product_name || "";
          type_sku = sku || name ? `${sku} - ${name}`.trim().replace(/^ - | - $/g, "") : null;
          image_url = snapshot.catalog_image_url || null;
          is_initials = !snapshot.specs.catalog_sku;
        } else {
          brand = mat.brand;
          type_sku = mat.type;
          image_url = mat.image_url;
          is_initials = !mat.brand && !mat.type;
        }
      } else {
        brand = mat.brand;
        type_sku = mat.type;
        image_url = mat.image_url;
        is_initials = !mat.brand && !mat.type;
      }

      return {
        code: mat.code,
        category,
        material_type,
        brand,
        type_sku,
        image_url,
        location: mat.location_notes,
        is_initials,
      };
    });

    // Sort materials alphabetically by code
    resolvedMaterials.sort((a, b) => a.code.localeCompare(b.code));

    // 4. Resolve FFEs
    const resolvedFFEs: FFEScheduleRow[] = sketchupProject.ffes.map((ffe) => {
      const parsedMeta = FFEMetaSchema.safeParse(ffe.metadata);
      const meta = parsedMeta.success ? parsedMeta.data : null;

      const metaBrand = meta?.brand || null;
      const metaProductName = meta?.product_name || null;
      const metaLocationNotes = meta?.location_notes || null;
      const metaCategory = meta?.category || null;

      // Find matching schedule entry dynamically by code string
      const entry = entryMapByCode.get(ffe.code.toUpperCase());
      const finalOption = entry?.options?.[0];
      const parsed = ScheduleSnapshotSchema.safeParse(finalOption?.data_snapshot);

      let brand = metaBrand;
      let product_name = metaProductName;
      let category = entry?.schedule_category || metaCategory;
      const location = entry?.schedule_location || metaLocationNotes;

      if (parsed.success) {
        const snapshot = parsed.data;
        brand = snapshot.catalog_brand || metaBrand;
        product_name = snapshot.catalog_product_name || metaProductName;
        category = entry?.schedule_category || snapshot.schedule_category || metaCategory;
      }

      return {
        code: ffe.code,
        category,
        product_name,
        qty: ffe.instance_count,
        brand,
        location,
      };
    });

    // Sort FFEs alphabetically by code
    resolvedFFEs.sort((a, b) => a.code.localeCompare(b.code));

    return {
      materials: resolvedMaterials,
      ffes: resolvedFFEs,
      project_id: projectId,
      sketchup_project_id: sketchupProject.id,
    };
  } catch (error) {
    console.error("[GET_PROJECT_SCHEDULE_DOCUMENT_ERROR]", error);
    throw error;
  }
}

export async function linkSketchupMaterialAction(materialId: string, linkedEntryId: string | null, projectId: string) {
  try {
    const { role } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    await prisma.sketchupMaterial.update({
      where: { id: materialId },
      data: { linked_entry_id: linkedEntryId },
    });
    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[LINK_SKETCHUP_MATERIAL_ERROR]", error);
    return { error: "Failed to link material." };
  }
}

export async function updateSketchupMaterialAction(
  materialId: string,
  data: { brand?: string | null; type?: string | null; location_notes?: string | null },
  projectId: string
) {
  try {
    const { role } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    await prisma.sketchupMaterial.update({
      where: { id: materialId },
      data: {
        brand: data.brand !== undefined ? data.brand : undefined,
        type: data.type !== undefined ? data.type : undefined,
        location_notes: data.location_notes !== undefined ? data.location_notes : undefined,
      },
    });
    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_SKETCHUP_MATERIAL_ERROR]", error);
    return { error: "Failed to update material manual data." };
  }
}

export async function updateSketchupFFEAction(
  ffeId: string,
  data: { brand?: string | null; product_name?: string | null; location_notes?: string | null },
  projectId: string
) {
  try {
    const { role } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }
    const ffe = await prisma.sketchupFFE.findUnique({
      where: { id: ffeId },
    });

    if (!ffe) {
      return { error: "FFE item not found." };
    }

    const currentMeta = (ffe.metadata as Record<string, any>) || {};
    const updatedMeta = {
      ...currentMeta,
      brand: data.brand !== undefined ? data.brand : currentMeta.brand,
      product_name: data.product_name !== undefined ? data.product_name : currentMeta.product_name,
      location_notes: data.location_notes !== undefined ? data.location_notes : currentMeta.location_notes,
    };

    await prisma.sketchupFFE.update({
      where: { id: ffeId },
      data: {
        metadata: updatedMeta,
      },
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_SKETCHUP_FFE_ERROR]", error);
    return { error: "Failed to update FFE metadata." };
  }
}

function calculateInitialsType(data: { catalog_motif?: string | null; catalog_color?: string | null; catalog_finishing?: string | null }) {
  return Array.from(new Set([data.catalog_motif, data.catalog_color, data.catalog_finishing])).filter(Boolean).join(" / ") || null;
}

function buildMaterialSnapshot(
  mat: { code: string; brand: string | null; type: string | null; finish: string | null; image_url: string | null; category: string },
  isComplete: boolean
): ScheduleSnapshot {
  if (isComplete) {
    return {
      snapshot_source_kind: "manual",
      snapshot_source_origin: "sketchup_plugin",
      snapshot_source_external_id: mat.code,
      product_catalog_id: null,
      catalog_type: "material",
      schedule_category: mat.category,
      catalog_sub_category: null,
      catalog_product_name: "Manual Item",
      catalog_brand: mat.brand || "Custom",
      catalog_initials_type: calculateInitialsType({
        catalog_motif: null,
        catalog_color: null,
        catalog_finishing: mat.type || mat.finish || null
      }),
      catalog_price: null,
      catalog_image_url: mat.image_url || null,
      catalog_reference_url: null,
      catalog_contact_name: null,
      catalog_contact_phone: null,
      catalog_contact_email: null,
      catalog_has_sample: false,
      specs: {
        catalog_sku: "Generic",
        catalog_motif: null,
        catalog_structured_tags: [],
        catalog_dimensions: "N/A",
        catalog_dimension_p: null,
        catalog_dimension_l: null,
        catalog_dimension_t: null,
        catalog_dimension_unit: "cm",
        catalog_color: null,
        catalog_finishing: mat.type || mat.finish || null,
        catalog_reference_url: null,
        catalog_metadata: {},
      },
      snapshot_source_payload: undefined,
      schedule_code: mat.code,
      snapshot_captured_at: new Date().toISOString(),
    };
  } else {
    // Incomplete metadata (Case A)
    return {
      snapshot_source_kind: "manual",
      snapshot_source_origin: "sketchup_plugin",
      snapshot_source_external_id: mat.code,
      product_catalog_id: null,
      catalog_type: "material",
      schedule_category: mat.category,
      catalog_sub_category: null,
      catalog_product_name: null,
      catalog_brand: "Custom",
      catalog_initials_type: calculateInitialsType({
        catalog_motif: null,
        catalog_color: mat.code,
        catalog_finishing: null
      }),
      catalog_price: null,
      catalog_image_url: mat.image_url || null,
      catalog_reference_url: null,
      catalog_contact_name: null,
      catalog_contact_phone: null,
      catalog_contact_email: null,
      catalog_has_sample: false,
      specs: {
        catalog_sku: null,
        catalog_motif: null,
        catalog_structured_tags: [],
        catalog_dimensions: "N/A",
        catalog_dimension_p: null,
        catalog_dimension_l: null,
        catalog_dimension_t: null,
        catalog_dimension_unit: "cm",
        catalog_color: mat.code,
        catalog_finishing: null,
        catalog_reference_url: null,
        catalog_metadata: {},
      },
      snapshot_source_payload: undefined,
      schedule_code: mat.code,
      snapshot_captured_at: new Date().toISOString(),
    };
  }
}

function buildFFESnapshot(
  ffe: { code: string; metadata: any },
  category: string,
  isComplete: boolean
): ScheduleSnapshot {
  const meta = ffe.metadata || {};
  if (isComplete) {
    return {
      snapshot_source_kind: "manual",
      snapshot_source_origin: "sketchup_plugin",
      snapshot_source_external_id: ffe.code,
      product_catalog_id: null,
      catalog_type: "fixture",
      schedule_category: category,
      catalog_sub_category: null,
      catalog_product_name: meta.product_name || "Manual Item",
      catalog_brand: meta.brand || "Custom",
      catalog_initials_type: calculateInitialsType({
        catalog_motif: null,
        catalog_color: null,
        catalog_finishing: null
      }),
      catalog_price: null,
      catalog_image_url: null,
      catalog_reference_url: null,
      catalog_contact_name: null,
      catalog_contact_phone: null,
      catalog_contact_email: null,
      catalog_has_sample: false,
      specs: {
        catalog_sku: "Generic",
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
      snapshot_source_payload: undefined,
      schedule_code: ffe.code,
      snapshot_captured_at: new Date().toISOString(),
    };
  } else {
    return {
      snapshot_source_kind: "manual",
      snapshot_source_origin: "sketchup_plugin",
      snapshot_source_external_id: ffe.code,
      product_catalog_id: null,
      catalog_type: "fixture",
      schedule_category: category,
      catalog_sub_category: null,
      catalog_product_name: meta.product_name || "Manual Item",
      catalog_brand: meta.brand || "Custom",
      catalog_initials_type: calculateInitialsType({
        catalog_motif: null,
        catalog_color: ffe.code,
        catalog_finishing: null
      }),
      catalog_price: null,
      catalog_image_url: null,
      catalog_reference_url: null,
      catalog_contact_name: null,
      catalog_contact_phone: null,
      catalog_contact_email: null,
      catalog_has_sample: false,
      specs: {
        catalog_sku: null,
        catalog_motif: null,
        catalog_structured_tags: [],
        catalog_dimensions: "N/A",
        catalog_dimension_p: null,
        catalog_dimension_l: null,
        catalog_dimension_t: null,
        catalog_dimension_unit: "cm",
        catalog_color: ffe.code,
        catalog_finishing: null,
        catalog_reference_url: null,
        catalog_metadata: {},
      },
      snapshot_source_payload: undefined,
      schedule_code: ffe.code,
      snapshot_captured_at: new Date().toISOString(),
    };
  }
}

export async function pushStagedDataToScheduleAction(
  projectId: string,
  _userId?: string
) {
  try {
    const { role, userId } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const res = await prisma.$transaction(async (tx) => {
      // 1. Fetch SketchUp project
      const sp = await tx.sketchupProject.findFirst({
        where: { project_id: projectId },
        include: {
          materials: true,
          ffes: true,
        },
      });

      if (!sp) {
        throw new Error("No SketchUp project linked.");
      }

      // 2. Process materials: only linked ones
      const linkedMaterials = sp.materials.filter((m) => m.linked_entry_id !== null);
      const linkedEntryIds = linkedMaterials.map((m) => m.linked_entry_id!);

      // PRE-FETCH Material Entries
      const materialEntries = await tx.projectScheduleEntry.findMany({
        where: { id: { in: linkedEntryIds } },
        include: { options: true },
      });
      const materialEntryMap = new Map(materialEntries.map(e => [e.id, e]));

      for (const mat of linkedMaterials) {
        const entry = materialEntryMap.get(mat.linked_entry_id!);
        if (!entry) continue;

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
          category: entry.schedule_category,
        }, isComplete);

        // Validate snapshot
        const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

        // Check if there is already a final option
        const finalOption = entry.options.find((o) => o.is_final) || entry.options[0];
        if (finalOption) {
          // Update existing option
          await tx.projectScheduleOption.update({
            where: { id: finalOption.id },
            data: {
              data_snapshot: validatedSnapshot as any,
              status: isComplete ? "APPROVED" : "DRAFT",
            },
          });

          await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "ProjectScheduleOption", finalOption.id, userId, {
            project_id: projectId,
            entry_id: entry.id,
            sketchup_material_id: mat.id,
          });
        } else {
          // Create new final option
          const newOpt = await tx.projectScheduleOption.create({
            data: {
              entry_id: entry.id,
              option_label: "A",
              is_final: true,
              status: isComplete ? "APPROVED" : "DRAFT",
              data_snapshot: validatedSnapshot as any,
            },
          });

          await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", newOpt.id, userId, {
            project_id: projectId,
            entry_id: entry.id,
            sketchup_material_id: mat.id,
          });
        }
      }

      // 3. Process FF&Es: auto-link/auto-create by parsing code (e.g., SF-01)
      
      // PRE-FETCH Fixture Entries and Dictionaries
      const fixtureEntries = await tx.projectScheduleEntry.findMany({
        where: { project_id: projectId, section: ProductType.fixture },
        include: { options: true },
      });
      const fixtureEntryMap = new Map();
      for (const e of fixtureEntries) {
        fixtureEntryMap.set(`${e.schedule_prefix}-${e.schedule_increment}`, e);
      }

      const existingDicts = await tx.prefixDictionary.findMany({
        where: { section: ProductType.fixture },
      });
      const prefixDictMap = new Map(existingDicts.map(d => [d.schedule_category.toUpperCase() + "_" + d.prefix, d]));

      for (const ffe of sp.ffes) {
        const match = ffe.code.match(/^([A-Za-z]+)-0*(\d+)$/);
        if (!match) continue; // Skip invalid codes

        const prefix = match[1].toUpperCase();
        const increment = parseInt(match[2], 10);

        const parsedMeta = FFEMetaSchema.safeParse(ffe.metadata);
        const meta = parsedMeta.success ? parsedMeta.data : null;

        // Resolve category
        let category = meta?.category?.trim().toUpperCase() || "";
        if (!category) {
          // Fallback check from our pre-fetched entries
          const existingSamePrefix = fixtureEntries.find(e => e.schedule_prefix === prefix);
          category = existingSamePrefix?.schedule_category || prefix;
        }
        category = category.toUpperCase();

        // Find or create PrefixDictionary for fixtures
        const dictKey = category + "_" + prefix;
        let prefixDict = prefixDictMap.get(dictKey);
        if (!prefixDict) {
          prefixDict = await tx.prefixDictionary.create({
            data: {
              schedule_category: category,
              prefix: prefix,
              section: ProductType.fixture,
            },
          });
          prefixDictMap.set(dictKey, prefixDict);
        }

        // Determine if metadata is complete (brand and product_name exist)
        const hasBrand = meta?.brand && meta.brand.trim() !== "" && meta.brand !== "PENDING" && meta.brand !== "Custom" && meta.brand !== "Generic";
        const hasProductName = meta?.product_name && meta.product_name.trim() !== "" && meta.product_name !== "Manual Item" && meta.product_name !== "New Item" && meta.product_name !== "[RESERVED]";
        const isComplete = !!(hasBrand && hasProductName);

        // Build snapshot
        const snapshot = buildFFESnapshot(ffe, category, isComplete);
        const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

        // Check if entry already exists
        const entryKey = `${prefix}-${increment}`;
        let entry = fixtureEntryMap.get(entryKey);

        if (entry) {
          // Update quantity & location
          await tx.projectScheduleEntry.update({
            where: { id: entry.id },
            data: {
              schedule_qty: ffe.instance_count,
              schedule_location: meta?.location_notes || entry.schedule_location,
            },
          });

          const finalOption = entry.options.find((o: any) => o.is_final) || entry.options[0];
          if (finalOption) {
            await tx.projectScheduleOption.update({
              where: { id: finalOption.id },
              data: {
                data_snapshot: validatedSnapshot as any,
                status: isComplete ? "APPROVED" : "DRAFT",
              },
            });

            await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "ProjectScheduleOption", finalOption.id, userId, {
              project_id: projectId,
              entry_id: entry.id,
              sketchup_ffe_id: ffe.id,
            });
          }
        } else {
          // Create entry
          const newEntry = await tx.projectScheduleEntry.create({
            data: {
              project_id: projectId,
              schedule_category: category,
              section: ProductType.fixture,
              schedule_prefix: prefix,
              schedule_increment: increment,
              index_number: increment,
              schedule_sort_order: increment,
              schedule_qty: ffe.instance_count,
              schedule_unit: "pcs",
              schedule_location: meta?.location_notes || null,
              prefix_id: prefixDict.id,
            },
          });

          await tx.projectScheduleOption.create({
            data: {
              entry_id: newEntry.id,
              option_label: "A",
              is_final: true,
              status: isComplete ? "APPROVED" : "DRAFT",
              data_snapshot: validatedSnapshot as any,
            },
          });

          await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", newEntry.id, userId, {
            project_id: projectId,
            schedule_category: category,
            sketchup_ffe_id: ffe.id,
          });
          
          // Add to map for subsequent iterations just in case (though FFE loop usually processes distinct codes)
          fixtureEntryMap.set(entryKey, { ...newEntry, options: [{ is_final: true, id: "temp" }] });
        }
      }

      return { success: true };
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return res;
  } catch (error: any) {
    console.error("[PUSH_STAGED_DATA_ERROR]", error);
    return { error: error.message || "Failed to push staged data to schedule." };
  }
}

export async function pushMaterialAsNewEntryAction(
  materialId: string,
  projectId: string,
  _userId?: string
) {
  try {
    const { role, userId } = await requireSession();
    if (role !== "ADMIN") {
      return { error: "Unauthorized SketchUp Action. Premium feature only." };
    }

    const res = await prisma.$transaction(async (tx) => {
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
      }, isComplete);

      const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

      // Find next sort order
      const lastEntry = await tx.projectScheduleEntry.findFirst({
        where: { project_id: projectId, section: ProductType.material, schedule_category: category },
        orderBy: { schedule_sort_order: "desc" },
      });
      const nextSortOrder = (lastEntry?.schedule_sort_order ?? 0) + 1;

      // Create new schedule entry
      const entry = await tx.projectScheduleEntry.create({
        data: {
          project_id: projectId,
          schedule_category: category,
          section: ProductType.material,
          schedule_sort_order: nextSortOrder,
          index_number: 9999, // Temp, will be normalized
          schedule_prefix: prefix,
          schedule_increment: 9999, // Temp, will be normalized
          prefix_id: prefixDict.id,
          schedule_location: mat.location_notes || null,
        },
      });

      // Create final option
      await tx.projectScheduleOption.create({
        data: {
          entry_id: entry.id,
          option_label: "A",
          is_final: true,
          status: isComplete ? "APPROVED" : "DRAFT",
          data_snapshot: validatedSnapshot as any,
        },
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

      return { success: true };
    });

    revalidatePath(`/projects/${projectId}/sketchup`);
    return res;
  } catch (error: any) {
    console.error("[PUSH_MATERIAL_AS_NEW_ENTRY_ERROR]", error);
    return { error: error.message || "Failed to push material as new entry." };
  }
}

export async function pushSketchupToSchedule(
  sketchupProjectId: string,
  _userId?: string
) {
  try {
    const { role, userId } = await requireSession();
    if (role !== "ADMIN") {
      return { pushed: 0, updated: 0, errors: ["Unauthorized SketchUp Action. Premium feature only."] };
    }

    // 1. Fetch SketchupProject with materials and ffes
    const sketchupProject = await prisma.sketchupProject.findUnique({
      where: { id: sketchupProjectId },
      include: {
        materials: true,
        ffes: true,
      },
    });

    if (!sketchupProject) {
      return { pushed: 0, updated: 0, errors: ["Sketchup project not found."] };
    }

    const projectId = sketchupProject.project_id;

    // 2. Fetch existing ProjectScheduleEntries for this project_id, with options
    const existingEntries = await prisma.projectScheduleEntry.findMany({
      where: { project_id: projectId },
      include: {
        options: {
          orderBy: { option_label: "asc" },
        },
      },
    });

    // 3. Build entryMap by "${section}_${prefix}_${increment}" for O(1) lookup
    const entryMap = new Map<string, typeof existingEntries[0]>();
    for (const entry of existingEntries) {
      const key = `${entry.section}_${entry.schedule_prefix.toUpperCase()}_${entry.schedule_increment}`;
      entryMap.set(key, entry);
    }

    // Pre-fetch prefix dictionaries to minimize database writes
    const existingDicts = await prisma.prefixDictionary.findMany({});
    const prefixDictMap = new Map<string, typeof existingDicts[0]>();
    for (const dict of existingDicts) {
      const key = `${dict.section}_${dict.prefix.toUpperCase()}_${dict.schedule_category.toUpperCase()}`;
      prefixDictMap.set(key, dict);
    }

    let pushed = 0;
    let updated = 0;
    const errors: string[] = [];

    // Helper to resolve category for Material
    const resolveMaterialCategory = async (tx: any, prefix: string): Promise<{ category: string; prefixDictId: string }> => {
      let dict = existingDicts.find(
        (d) => d.section === ProductType.material && d.prefix.toUpperCase() === prefix
      );

      let category = dict?.schedule_category || prefix;
      category = category.toUpperCase();

      if (!dict) {
        const newDict = await tx.prefixDictionary.create({
          data: {
            schedule_category: category,
            prefix: prefix,
            section: ProductType.material,
          },
        });
        existingDicts.push(newDict);
        const key = `${newDict.section}_${newDict.prefix.toUpperCase()}_${newDict.schedule_category.toUpperCase()}`;
        prefixDictMap.set(key, newDict);
        dict = newDict;
      }

      if (!dict) {
        throw new Error(`Failed to resolve PrefixDictionary for prefix ${prefix}`);
      }

      return { category, prefixDictId: dict.id };
    };

    // Helper to resolve category for FFE
    const resolveFFECategory = async (tx: any, prefix: string, metaCategory: string | null): Promise<{ category: string; prefixDictId: string }> => {
      let category = metaCategory?.trim().toUpperCase() || "";
      if (!category) {
        const dict = existingDicts.find(
          (d) => d.section === ProductType.fixture && d.prefix.toUpperCase() === prefix
        );
        category = dict?.schedule_category || prefix;
      }
      category = category.toUpperCase();

      const key = `${ProductType.fixture}_${prefix}_${category}`;
      let dict = prefixDictMap.get(key);

      if (!dict) {
        const newDict = await tx.prefixDictionary.create({
          data: {
            schedule_category: category,
            prefix: prefix,
            section: ProductType.fixture,
          },
        });
        existingDicts.push(newDict);
        prefixDictMap.set(key, newDict);
        dict = newDict;
      }

      if (!dict) {
        throw new Error(`Failed to resolve PrefixDictionary for FFE prefix ${prefix}`);
      }

      return { category, prefixDictId: dict.id };
    };

    // 4. For each material
    for (const mat of sketchupProject.materials) {
      const codeMatch = mat.code.match(/^([A-Za-z]+)-(\d+)$/);
      if (!codeMatch) {
        errors.push(`Invalid material code format: "${mat.code}"`);
        continue;
      }

      const prefix = codeMatch[1].toUpperCase();
      const increment = parseInt(codeMatch[2], 10);
      const isComplete = mat.brand !== null && mat.brand !== undefined && mat.brand.trim() !== "" && mat.type !== null && mat.type !== undefined && mat.type.trim() !== "";

      try {
        await prisma.$transaction(async (tx) => {
          const { category, prefixDictId } = await resolveMaterialCategory(tx, prefix);
          const entryKey = `${ProductType.material}_${prefix}_${increment}`;
          const existingEntry = entryMap.get(entryKey);

          // Build snapshot compliant with ScheduleSnapshotSchema
          let snapshot: ScheduleSnapshot;
          if (isComplete) {
            snapshot = {
              snapshot_source_kind: "manual",
              snapshot_source_origin: "sketchup_plugin",
              snapshot_source_external_id: mat.code,
              product_catalog_id: null,
              catalog_type: "material",
              schedule_category: category,
              catalog_sub_category: null,
              catalog_product_name: mat.type!,
              catalog_brand: mat.brand!,
              catalog_initials_type: null,
              catalog_price: null,
              catalog_image_url: mat.image_url || null,
              catalog_reference_url: null,
              catalog_contact_name: null,
              catalog_contact_phone: null,
              catalog_contact_email: null,
              catalog_has_sample: false,
              specs: {
                catalog_sku: mat.type!,
                catalog_motif: null,
                catalog_structured_tags: [],
                catalog_dimensions: "N/A",
                catalog_dimension_p: null,
                catalog_dimension_l: null,
                catalog_dimension_t: null,
                catalog_dimension_unit: "cm",
                catalog_color: null,
                catalog_finishing: mat.type!,
                catalog_reference_url: null,
                catalog_metadata: {},
              },
              schedule_code: mat.code,
              snapshot_captured_at: new Date().toISOString(),
            };
          } else {
            // CASE A: Initials (brand or type is missing)
            // catalog_brand = "(Unspecified)" as requested by user
            // specs.catalog_color = code to satisfy superRefine check
            snapshot = {
              snapshot_source_kind: "manual",
              snapshot_source_origin: "sketchup_plugin",
              snapshot_source_external_id: mat.code,
              product_catalog_id: null,
              catalog_type: "material",
              schedule_category: category,
              catalog_sub_category: null,
              catalog_product_name: null,
              catalog_brand: "(Unspecified)",
              catalog_initials_type: null,
              catalog_price: null,
              catalog_image_url: null,
              catalog_reference_url: null,
              catalog_contact_name: null,
              catalog_contact_phone: null,
              catalog_contact_email: null,
              catalog_has_sample: false,
              specs: {
                catalog_sku: null,
                catalog_motif: null,
                catalog_structured_tags: [],
                catalog_dimensions: "N/A",
                catalog_dimension_p: null,
                catalog_dimension_l: null,
                catalog_dimension_t: null,
                catalog_dimension_unit: "cm",
                catalog_color: mat.code,
                catalog_finishing: null,
                catalog_reference_url: null,
                catalog_metadata: {},
              },
              schedule_code: mat.code,
              snapshot_captured_at: new Date().toISOString(),
            };
          }

          const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

          if (existingEntry) {
            const optionCount = existingEntry.options.length;
            const nextLabel = String.fromCharCode(65 + optionCount);

            // Mark other options as non-final
            await tx.projectScheduleOption.updateMany({
              where: { entry_id: existingEntry.id },
              data: { is_final: false },
            });

            // Create new final option
            const newOpt = await tx.projectScheduleOption.create({
              data: {
                entry_id: existingEntry.id,
                option_label: nextLabel,
                is_final: true,
                status: isComplete ? "APPROVED" : "DRAFT",
                data_snapshot: validatedSnapshot as any,
              },
            });

            // Update entry active_index
            await tx.projectScheduleEntry.update({
              where: { id: existingEntry.id },
              data: { active_index: optionCount },
            });

            // Link material if not already linked
            if (mat.linked_entry_id !== existingEntry.id) {
              await tx.sketchupMaterial.update({
                where: { id: mat.id },
                data: { linked_entry_id: existingEntry.id },
              });
            }

            // Sync local memory map
            existingEntry.options.push(newOpt);
            existingEntry.active_index = optionCount;

            await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", newOpt.id, userId, {
              project_id: projectId,
              entry_id: existingEntry.id,
              sketchup_material_id: mat.id,
            });

            updated++;
          } else {
            // Create new entry
            const newEntry = await tx.projectScheduleEntry.create({
              data: {
                project_id: projectId,
                schedule_category: category,
                section: ProductType.material,
                schedule_prefix: prefix,
                schedule_increment: increment,
                index_number: increment,
                schedule_sort_order: increment,
                prefix_id: prefixDictId,
                schedule_qty: null,
                schedule_unit: null,
                schedule_location: null,
              },
            });

            // Create first option
            const newOpt = await tx.projectScheduleOption.create({
              data: {
                entry_id: newEntry.id,
                option_label: "A",
                is_final: true,
                status: isComplete ? "APPROVED" : "DRAFT",
                data_snapshot: validatedSnapshot as any,
              },
            });

            // Link SketchUp material to the new entry
            await tx.sketchupMaterial.update({
              where: { id: mat.id },
              data: { linked_entry_id: newEntry.id },
            });

            await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", newEntry.id, userId, {
              project_id: projectId,
              schedule_category: category,
              sketchup_material_id: mat.id,
            });

            // Sync local memory map
            entryMap.set(entryKey, {
              ...newEntry,
              options: [newOpt],
            });

            pushed++;
          }
        });
      } catch (err: any) {
        errors.push(`Error processing material ${mat.code}: ${err.message}`);
      }
    }

    // 5. For each FFE
    for (const ffe of sketchupProject.ffes) {
      const codeMatch = ffe.code.match(/^([A-Za-z]+)-(\d+)$/);
      if (!codeMatch) {
        errors.push(`Invalid FFE code format: "${ffe.code}"`);
        continue;
      }

      const prefix = codeMatch[1].toUpperCase();
      const increment = parseInt(codeMatch[2], 10);

      const parsedMeta = FFEMetaSchema.safeParse(ffe.metadata);
      const meta = parsedMeta.success ? parsedMeta.data : null;
      const brand = meta?.brand || null;
      const type = meta?.product_name || null;
      const locationNotes = meta?.location_notes || null;

      const isComplete = brand !== null && brand !== undefined && brand.trim() !== "" && type !== null && type !== undefined && type.trim() !== "";

      try {
        await prisma.$transaction(async (tx) => {
          const { category, prefixDictId } = await resolveFFECategory(tx, prefix, meta?.category || null);
          const entryKey = `${ProductType.fixture}_${prefix}_${increment}`;
          const existingEntry = entryMap.get(entryKey);

          // Build snapshot compliant with ScheduleSnapshotSchema
          let snapshot: ScheduleSnapshot;
          if (isComplete) {
            snapshot = {
              snapshot_source_kind: "manual",
              snapshot_source_origin: "sketchup_plugin",
              snapshot_source_external_id: ffe.code,
              product_catalog_id: null,
              catalog_type: "fixture",
              schedule_category: category,
              catalog_sub_category: null,
              catalog_product_name: type!,
              catalog_brand: brand!,
              catalog_initials_type: null,
              catalog_price: null,
              catalog_image_url: null,
              catalog_reference_url: null,
              catalog_contact_name: null,
              catalog_contact_phone: null,
              catalog_contact_email: null,
              catalog_has_sample: false,
              specs: {
                catalog_sku: type!,
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
              schedule_code: ffe.code,
              snapshot_captured_at: new Date().toISOString(),
            };
          } else {
            // CASE A: Initials (brand or type is missing)
            // catalog_brand = "(Unspecified)" as requested by user
            // specs.catalog_color = code to satisfy superRefine check
            snapshot = {
              snapshot_source_kind: "manual",
              snapshot_source_origin: "sketchup_plugin",
              snapshot_source_external_id: ffe.code,
              product_catalog_id: null,
              catalog_type: "fixture",
              schedule_category: category,
              catalog_sub_category: null,
              catalog_product_name: null,
              catalog_brand: "(Unspecified)",
              catalog_initials_type: null,
              catalog_price: null,
              catalog_image_url: null,
              catalog_reference_url: null,
              catalog_contact_name: null,
              catalog_contact_phone: null,
              catalog_contact_email: null,
              catalog_has_sample: false,
              specs: {
                catalog_sku: null,
                catalog_motif: null,
                catalog_structured_tags: [],
                catalog_dimensions: "N/A",
                catalog_dimension_p: null,
                catalog_dimension_l: null,
                catalog_dimension_t: null,
                catalog_dimension_unit: "cm",
                catalog_color: ffe.code,
                catalog_finishing: null,
                catalog_reference_url: null,
                catalog_metadata: {},
              },
              schedule_code: ffe.code,
              snapshot_captured_at: new Date().toISOString(),
            };
          }

          const validatedSnapshot = ScheduleSnapshotSchema.parse(snapshot);

          if (existingEntry) {
            const optionCount = existingEntry.options.length;
            const nextLabel = String.fromCharCode(65 + optionCount);

            // Mark other options as non-final
            await tx.projectScheduleOption.updateMany({
              where: { entry_id: existingEntry.id },
              data: { is_final: false },
            });

            // Create new final option
            const newOpt = await tx.projectScheduleOption.create({
              data: {
                entry_id: existingEntry.id,
                option_label: nextLabel,
                is_final: true,
                status: isComplete ? "APPROVED" : "DRAFT",
                data_snapshot: validatedSnapshot as any,
              },
            });

            // Update entry level quantity, unit, and location notes (as clarified by user)
            await tx.projectScheduleEntry.update({
              where: { id: existingEntry.id },
              data: {
                active_index: optionCount,
                schedule_qty: ffe.instance_count,
                schedule_unit: "pcs",
                schedule_location: locationNotes ?? existingEntry.schedule_location,
              },
            });

            // Sync local memory map
            existingEntry.options.push(newOpt);
            existingEntry.active_index = optionCount;
            existingEntry.schedule_qty = ffe.instance_count;
            existingEntry.schedule_location = locationNotes ?? existingEntry.schedule_location;

            await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", newOpt.id, userId, {
              project_id: projectId,
              entry_id: existingEntry.id,
              sketchup_ffe_id: ffe.id,
            });

            updated++;
          } else {
            // Create new entry (with qty, unit, location resolved on the entry itself)
            const newEntry = await tx.projectScheduleEntry.create({
              data: {
                project_id: projectId,
                schedule_category: category,
                section: ProductType.fixture,
                schedule_prefix: prefix,
                schedule_increment: increment,
                index_number: increment,
                schedule_sort_order: increment,
                prefix_id: prefixDictId,
                schedule_qty: ffe.instance_count,
                schedule_unit: "pcs",
                schedule_location: locationNotes ?? null,
              },
            });

            // Create first option
            const newOpt = await tx.projectScheduleOption.create({
              data: {
                entry_id: newEntry.id,
                option_label: "A",
                is_final: true,
                status: isComplete ? "APPROVED" : "DRAFT",
                data_snapshot: validatedSnapshot as any,
              },
            });

            await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", newEntry.id, userId, {
              project_id: projectId,
              schedule_category: category,
              sketchup_ffe_id: ffe.id,
            });

            // Sync local memory map
            entryMap.set(entryKey, {
              ...newEntry,
              options: [newOpt],
            });

            pushed++;
          }
        });
      } catch (err: any) {
        errors.push(`Error processing FFE ${ffe.code}: ${err.message}`);
      }
    }

    // 6. Revalidation
    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}/sketchup`);

    return { pushed, updated, errors };
  } catch (error: any) {
    console.error("[PUSH_SKETCHUP_TO_SCHEDULE_ERROR]", error);
    return { pushed: 0, updated: 0, errors: [error.message || "Unknown error occurred during push."] };
  }
}



