/**
 * Calendário e horas do produto — padrão Brasília (America/Sao_Paulo).
 * Nunca use `toISOString().slice(0, 10)` para “dia do herói”: isso é UTC.
 */

export const APP_TIMEZONE = "America/Sao_Paulo";

/** YYYY-MM-DD no fuso informado (padrão: Brasília). */
export function calendarDateInTz(date: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Atalho: “hoje” do produto. */
export function hojeISO(date: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return calendarDateInTz(date, timeZone);
}

/** Soma/subtrai dias em uma chave YYYY-MM-DD (aritmética de calendário). */
export function addDaysToDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function ontemISO(date: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return addDaysToDateKey(hojeISO(date, timeZone), -1);
}

/** Hora 0–23 no fuso (padrão Brasília). */
export function hourInTz(date: Date = new Date(), timeZone: string = APP_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const h = Number(raw);
  // Alguns engines reportam meia-noite como 24
  return h === 24 ? 0 : h;
}

/**
 * Quiet hours do produto: 23:00–06:59 no fuso (docs: ≈ BRT).
 * Antes era UTC 02–10 ≈ BRT 23–07; agora usa o fuso diretamente.
 */
export function isQuietHoursInTz(date: Date = new Date(), timeZone: string = APP_TIMEZONE): boolean {
  const h = hourInTz(date, timeZone);
  return h >= 23 || h < 7;
}

/** @deprecated use isQuietHoursInTz — mantido para imports antigos. */
export function isQuietHoursUtc(date: Date = new Date()): boolean {
  return isQuietHoursInTz(date, APP_TIMEZONE);
}

/**
 * Offset (ms) de `timeZone` em relação a UTC no instante `date`:
 * localWallAsUtc - instant = offset → instant = wallUtc - offset.
 */
function tzOffsetMilliseconds(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** Instant UTC correspondente a `dateKey` + horário civil em `timeZone`. */
export function zonedDateTimeToUtc(
  dateKey: string,
  hour: number,
  minute = 0,
  second = 0,
  timeZone: string = APP_TIMEZONE,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  let utcMillis = Date.UTC(y, m - 1, d, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const offset = tzOffsetMilliseconds(new Date(utcMillis), timeZone);
    utcMillis = Date.UTC(y, m - 1, d, hour, minute, second) - offset;
  }
  return new Date(utcMillis);
}

/** Limites inclusivos do dia civil em `timeZone`, como ISO UTC. */
export function zonedDayBoundsUtcIso(
  dia: string,
  timeZone: string = APP_TIMEZONE,
): { start: string; end: string } {
  const start = zonedDateTimeToUtc(dia, 0, 0, 0, timeZone);
  const next = zonedDateTimeToUtc(addDaysToDateKey(dia, 1), 0, 0, 0, timeZone);
  return {
    start: start.toISOString(),
    end: new Date(next.getTime() - 1).toISOString(),
  };
}

/** Lista de YYYY-MM-DD de `fromKey` até `toKey` (inclusive). */
export function eachDateKeyInclusive(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = fromKey;
  while (cur <= toKey) {
    out.push(cur);
    cur = addDaysToDateKey(cur, 1);
    if (out.length > 400) break;
  }
  return out;
}
