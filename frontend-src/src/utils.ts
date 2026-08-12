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

/** Day abbreviations for a locale; defaults to pt-BR. Index 0 = Monday. */
export function dayLabels(locale?: string | null): string[] {
  if (!locale || locale.toLowerCase().startsWith("pt")) {
    return [...DAYS_PT];
  }
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_unused, index) => {
    // 2000-01-03 was a Monday; a fixed date keeps the labels locale-stable.
    const date = new Date(2000, 0, 3 + index, 12, 0, 0);
    return formatter.format(date).replace(/\.$/, "");
  });
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
