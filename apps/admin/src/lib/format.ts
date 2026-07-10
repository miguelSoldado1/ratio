export function formatDate(date: Date | string | number | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      day: opts.day ?? "numeric",
      month: opts.month ?? "long",
      year: opts.year ?? "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      timeZone: "UTC",
      ...opts,
    }).format(new Date(date));
  } catch {
    return "";
  }
}

export function toUTCMidnight(date: Date): number {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).getTime();
}

export function toUTCEndOfDay(date: Date): number {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)).getTime();
}
