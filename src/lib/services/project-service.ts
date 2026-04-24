import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { isGlobalChecklistTemplate } from "@/lib/permissions";
import { insertAuditLog, getSystemConfigTx, upsertClientByName } from "@/actions/_shared";
import { calculateBackwardTimeline } from "@/lib/date-utils";
import { PhaseName, ProjectPriority, ProjectStatus, TimelineStatus, PhaseStatus } from "@/generated/prisma";
import { AUDIT_ACTIONS } from "@/lib/services/audit";

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

    const systemConfig = await getSystemConfigTx(tx);
    let formattedName = normalizedName;

    if (systemConfig.is_auto_naming_enabled) {
      if (/^\d{4}-\d{3} .+/.test(normalizedName)) {
        throw new ActionError("Enter only the readable project name. Year and sequence are generated automatically.", "AUTO_NAMING_CONFLICT");
      }

      const currentYear = new Date().getFullYear();
      const yearPrefix = `${currentYear}-`;
      const projectCount = await tx.project.count({
        where: { name: { startsWith: yearPrefix } },
      });
      const nnn = String(projectCount + 1).padStart(3, "0");
      formattedName = `${currentYear}-${nnn} ${normalizedName}`;
    } else if (!/^\d{4}-\d{3} .+/.test(normalizedName)) {
      throw new ActionError("Project name must use the format: [YYYY]-[NNN] [Name].", "INVALID_FORMAT");
    }

    const project = await tx.project.create({
      data: {
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
      const phase = await tx.phase.create({
        data: {
          project_id: project.id,
          name_enum: p.name,
          status_enum: p.index === 1 ? PhaseStatus.IN_PROGRESS : PhaseStatus.PENDING,
          order_index: p.index,
          is_locked: false,
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
      const globalChecklistRows = checklistTemplates
        .filter((template) => isGlobalChecklistTemplate(template.phase_enum))
        .map((template) => ({
          project_id: project.id,
          phase_id: null,
          label: template.label,
          is_checked: false,
        }));
      const phaseChecklistRows = phases.flatMap((phase) =>
        checklistTemplates
          .filter((template) => template.phase_enum === phase.name_enum)
          .map((template) => ({
            project_id: project.id,
            phase_id: phase.id,
            label: template.label,
            is_checked: false,
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

    if (userRole === "ADMIN" && name !== undefined && !normalizedName) {
      throw new ActionError("INVALID_INPUT", "NAME_REQUIRED");
    }

    if (userRole === "ADMIN") {
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

    const updateData = userRole === "ADMIN"
      ? {
          name: normalizedName || project.name,
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

    const auditDetails = userRole === "ADMIN"
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

    const existingChecklists = await tx.projectChecklist.findMany({
      where: { project_id: projectId },
      select: { phase_id: true, label: true },
    });

    const newRows: Array<{ project_id: string; phase_id: string | null; label: string; is_checked: boolean }> = [];
    const existingChecklistKeys = new Set(
      existingChecklists.map((checklist) => `${checklist.phase_id ?? "GLOBAL"}::${checklist.label}`)
    );
    const phaseIdByName = new Map<PhaseName, string>(
      phases.map((phase) => [phase.name_enum as PhaseName, phase.id])
    );
    const pendingChecklistKeys = new Set<string>();

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
      const checklistKey = `${phaseId ?? "GLOBAL"}::${template.label}`;

      if (existingChecklistKeys.has(checklistKey) || pendingChecklistKeys.has(checklistKey)) {
        continue;
      }

      pendingChecklistKeys.add(checklistKey);
      newRows.push({
        project_id: projectId,
        phase_id: phaseId,
        label: template.label,
        is_checked: false,
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
    await tx.projectChecklist.deleteMany({ where: { project_id: projectId } });
    await tx.cDList.deleteMany({ where: { phase_id: { in: phaseIds } } });
    await tx.comment.deleteMany({ where: { phase_id: { in: phaseIds } } });
    await tx.revision.deleteMany({ where: { id: { in: revisionIds } } });
    await tx.phase.deleteMany({ where: { id: { in: phaseIds } } });

    // Cascade Delete Extensions (MF-02 Alignment)
    await tx.projectProductRequest.deleteMany({ where: { project_id: projectId } });
    await tx.projectScheduleEntry.deleteMany({ where: { project_id: projectId } });
    
    // As per SSOT Section 17, purge audit logs related to this project
    await tx.auditLog.deleteMany({ where: { project_id: projectId } });


    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_PROJECT, "Project", projectId, userId, { project_id: projectId });

    return tx.project.delete({ where: { id: projectId } });
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
};
