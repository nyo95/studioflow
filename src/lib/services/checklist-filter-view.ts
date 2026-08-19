import { prisma } from "@/core/platform/db";
import { ChecklistFilterQuerySchema } from "@/lib/validations";
import type { ChecklistFilterViewData } from "@/types/checklist";

export async function getChecklistFilterViews(
  ownerId: string
): Promise<ChecklistFilterViewData[]> {
  const rows = await prisma.checklistFilterView.findMany({
    where: { owner_id: ownerId },
    orderBy: [{ name: "asc" }, { created_at: "asc" }],
    select: { id: true, name: true, query_json: true },
  });

  return rows.flatMap((row) => {
    const parsed = ChecklistFilterQuerySchema.safeParse(row.query_json);
    return parsed.success
      ? [{ id: row.id, name: row.name, query: parsed.data }]
      : [];
  });
}
