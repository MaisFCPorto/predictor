// src/utils/dates.ts

const LISBON_TIME_ZONE = 'Europe/Lisbon';

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock value from an <input type="datetime-local"> in
 * Portugal into an absolute UTC timestamp before it is sent to the API.
 */
export function localDateTimeToUtcIso(localValue: string) {
  const match = localValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return '';

  const [, year, month, day, hour, minute, second = '0'] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  let utcTime =
    wallClockUtc - timeZoneOffsetMs(new Date(wallClockUtc), LISBON_TIME_ZONE);

  // Recalculate after the first conversion because the DST offset may differ
  // between the UTC guess and the resulting instant.
  const correctedUtcTime =
    wallClockUtc - timeZoneOffsetMs(new Date(utcTime), LISBON_TIME_ZONE);
  if (correctedUtcTime !== utcTime) utcTime = correctedUtcTime;

  return new Date(utcTime).toISOString();
}

/**
 * D1/SQLite DATETIME('now') values are UTC, but are returned without a Z.
 * Append it only when the timestamp has no explicit timezone.
 */
export function parseDbUtcTimestamp(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function formatDbDateTimePT(value: string) {
  const date = parseDbUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: LISBON_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function fmtKickoffPT(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: LISBON_TIME_ZONE,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(new Date(iso))
      .replace('.', '');
  } catch {
    return iso;
  }
}
