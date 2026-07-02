const UNITS: { suffix: string; ms: number }[] = [
  { suffix: "yr", ms: 365 * 24 * 60 * 60 * 1000 },
  { suffix: "mo", ms: 30 * 24 * 60 * 60 * 1000 },
  { suffix: "w", ms: 7 * 24 * 60 * 60 * 1000 },
  { suffix: "d", ms: 24 * 60 * 60 * 1000 },
  { suffix: "h", ms: 60 * 60 * 1000 },
  { suffix: "m", ms: 60 * 1000 },
];

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();

  for (const { suffix, ms } of UNITS) {
    const value = Math.floor(diff / ms);
    if (value > 0) {
      return `${value}${suffix}`;
    }
  }

  return "just now";
}
