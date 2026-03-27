/**
 * date-utils.ts — Studioflow Date Utilities
 * Implements backward timeline calculation as per PRD PATCH 1.
 */

// Mock Holiday API - National Holidays 2026 (Indonesia)
export const NATIONAL_HOLIDAYS_2026 = [
  "2026-01-01", // New Year's Day
  "2026-01-29", // Chinese New Year
  "2026-02-15", // Isra Mi'raj
  "2026-03-20", // Nyepi
  "2026-03-20", // Eid al-Fitr (Start)
  "2026-03-21", // Eid al-Fitr (End)
  "2026-04-03", // Good Friday
  "2026-05-01", // Labor Day
  "2026-05-14", // Ascension Day
  "2026-05-31", // Waisak
  "2026-06-01", // Pancasila Day
  "2026-06-27", // Eid al-Adha
  "2026-07-17", // Islamic New Year
  "2026-08-17", // Independence Day
  "2026-12-25", // Christmas
];

export function isHolidayOrWeekend(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true; // Sunday = 0, Saturday = 6

  const isoDate = date.toISOString().split("T")[0];
  return NATIONAL_HOLIDAYS_2026.includes(isoDate);
}

/**
 * Calculates start and end dates for phases by counting backwards from an opening date.
 * Each phase duration skips weekends and holidays.
 */
export function calculateBackwardTimeline(
  openingDate: Date,
  templates: { phase_enum: string; duration_days: number }[]
) {
  // Sort templates by order (reverse of PHASE_ORDER)
  // MOODBOARD(1), LAYOUT(2), DESIGN_3D(3), CD(4), SUPERVISION(5)
  // We go backwards from SUPERVISION.
  
  const phaseOrder = ["SUPERVISION", "CD", "DESIGN_3D", "LAYOUT", "MOODBOARD"];
  const sortedTemplates = [...templates].sort(
    (a, b) => phaseOrder.indexOf(a.phase_enum) - phaseOrder.indexOf(b.phase_enum)
  );

  let currentDate = new Date(openingDate);
  const results: Record<string, { start: Date; end: Date }> = {};

  for (const template of sortedTemplates) {
    const end = new Date(currentDate);
    
    // Calculate start by subtracting duration_days, skipping holidays/weekends
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
    
    // Next phase (going backwards) ends where this one started
    currentDate = new Date(start);
  }

  return results;
}
