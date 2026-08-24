export function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function emptyToNull<T>(value: T | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  return value;
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeName(value: string | null | undefined): string | null {
  const collapsed = collapseWhitespace(value ?? "");
  return collapsed.length > 0 ? collapsed : null;
}

export function normalizeCode(
  value: string | null | undefined,
  options?: { uppercase?: boolean }
): string | null {
  const collapsed = collapseWhitespace(value ?? "");
  if (collapsed.length === 0) return null;
  return options?.uppercase ? collapsed.toUpperCase() : collapsed;
}

export function normalizeSearchText(value: string | null | undefined): string {
  return collapseWhitespace(value ?? "")
    .normalize("NFKC")
    .toLowerCase();
}
