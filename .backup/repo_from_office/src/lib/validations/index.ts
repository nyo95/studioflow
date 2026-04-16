import { z } from "zod";
import { ProjectPriority, PhaseStatus, CDItemStatus, ActivityMode, ScheduleSection } from "@/generated/prisma";

// --- Common ---
export const IdSchema = z.string().uuid("Invalid ID format");

// --- Project ---
export const ProjectIdSchema = z.object({
  projectId: IdSchema,
});

export const BootstrapProjectSchema = z.object({
  name: z.string().min(2).max(100),
  pic_designer_id: IdSchema,
  pic_drafter_id: IdSchema,
  opening_date: z.coerce.date().optional(),
  project_type: z.string().optional(),
  client_name: z.string().optional(),
  client_contact: z.string().optional(),
  address: z.string().optional(),
  area: z.number().positive().optional(),
});

export const UpdateProjectMetadataSchema = z.object({
  projectId: IdSchema,
  name: z.string().min(2).max(100).optional(),
  client_name: z.string().optional(),
  clientId: IdSchema.nullable().optional(),
  area: z.number().positive().optional(),
  opening_date: z.coerce.date().optional(),
  pic_designer_id: IdSchema.optional(),
  pic_drafter_id: IdSchema.optional(),
});

export const UpdateProjectPrioritySchema = z.object({
  projectId: IdSchema,
  priority: z.nativeEnum(ProjectPriority),
});

// --- Phase ---
export const PhaseIdSchema = z.object({
  phaseId: IdSchema,
});

export const RejectPhaseSchema = z.object({
  phaseId: IdSchema,
  type: z.enum(["INTERNAL", "CLIENT"]),
});

export const CreateCDItemSchema = z.object({
  phaseId: IdSchema,
  data: z.object({
    group_code: z.string().min(1),
    drawing_name: z.string().min(1),
    assigned_to_id: IdSchema.optional(),
  }),
});

export const UpdateCDItemSchema = z.object({
  itemId: IdSchema,
  data: z.object({
    group_code: z.string().min(1),
    drawing_name: z.string().min(1),
  }),
});

export const UpdateCDStatusSchema = z.object({
  itemId: IdSchema,
  status: z.nativeEnum(CDItemStatus),
});

export const ToggleChecklistSchema = z.object({
  checklistId: IdSchema,
  isChecked: z.boolean(),
});

export const AddChecklistItemSchema = z.object({
  phaseId: IdSchema,
  label: z.string().min(1),
});

export const AddActivitySchema = z.object({
  revisionId: IdSchema,
  content: z.string().min(1),
  mode: z.nativeEnum(ActivityMode),
});

export const UpdateActivitySchema = z.object({
  activityId: IdSchema,
  content: z.string().min(1),
});

export const ToggleActivityStatusSchema = z.object({
  activityId: IdSchema,
});

export const DeleteActivitySchema = z.object({
  activityId: IdSchema,
});

export const DeferActivitySchema = z.object({
  activityId: IdSchema,
});

export const AddDeliverableSchema = z.object({
  revisionId: IdSchema,
  data: z.object({
    file_name: z.string().min(1),
    file_type: z.string().min(1),
    file_url: z.string().optional(),
    link_url: z.string().optional(),
    is_external: z.boolean(),
  }),
});

export const OverrideRevisionSchema = z.object({
  phaseId: IdSchema,
  targetMajorVersion: z.number().int().min(0).optional(),
  targetMinorVersion: z.number().int().min(0).optional(),
  note: z.string().min(1),
  mode: z.enum(["HARD_RESET_ACTIVE", "HARD_RESET_PENDING"]),
});

// --- Vendor & Library ---
export const CreateVendorSchema = z.object({
  brand_name: z.string().min(2),
  company_name: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// --- Scheduler Pillar 2 ---
// Removed ScheduleManualDataSchema in favor of Auto-Harvesting (create_catalog)

const ScheduleCatalogCreateSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional().default("Generic"),
  sub_category: z.string().optional().nullable(),
  motif_or_color: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  finishing: z.string().optional().nullable(),
  dimension_p: z.string().optional().nullable(),
  dimension_l: z.string().optional().nullable(),
  dimension_t: z.string().optional().nullable(),
  dimension_unit: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  digital_catalog_url: z.string().optional().nullable(),
  reference_url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  image_url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  price: z.number().nullable().optional(),
});

const EntrySourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("catalog"),
    catalogItemId: IdSchema,
  }),
  z.object({
    mode: z.literal("create_catalog"),
    catalogCreateData: ScheduleCatalogCreateSchema,
  }),
  z.object({
    mode: z.literal("reserve"),
  }),
]);

const OptionSourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("catalog"),
    catalogItemId: IdSchema,
  }),
  z.object({
    mode: z.literal("create_catalog"),
    catalogCreateData: ScheduleCatalogCreateSchema,
  }),
  z.object({
    mode: z.literal("reserve"),
  }),
]);

export const AddScheduleEntryInstantSchema = z.object({
  projectId: IdSchema,
  category: z.string()
    .min(1)
    .refine(v => v.toLowerCase() !== "general", { message: "'General' category is not allowed" }),
  section: z.nativeEnum(ScheduleSection).optional().default(ScheduleSection.MATERIAL),
});

export const AddScheduleEntryWithMaterialSchema = z.object({
  projectId: IdSchema,
  materialId: IdSchema,
  section: z.nativeEnum(ScheduleSection).optional().default(ScheduleSection.MATERIAL),
});

export const AddScheduleEntrySchema = z
  .object({
    projectId: IdSchema,
    category: z.string()
      .min(1)
      .refine(v => v.toLowerCase() !== "general", { message: "'General' category is not allowed" }),
    section: z.nativeEnum(ScheduleSection).optional().default(ScheduleSection.MATERIAL),
  })
  .and(EntrySourceSchema);

export const AddScheduleOptionSchema = z
  .object({
    entryId: IdSchema,
  })
  .and(OptionSourceSchema);

export const ApproveScheduleOptionSchema = z.object({
  optionId: IdSchema,
  entryId: IdSchema,
});

export const DeleteScheduleEntrySchema = z.object({
  projectId: IdSchema,
  entryId: IdSchema,
});

export const BulkDeleteScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ScheduleSection),
  category: z.string(),
  entryIds: z.array(IdSchema).min(1),
});

const ScheduleEntryPatchSchema = z
  .object({
    qty: z.number().positive().optional(),
    unit: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
    location: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      value.qty !== undefined || value.unit !== undefined || value.location !== undefined,
    { message: "At least one field must be provided" }
  );

export const UpdateScheduleEntrySchema = z.object({
  projectId: IdSchema,
  entryId: IdSchema,
  data: ScheduleEntryPatchSchema,
});

export const ReorderScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ScheduleSection),
  category: z.string(),
  items: z.array(z.object({
    id: IdSchema,
    sort_order: z.number(),
  })),
});

export const UpdateScheduleOptionSnapshotSchema = z.object({
  optionId: IdSchema,
  data: z.object({
    name: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    initials_type: z.string().trim().optional().nullable(),
    reference_url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    image_url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    price: z.number().nullable().optional(),
    contact_name: z.string().trim().optional().nullable(),
    contact_phone: z.string().trim().optional().nullable(),
    contact_email: z
      .union([z.string().trim().email(), z.literal("")])
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    specs: z.object({
      product_type: z.string().min(1),
      motif_or_color: z.string().nullable().optional(),
      dimensions: z.string().optional(),
      color: z.string().nullable().optional(),
      finishing: z.string().nullable().optional(),
      digital_catalog_url: z.string().nullable().optional(),
    }).partial().optional(),
  }),
});
