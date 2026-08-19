import type { Role } from "@/generated/prisma";

/**
 * Who may hold each PIC seat on a project.
 *
 * The original bug this module fixed: the pickers offered ADMIN, DEVELOPER and
 * STAFF for the designer seat and STAFF for the drafter seat, which is how a
 * STAFF account ended up listed as a candidate drafter. Tightening both seats to
 * the role of the same name fixed it.
 *
 * ADMIN and DEVELOPER were re-added to the designer seat on 2026-08-10 (owner
 * request). That is a narrower change than the state it reverts to, and the
 * distinction matters:
 *
 *   - **STAFF stays out.** It was never a designer role; it was collateral from
 *     the same over-broad list, and it is the half that caused the reported bug.
 *   - **The drafter seat is untouched.** DRIC only.
 *
 * The reason to allow it: in a studio this size the ADMIN account frequently is
 * a working designer, and forcing a role change just to hold a seat means
 * trading away the admin rights the same person needs.
 *
 * The cost, worth stating because it is invisible: the seat no longer proves the
 * role. `isAdminLevel` already lets these two past every per-project gate, so a
 * project whose DIC is an ADMIN cannot be read as "a DIC signed off on this" —
 * only as "somebody with rights holds the seat". Anything that comes to depend
 * on the seat as evidence of the role has to check the role itself.
 *
 * This lived duplicated in two page files that had already been copy-pasted
 * apart. One list, one place.
 */
// String literals rather than `Role.DIC`: the enum object is a runtime import
// from the generated client, and this module is pure policy — keeping it free
// of that lets it be unit-tested without a database client.
export const DESIGNER_ROLES: Role[] = ["DIC", "ADMIN", "DEVELOPER"];
export const DRAFTER_ROLES: Role[] = ["DRIC"];

interface PicCandidate {
  id: string;
  role: Role;
}

/**
 * Eligible candidates, **plus whoever currently holds the seat**.
 *
 * That second half is not politeness, it is a correctness requirement. The
 * pickers are uncontrolled `<select defaultValue={currentId}>`: if the current
 * holder is missing from the options, the browser silently renders the *first*
 * option instead, and a save that never touched the field reassigns the project
 * to whoever happens to sort first. Legacy assignments made under the old,
 * looser rule would have been quietly rewritten by anyone who opened the dialog.
 */
export function eligiblePics<T extends PicCandidate>(
  users: T[],
  allowedRoles: Role[],
  currentId?: string | null
): T[] {
  return users.filter((user) => allowedRoles.includes(user.role) || user.id === currentId);
}

export function eligibleDesigners<T extends PicCandidate>(users: T[], currentId?: string | null): T[] {
  return eligiblePics(users, DESIGNER_ROLES, currentId);
}

export function eligibleDrafters<T extends PicCandidate>(users: T[], currentId?: string | null): T[] {
  return eligiblePics(users, DRAFTER_ROLES, currentId);
}

/**
 * Server-side gate for a PIC change.
 *
 * The rule is "eligible OR unchanged", not plain "eligible". A project whose
 * designer predates this restriction must stay saveable — otherwise every edit
 * to an unrelated field on that project would fail, and the only way out would
 * be reassigning a project nobody asked to reassign.
 */
export function isPicAssignable(
  candidate: { role: Role } | null,
  allowedRoles: Role[],
  { currentId, nextId }: { currentId: string; nextId: string }
): boolean {
  if (nextId === currentId) return true;
  return candidate !== null && allowedRoles.includes(candidate.role);
}
