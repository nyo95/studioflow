"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { hasPermission, isAdminLevel, PERMISSION } from "@/core/rbac/rbac";
import { ScheduleSnapshotSchema } from "@/lib/validations/schedule-snapshot";
import { resolveCategoryLabel } from "@/extensions/schedule/lib/category-labels";
import { RenderLabelSide, type Prisma } from "@/generated/prisma";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";

// Render annotation boards live inside the Product Schedule, so they reuse its
// access model: any VIEW-permission role may look; editing requires project
// membership (ADMIN/OWNER, or the assigned designer/drafter). The render image
// is never modified — annotations are a separate overlay layer.
const NOT_ALLOWED = "View only — this project's render boards belong to another designer.";

async function requireBoardViewer() {
  const session = await requireSession();
  if (!hasPermission(session.role, PERMISSION.PLUGIN_SCHEDULE_VIEW)) {
    throw new Error("You don't have permission to view this Product Schedule.");
  }
  return session;
}

async function requireBoardEditor(projectId: string) {
  const { role, userId } = await requireSession();
  if (!hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_EDIT)) throw new Error(NOT_ALLOWED);
  if (!isAdminLevel(role)) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { pic_designer_id: true, pic_drafter_id: true },
    });
    if (!project) throw new Error("Project was not found.");
    if (project.pic_designer_id !== userId && project.pic_drafter_id !== userId) throw new Error(NOT_ALLOWED);
  }
  return { role, userId };
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/extensions/product-catalog`);
}

const PLACEHOLDERS = new Set(["", "—", "N/A", "PENDING", "DRAFT", "GENERIC", "CUSTOM", "[RESERVED]", "MANUAL ITEM"]);
function realStr(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v && !PLACEHOLDERS.has(v.toUpperCase()) ? v : null;
}

export type RenderAnnotationView = {
  id: string;
  entry_id: string | null;
  code: string | null;
  name: string | null;
  type_label: string | null;
  image_url: string | null;
  pin_x: number;
  pin_y: number;
  label_side: RenderLabelSide;
  note: string | null;
  sort_order: number;
};

export type RenderBoardView = {
  id: string;
  title: string;
  image_url: string;
  image_ratio: number | null;
  sort_order: number;
  annotations: RenderAnnotationView[];
};

export type ScheduleEntryOption = {
  entry_id: string;
  code: string;
  name: string | null;
  type_label: string | null;
  image_url: string | null;
};

type EntryWithOptions = {
  id: string;
  schedule_prefix: string;
  schedule_increment: number;
  schedule_category: string;
  section: string;
  options: { is_final: boolean; data_snapshot: unknown }[];
};

function resolveEntry(entry: EntryWithOptions) {
  const code = `${entry.schedule_prefix.toUpperCase()}-${entry.schedule_increment}`;
  const option = entry.options.find((o) => o.is_final) ?? entry.options[0];
  const parsed = option ? ScheduleSnapshotSchema.safeParse(option.data_snapshot) : null;
  const snap = parsed?.success ? parsed.data : null;
  const name = snap ? realStr(snap.catalog_product_name) : null;
  const type_label = (snap ? realStr(snap.catalog_sub_category) : null)
    ?? resolveCategoryLabel(entry.schedule_prefix, entry.schedule_category);
  const image_url = snap ? realStr(snap.catalog_image_url) : null;
  return { code, name, type_label, image_url };
}

// Read model: all boards for a project with each annotation resolved against
// its linked schedule entry (code + name + type + photo for the label).
export async function getRenderBoards(projectId: string): Promise<RenderBoardView[]> {
  await requireBoardViewer();
  // Fail soft: if the render-board tables/client aren't ready yet (migration
  // not applied, or a stale dev-server Prisma client), return no boards rather
  // than crashing the whole Product Schedule page. This feature is additive and
  // must never take down the existing catalog.
  if (!prisma.renderBoard) return [];
  let boards;
  try {
    boards = await prisma.renderBoard.findMany({
      where: { project_id: projectId },
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      include: {
        annotations: {
          orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
          include: {
            schedule_entry: {
              include: { options: { orderBy: { option_label: "asc" } } },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("[GET_RENDER_BOARDS_ERROR]", error);
    return [];
  }

  return boards.map((board) => ({
    id: board.id,
    title: board.title,
    image_url: board.image_url,
    image_ratio: board.image_ratio,
    sort_order: board.sort_order,
    annotations: board.annotations.map((a) => {
      const resolved = a.schedule_entry ? resolveEntry(a.schedule_entry) : null;
      return {
        id: a.id,
        entry_id: a.schedule_entry_id,
        code: resolved?.code ?? null,
        name: resolved?.name ?? null,
        type_label: resolved?.type_label ?? null,
        image_url: resolved?.image_url ?? null,
        pin_x: a.pin_x,
        pin_y: a.pin_y,
        label_side: a.label_side,
        note: a.note,
        sort_order: a.sort_order,
      };
    }),
  }));
}

// Schedule entries available to pin (materials + fixtures), code-sorted.
export async function getScheduleEntryOptions(projectId: string): Promise<ScheduleEntryOption[]> {
  await requireBoardViewer();
  const entries = await prisma.projectScheduleEntry.findMany({
    where: { project_id: projectId },
    include: { options: { orderBy: { option_label: "asc" } } },
  });
  const opts = entries.map((entry) => {
    const r = resolveEntry(entry);
    return { entry_id: entry.id, code: r.code, name: r.name, type_label: r.type_label, image_url: r.image_url };
  });
  const key = (code: string): [string, number] => {
    const m = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/.exec(code.trim());
    return m ? [m[1].toUpperCase(), Number(m[2])] : ["￿", Number.MAX_SAFE_INTEGER];
  };
  return opts.sort((a, b) => {
    const [pa, na] = key(a.code);
    const [pb, nb] = key(b.code);
    return pa.localeCompare(pb) || na - nb;
  });
}

type ActionResult = { success?: boolean; error?: string; boardId?: string; annotationId?: string };

function getActionError(error: unknown, fallback: string): ActionResult {
  return { error: error instanceof Error ? error.message : fallback };
}

const CreateBoardSchema = z.object({
  title: z.string().trim().max(200).optional(),
  imageUrl: z.string().trim().min(1).max(4000),
  imageRatio: z.number().finite().positive().optional(),
});

export async function createRenderBoardAction(projectId: string, input: z.infer<typeof CreateBoardSchema>): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const data = CreateBoardSchema.parse(input);
    const board = await prisma.$transaction(async (tx) => {
      const last = await tx.renderBoard.findFirst({
        where: { project_id: projectId },
        orderBy: { sort_order: "desc" },
        select: { sort_order: true },
      });
      const created = await tx.renderBoard.create({
        data: {
          project_id: projectId,
          title: data.title?.trim() || "Render Board",
          image_url: data.imageUrl,
          image_ratio: data.imageRatio ?? null,
          sort_order: (last?.sort_order ?? -1) + 1,
          created_by: userId,
        },
      });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_BOARD_CREATE, "RenderBoard", created.id, userId, {
        project_id: projectId,
        title: created.title,
      });
      return created;
    });
    revalidate(projectId);
    return { success: true, boardId: board.id };
  } catch (error) {
    console.error("[CREATE_RENDER_BOARD_ERROR]", error);
    return getActionError(error, "Failed to create render board.");
  }
}

const UpdateBoardSchema = z.object({
  title: z.string().trim().max(200).optional(),
  imageUrl: z.string().trim().min(1).max(4000).optional(),
  imageRatio: z.number().finite().positive().nullable().optional(),
});

export async function updateRenderBoardAction(projectId: string, boardId: string, input: z.infer<typeof UpdateBoardSchema>): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const data = UpdateBoardSchema.parse(input);
    const updated = await prisma.$transaction(async (tx) => {
      const board = await tx.renderBoard.findFirst({
        where: { id: boardId, project_id: projectId },
        select: { id: true },
      });
      if (!board) return false;
      await tx.renderBoard.update({
        where: { id: boardId },
        data: {
          title: data.title !== undefined ? (data.title.trim() || "Render Board") : undefined,
          image_url: data.imageUrl !== undefined ? data.imageUrl : undefined,
          image_ratio: data.imageRatio !== undefined ? data.imageRatio : undefined,
        },
      });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_BOARD_UPDATE, "RenderBoard", boardId, userId, {
        project_id: projectId,
        fields: Object.keys(data),
      });
      return true;
    });
    if (!updated) return { error: "Render board was not found for this project." };
    revalidate(projectId);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_RENDER_BOARD_ERROR]", error);
    return getActionError(error, "Failed to update render board.");
  }
}

export async function deleteRenderBoardAction(projectId: string, boardId: string): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const board = await prisma.renderBoard.findFirst({
      where: { id: boardId, project_id: projectId },
      select: { id: true, title: true },
    });
    if (!board) return { error: "Render board was not found for this project." };
    // Cascade removes annotations only. The render image file is external and
    // untouched — deleting a board never destroys the underlying render.
    await prisma.$transaction(async (tx) => {
      await tx.renderBoard.delete({ where: { id: boardId } });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_BOARD_DELETE, "RenderBoard", boardId, userId, {
        project_id: projectId,
        title: board.title,
      });
    });
    revalidate(projectId);
    return { success: true };
  } catch (error) {
    console.error("[DELETE_RENDER_BOARD_ERROR]", error);
    return getActionError(error, "Failed to delete render board.");
  }
}

const AddAnnotationSchema = z.object({
  entryId: z.string().uuid().nullable().optional(),
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
  side: z.nativeEnum(RenderLabelSide).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export async function addRenderAnnotationAction(projectId: string, boardId: string, input: z.infer<typeof AddAnnotationSchema>): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const data = AddAnnotationSchema.parse(input);
    const board = await prisma.renderBoard.findFirst({ where: { id: boardId, project_id: projectId }, select: { id: true } });
    if (!board) return { error: "Render board was not found for this project." };
    if (data.entryId) {
      const entry = await prisma.projectScheduleEntry.findFirst({ where: { id: data.entryId, project_id: projectId }, select: { id: true } });
      if (!entry) return { error: "That schedule item was not found for this project." };
    }
    const annotation = await prisma.$transaction(async (tx) => {
      const last = await tx.renderAnnotation.findFirst({
        where: { board_id: boardId },
        orderBy: { sort_order: "desc" },
        select: { sort_order: true },
      });
      const created = await tx.renderAnnotation.create({
        data: {
          board_id: boardId,
          schedule_entry_id: data.entryId ?? null,
          pin_x: data.x,
          pin_y: data.y,
          label_side: data.side ?? RenderLabelSide.auto,
          note: data.note ?? null,
          sort_order: (last?.sort_order ?? -1) + 1,
        },
      });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_ANNOTATION_CREATE, "RenderAnnotation", created.id, userId, {
        project_id: projectId,
        board_id: boardId,
        schedule_entry_id: data.entryId ?? null,
      });
      return created;
    });
    revalidate(projectId);
    return { success: true, annotationId: annotation.id };
  } catch (error) {
    console.error("[ADD_RENDER_ANNOTATION_ERROR]", error);
    return getActionError(error, "Failed to add annotation.");
  }
}

const UpdateAnnotationSchema = z.object({
  entryId: z.string().uuid().nullable().optional(),
  x: z.number().finite().min(0).max(100).optional(),
  y: z.number().finite().min(0).max(100).optional(),
  side: z.nativeEnum(RenderLabelSide).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export async function updateRenderAnnotationAction(projectId: string, annotationId: string, input: z.infer<typeof UpdateAnnotationSchema>): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const data = UpdateAnnotationSchema.parse(input);
    const annotation = await prisma.renderAnnotation.findFirst({
      where: { id: annotationId, board: { project_id: projectId } },
      select: { id: true },
    });
    if (!annotation) return { error: "Annotation was not found for this project." };
    if (data.entryId) {
      const entry = await prisma.projectScheduleEntry.findFirst({ where: { id: data.entryId, project_id: projectId }, select: { id: true } });
      if (!entry) return { error: "That schedule item was not found for this project." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.renderAnnotation.update({
        where: { id: annotationId },
        data: {
          schedule_entry_id: data.entryId !== undefined ? data.entryId : undefined,
          pin_x: data.x !== undefined ? data.x : undefined,
          pin_y: data.y !== undefined ? data.y : undefined,
          label_side: data.side !== undefined ? data.side : undefined,
          note: data.note !== undefined ? data.note : undefined,
        } as Prisma.RenderAnnotationUpdateInput,
      });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_ANNOTATION_UPDATE, "RenderAnnotation", annotationId, userId, {
        project_id: projectId,
        fields: Object.keys(data),
      });
    });
    revalidate(projectId);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_RENDER_ANNOTATION_ERROR]", error);
    return getActionError(error, "Failed to update annotation.");
  }
}

export async function deleteRenderAnnotationAction(projectId: string, annotationId: string): Promise<ActionResult> {
  try {
    const { userId } = await requireBoardEditor(projectId);
    const annotation = await prisma.renderAnnotation.findFirst({
      where: { id: annotationId, board: { project_id: projectId } },
      select: { id: true, board_id: true, schedule_entry_id: true },
    });
    if (!annotation) return { error: "Annotation was not found for this project." };
    await prisma.$transaction(async (tx) => {
      await tx.renderAnnotation.delete({ where: { id: annotationId } });
      await insertAuditLog(tx, AUDIT_ACTIONS.RENDER_ANNOTATION_DELETE, "RenderAnnotation", annotationId, userId, {
        project_id: projectId,
        board_id: annotation.board_id,
        schedule_entry_id: annotation.schedule_entry_id,
      });
    });
    revalidate(projectId);
    return { success: true };
  } catch (error) {
    console.error("[DELETE_RENDER_ANNOTATION_ERROR]", error);
    return getActionError(error, "Failed to delete annotation.");
  }
}
