import { Role, PhaseName } from "@/generated/prisma";

export function canEditPhase(role: Role, phaseName: PhaseName): boolean {
  if (role === "ADMIN") return true;
  if (role === "STAFF") return false;

  if (role === "DIC") {
    // DIC handles all phases except Construction Doc (CD)
    return phaseName !== "CD";
  }

  if (role === "DRIC") {
    // DRIC (Drafter) handles Technical Drawings (CD phase)
    return phaseName === "CD";
  }

  return false;
}

export function canEditProjectMetadata(
  role: Role,
  userId: string,
  picDesignerId: string
): boolean {
  if (role === "ADMIN") return true;
  return role === "DIC" && userId === picDesignerId;
}
