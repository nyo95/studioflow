import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { isGlobalChecklistTemplate } from "@/core/rbac/permissions";
import { insertAuditLog, getSystemConfigTx, upsertClientByName } from "@/actions/_shared";
import { calculateBackwardTimeline } from "@/lib/services/project-timeline";
import { PhaseName, ProjectPriority, ProjectStatus, TimelineStatus, PhaseStatus, ActivityStatus, Role } from "@/generated/prisma";
import { AUDIT_ACTIONS } from "@/core/platform/audit";
import { projectNamingPolicy } from "@/core/domain-shared/project-naming";
import { parsePhaseTag } from "@/lib/services/task-tagger";
import { CHECKLIST_SORT_STEP } from "@/lib/constants";
import { DESIGNER_ROLES, DRAFTER_ROLES, isPicAssignable } from "@/core/rbac/project-pic";
import { ScheduleService } from "@/extensions/schedule/services/schedule-service";

/**
 * Refuses a PIC assignment whose role does not match the seat.
 *
 * Skipped when the value is unchanged or absent, so legacy assignments made
 * before the roles were tightened do not block unrelated edits — see
 * `core/rbac/project-pic.ts` for the full rule.
 */
async function assertPicAssignable(
  tx: PrismaTransaction,
  params: {
    nextId: string | undefined;
    currentId: string;
    allowedRoles: Role[];
    seat: string;
  }
) {
  const { nextId, currentId, allowedRoles, seat } = params;
  if (!nextId || nextId === currentId) return;

  const candidate = await tx.user.findUnique({
    where: { id: nextId },
    select: { role: true, name: true },
  });

  if (!candidate) {
    throw new ActionError("Selected user no longer exists.", "NOT_FOUND");
  }

  if (!isPicAssignable(candidate, allowedRoles, { currentId, nextId })) {
    throw new ActionError(
      `${candidate.name} has the ${candidate.role} role and can't hold the ${seat} seat. Only ${allowedRoles.join(" / ")} can.`,
      "VALIDATION_ERROR"
    );
  }
}

/**
 * Functional Service Layer for Project operations.
 * Pure business logic - no HTTP/UI concerns.
 */
export const projectService = {
  /**
   * Creates a new project with all 5 phases in PENDING, first phase IN_PROGRESS.
   */
  async executeBootstrapProject(
    tx: PrismaTransaction,
    params: {
      name: string;
      pic_designer_id: string;
      pic_drafter_id: string;
      opening_date?: Date;
      core_project_type?: string;
      client_name?: string;
      client_contact?: string;
      address?: string;
      area?: number;
      userId: string;
    }
  ) {
    const { name, pic_designer_id, pic_drafter_id, opening_date, core_project_type, client_name, client_contact, address, area, userId } = params;

    const normalizedName = name.trim();
    const client = await upsertClientByName(tx, client_name, { address });
    if (!normalizedName) throw new ActionError("INVALID_INPUT", "NAME_REQUIRED");

    // A new project has no incumbent, so both seats are checked outright.
    // `currentId: ""` can never equal a UUID, which is what makes the
    // "unchanged" escape hatch inapplicable here — as it should be.
    await assertPicAssignable(tx, {
      nextId: pic_designer_id,
      currentId: "",
      allowedRoles: DESIGNER_ROLES,
      seat: "DIC (Designer)",
    });
    await assertPicAssignable(tx, {
      nextId: pic_drafter_id,
      currentId: "",
      allowedRoles: DRAFTER_ROLES,
      seat: "DRIC (Drafter)",
    });

    let project;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const systemConfig = await getSystemConfigTx(tx);
        let formattedName = normalizedName;

        if (systemConfig.is_auto_naming_enabled) {
          formattedName = await projectNamingPolicy.generateAutoName(tx, normalizedName);
        } else {
          projectNamingPolicy.validateManualFormat(normalizedName);
        }

        project = await tx.project.create({
          data: {
            project_code: projectNamingPolicy.extractProjectCode(formattedName),
            name: formattedName,
            pic_designer_id,
            pic_drafter_id,
            clientId: client?.id,
            opening_date,
            core_project_type: core_project_type ?? "RETAIL",
            client_contact,
            address,
            area,
            status_progress: ProjectStatus.ACTIVE,
          },
        });
        break; // Success
      } catch (error: unknown) {
        if ((error as { code?: string }).code === "P2002" && attempts < maxAttempts - 1) {
          attempts++;
          // Wait a bit before retry to let the other transaction finish
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
          continue;
        }
        throw error;
      }
    }

    if (!project) throw new ActionError("FAILED_TO_CREATE_PROJECT", "CONCURRENCY_ERROR");

    const PHASE_ORDER: Array<{ name: PhaseName; index: number }> = [
      { name: "MOODBOARD", index: 1 },
      { name: "LAYOUT", index: 2 },
      { name: "DESIGN_3D", index: 3 },
      { name: "CD", index: 4 },
      { name: "SUPERVISION", index: 5 },
    ];

    let timelineCalculations: Record<string, { start: Date; end: Date }> = {};
    if (opening_date) {
      const templates = await tx.timelineTemplate.findMany();
      timelineCalculations = calculateBackwardTimeline(opening_date, templates);
    }

    const phases: Array<{ id: string; name_enum: PhaseName }> = [];
    for (const p of PHASE_ORDER) {
      const isParallel = ["LAYOUT", "DESIGN_3D", "CD"].includes(p.name);
      
      const phase = await tx.phase.create({
        data: {
          project_id: project.id,
          name_enum: p.name,
          status_enum: p.index === 1 ? PhaseStatus.IN_PROGRESS : PhaseStatus.PENDING,
          order_index: p.index,
          is_locked: false,
          allow_parallel: isParallel,
        },
      });
      phases.push({ id: phase.id, name_enum: phase.name_enum });

      if (timelineCalculations[p.name]) {
        await tx.projectTimeline.create({
          data: {
            project_id: project.id,
            phase_id: phase.id,
            start_date: timelineCalculations[p.name].start,
            end_date: timelineCalculations[p.name].end,
            status: p.index === 1 ? TimelineStatus.IN_PROGRESS : TimelineStatus.NOT_STARTED,
          },
        });
      }
    }

    // Sync checklists
    const checklistTemplates = await tx.checklistTemplate.findMany({
      where: { is_active: true },
    });
    if (checklistTemplates.length > 0) {
      // template_id is what marks these rows as regenerable. Without it they
      // are indistinguishable from a task the user typed, and both the sync
      // dedup and the reset confirmation lose the ability to tell them apart.
      const globalChecklistRows = checklistTemplates
        .filter((template) => isGlobalChecklistTemplate(template.phase_enum))
        .map((template, index) => ({
          project_id: project.id,
          phase_id: null,
          label: template.label,
          is_checked: false,
          template_id: template.id,
          sort_order: (index + 1) * CHECKLIST_SORT_STEP,
        }));
      const phaseChecklistRows = phases.flatMap((phase) =>
        checklistTemplates
          .filter((template) => template.phase_enum === phase.name_enum)
          .map((template, index) => ({
            project_id: project.id,
            phase_id: phase.id,
            label: template.label,
            is_checked: false,
            template_id: template.id,
            sort_order: (index + 1) * CHECKLIST_SORT_STEP,
          }))
      );
      const checklistRows = [...globalChecklistRows, ...phaseChecklistRows];

      if (checklistRows.length > 0) {
        await tx.projectChecklist.createMany({ data: checklistRows });
      }
    }

    // Create initial revision for first phase
    await tx.revision.create({
      data: {
        phase_id: phases[0].id,
        major: 1,
        minor: 0,
        status_enum: "ACTIVE",
      },
    });

    // Recurring schedule template (PLAN-AUDIT-ROADMAP-2026Q3.md §2.1 R1):
    // pre-populate the empty reserve rows admins have marked as defaults,
    // same pattern as the checklist sync above. Additive/idempotent by
    // construction (see applyDefaultTemplateEntries) so this is safe even
    // though the project has no entries yet — it's just the natural first call.
    await ScheduleService.applyDefaultTemplateEntries(tx, project.id, userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.BOOTSTRAP_PROJECT, "Project", project.id, userId, {
      project_id: project.id,
      name: project.name
    });

    return project;
  },

  /**
   * Updates project metadata (name, client, area, dates, PICs).
   */
  async executeUpdateProjectMetadata(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      name?: string;
      client_name?: string;
      clientId?: string | null;
      area?: number;
      opening_date?: Date;
      pic_designer_id?: string;
      pic_drafter_id?: string;
      userId: string;
      userRole: string;
    }
  ) {
    const { projectId, name, client_name, clientId, area, opening_date, pic_designer_id, pic_drafter_id, userId, userRole } = params;

    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        clientId: true,
        area: true,
        opening_date: true,
        pic_designer_id: true,
        pic_drafter_id: true,
      },
    });

    const normalizedName = name?.trim();
    let resolvedClientId = project.clientId;
    const sanitizedArea = typeof area === "number" ? area : null;
    const sanitizedOpeningDate = opening_date ?? null;

    if ((userRole === "ADMIN" || userRole === "DEVELOPER") && name !== undefined && !normalizedName) {
      throw new ActionError("INVALID_INPUT", "NAME_REQUIRED");
    }

    if ((userRole === "ADMIN" || userRole === "DEVELOPER")) {
      if (clientId !== undefined) {
        if (clientId === null) {
          resolvedClientId = null;
        } else {
          const client = await tx.client.findUnique({
            where: { id: clientId },
            select: { id: true },
          });
          if (!client) throw new ActionError("CLIENT_NOT_FOUND", "NOT_FOUND");
          resolvedClientId = client.id;
        }
      } else if (client_name !== undefined) {
        const client = await upsertClientByName(tx, client_name);
        resolvedClientId = client?.id ?? null;
      }
    }

    if ((userRole === "ADMIN" || userRole === "DEVELOPER") && normalizedName) {
      // Validate naming protocol if ADMIN manually changes the name
      if (!/^\d{4}-\d+ .+/.test(normalizedName)) {
        throw new ActionError("ADMIN: Manual project rename MUST follow the protocol: [YYYY]-[Nomor] [Name].", "PROTOCOL_VIOLATION");
      }
    }

    // The PIC seats are named after roles, so only that role may take them.
    // Enforced here and not only in the picker: a rule that lives in the UI is
    // not a rule, it is a default.
    //
    // "Eligible OR unchanged" — a project whose designer predates this
    // restriction stays saveable, so editing an unrelated field on it does not
    // fail and force a reassignment nobody asked for.
    await assertPicAssignable(tx, {
      nextId: pic_designer_id,
      currentId: project.pic_designer_id,
      allowedRoles: DESIGNER_ROLES,
      seat: "DIC (Designer)",
    });
    await assertPicAssignable(tx, {
      nextId: pic_drafter_id,
      currentId: project.pic_drafter_id,
      allowedRoles: DRAFTER_ROLES,
      seat: "DRIC (Drafter)",
    });

    const updateData = (userRole === "ADMIN" || userRole === "DEVELOPER")
      ? {
          name: normalizedName || project.name,
          project_code: normalizedName ? projectNamingPolicy.extractProjectCode(normalizedName) : undefined,
          clientId: resolvedClientId,
          area: sanitizedArea,
          opening_date: sanitizedOpeningDate,
          pic_designer_id: pic_designer_id || project.pic_designer_id,
          pic_drafter_id: pic_drafter_id || project.pic_drafter_id,
        }
      : {
          area: sanitizedArea,
          opening_date: sanitizedOpeningDate,
        };

    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: updateData,
    });

    const auditDetails = (userRole === "ADMIN" || userRole === "DEVELOPER")
      ? {
          name: updateData.name,
          clientId: updateData.clientId,
          area: updateData.area,
          opening_date: updateData.opening_date?.toISOString() ?? null,
          pic_designer_id: updateData.pic_designer_id,
          pic_drafter_id: updateData.pic_drafter_id,
        }
      : {
          area: updateData.area,
          opening_date: updateData.opening_date?.toISOString() ?? null,
        };

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_PROJECT_METADATA, "Project", projectId, userId, {
      project_id: projectId,
      ...auditDetails
    });

    return updatedProject;
  },

  /**
   * Updates project priority (URGENT, NORMAL, LOW).
   */
  async executeUpdateProjectPriority(
    tx: PrismaTransaction,
    params: { projectId: string; priority: ProjectPriority; userId: string }
  ) {
    const { projectId, priority, userId } = params;

    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { priority: true },
    });

    const updated = await tx.project.update({
      where: { id: projectId },
      data: { priority },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_PROJECT_PRIORITY, "Project", projectId, userId, {
      project_id: projectId,
      newPriority: priority,
      previousPriority: project.priority,
    });

    return updated;
  },

  /**
   * Syncs project checklists with active templates.
   */
  async executeSyncProjectChecklists(
    tx: PrismaTransaction,
    params: { projectId: string; userId: string }
  ) {
    const { projectId, userId } = params;

    await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true },
    });

    const phases = await tx.phase.findMany({
      where: { project_id: projectId },
      select: { id: true, name_enum: true },
    });

    const activeTemplates = await tx.checklistTemplate.findMany({
      where: { is_active: true },
    });

    // Identity is (template_id, phase_id) — NOT (phase_id, label), which is what
    // this used before. Label was never a safe identity for two reasons:
    //
    //   1. A user-written task that happens to share a template's label would
    //      swallow that template's row, silently and permanently.
    //   2. Renaming a template's label changed the key, so the next sync
    //      created a duplicate instead of recognising the row it already had.
    //
    // Rows whose template was deleted carry template_id = null and are simply
    // not considered here — they are plain user tasks now.
    const existingChecklists = await tx.projectChecklist.findMany({
      where: { project_id: projectId, template_id: { not: null } },
      select: { phase_id: true, template_id: true },
    });

    const newRows: Array<{
      project_id: string;
      phase_id: string | null;
      label: string;
      is_checked: boolean;
      template_id: string;
      sort_order: number;
    }> = [];
    const existingChecklistKeys = new Set(
      existingChecklists.map((checklist) => `${checklist.phase_id ?? "GLOBAL"}::${checklist.template_id}`)
    );
    const phaseIdByName = new Map<PhaseName, string>(
      phases.map((phase) => [phase.name_enum as PhaseName, phase.id])
    );
    const pendingChecklistKeys = new Set<string>();

    // New rows land after everything already present in their bucket, rather
    // than all colliding at sort_order 0.
    const maxSortByBucket = new Map<string, number>();
    const sortSeeds = await tx.projectChecklist.groupBy({
      by: ["phase_id"],
      where: { project_id: projectId, parent_id: null },
      _max: { sort_order: true },
    });
    for (const seed of sortSeeds) {
      maxSortByBucket.set(seed.phase_id ?? "GLOBAL", seed._max.sort_order ?? 0);
    }

    for (const template of activeTemplates) {
      const isGlobalTemplate = isGlobalChecklistTemplate(template.phase_enum);
      const resolvedPhaseId = isGlobalTemplate
        ? null
        : template.phase_enum
          ? phaseIdByName.get(template.phase_enum as PhaseName)
          : undefined;

      if (!isGlobalTemplate && !resolvedPhaseId) {
        continue;
      }

      const phaseId = resolvedPhaseId ?? null;
      const bucket = phaseId ?? "GLOBAL";
      const checklistKey = `${bucket}::${template.id}`;

      if (existingChecklistKeys.has(checklistKey) || pendingChecklistKeys.has(checklistKey)) {
        continue;
      }

      const nextSort = (maxSortByBucket.get(bucket) ?? 0) + CHECKLIST_SORT_STEP;
      maxSortByBucket.set(bucket, nextSort);

      pendingChecklistKeys.add(checklistKey);
      newRows.push({
        project_id: projectId,
        phase_id: phaseId,
        label: template.label,
        is_checked: false,
        template_id: template.id,
        sort_order: nextSort,
      });
    }

    if (newRows.length > 0) {
      await tx.projectChecklist.createMany({ data: newRows });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.SYNC_PROJECT_CHECKLISTS, "Project", projectId, userId, { 
      project_id: projectId,
      count: newRows.length 
    });

    return { count: newRows.length };
  },

  /**
   * Hard deletes a project and all related data.
   */
  async executeDeleteProject(tx: PrismaTransaction, params: { projectId: string; userId: string }) {
    const { projectId, userId } = params;

    const phases = await tx.phase.findMany({
      where: { project_id: projectId },
      select: { id: true },
    });
    const phaseIds = phases.map((p) => p.id);

    const revisions = await tx.revision.findMany({
      where: { phase_id: { in: phaseIds } },
      select: { id: true },
    });
    const revisionIds = revisions.map((r) => r.id);

    await tx.file.deleteMany({ where: { revision_id: { in: revisionIds } } });
    await tx.activity.deleteMany({ where: { revision_id: { in: revisionIds } } });
    await tx.projectTimeline.deleteMany({
      where: { OR: [{ project_id: projectId }, { phase_id: { in: phaseIds } }] },
    });
    // Template rows can be regenerated by executeSyncProjectChecklists; rows
    // with template_id = null are user-written and gone for good. The count is
    // recorded in the audit log below so the loss is at least legible after the
    // fact — see getProjectDeletionImpact for the pre-flight version.
    const manualTaskCount = await tx.projectChecklist.count({
      where: { project_id: projectId, template_id: null },
    });
    await tx.projectChecklist.deleteMany({ where: { project_id: projectId } });
    await tx.cDList.deleteMany({ where: { phase_id: { in: phaseIds } } });
    await tx.comment.deleteMany({ where: { phase_id: { in: phaseIds } } });
    await tx.revision.deleteMany({ where: { id: { in: revisionIds } } });
    await tx.phase.deleteMany({ where: { id: { in: phaseIds } } });

    // Cascade Delete Extensions (MF-02 Alignment)
    await tx.projectProductRequest.deleteMany({ where: { project_id: projectId } });
    await tx.projectScheduleEntry.deleteMany({ where: { project_id: projectId } });
    
    // Audit logs are preserved via onDelete: SetNull in schema.prisma.
    // Manual purge removed to comply with forensic trail requirements.


    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_PROJECT, "Project", projectId, userId, {
      project_id: projectId,
      manual_tasks_destroyed: manualTaskCount,
    });

    return tx.project.delete({ where: { id: projectId } });
  },

  /**
   * What a project deletion would destroy that cannot be regenerated.
   *
   * Template-generated checklist rows are deliberately excluded: they come back
   * on the next sync, so warning about them would train people to click through
   * the warning. Only rows a person actually typed are counted.
   */
  async getProjectDeletionImpact(tx: PrismaTransaction, projectId: string) {
    const manualTaskCount = await tx.projectChecklist.count({
      where: { project_id: projectId, template_id: null },
    });

    return { manualTaskCount };
  },

  /**
   * Manually completes a project (Admin only).
   */
  async executeCompleteProject(tx: PrismaTransaction, params: { projectId: string; userId: string }) {
    const { projectId, userId } = params;

    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status_progress: true }
    });

    if (project.status_progress === ProjectStatus.COMPLETED) {
      throw new ActionError("Project is already completed.", "ALREADY_COMPLETED");
    }

    const updated = await tx.project.update({
      where: { id: projectId },
      data: { status_progress: ProjectStatus.COMPLETED },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.PROJECT_COMPLETED_MANUAL, "PROJECT", projectId, userId, {
      project_id: projectId,
      manual_admin_action: true,
      previous_status: project.status_progress,
    });

    return updated;
  },

  /**
   * Adds a project-level activity (todo) not bound to any phase.
   */
  async executeAddProjectActivity(
    tx: PrismaTransaction,
    params: { projectId: string; content: string; userId: string }
  ) {
    const { projectId, content, userId } = params;
    const normalizedContent = content.trim();
    if (!normalizedContent) throw new ActionError("INVALID_INPUT", "CONTENT_REQUIRED");

    const { cleanContent, targetPhaseName } = parsePhaseTag(normalizedContent);

    if (targetPhaseName && targetPhaseName !== "GENERAL") {
      const phase = await tx.phase.findFirst({
        where: { project_id: projectId, name_enum: targetPhaseName },
        include: {
          revisions: {
            where: { status_enum: "ACTIVE" },
            take: 1,
          },
        },
      });

      if (phase && phase.revisions[0]) {
        const newActivity = await tx.activity.create({
          data: {
            revision_id: phase.revisions[0].id,
            project_id: projectId,
            content: cleanContent,
            mode: "TODO",
            status: ActivityStatus.OPEN,
            phase_id: phase.id,
          },
        });

        await insertAuditLog(tx, AUDIT_ACTIONS.ADD_ACTIVITY, "Activity", newActivity.id, userId, {
          project_id: projectId,
          phase_id: phase.id,
          revision_id: phase.revisions[0].id,
          content: cleanContent,
          mode: "TODO",
        });

        return newActivity;
      }
    }

    // Fallback or GENERAL tag or no tag
    const finalContent = targetPhaseName === "GENERAL" ? cleanContent : normalizedContent;

    const newActivity = await tx.activity.create({
      data: {
        project_id: projectId,
        content: finalContent,
        mode: "TODO",
        status: ActivityStatus.OPEN,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.ADD_ACTIVITY, "Activity", newActivity.id, userId, {
      project_id: projectId,
      content: finalContent,
      mode: "TODO",
      project_level: true,
    });

    return newActivity;
  },
};
