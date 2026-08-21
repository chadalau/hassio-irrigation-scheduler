import { describe, expect, it } from "vitest";

import {
  countSchedulesToday,
  averageDailyVolumeL,
  dayInitials,
  dayLabels,
  formatDuration,
  formatMl,
  formatRemaining,
  formatReservoirEstimate,
  formatSensorReading,
  formatTime,
  formatVolume,
  formatVolumeFraction,
  dayLabelFor,
  durationSecondsForPerPotVolumeMl,
  groupHistoryByDay,
  parseTimeParts,
  perPotVolumeMl,
  progressPct,
  remainingSeconds,
  sanitizeSchedules,
  scheduleStatusToday,
  sortSchedulesByTime,
  sourceIcon,
  sourceLabel,
  timeToSeconds,
  toServiceTime,
  totalVolumeMl,
  waterVolume,
} from "../src/utils";
import type { HistoryRun, Schedule } from "../src/types";

describe("formatTime", () => {
  it("drops :00 seconds", () => {
    expect(formatTime("06:00:00")).toBe("06:00");
  });

  it("keeps non-zero seconds", () => {
    expect(formatTime("06:30:15")).toBe("06:30:15");
  });

  it("accepts HH:MM without seconds", () => {
    expect(formatTime("07:05")).toBe("07:05");
  });

  it("passes through garbage unchanged", () => {
    expect(formatTime("nope")).toBe("nope");
    expect(formatTime("")).toBe("");
  });

  it("formats 1-digit components without padding the hour", () => {
    expect(formatTime("6:05:30")).toBe("6:05:30");
    expect(formatTime("6:5")).toBe("6:05");
  });

  it("rejects out-of-range times", () => {
    expect(formatTime("24:00")).toBe("24:00");
    expect(formatTime("99:99")).toBe("99:99");
  });
});

describe("parseTimeParts", () => {
  it("parses valid times with flexible digit counts", () => {
    expect(parseTimeParts("6:5")).toEqual({ hour: 6, minute: 5, second: 0 });
    expect(parseTimeParts("06:05")).toEqual({ hour: 6, minute: 5, second: 0 });
    expect(parseTimeParts("06:05:05")).toEqual({ hour: 6, minute: 5, second: 5 });
  });

  it("returns null for out-of-range values", () => {
    expect(parseTimeParts("24:00")).toBeNull();
    expect(parseTimeParts("99:99")).toBeNull();
    expect(parseTimeParts("12:60")).toBeNull();
    expect(parseTimeParts("00:00:60")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseTimeParts("")).toBeNull();
    expect(parseTimeParts("nope")).toBeNull();
    expect(parseTimeParts("6:5:5:5")).toBeNull();
  });
});

describe("dayLabels", () => {
  it("always returns the pt-BR abbreviations", () => {
    // The card hardcodes every other string in Portuguese too (labels,
    // dialogs, errors), so the day chips no longer follow hass.locale --
    // that half-localization used to show English day names on pt-BR HA
    // installs whenever hass.locale.language didn't resolve as expected.
    expect(dayLabels()).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
  });
});

describe("dayInitials", () => {
  it("returns one letter per day, same order as dayLabels", () => {
    expect(dayInitials()).toEqual(["S", "T", "Q", "Q", "S", "S", "D"]);
  });
});

describe("dayLabelFor", () => {
  const NOW = "2026-08-13T12:00:00Z";

  it("labels today, yesterday, and older dates", () => {
    expect(dayLabelFor("2026-08-13T06:00:00Z", NOW)).toBe("Hoje");
    expect(dayLabelFor("2026-08-12T06:00:00Z", NOW)).toBe("Ontem");
    expect(dayLabelFor("2026-08-01T06:00:00Z", NOW)).toBe("01/08");
  });

  it("returns '' for an unparseable date", () => {
    expect(dayLabelFor("not-a-date", NOW)).toBe("");
  });

  it("evaluates the day in the given timeZone (HA server's), not the runtime's default", () => {
    // 23:30 UTC on Aug 1 is still Aug 1 in UTC, but already Aug 2 13:30 in
    // Pacific/Kiritimati (UTC+14) -- the fallback "DD/MM" label must follow
    // whichever timeZone is passed, independent of the test runner's own zone.
    const iso = "2026-08-01T23:30:00Z";
    const now = "2026-08-10T12:00:00Z"; // far enough to skip Hoje/Ontem
    expect(dayLabelFor(iso, now, "UTC")).toBe("01/08");
    expect(dayLabelFor(iso, now, "Pacific/Kiritimati")).toBe("02/08");
  });
});

describe("groupHistoryByDay", () => {
  const NOW = "2026-08-13T12:00:00Z";

  function run(startedAt: string, duration: number): HistoryRun {
    return {
      started_at: startedAt,
      finishes_at: startedAt,
      duration,
      source: "schedule",
      schedule_id: "s1",
      flow_rate_lph: 8,
      number_of_pots: 12,
      ph_value: null,
      ec_value: null,
      ec_unit: null,
      ph_value_2: null,
      ec_value_2: null,
      ec_unit_2: null,
    };
  }

  it("groups most-recent-first entries by day, labeling Hoje/Ontem/date", () => {
    const history = [
      run("2026-08-13T18:00:00Z", 450), // today, later
      run("2026-08-13T06:00:00Z", 900), // today, earlier
      run("2026-08-12T06:00:00Z", 900), // yesterday
      run("2026-08-01T06:00:00Z", 900), // older
    ];

    const groups = groupHistoryByDay(history, NOW);

    expect(groups.map((g) => g.label)).toEqual(["Hoje", "Ontem", "01/08"]);
    expect(groups[0].entries).toHaveLength(2);
    // Order within a day is preserved as given (most-recent-first).
    expect(groups[0].entries[0].duration).toBe(450);
    expect(groups[0].entries[1].duration).toBe(900);
    // 450s @ 8 L/h/pot = 1000 ml/pot * 12 pots = 12000 ml;
    // 900s @ 8 L/h/pot = 2000 ml/pot * 12 pots = 24000 ml.
    expect(groups[0].totalMl).toBeCloseTo(36000);
    expect(groups[0].perPotMl).toBeCloseTo(3000);
    expect(groups[1].totalMl).toBeCloseTo(24000);
    expect(groups[1].perPotMl).toBeCloseTo(2000);
  });

  it("skips entries with an unparseable started_at instead of crashing", () => {
    const history = [run("not-a-date", 900), run("2026-08-13T06:00:00Z", 900)];
    const groups = groupHistoryByDay(history, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(1);
  });

  it("returns an empty list for empty history", () => {
    expect(groupHistoryByDay([], NOW)).toEqual([]);
  });

  it("groups by the given timeZone (server's), not the runtime's default", () => {
    // 23:30 UTC on Aug 1 and 00:30 UTC on Aug 2 are two different UTC
    // calendar days, but the SAME local day (Aug 2) in Pacific/Kiritimati
    // (UTC+14) -- they must land in one group when that timeZone is passed.
    const history = [run("2026-08-02T00:30:00Z", 300), run("2026-08-01T23:30:00Z", 300)];
    const now = "2026-08-10T12:00:00Z";

    const utcGroups = groupHistoryByDay(history, now, "UTC");
    expect(utcGroups).toHaveLength(2);

    const kiritimatiGroups = groupHistoryByDay(history, now, "Pacific/Kiritimati");
    expect(kiritimatiGroups).toHaveLength(1);
    expect(kiritimatiGroups[0].entries).toHaveLength(2);
  });
});

describe("scheduleStatusToday", () => {
  // 2024-05-06 is a Monday (index 0 in this card's day convention).
  function schedule(overrides: Partial<Schedule> = {}): Schedule {
    return {
      id: "s1",
      time: "06:00:00",
      days: [0],
      duration: 600,
      enabled: true,
      ...overrides,
    };
  }

  function run(startedAt: string, scheduleId = "s1"): HistoryRun {
    return {
      started_at: startedAt,
      finishes_at: startedAt,
      duration: 600,
      source: "schedule",
      schedule_id: scheduleId,
      flow_rate_lph: 8,
      number_of_pots: 1,
      ph_value: null,
      ec_value: null,
      ec_unit: null,
      ph_value_2: null,
      ec_value_2: null,
      ec_unit_2: null,
    };
  }

  it("'warning' takes priority over everything else", () => {
    expect(scheduleStatusToday(schedule(), true, [], "2024-05-06T05:00:00Z", "UTC")).toBe(
      "warning",
    );
  });

  it("returns null for a disabled schedule", () => {
    expect(
      scheduleStatusToday(schedule({ enabled: false }), false, [], "2024-05-06T05:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("returns null when today is not one of the schedule's days", () => {
    // Tuesday.
    expect(
      scheduleStatusToday(schedule({ days: [0] }), false, [], "2024-05-07T05:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("returns 'pending' when today is active and the time has not arrived yet", () => {
    expect(
      scheduleStatusToday(schedule(), false, [], "2024-05-06T05:00:00Z", "UTC"),
    ).toBe("pending");
  });

  it("returns 'done' when the time passed and history confirms it ran today", () => {
    const history = [run("2024-05-06T06:00:05Z")];
    expect(
      scheduleStatusToday(schedule(), false, history, "2024-05-06T07:00:00Z", "UTC"),
    ).toBe("done");
  });

  it("returns null when the time passed with no matching history entry", () => {
    expect(
      scheduleStatusToday(schedule(), false, [], "2024-05-06T07:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("ignores a history entry for a DIFFERENT schedule_id", () => {
    const history = [run("2024-05-06T06:00:05Z", "other-schedule")];
    expect(
      scheduleStatusToday(schedule(), false, history, "2024-05-06T07:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("ignores a history entry from a DIFFERENT calendar day", () => {
    const history = [run("2024-05-05T06:00:05Z")];
    expect(
      scheduleStatusToday(schedule(), false, history, "2024-05-06T07:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("ignores an unparseable history date instead of throwing", () => {
    const history = [run("not-a-date")];
    expect(
      scheduleStatusToday(schedule(), false, history, "2024-05-06T07:00:00Z", "UTC"),
    ).toBeNull();
  });

  it("evaluates day-of-week and time-of-day in the SERVER timezone, not raw UTC", () => {
    // 2024-05-06T23:30:00Z is already Tuesday 13:30 in Pacific/Kiritimati
    // (UTC+14) -- a Monday-only schedule must not be pending/done there.
    expect(
      scheduleStatusToday(
        schedule({ days: [0] }),
        false,
        [],
        "2024-05-06T23:30:00Z",
        "Pacific/Kiritimati",
      ),
    ).toBeNull();
    // But it IS Tuesday there, so a Tuesday schedule at 13:00 local (already
    // passed the 13:30 "now") with a matching history entry is done.
    const history = [run("2024-05-06T23:05:00Z")];
    expect(
      scheduleStatusToday(
        schedule({ days: [1], time: "13:00:00" }),
        false,
        history,
        "2024-05-06T23:30:00Z",
        "Pacific/Kiritimati",
      ),
    ).toBe("done");
  });
});

describe("formatSensorReading", () => {
  it("rounds to 2 decimals and appends the unit when given", () => {
    expect(formatSensorReading(6.234)).toBe("6.23");
    expect(formatSensorReading(812.456, "µS/cm")).toBe("812.46 µS/cm");
    expect(formatSensorReading(6)).toBe("6");
  });

  it("renders non-finite/missing values as '?' instead of NaN/blank", () => {
    expect(formatSensorReading(Number.NaN)).toBe("?");
    expect(formatSensorReading(Number.POSITIVE_INFINITY)).toBe("?");
  });
});

describe("sourceLabel / sourceIcon", () => {
  it("labels the three known sources", () => {
    expect(sourceLabel("schedule")).toBe("agendada");
    expect(sourceLabel("manual")).toBe("manual");
    expect(sourceLabel("external")).toBe("ativada no dispositivo");
  });

  it("falls back to 'agendada' for unknown/missing values", () => {
    expect(sourceLabel(null)).toBe("agendada");
    expect(sourceLabel(undefined)).toBe("agendada");
    expect(sourceLabel("something-else")).toBe("agendada");
  });

  it("picks a distinct icon per source", () => {
    expect(sourceIcon("schedule")).toBe("mdi:calendar-clock");
    expect(sourceIcon("manual")).toBe("mdi:hand-back-right");
    expect(sourceIcon("external")).toBe("mdi:gesture-tap-button");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("45 s");
  });

  it("formats minutes", () => {
    expect(formatDuration(900)).toBe("15 min");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(5400)).toBe("1 h 30 min");
  });

  it("formats whole hours", () => {
    expect(formatDuration(7200)).toBe("2 h");
  });

  it("clamps negative values to zero", () => {
    expect(formatDuration(-5)).toBe("0 s");
  });
});

describe("remainingSeconds", () => {
  it("computes the floored remaining seconds", () => {
    expect(remainingSeconds("2026-01-01T00:01:05Z", "2026-01-01T00:00:00Z")).toBe(65);
  });

  it("returns 0 when the finish time is in the past", () => {
    expect(remainingSeconds("2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z")).toBe(0);
  });

  it("returns 0 when finish equals now", () => {
    expect(remainingSeconds("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(remainingSeconds("not-a-date", "2026-01-01T00:00:00Z")).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("formats MM:SS", () => {
    expect(formatRemaining(65)).toBe("01:05");
  });

  it("formats zero", () => {
    expect(formatRemaining(0)).toBe("00:00");
  });

  it("formats H:MM:SS over an hour", () => {
    expect(formatRemaining(3661)).toBe("1:01:01");
  });

  it("clamps negative values", () => {
    expect(formatRemaining(-3)).toBe("00:00");
  });
});

describe("progressPct", () => {
  it("returns 100 when started equals finishes", () => {
    expect(
      progressPct("2026-01-01T00:10:00Z", "2026-01-01T00:10:00Z", "2026-01-01T00:10:00Z"),
    ).toBe(100);
  });

  it("returns proportional progress", () => {
    expect(
      progressPct("2026-01-01T00:10:00Z", "2026-01-01T00:00:00Z", "2026-01-01T00:05:00Z"),
    ).toBe(50);
  });

  it("clamps to 100 once finished", () => {
    expect(
      progressPct("2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z", "2026-01-01T00:00:20Z"),
    ).toBe(100);
  });

  it("returns 0 for invalid input", () => {
    expect(progressPct("nope", "2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z")).toBe(0);
  });
});

describe("sanitizeSchedules", () => {
  it("normalizes a valid schedule", () => {
    const result = sanitizeSchedules([
      { id: "aaaa1111", time: "06:00:00", days: [0, 1, 1], duration: 900, enabled: false },
    ]);
    expect(result).toEqual([
      { id: "aaaa1111", time: "06:00:00", days: [0, 1], duration: 900, enabled: false },
    ]);
  });

  it("filters malformed items", () => {
    const result = sanitizeSchedules([
      null,
      "texto",
      { time: "06:00:00", days: [0], duration: 900 },
      { time: "06:00:00", days: [], duration: 900 },
      { time: "garbage", days: [0], duration: 900 },
      { time: "06:00:00", days: [0], duration: 0 },
      { time: "06:00:00", days: [7], duration: 900 },
      { time: "06:00:00", days: [0, 7], duration: 900 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].days).toEqual([0]);
    expect(result[1].days).toEqual([0]);
  });

  it("defaults enabled to true", () => {
    const result = sanitizeSchedules([{ time: "06:00:00", days: [0], duration: 900 }]);
    expect(result[0].enabled).toBe(true);
  });

  it("treats undefined/non-array input as an empty list", () => {
    expect(sanitizeSchedules(undefined)).toEqual([]);
    expect(sanitizeSchedules("nope")).toEqual([]);
    expect(sanitizeSchedules({})).toEqual([]);
  });

  it("rejects out-of-range times like 25:00", () => {
    const result = sanitizeSchedules([{ time: "25:00", days: [0], duration: 900 }]);
    expect(result).toEqual([]);
  });

  it("accepts 1-digit times and normalizes them to HH:MM:SS", () => {
    const result = sanitizeSchedules([{ time: "6:5", days: [0], duration: 900 }]);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe("06:05:00");
  });
});

describe("sortSchedulesByTime", () => {
  const sched = (time: string, id: string) => ({
    id,
    time,
    days: [0],
    duration: 60,
    enabled: true,
  });

  it("sorts ascending by time of day regardless of input order", () => {
    const result = sortSchedulesByTime([
      sched("15:30:00", "c"),
      sched("06:00:00", "a"),
      sched("11:30:00", "b"),
    ]);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = [sched("15:30:00", "c"), sched("06:00:00", "a")];
    const inputCopy = [...input];
    sortSchedulesByTime(input);
    expect(input).toEqual(inputCopy);
  });

  it("has no effect on an already-sorted list", () => {
    const input = [sched("06:00:00", "a"), sched("11:30:00", "b")];
    expect(sortSchedulesByTime(input).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("timeToSeconds", () => {
  it("parses HH:MM", () => {
    expect(timeToSeconds("06:00")).toBe(21600);
  });

  it("parses HH:MM:SS", () => {
    expect(timeToSeconds("06:00:30")).toBe(21630);
  });

  it("rejects invalid or out-of-range input", () => {
    expect(timeToSeconds("99:00")).toBe(-1);
    expect(timeToSeconds("ab:cd")).toBe(-1);
    expect(timeToSeconds("12:60")).toBe(-1);
    expect(timeToSeconds("99:99")).toBe(-1);
    expect(timeToSeconds("24:00")).toBe(-1);
  });

  it("parses 1-digit components", () => {
    expect(timeToSeconds("6:5")).toBe(21900);
  });
});

describe("toServiceTime", () => {
  it("normalizes HH:MM to HH:MM:SS", () => {
    expect(toServiceTime("6:05")).toBe("06:05:00");
  });

  it("normalizes single-digit minutes", () => {
    expect(toServiceTime("6:5")).toBe("06:05:00");
    expect(toServiceTime("06:05")).toBe("06:05:00");
  });

  it("keeps seconds when present", () => {
    expect(toServiceTime("06:05:30")).toBe("06:05:30");
  });

  it("returns the input unchanged when invalid or out-of-range", () => {
    expect(toServiceTime("24:00")).toBe("24:00");
    expect(toServiceTime("99:99")).toBe("99:99");
    expect(toServiceTime("nope")).toBe("nope");
  });
});

describe("waterVolume", () => {
  it("computes liters from flow rate and duration", () => {
    // 300 L/h over 60 s -> 5 L; over 3600 s -> 300 L.
    expect(waterVolume(300, 60)).toBeCloseTo(5);
    expect(waterVolume(300, 3600)).toBeCloseTo(300);
    expect(waterVolume(1200, 30)).toBeCloseTo(10);
  });

  it("returns null when no flow rate is configured", () => {
    expect(waterVolume(0, 60)).toBeNull();
    expect(waterVolume(-5, 60)).toBeNull();
    expect(waterVolume(Number.NaN, 60)).toBeNull();
  });

  it("handles zero duration", () => {
    expect(waterVolume(300, 0)).toBe(0);
  });
});

describe("formatVolume", () => {
  it("formats whole and fractional liters", () => {
    expect(formatVolume(5)).toBe("5 L");
    expect(formatVolume(0.5)).toBe("0.5 L");
    expect(formatVolume(12.345)).toBe("12.35 L");
    // A positive volume that rounds to zero must not read as a flat "0 L":
    // the reservoir estimate beside it is computed from the same non-zero
    // number and would contradict it.
    expect(formatVolume(0.0044)).toBe("< 0.01 L");
    expect(formatVolume(0)).toBe("0 L");
  });

  it("handles non-finite input", () => {
    expect(formatVolume(Number.NaN)).toBe("0 L");
  });
});

describe("formatVolumeFraction", () => {
  it("formats remaining/total, each rounded to at most 1 decimal", () => {
    expect(formatVolumeFraction(620, 1000)).toBe("620/1000 L");
    expect(formatVolumeFraction(12.345, 20)).toBe("12.3/20 L");
  });

  it("clamps non-finite/negative input to 0", () => {
    expect(formatVolumeFraction(Number.NaN, 1000)).toBe("0/1000 L");
    expect(formatVolumeFraction(-5, 1000)).toBe("0/1000 L");
  });
});

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    time: "06:00:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    duration: 3600,
    enabled: true,
    ...overrides,
  };
}

describe("averageDailyVolumeL", () => {
  it("spreads a daily schedule's per-run volume over 7 days (i.e. equals it)", () => {
    // 60 L/h * 1h * 1 pot, firing every day -> 60 L/day.
    expect(
      averageDailyVolumeL([schedule({ duration: 3600 })], 60, 1),
    ).toBeCloseTo(60);
  });

  it("weights by how many days/week the schedule fires", () => {
    // Same run, but only 1 day/week -> 60 L/week / 7 -> ~8.57 L/day.
    expect(
      averageDailyVolumeL([schedule({ duration: 3600, days: [0] })], 60, 1),
    ).toBeCloseTo(60 / 7);
  });

  it("ignores disabled schedules", () => {
    expect(
      averageDailyVolumeL([schedule({ enabled: false })], 60, 1),
    ).toBe(0);
  });

  it("returns 0 when no flow rate is configured", () => {
    expect(averageDailyVolumeL([schedule()], 0, 1)).toBe(0);
  });

  it("sums multiple enabled schedules", () => {
    const schedules = [
      schedule({ id: "a", duration: 3600, days: [0, 1, 2, 3, 4, 5, 6] }),
      schedule({ id: "b", duration: 1800, days: [0, 1, 2, 3, 4, 5, 6] }),
    ];
    // 60 L/day + 30 L/day.
    expect(averageDailyVolumeL(schedules, 60, 1)).toBeCloseTo(90);
  });
});

describe("formatReservoirEstimate", () => {
  it("returns null when there is no active consumption", () => {
    expect(formatReservoirEstimate(500, 0)).toBeNull();
    expect(formatReservoirEstimate(500, Number.NaN)).toBeNull();
  });

  it("shows hours when less than a day remains", () => {
    // 10 L remaining at 60 L/day -> 4 hours.
    expect(formatReservoirEstimate(10, 60)).toBe("~4 h");
  });

  it("shows days when between 1 and 60 days remain", () => {
    // 1000 L remaining at 60 L/day -> ~16.7 days.
    expect(formatReservoirEstimate(1000, 60)).toBe("~17 dias");
  });

  it("shows months beyond 60 days", () => {
    // 6000 L remaining at 10 L/day -> 600 days -> 20 months.
    expect(formatReservoirEstimate(6000, 10)).toBe("~20 meses");
  });

  it("reports 'Vazio' when already empty", () => {
    expect(formatReservoirEstimate(0, 60)).toBe("Vazio");
    expect(formatReservoirEstimate(-5, 60)).toBe("Vazio");
  });
});

describe("perPotVolumeMl / totalVolumeMl / formatMl", () => {
  it("flow applies per pot; total = per-pot volume x pots", () => {
    // 8 L/h over 60 s -> 133.33 ml delivered to one pot.
    expect(perPotVolumeMl(8, 60)).toBeCloseTo(133.33, 1);
    // With 12 pots, the total is ~1600 ml.
    expect(totalVolumeMl(8, 60, 12)).toBeCloseTo(1600);
  });

  it("CONTRACT: flow_rate_lph is PER POT, not the zone total (8 L/h, 12 pots, 900s)", () => {
    // Round numbers so the "per pot, not total" contract is checkable by
    // hand: 8 L/h over 900s = 2 L for ONE pot; 12 pots => 24 L total. Every
    // label in the UI/services/docs must say "per pot" so a user configuring
    // the zone's actual total line flow doesn't get a 12x-inflated display.
    expect(perPotVolumeMl(8, 900)).toBeCloseTo(2000); // 2 L/pot in ml
    expect(totalVolumeMl(8, 900, 12)).toBeCloseTo(24000); // 24 L total in ml
  });

  it("returns null when no flow rate is configured", () => {
    expect(perPotVolumeMl(0, 60)).toBeNull();
    expect(totalVolumeMl(0, 60, 12)).toBeNull();
    expect(totalVolumeMl(-5, 60, 12)).toBeNull();
  });

  it("total equals per-pot volume when pots is not configured", () => {
    expect(totalVolumeMl(8, 60, 0)).toBeCloseTo(133.33, 1);
    expect(totalVolumeMl(8, 60, -1)).toBeCloseTo(133.33, 1);
  });
});

describe("durationSecondsForPerPotVolumeMl", () => {
  it("is the inverse of perPotVolumeMl", () => {
    const seconds = durationSecondsForPerPotVolumeMl(8, 2000);
    expect(seconds).toBe(900); // matches the 8 L/h, 900s -> 2000 ml contract above
    expect(perPotVolumeMl(8, seconds!)).toBeCloseTo(2000);
  });

  it("returns null when no flow rate is configured", () => {
    expect(durationSecondsForPerPotVolumeMl(0, 500)).toBeNull();
    expect(durationSecondsForPerPotVolumeMl(-5, 500)).toBeNull();
  });

  it("treats a non-positive/non-finite volume as 0 ml -> 0 seconds", () => {
    expect(durationSecondsForPerPotVolumeMl(8, 0)).toBe(0);
    expect(durationSecondsForPerPotVolumeMl(8, -100)).toBe(0);
    expect(durationSecondsForPerPotVolumeMl(8, Number.NaN)).toBe(0);
  });

  it("formats ml and switches to liters above 1000 ml", () => {
    expect(formatMl(417)).toBe("417 ml");
    expect(formatMl(0.5)).toBe("0.5 ml");
    expect(formatMl(1500)).toBe("1.5 L");
  });

  it("handles non-finite input", () => {
    expect(formatMl(Number.NaN)).toBe("0 ml");
  });
});

describe("countSchedulesToday", () => {
  // 2026-08-17T09:00:00Z is a Monday in UTC -> weekday index 0.
  const monday = "2026-08-17T09:00:00Z";

  it("counts only schedules whose days include today's weekday", () => {
    const schedules = [
      schedule({ id: "a", days: [0] }),
      schedule({ id: "b", days: [1, 2] }),
      schedule({ id: "c", days: [0, 3] }),
    ];
    expect(countSchedulesToday(schedules, monday, "UTC")).toBe(2);
  });

  it("ignores disabled schedules", () => {
    const schedules = [
      schedule({ id: "a", days: [0] }),
      schedule({ id: "b", days: [0], enabled: false }),
    ];
    expect(countSchedulesToday(schedules, monday, "UTC")).toBe(1);
  });

  it("counts a schedule whose time already passed -- it asks about the calendar, not history", () => {
    // 23:00 on an every-day schedule, read at 09:00: still "on today's list".
    expect(
      countSchedulesToday([schedule({ time: "23:00:00" })], monday, "UTC"),
    ).toBe(1);
  });

  it("resolves the weekday in the given timezone, not the browser's", () => {
    // 2026-08-17T02:00Z is still Sunday (index 6) in Sao Paulo (UTC-3).
    const schedules = [schedule({ id: "sun", days: [6] })];
    expect(countSchedulesToday(schedules, "2026-08-17T02:00:00Z", "UTC")).toBe(0);
    expect(
      countSchedulesToday(schedules, "2026-08-17T02:00:00Z", "America/Sao_Paulo"),
    ).toBe(1);
  });

  it("returns 0 for an empty list or an unparseable timestamp", () => {
    expect(countSchedulesToday([], monday, "UTC")).toBe(0);
    expect(countSchedulesToday([schedule()], "not-a-date", "UTC")).toBe(0);
  });
});
