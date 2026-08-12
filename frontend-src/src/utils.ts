import type { Schedule } from "./types";

const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;

/** Parsed components of a valid "H:MM[:SS]" time string. */
export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Central parser for "H:MM[:SS]" time strings. Accepts 1-2 digit hours,
 * minutes and optional seconds, enforces real limits (hour 0-23, minute
 * 0-59, second 0-59) and returns `null` for anything invalid.
 */
export function parseTimeParts(time: string): TimeParts | null {
  const match = TIME_RE.exec(time);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  return { hour, minute, second };
}

/** "HH:MM:SS" -> "06:00"; seconds are kept only when non-zero. */
export function formatTime(time: string): string {
  const parts = parseTimeParts(time);
  if (!parts) {
    return time;
  }
  const hour = time.slice(0, time.indexOf(":"));
  const minute = String(parts.minute).padStart(2, "0");
  return parts.second > 0
    ? `${hour}:${minute}:${String(parts.second).padStart(2, "0")}`
    : `${hour}:${minute}`;
}

/**
 * Day abbreviations, index 0 = Monday. Always pt-BR: every other string in
 * this card (labels, dialogs, errors) is hardcoded Portuguese too, so making
 * only the day labels follow ``hass.locale``/``hass.language`` produced a
 * half-localized card -- e.g. Portuguese buttons next to "Mon Tue Wed" day
 * chips whenever that HA field did not resolve to a "pt*" value.
 */
export function dayLabels(): string[] {
  return [...DAYS_PT];
}

/** Label shown when every day of the week is selected. */
export function allDaysLabel(): string {
  return "Todos os dias";
}

/** True when ``days`` covers Monday..Sunday (all week). */
export function isAllDays(days: readonly number[]): boolean {
  return days.length === 7 && days.every((d) => d >= 0 && d <= 6);
}

/** "15 min" / "1 h 30 min" / "45 s". */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  if (safe < 60) {
    return `${safe} s`;
  }
  const totalMinutes = Math.round(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }
  return parts.join(" ");
}

/** Whole seconds between now and finishesAt, floored and >= 0. */
export function remainingSeconds(finishesAtISO: string, nowIso: string): number {
  const finish = Date.parse(finishesAtISO);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(finish) || !Number.isFinite(now)) {
    return 0;
  }
  return Math.max(0, Math.floor((finish - now) / 1000));
}

/**
 * Liters a run of ``durationSeconds`` delivers to ONE pot at ``flowLph``
 * liters per hour. ``flowLph`` is the flow rate PER POT. Returns ``null`` when
 * no flow rate is configured (0 or missing).
 */
export function waterVolume(
  flowLph: number,
  durationSeconds: number,
): number | null {
  const safe = Number.isFinite(flowLph) ? flowLph : 0;
  if (safe <= 0) {
    return null;
  }
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
  return (safe / 3600) * duration;
}

/** "5 L", "0.5 L", "12.34 L". */
export function formatVolume(liters: number): string {
  if (!Number.isFinite(liters)) {
    return "0 L";
  }
  const rounded = Math.round(liters * 100) / 100;
  return `${rounded} L`;
}

/**
 * Milliliters delivered to ONE pot for a run. ``flowLph`` is the flow rate
 * PER POT; the number of pots does not change what a single pot receives.
 * Returns ``null`` when no flow rate is configured.
 */
export function perPotVolumeMl(
  flowLph: number,
  durationSeconds: number,
): number | null {
  const liters = waterVolume(flowLph, durationSeconds);
  return liters === null ? null : liters * 1000;
}

/**
 * Total milliliters delivered to all pots for a run, i.e. per-pot volume
 * times the number of pots. When ``pots`` is not configured (0 or missing),
 * the total equals the per-pot volume.
 */
export function totalVolumeMl(
  flowLph: number,
  durationSeconds: number,
  pots: number,
): number | null {
  const perPot = perPotVolumeMl(flowLph, durationSeconds);
  if (perPot === null) {
    return null;
  }
  const count = Number.isFinite(pots) && pots > 0 ? pots : 1;
  return perPot * count;
}

/** "417 ml", "1.2 L" (liters when >= 1000 ml). */
export function formatMl(ml: number): string {
  if (!Number.isFinite(ml)) {
    return "0 ml";
  }
  if (ml >= 1000) {
    return formatVolume(ml / 1000);
  }
  return `${Math.round(ml * 100) / 100} ml`;
}

/** "MM:SS"; "H:MM:SS" once the remaining time exceeds one hour. */
export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Progress of the active run in 0..100 (clamped); 100 when no run span. */
export function progressPct(
  finishesAtISO: string,
  startedAtISO: string,
  nowIso: string,
): number {
  const finish = Date.parse(finishesAtISO);
  const start = Date.parse(startedAtISO);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(finish) || !Number.isFinite(start) || !Number.isFinite(now)) {
    return 0;
  }
  const total = finish - start;
  if (total <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, ((now - start) / total) * 100));
}

/** Filter malformed items, normalize fields and dedupe/sort days. */
export function sanitizeSchedules(raw: unknown): Schedule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: Schedule[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const time =
      typeof record.time === "string" && parseTimeParts(record.time) !== null
        ? toServiceTime(record.time)
        : "";
    const days = Array.isArray(record.days)
      ? record.days.filter(
          (d): d is number =>
            typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
        )
      : [];
    const duration =
      typeof record.duration === "number" &&
      Number.isFinite(record.duration) &&
      record.duration > 0
        ? record.duration
        : 0;
    if (!time || days.length === 0 || duration <= 0) {
      continue;
    }
    result.push({
      id: typeof record.id === "string" ? record.id : "",
      time,
      days: [...new Set(days)].sort((a, b) => a - b),
      duration,
      enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    });
  }
  return result;
}

/** Seconds since midnight, or -1 for invalid/out-of-range input. */
export function timeToSeconds(time: string): number {
  const parts = parseTimeParts(time);
  if (!parts) {
    return -1;
  }
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

/** Normalize a time string to the backend's "HH:MM:SS" format. */
export function toServiceTime(time: string): string {
  const parts = parseTimeParts(time);
  if (!parts) {
    return time;
  }
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const second = String(parts.second).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}
