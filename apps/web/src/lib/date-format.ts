const UNITS: { suffix: string; ms: number }[] = [
  { suffix: "yr", ms: 365 * 24 * 60 * 60 * 1000 },
  { suffix: "mo", ms: 30 * 24 * 60 * 60 * 1000 },
  { suffix: "w", ms: 7 * 24 * 60 * 60 * 1000 },
  { suffix: "d", ms: 24 * 60 * 60 * 1000 },
  { suffix: "h", ms: 60 * 60 * 1000 },
  { suffix: "m", ms: 60 * 1000 },
];

const calendarDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function formatCalendarDate(date: Date | string) {
  return calendarDateFormatter.format(new Date(date));
}

export function formatRelativeTime(date: Date) {
  const diff = Date.now() - date.getTime();

  for (const { suffix, ms } of UNITS) {
    const value = Math.floor(diff / ms);
    if (value > 0) {
      return `${value}${suffix}`;
    }
  }

  return "just now";
}

export function formatRelativeTimeAgo(date: Date) {
  const relativeTime = formatRelativeTime(date);

  return relativeTime === "just now" ? relativeTime : `${relativeTime} ago`;
}
