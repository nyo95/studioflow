export const PROVENANCE_SOURCES = [
  "MASTER_DATA",
  "PROJECT_LOCAL",
  "SNAPSHOT",
  "MANUAL_OVERRIDE",
  "LIBRARY",
] as const;

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export function isProvenanceSource(value: unknown): value is ProvenanceSource {
  return (
    typeof value === "string" &&
    (PROVENANCE_SOURCES as readonly string[]).includes(value)
  );
}
