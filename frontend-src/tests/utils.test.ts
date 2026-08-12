import { describe, expect, it } from "vitest";

import {
  dayLabels,
  formatDuration,
  formatRemaining,
  formatTime,
  parseTimeParts,
  progressPct,
  remainingSeconds,
  sanitizeSchedules,
  timeToSeconds,
  toServiceTime,
} from "../src/utils";

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
  it("defaults to pt-BR abbreviations", () => {
    expect(dayLabels()).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
  });

  it("returns the pt-BR list for pt locales", () => {
    expect(dayLabels("pt-BR")).toEqual([
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
      "Dom",
    ]);
  });

  it("uses Intl for other locales", () => {
    const labels = dayLabels("en-US");
    expect(labels).toHaveLength(7);
    expect(labels[0]).toMatch(/^Mon$/i);
    expect(labels[6]).toMatch(/^Sun$/i);
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
