import { z } from "zod";
import { ProjectPriority, PhaseStatus, CDItemStatus, ActivityMode, ProductType } from "@/generated/prisma";
import {
  CHECKLIST_LABEL_MAX_LENGTH,
  CHECKLIST_PRIORITY_MIN,
  CHECKLIST_PRIORITY_NONE,
} from "@/lib/constants";

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
  core_project_type: z.string().optional(),
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

export const ReopenPhaseSchema = z.object({
  phaseId: IdSchema,
  intent: z.enum(["INTERNAL", "CLIENT"]).optional().default("CLIENT"),
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
    assigned_to_id: IdSchema.nullable().optional(),
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

// ---------------------------------------------------------------------------
// Tasks (roadmap §C)
// ---------------------------------------------------------------------------

const ChecklistPrioritySchema = z
  .number()
  .int()
  .min(CHECKLIST_PRIORITY_MIN)
  .max(CHECKLIST_PRIORITY_NONE);

const ChecklistLabelTextSchema = z.string().trim().min(1).max(CHECKLIST_LABEL_MAX_LENGTH);

/**
 * Only subtasks can be created from the app.
 *
 * `parentId` is required, and that is the point: a root checklist item is a
 * requirement, and requirements are defined once in Studio settings and
 * generated into every project. There is no shape of this input that creates
 * one — the schema refuses it before the service is even reached.
 *
 * `phaseId` is gone too. A subtask inherits its parent's phase; accepting one
 * here would let a caller file a subtask against a phase its parent is not in.
 */
export const CreateSubtaskSchema = z.object({
  projectId: IdSchema,
  parentId: IdSchema,
  label: ChecklistLabelTextSchema,
  priority: ChecklistPrioritySchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedToId: IdSchema.nullable().optional(),
});

/**
 * `.nullable()` and `.optional()` mean different things here and both are load
 * bearing: omitted = leave alone, explicit null = clear. Collapsing them would
 * make it impossible to remove a due date or an assignee once set.
 */

export const UpdateTaskSchema = z.object({
  taskId: IdSchema,
  label: ChecklistLabelTextSchema.optional(),
  priority: ChecklistPrioritySchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedToId: IdSchema.nullable().optional(),
});

export const TaskIdSchema = z.object({
  taskId: IdSchema,
});

export const ReorderTasksSchema = z.object({
  taskIds: z.array(IdSchema).min(1),
});

export const AttachTaskLabelSchema = z.object({
  taskId: IdSchema,
  name: ChecklistLabelTextSchema,
  color: z.string().trim().min(1).max(32).optional(),
});

export const DetachTaskLabelSchema = z.object({
  taskId: IdSchema,
  labelId: IdSchema,
});

/** C-SISA-5: persisted filters are structured predicates, never a text DSL. */
export const ChecklistFilterQuerySchema = z
  .object({
    status: z.enum(["OPEN", "COMPLETED"]),
    priority: z.literal("P1").nullable(),
    assignee: z.literal("ME").nullable(),
    due: z.enum(["TODAY_OR_EARLIER", "OVERDUE"]).nullable(),
  })
  .strict();

export const SaveChecklistFilterViewSchema = z.object({
  name: z.string().trim().min(1, "Filter name is required").max(80),
  query: ChecklistFilterQuerySchema,
});

export const DeleteChecklistFilterViewSchema = z.object({
  filterId: IdSchema,
});

export const AddActivitySchema = z.object({
  revisionId: IdSchema,
  content: z.string().min(1),
  mode: z.nativeEnum(ActivityMode),
});

export const AddProjectActivitySchema = z.object({
  projectId: IdSchema,
  content: z.string().min(1),
});

export const UpdateActivitySchema = z.object({
  activityId: IdSchema,
  content: z.string().min(1),
});

/** `null` clears the date; omitting the key is not allowed, so "clear" is always expressible. */
export const SetActivityDueDateSchema = z.object({
  activityId: IdSchema,
  dueAt: z.coerce.date().nullable(),
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
  }).superRefine((value, ctx) => {
    if (value.is_external && !value.link_url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["link_url"],
        message: "Link URL is required for external deliverables",
      });
    }

    if (!value.is_external && !value.file_url?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["file_url"],
        message: "File URL is required for uploaded deliverables",
      });
    }
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

// --- Settings ---
export const UISettingsSchema = z.object({
  canvasBg: z.string().optional(),
  radiusCard: z.string().optional(),
  sectionPx: z.string().optional(),
  sectionPy: z.string().optional(),
  rowPaddingY: z.string().optional(),
  sidebarWidth: z.string().optional(),
  containerMaxWidth: z.string().optional(),
  fontSerif: z.string().optional(),
  fontSans: z.string().optional(),
  appLogoUrl: z.string().optional(),
  pagePaddingY: z.string().optional(),
  pageMaxWidth: z.string().optional(),
}).partial();

export const UpdateUISettingsSchema = z.object({
  uiSettings: UISettingsSchema.optional(),
  appTitle: z.string().optional(),
});

export const SetAutoNamingSchema = z.object({
  isEnabled: z.boolean(),
});

export const CreateChecklistTemplateSchema = z.object({
  phaseEnum: z.string().nullable(),
  label: z.string().min(1),
});

export const DeleteByIdSchema = z.object({
  id: z.string().min(1),
});

export const UpsertScheduleCategorySchema = z.object({
  section: z.nativeEnum(ProductType),
  schedule_category: z.string().min(1),
  prefix: z.string().optional(),
});

export const DeleteScheduleCategorySchema = z.object({
  section: z.nativeEnum(ProductType),
  schedule_category: z.string().min(1),
});

// R1 (PLAN-AUDIT-ROADMAP-2026Q3.md §2.1): toggle whether a global schedule
// category is auto-materialized as a "reserve" entry on new/existing projects.
export const SetScheduleTemplateDefaultEntrySchema = z.object({
  section: z.nativeEnum(ProductType),
  schedule_category: z.string().min(1),
  is_default_entry: z.boolean(),
});

// --- Scheduler Pillar 2 ---

const ScheduleCatalogCreateSchema = z.object({
  catalog_sku: z.string().min(1),
  catalog_brand: z.string().optional().default("Generic"),
  catalog_sub_category: z.string().optional().nullable(),
  catalog_product_name: z.string().optional().nullable(),
  catalog_motif: z.string().optional().nullable(),
  catalog_color: z.string().optional().nullable(),
  catalog_finishing: z.string().optional().nullable(),
  catalog_dimension_p: z.string().optional().nullable(),
  catalog_dimension_l: z.string().optional().nullable(),
  catalog_dimension_t: z.string().optional().nullable(),
  catalog_dimension_unit: z.string().optional().nullable(),
  catalog_structured_tags: z.array(z.string()).optional().default([]),
  catalog_reference_url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  catalog_image_url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  catalog_price: z.number().nullable().optional(),
  catalog_notes: z.string().trim().optional().nullable(),
}).transform((data) => ({
  ...data,
  catalog_product_name: data.catalog_product_name || "Unspecified",
}));

const EntrySourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("catalog"),
    catalogItemId: IdSchema,
  }),
  z.object({
    mode: z.literal("manual"), // New: Manual entry that is auto-approved
    catalogCreateData: ScheduleCatalogCreateSchema,
  }),
]);

const OptionSourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("catalog"),
    catalogItemId: IdSchema,
  }),
  z.object({
    mode: z.literal("manual"), // New: Manual entry that is auto-approved
    catalogCreateData: ScheduleCatalogCreateSchema,
  }),
]);

export const AddScheduleEntryInstantSchema = z.object({
  projectId: IdSchema,
  schedule_category: z.string().min(1),
  section: z.nativeEnum(ProductType).optional().default(ProductType.material),
}).refine(v => v.schedule_category.toLowerCase() !== "general", {
  message: "'General' category is not allowed",
  path: ["schedule_category"],
});

export const AddScheduleEntryWithProductSchema = z.object({
  projectId: IdSchema,
  product_catalog_id: IdSchema,
  section: z.nativeEnum(ProductType).optional().default(ProductType.material),
});

export const AddScheduleEntrySchema = z
  .object({
    projectId: IdSchema,
    schedule_category: z.string().min(1),
    section: z.nativeEnum(ProductType).optional().default(ProductType.material),
  })
  .and(EntrySourceSchema)
  .refine(v => v.schedule_category.toLowerCase() !== "general", {
    message: "'General' category is not allowed",
    path: ["schedule_category"],
  });

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
  section: z.nativeEnum(ProductType),
  schedule_category: z.string(),
  entryIds: z.array(IdSchema).min(1),
});

const ScheduleEntryPatchSchema = z
  .object({
    schedule_qty: z.number().positive().optional(),
    schedule_unit: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
    schedule_location: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      value.schedule_qty !== undefined || value.schedule_unit !== undefined || value.schedule_location !== undefined,
    { message: "At least one field must be provided" }
  );

export const UpdateScheduleEntrySchema = z.object({
  projectId: IdSchema,
  entryId: IdSchema,
  data: ScheduleEntryPatchSchema,
});

export const ReorderScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ProductType),
  schedule_category: z.string(),
  items: z.array(z.object({
    id: IdSchema,
    schedule_sort_order: z.number(),
  })),
});

export const MoveBetweenCategoriesSchema = z.object({
  projectId: IdSchema,
  entryId: IdSchema,
  fromCategory: z.string(),
  toCategory: z.string(),
  newIndex: z.number().int().min(0),
});

export const SwapScheduleEntriesSchema = z.object({
  projectId: IdSchema,
  idA: IdSchema,
  idB: IdSchema
});

export const UpdateScheduleOptionSnapshotSchema = z.object({
  optionId: IdSchema,
  data: z.object({
    catalog_product_name: z.string().min(1).optional(),
    catalog_brand: z.string().min(1).optional(), // Renamed from brand
    catalog_initials_type: z.string().trim().optional().nullable(),
    catalog_reference_url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    catalog_image_url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    catalog_price: z.number().nullable().optional(),
    catalog_notes: z.string().trim().optional().nullable(),
    catalog_sub_category: z.string().trim().optional().nullable(),
    catalog_contact_name: z.string().trim().optional().nullable(),
    catalog_contact_phone: z.string().trim().optional().nullable(),
    catalog_contact_email: z
      .union([z.string().trim().email(), z.literal("")])
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    specs: z.object({
      catalog_sku: z.string().min(1),
      catalog_product_name: z.string().nullable().optional(),
      catalog_dimensions: z.string().optional(),
      catalog_structured_tags: z.array(z.string()).optional(),
      catalog_color: z.string().nullable().optional(),
      catalog_finishing: z.string().nullable().optional(),
      catalog_reference_url: z.string().nullable().optional(), // Replaces digital_catalog_url
    }).partial().optional(),
  }),
});

export const MergeScheduleCategoriesSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ProductType),
  sourceCategory: z.string().min(1),
  targetCategory: z.string().min(1),
});

export const MergeGlobalCategoriesSchema = z.object({
  section: z.nativeEnum(ProductType),
  sourceCategory: z.string().min(1),
  targetCategory: z.string().min(1),
});
