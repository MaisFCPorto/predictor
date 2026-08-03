export function normalizePlayerId(value: unknown): string {
  if (value == null) return '';

  const numericId = Number(value);
  if (Number.isInteger(numericId) && numericId > 0) {
    return String(numericId);
  }

  return String(value).trim();
}

export function toPositivePlayerId(value: unknown): number | null {
  const numericId = Number(value);
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
}
