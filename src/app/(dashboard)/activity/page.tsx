import { DashboardPageShell, PageHeader, SectionCard } from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";
import { auditService } from "@/core/platform/audit";
import { ActivityLogTable } from "@/components/activity-log-table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { role } = await getSession();
  const params = await searchParams;

  const data = await auditService.getGlobalActivityCenterData({
    userIds: getSingle(params.user) ? [String(getSingle(params.user))] : undefined,
    actions: getSingle(params.action) ? [String(getSingle(params.action))] : undefined,
    phaseIds: getSingle(params.phase) ? [String(getSingle(params.phase))] : undefined,
    dateFrom: getSingle(params.from) ?? null,
    dateTo: getSingle(params.to) ?? null,
  });

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Aktivitas Tim"
        title="Pusat Aktivitas"
        description="Ringkasan aktivitas terbaru tim. Gunakan filter bila ingin lihat orang, fase, atau rentang tanggal tertentu."
      />

      <SectionCard padding="none" className="overflow-hidden">
        <ActivityLogTable
          logs={data.logs}
          canUndo={role === Role.ADMIN || role === Role.DIC}
          filters={{
            users: data.filters.users.map((user) => ({ id: user.id, label: user.name })),
            actions: data.filters.actions.map((action) => ({ id: action, label: action.replace(/_/g, " ") })),
            phases: data.filters.phases,
          }}
          initialFilterState={{
            userIds: getSingle(params.user) ? [String(getSingle(params.user))] : [],
            actions: getSingle(params.action) ? [String(getSingle(params.action))] : [],
            phaseIds: getSingle(params.phase) ? [String(getSingle(params.phase))] : [],
            dateFrom: getSingle(params.from) ?? "",
            dateTo: getSingle(params.to) ?? "",
          }}
        />
      </SectionCard>
    </DashboardPageShell>
  );
}
