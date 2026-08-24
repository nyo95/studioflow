export function roundHalfUp(value: number): number {
  if (value < 0) return -roundHalfUp(-value);
  return Math.floor(value + 0.5);
}
