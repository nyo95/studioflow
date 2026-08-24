import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma";
import { isAdminLevel } from "@/core/rbac/rbac";
import { getSession } from "@/lib/auth";
import { auditService, type AuditFiltersInput } from "@/core/platform/audit";
import { ActivityLogTable } from "@/components/activity-log-table";
import { DetailTemplate, PageBackLink, PageHeader } from "@/ui_engine";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id: projectId } = await params;
  const { role } = await getSession();
  const query = await searchParams;

  const filters: AuditFiltersInput = {
    userIds: getSingle(query.user) ? [String(getSingle(query.user))] : undefined,
    actions: getSingle(query.action) ? [String(getSingle(query.action))] : undefined,
    phaseIds: getSingle(query.phase) ? [String(getSingle(query.phase))] : undefined,
    dateFrom: getSingle(query.from) ?? null,
    dateTo: getSingle(query.to) ?? null,
  };

  let data: Awaited<ReturnType<typeof auditService.getProjectActivityCenterData>> | null = null;
  try {
    data = await auditService.getProjectActivityCenterData(projectId, filters);
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  return (
    <DetailTemplate
      header={
        <>
          <PageBackLink />
          <PageHeader
            eyebrow="Project activity"
            title={`${data.project.name} Activity`}
            description="What happened on this project, in plain words — with filters, export, and undo."
          />
        </>
      }
      content={
        <ActivityLogTable
          logs={data.logs}
          canUndo={isAdminLevel(role) || role === Role.DIC}
          filters={{
            users: data.filters.users.map((user) => ({ id: user.id, label: user.name })),
            actions: data.filters.actions.map((action) => ({
              id: action,
              label: action.replace(/_/g, " "),
            })),
            phases: data.filters.phases,
          }}
          initialFilterState={{
            userIds: getSingle(query.user) ? [String(getSingle(query.user))] : [],
            actions: getSingle(query.action) ? [String(getSingle(query.action))] : [],
            phaseIds: getSingle(query.phase) ? [String(getSingle(query.phase))] : [],
            dateFrom: getSingle(query.from) ?? "",
            dateTo: query.to ? String(getSingle(query.to)) : "",
          }}
        />
      }
    />
  );
}
