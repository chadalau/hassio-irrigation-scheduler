import type { HistoryRun, Schedule } from "./types";

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

/**
 * Single-letter day initials, same order/index as ``dayLabels()`` (index 0 =
 * Monday). Deliberately ambiguous on its own (Seg/Sex/Sáb all start with
 * "S", Qua/Qui both start with "Q") -- the fixed position in the 7-letter
 * strip conveys which day it is, not the letter alone.
 */
export function dayInitials(): string[] {
  return dayLabels().map((label) => label.charAt(0));
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
  // A positive-but-tiny volume would otherwise print "0 L" next to a
  // reservoir estimate derived from the same non-zero number.
  if (rounded === 0 && liters > 0) {
    return "< 0.01 L";
  }
  return `${rounded} L`;
}

/** "620/1000 L" (each side rounded to at most 1 decimal). */
export function formatVolumeFraction(remainingL: number, totalL: number): string {
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const remaining = round1(Number.isFinite(remainingL) ? Math.max(0, remainingL) : 0);
  const total = round1(Number.isFinite(totalL) ? Math.max(0, totalL) : 0);
  return `${remaining}/${total} L`;
}

/**
 * Average liters/day the zone's ENABLED schedules would consume, at
 * ``flowLph``/``pots``. A schedule's weekly contribution is its per-run
 * total volume times how many days/week it fires; the average is that sum
 * spread over 7 days. Returns 0 when there is nothing enabled (or no flow
 * rate configured) -- callers use that to hide the "time until empty"
 * estimate rather than showing a nonsensical infinite runway.
 */
export function averageDailyVolumeL(
  schedules: readonly Schedule[],
  flowLph: number,
  pots: number,
): number {
  let weeklyMl = 0;
  for (const schedule of schedules) {
    if (!schedule.enabled) {
      continue;
    }
    const total = totalVolumeMl(flowLph, schedule.duration, pots);
    if (total === null) {
      continue;
    }
    weeklyMl += total * schedule.days.length;
  }
  return weeklyMl / 1000 / 7;
}

/**
 * "~3 h" / "~12 dias" / "~2 meses" estimate of when the reservoir runs dry,
 * given its current remaining volume and the zone's average daily
 * consumption. Adaptive units: hours below one day, days up to 60, months
 * beyond that. Returns "Vazio" when already empty, and `null` (no estimate
 * to show) when there is no active consumption to project from.
 */
export function formatReservoirEstimate(
  remainingL: number,
  avgDailyVolumeL: number,
): string | null {
  if (!Number.isFinite(avgDailyVolumeL) || avgDailyVolumeL <= 0) {
    return null;
  }
  const remaining = Number.isFinite(remainingL) ? Math.max(0, remainingL) : 0;
  if (remaining <= 0) {
    return "Vazio";
  }
  const days = remaining / avgDailyVolumeL;
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `~${hours} h`;
  }
  if (days <= 60) {
    return `~${Math.max(1, Math.round(days))} dias`;
  }
  const months = Math.max(1, Math.round(days / 30));
  return `~${months} meses`;
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
 * Inverse of ``perPotVolumeMl``: the duration (seconds) a run needs to
 * deliver ``volumeMl`` to ONE pot at ``flowLph`` liters per hour. Returns
 * ``null`` when no flow rate is configured (0 or missing) -- there is no
 * duration that would satisfy a target volume without a known flow rate.
 */
export function durationSecondsForPerPotVolumeMl(
  flowLph: number,
  volumeMl: number,
): number | null {
  const safe = Number.isFinite(flowLph) ? flowLph : 0;
  if (safe <= 0) {
    return null;
  }
  const ml = Number.isFinite(volumeMl) ? Math.max(0, volumeMl) : 0;
  const liters = ml / 1000;
  return Math.round((liters / safe) * 3600);
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

/**
 * Sorted copy, ascending by time of day. Display order only -- it has no
 * effect on which schedule fires next (that is computed purely from time +
 * days, regardless of list order).
 */
export function sortSchedulesByTime(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort(
    (a, b) => timeToSeconds(a.time) - timeToSeconds(b.time),
  );
}

/** Seconds since midnight, or -1 for invalid/out-of-range input. */
export function timeToSeconds(time: string): number {
  const parts = parseTimeParts(time);
  if (!parts) {
    return -1;
  }
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

/**
 * Format a live sensor reading (pH/EC badge next to the zone title):
 * rounds to 2 decimals and appends the unit when known. Non-finite/missing
 * values render as "?" so a badge is still shown (and still clickable to
 * open history) even while the sensor is unavailable/unknown.
 */
export function formatSensorReading(value: number, unit?: string): string {
  if (!Number.isFinite(value)) {
    return "?";
  }
  const rounded = Math.round(value * 100) / 100;
  return unit ? `${rounded} ${unit}` : `${rounded}`;
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

/** One calendar day's worth of history entries, most-recent-day-first. */
export interface HistoryDayGroup {
  /** "Hoje" / "Ontem" / "12/08". */
  label: string;
  /** Most-recent-run-first, mirroring the order ``history`` already arrives in. */
  entries: HistoryRun[];
  /** Sum of totalVolumeMl() across every run that day. */
  totalMl: number;
  /** Sum delivered to EACH pot across every run that day. */
  perPotMl: number;
}

/**
 * "YYYY-MM-DD" for ``date`` in ``timeZone`` (the HA SERVER's zone when
 * given; falls back to the runtime's own zone when undefined). Used as a
 * comparable/sortable calendar-day key instead of ``Date.toDateString()``,
 * which is always the BROWSER's local zone and cannot take a timeZone
 * override -- comparing by it would group/label a run's day relative to
 * whoever is looking at the dashboard, not to the HA instance actually
 * running the schedule.
 */
export function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * "Hoje" / "Ontem" / "12/08" for a date relative to ``nowIso``, both
 * evaluated in ``timeZone`` (the HA server's zone); "" if ``iso`` is
 * unparseable.
 */
export function dayLabelFor(iso: string, nowIso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date(nowIso);
  if (dayKey(date, timeZone) === dayKey(now, timeZone)) {
    return "Hoje";
  }
  // Exactly 24h back in absolute time, then re-keyed in timeZone -- avoids
  // browser-local calendar math (setDate) disagreeing with the target zone
  // around a midnight boundary.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(date, timeZone) === dayKey(yesterday, timeZone)) {
    return "Ontem";
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(
    date,
  );
}

/**
 * Groups history entries by calendar day IN ``timeZone`` (the HA server's
 * zone, so grouping/labels match when the schedule actually fired,
 * regardless of the viewing browser's own zone), labeling today/yesterday
 * and summing each day's total delivered volume. ``history`` is assumed
 * most-recent-first already (the backend's order); day groups come out
 * most-recent-day-first too, since a Map preserves first-insertion order.
 */
export function groupHistoryByDay(
  history: readonly HistoryRun[],
  nowIso: string,
  timeZone?: string,
): HistoryDayGroup[] {
  const groups = new Map<string, HistoryDayGroup>();
  for (const entry of history) {
    const date = new Date(entry.started_at);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const key = dayKey(date, timeZone);
    let group = groups.get(key);
    if (!group) {
      group = {
        label: dayLabelFor(entry.started_at, nowIso, timeZone),
        entries: [],
        totalMl: 0,
        perPotMl: 0,
      };
      groups.set(key, group);
    }
    group.entries.push(entry);
    const total = totalVolumeMl(entry.flow_rate_lph, entry.duration, entry.number_of_pots);
    if (total !== null) {
      group.totalMl += total;
    }
    const perPot = perPotVolumeMl(entry.flow_rate_lph, entry.duration);
    if (perPot !== null) {
      group.perPotMl += perPot;
    }
  }
  return Array.from(groups.values());
}

/**
 * Human label for a run's "source" -- "agendada" (a scheduled firing),
 * "manual" (the card's own Regar agora / the water_now service), or
 * "ativada no dispositivo" (the target was actuated OUTSIDE the
 * integration: a physical button, the device's own app, another
 * automation -- see the backend's SOURCE_EXTERNAL). Unknown/missing values
 * fall back to "agendada" rather than throwing, since that was already this
 * label's behavior before "external" existed.
 */
export function sourceLabel(source: string | null | undefined): string {
  if (source === "manual") {
    return "manual";
  }
  if (source === "external") {
    return "ativada no dispositivo";
  }
  return "agendada";
}

/** mdi icon matching sourceLabel's three cases. */
export function sourceIcon(source: string | null | undefined): string {
  if (source === "manual") {
    return "mdi:hand-back-right";
  }
  if (source === "external") {
    return "mdi:gesture-tap-button";
  }
  return "mdi:calendar-clock";
}

/** Day of week (0 = Monday .. 6 = Sunday, this card's convention) for
 * ``date`` IN ``timeZone`` -- same reasoning as ``dayKey``: the browser's
 * own local zone would put the wrong weekday's schedule "today" if it
 * differs from the HA server's. */
function weekdayInZone(date: Date, timeZone?: string): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(label);
  // Intl always returns one of the 7 English abbreviations above; a -1
  // (unexpected locale data) falls back to JS's own 0=Sunday getDay(),
  // re-based to this card's 0=Monday convention, rather than crashing.
  return index >= 0 ? index : (date.getDay() + 6) % 7;
}

/** Seconds since midnight for ``date`` IN ``timeZone``. */
function secondsSinceMidnightInZone(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Midnight is sometimes formatted as "24" by this Intl option; normalize
  // it back to 0 so the seconds-since-midnight value stays in [0, 86400).
  const hour = part("hour") % 24;
  return hour * 3600 + part("minute") * 60 + part("second");
}

/**
 * How many enabled schedules are set to run on today's weekday (in the
 * zone's own timezone). Drives the card's summary headline; unlike
 * ``scheduleStatusToday`` this only asks "is it on today's calendar", not
 * whether it already ran.
 */
export function countSchedulesToday(
  schedules: readonly Schedule[],
  nowIso: string,
  timeZone?: string,
): number {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) {
    return 0;
  }
  const today = weekdayInZone(now, timeZone);
  return schedules.filter(
    (schedule) => schedule.enabled && schedule.days.includes(today),
  ).length;
}

/** Today's status for one schedule, IN ``timeZone`` (the HA server's zone):
 * ``"warning"`` when its last scheduled firing didn't complete normally
 * (``hasWarning``, from ``schedule_warnings`` -- takes priority over
 * everything else), ``"pending"`` when today is one of its days and the
 * time hasn't arrived yet, ``"done"`` when today is one of its days, the
 * time has passed, and a matching ``history`` entry (same ``schedule_id``,
 * same calendar day) confirms it ran -- or ``null`` when none of that
 * applies (today isn't an active day, the schedule is disabled, or the
 * time already passed with no warning AND no matching history entry, which
 * is ambiguous rather than a known-good or known-bad state). */
export function scheduleStatusToday(
  schedule: Schedule,
  hasWarning: boolean,
  history: readonly HistoryRun[],
  nowIso: string,
  timeZone?: string,
): "done" | "pending" | "warning" | null {
  if (hasWarning) {
    return "warning";
  }
  if (!schedule.enabled) {
    return null;
  }
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) {
    return null;
  }
  if (!schedule.days.includes(weekdayInZone(now, timeZone))) {
    return null;
  }
  const scheduleSeconds = timeToSeconds(schedule.time);
  if (scheduleSeconds < 0) {
    return null;
  }
  if (secondsSinceMidnightInZone(now, timeZone) < scheduleSeconds) {
    return "pending";
  }
  const today = dayKey(now, timeZone);
  const ranToday = history.some(
    (entry) => {
      const startedAt = new Date(entry.started_at);
      return (
        entry.schedule_id === schedule.id &&
        !Number.isNaN(startedAt.getTime()) &&
        dayKey(startedAt, timeZone) === today
      );
    },
  );
  return ranToday ? "done" : null;
}
