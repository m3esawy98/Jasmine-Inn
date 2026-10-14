import type { Plan } from "./types";

const p = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const f = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: string, n: number) {
  const x = p(d);
  x.setUTCDate(x.getUTCDate() + n);
  return f(x);
}
export function addMonths(d: string, n: number) {
  const x = p(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return f(x);
}
export function daysBetween(a: string, b: string) {
  return Math.round((p(b).getTime() - p(a).getTime()) / 86400000);
}
/** Billable months for an inclusive date range (Nov 1 - Feb 28 = 4). */
export function monthsBetween(start: string, end: string) {
  const s = p(start);
  const e = p(addDays(end, 1));
  let m = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) m -= 1;
  const anchor = p(addMonths(start, m));
  if (anchor.getTime() < e.getTime()) m += 1;
  return Math.max(1, m);
}
export function computeRent(plan: Plan, start: string, end: string) {
  if (!validRange(plan.period, start, end)) return 0;
  switch (plan.period) {
    case "daily":
      return Math.max(1, daysBetween(start, end)) * plan.price;
    case "weekly":
      return Math.ceil(Math.max(1, daysBetween(start, end)) / 7) * plan.price;
    case "monthly":
      return monthsBetween(start, end) * plan.price;
    case "semester":
      return Math.ceil(monthsBetween(start, end) / 4) * plan.price;
  }
}
/**
 * First free day after a booking. Nightly/weekly plans store `end` as the
 * departure date (bed is free that day); monthly/semester plans store the last
 * day of the stay, inclusive (Nov 1 - Feb 28).
 */
export function freeFrom(period: Plan["period"], end: string) {
  return period === "daily" || period === "weekly" ? end : addDays(end, 1);
}
/** True when the stay covers at least one day/night. */
export const validRange = (period: Plan["period"], start: string, end: string) => freeFrom(period, end) > start;
/** Half-open ranges [start, freeFrom): a departure day can be the next arrival day. */
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2;
