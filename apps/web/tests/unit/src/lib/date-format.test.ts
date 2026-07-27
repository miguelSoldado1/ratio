import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDate, formatRelativeTimeAgo } from "@/lib/date-format";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeTimeAgo", () => {
  it("does not append ago to just now", () => {
    expect(formatRelativeTimeAgo(new Date("2026-01-01T11:59:45.000Z"))).toBe("just now");
  });

  it("appends ago to elapsed units", () => {
    expect(formatRelativeTimeAgo(new Date("2026-01-01T11:59:00.000Z"))).toBe("1m ago");
  });
});

describe("formatCalendarDate", () => {
  it("formats an exact UTC calendar date", () => {
    expect(formatCalendarDate("2026-07-27T23:30:00.000Z")).toBe("Jul 27, 2026");
  });
});
