/**
 * Domain ownership boundary between the Product Schedule (web) and the
 * SketchUp model (drawing).
 *
 * The goal is NOT "one side always wins". Each side is authoritative for the
 * things it is actually able to know, and the two must converge on the one
 * value they share — the code:
 *
 *   SCHEDULE owns  ── catalog content (brand, type, finish, item no, colour,
 *                     size, unit cost, notes, reference url, qty, unit,
 *                     location, field visibility) AND the code assignment.
 *                     The web app is where a designer specifies a product, so
 *                     the specification lives in ProjectScheduleEntry +
 *                     ProjectScheduleOption.data_snapshot.
 *
 *   SKETCHUP owns  ── technical identity and geometry (uuid, area, face_count,
 *                     backface_count, layers, parents, instance_count) AND
 *                     the fact that a material/component exists in the model
 *                     at all. Only the model can know these.
 *
 *   SHARED (must converge) ── the code (e.g. "GL-3"). Schedule decides it;
 *                     SketchUp applies it via the merge-action queue. A push
 *                     that reports a different code for an already-linked item
 *                     is a DIVERGENCE, not an instruction: the Schedule value
 *                     stands and a rename is queued so the model catches up.
 *                     This is what makes "schedule = skp" true rather than
 *                     merely intended.
 *
 * The join key between the two sides is the SketchUp `uuid` (materials) or
 * `linked_entry_id` in metadata (fixtures) — never the code. Codes change;
 * identity does not. Matching on identity is what lets a rename be detected
 * as a divergence instead of being mistaken for a different item.
 *
 * ── Dormant columns ────────────────────────────────────────────────────────
 * SketchupMaterial still HAS the catalog content columns (brand, type, finish,
 * item_no, qty, unit, color_size, unit_cost, notes, image_url, reference_url,
 * location_notes, catalog_fields), and SketchupFFE.metadata still has the
 * equivalent keys. They are deliberately NOT dropped: they hold pre-redesign
 * data and act as a rollback safety net. They are now DORMANT — read as a
 * fallback for rows that have not been backfilled yet, never written to as a
 * catalog target. `scripts/backfill-catalog-snapshots.mjs` copies them into
 * the snapshot; once it has run for a project, the fallback stops firing.
 *
 * Do not add new writes to the dormant sets below. If a field needs to be
 * editable, it belongs in the snapshot.
 */

/** Catalog-content columns on SketchupMaterial that are no longer write targets. */
export const DORMANT_MATERIAL_COLUMNS = [
  "brand",
  "type",
  "finish",
  "image_url",
  "reference_url",
  "location_notes",
  "item_no",
  "qty",
  "unit",
  "color_size",
  "unit_cost",
  "notes",
  "catalog_fields",
] as const;

/** Columns on SketchupMaterial that the plugin remains authoritative for. */
export const SKETCHUP_OWNED_MATERIAL_COLUMNS = [
  "code",
  "uuid",
  "area",
  "face_count",
  "backface_count",
  "layers",
  "parents",
] as const;

/** Keys inside SketchupFFE.metadata that are no longer write targets. */
export const DORMANT_FIXTURE_METADATA_KEYS = [
  "brand",
  "product_name",
  "type",
  "finish",
  "image_url",
  "reference_url",
  "location_notes",
  "item_no",
  "qty",
  "unit",
  "color_size",
  "unit_cost",
  "notes",
  "catalog_fields",
] as const;

/**
 * Keys inside SketchupFFE.metadata that the plugin owns and that must survive
 * every write. `linked_entry_id` is StudioFlow-managed but lives here too
 * because it is the fixture's join key.
 */
export const FIXTURE_METADATA_PRESERVED_KEYS = [
  "definition_names",
  "layers",
  "locations",
  "category",
  "linked_entry_id",
] as const;

/**
 * Strip the dormant catalog keys out of a fixture metadata object, keeping
 * everything the plugin owns. Used when writing fixture metadata so a save
 * cannot re-populate the dormant half.
 *
 * Existing dormant values on rows we are not otherwise touching are left
 * alone — this only governs what we WRITE.
 */
export function withoutDormantFixtureKeys(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  const dormant = new Set<string>(DORMANT_FIXTURE_METADATA_KEYS);
  for (const [key, value] of Object.entries(metadata)) {
    if (!dormant.has(key)) next[key] = value;
  }
  return next;
}

/** Normalise a code so "CT-01", "ct-1" and "CT-1" all compare equal. */
export function normalizeSharedCode(code: string | null | undefined): string {
  const trimmed = (code ?? "").trim().toUpperCase();
  const match = /^([A-Z][A-Z0-9]*)-0*(\d+)$/.exec(trimmed);
  return match ? `${match[1]}-${Number(match[2])}` : trimmed;
}

export type CodeConvergence =
  | { kind: "aligned" }
  | { kind: "adopt_model_code" }
  | { kind: "queue_rename"; sourceCode: string; targetCode: string };

/**
 * Decide what to do when a push reports `modelCode` for an item whose linked
 * schedule entry currently reads `scheduleCode`.
 *
 * - No schedule opinion yet (unlinked / no entry) → the model's code is the
 *   only information available, so adopt it.
 * - Codes already agree → nothing to do.
 * - They disagree → Schedule wins. Queue a rename so the model converges.
 *
 * This terminates: the queued rename targets the Schedule code, which this
 * function never changes, so the next push reports the Schedule code and
 * returns "aligned". There is no rename ping-pong.
 */
export function resolveCodeConvergence(
  scheduleCode: string | null | undefined,
  modelCode: string | null | undefined
): CodeConvergence {
  const schedule = normalizeSharedCode(scheduleCode);
  const model = normalizeSharedCode(modelCode);
  if (!schedule) return { kind: "adopt_model_code" };
  if (!model) return { kind: "aligned" };
  if (schedule === model) return { kind: "aligned" };
  return { kind: "queue_rename", sourceCode: model, targetCode: schedule };
}

export type ConvergenceItem = {
  /** The code this item currently has in the SketchUp model. */
  modelCode: string;
  /** The code its linked Product Schedule entry says it should have. */
  scheduleCode: string;
};

export type ConvergenceHop = { sourceCode: string; targetCode: string };

/**
 * Plan every rename needed to make the model match the Schedule, for one
 * SketchUp project at once.
 *
 * Planning per-item is not sufficient. When two items have exchanged codes
 * (model: GL-1, GL-2 / schedule: GL-2, GL-1) each one's target is occupied by
 * the other, so an item-at-a-time planner either deadlocks (refusing both, to
 * avoid creating a duplicate) or emits a rename that would collide.
 *
 * The fix is the same two-hop technique the Code Manager already uses for
 * renumbering: move every diverging item to a unique temporary code FIRST,
 * then move each temporary onto its real target. By the time any target is
 * claimed, every code that needed vacating has been vacated, so no hop can
 * ever collide — cycles of any length included.
 *
 * Temporary codes are allocated per prefix above the highest number that
 * prefix uses anywhere — across the planned items AND `reservedCodes`, which
 * must list every other code that exists in the model. Without that second
 * list a temporary code can land on a real material the plan never mentions
 * (an unlinked one, say), and the plugin would be told to rename onto an
 * occupied slot.
 *
 * Returns hops in execution order. Items already aligned produce nothing.
 */
export function planConvergenceHops(
  items: ConvergenceItem[],
  reservedCodes: string[] = []
): ConvergenceHop[] {
  const diverging: { model: string; schedule: string }[] = [];
  for (const item of items) {
    const model = normalizeSharedCode(item.modelCode);
    const schedule = normalizeSharedCode(item.scheduleCode);
    if (!model || !schedule || model === schedule) continue;
    diverging.push({ model, schedule });
  }
  if (diverging.length === 0) return [];

  const prefixOf = (code: string) => code.slice(0, code.lastIndexOf("-"));
  const numberOf = (code: string) => Number(code.slice(code.lastIndexOf("-") + 1));

  // Highest number in use per prefix, across every code the plan touches, so
  // the temporary band starts safely above all of them.
  const highestByPrefix = new Map<string, number>();
  const noteCode = (code: string) => {
    const prefix = prefixOf(code);
    const value = numberOf(code);
    if (!prefix || !Number.isFinite(value)) return;
    highestByPrefix.set(prefix, Math.max(highestByPrefix.get(prefix) ?? 0, value));
  };
  for (const item of items) {
    noteCode(normalizeSharedCode(item.modelCode));
    noteCode(normalizeSharedCode(item.scheduleCode));
  }
  for (const code of reservedCodes) {
    noteCode(normalizeSharedCode(code));
  }

  const nextTempByPrefix = new Map<string, number>();
  const allocateTemp = (prefix: string) => {
    const start = nextTempByPrefix.get(prefix) ?? (highestByPrefix.get(prefix) ?? 0) + 1;
    nextTempByPrefix.set(prefix, start + 1);
    return `${prefix}-${start}`;
  };

  const toTemp: ConvergenceHop[] = [];
  const fromTemp: ConvergenceHop[] = [];
  for (const item of diverging) {
    const temp = allocateTemp(prefixOf(item.model));
    toTemp.push({ sourceCode: item.model, targetCode: temp });
    fromTemp.push({ sourceCode: temp, targetCode: item.schedule });
  }

  // All vacating hops first, then all claiming hops.
  return [...toTemp, ...fromTemp];
}
