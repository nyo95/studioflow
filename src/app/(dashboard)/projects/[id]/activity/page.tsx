import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma";
import { getSession } from "@/lib/auth";
import { auditService, type AuditFiltersInput } from "@/core/platform/audit";
import { ActivityLogTable } from "@/components/activity-log-table";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";

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
    <DashboardPageShell>
      <PageBackLink />
      <PageHeader
        eyebrow="Aktivitas Proyek"
        title={`${data.project.name} Activity`}
        description="Riwayat aktivitas khusus proyek ini dalam bahasa yang lebih mudah dibaca, plus filter, ekspor, dan undo."
      />

      <ActivityLogTable
        logs={data.logs}
        canUndo={role === Role.ADMIN || role === Role.DIC}
        filters={{
          users: data.filters.users.map((user) => ({ id: user.id, label: user.name })),
          actions: data.filters.actions.map((action) => ({ id: action, label: action.replace(/_/g, " ") })),
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
    </DashboardPageShell>
  );
}
