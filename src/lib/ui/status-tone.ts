/**
 * Domain-side status → badge-tone mapping (PRD Architecture Cleanup v2 §40).
 *
 * R5 moved `StatusBadge` to a tone-only API; the engine must not know domain
 * statuses. This helper owns the mapping that used to be hard-coded inside
 * the engine component — the values below are carried over verbatim so no
 * badge changes color in this phase.
 *
 * Domains that need a different judgement for a specific status should add an
 * explicit map here rather than reaching back into UI Engine.
 */
import type { StatusTone } from "@/ui_engine";

export function statusToTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  const normalized = status.toUpperCase().replace(/_/g, " ");
  if (["IN PROGRESS", "ACTIVE"].includes(normalized)) return "success";
  if (["ON REVIEW INTERNAL", "ON REVIEW CLIENT", "PENDING"].includes(normalized)) return "warning";
  if (["COMPLETED", "READY FOR NEXT", "APPROVED"].includes(normalized)) return "info";
  if (["REJECTED", "CANCELLED", "OVERDUE"].includes(normalized)) return "critical";
  return "neutral";
}
