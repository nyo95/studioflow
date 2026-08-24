// Aturan timeline proyek ini khusus domain StudioFlow; jangan dipindah ke core.

export const NATIONAL_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-01-29",
  "2026-02-15",
  "2026-03-20",
  "2026-03-20",
  "2026-03-21",
  "2026-04-03",
  "2026-05-01",
  "2026-05-14",
  "2026-05-31",
  "2026-06-01",
  "2026-06-27",
  "2026-07-17",
  "2026-08-17",
  "2026-12-25",
];

export function isHolidayOrWeekend(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;

  const isoDate = date.toISOString().split("T")[0];
  return NATIONAL_HOLIDAYS_2026.includes(isoDate);
}

export function calculateBackwardTimeline(
  openingDate: Date,
  templates: { phase_enum: string; duration_days: number }[]
) {
  const phaseOrder = ["SUPERVISION", "CD", "DESIGN_3D", "LAYOUT", "MOODBOARD"];
  const sortedTemplates = [...templates].sort(
    (a, b) => phaseOrder.indexOf(a.phase_enum) - phaseOrder.indexOf(b.phase_enum)
  );

  let currentDate = new Date(openingDate);
  const results: Record<string, { start: Date; end: Date }> = {};

  for (const template of sortedTemplates) {
    const end = new Date(currentDate);
    let daysToSubtract = template.duration_days;
    const tempDate = new Date(currentDate);

    while (daysToSubtract > 0) {
      tempDate.setDate(tempDate.getDate() - 1);
      if (!isHolidayOrWeekend(tempDate)) {
        daysToSubtract--;
      }
    }

    const start = new Date(tempDate);
    results[template.phase_enum] = { start, end };
    currentDate = new Date(start);
  }

  return results;
}
