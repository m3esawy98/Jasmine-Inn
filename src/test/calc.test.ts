import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  computeRent,
  daysBetween,
  freeFrom,
  monthsBetween,
  overlaps,
  validRange,
} from "@/lib/demo/calc";
import type { Plan } from "@/lib/demo/types";

const plan = (period: Plan["period"], price = 1000): Plan => ({
  id: "x",
  name: "x",
  nameEn: "x",
  period,
  price,
  deposit: 0,
});

describe("date helpers", () => {
  it("adds days and months across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-04")).toBe(3);
    expect(daysBetween("2026-11-01", "2026-11-01")).toBe(0);
  });

  it("counts billable months for inclusive ranges", () => {
    expect(monthsBetween("2026-11-01", "2027-02-28")).toBe(4);
    expect(monthsBetween("2026-09-01", "2027-01-31")).toBe(5);
    expect(monthsBetween("2026-11-01", "2026-11-01")).toBe(1);
    expect(monthsBetween("2026-11-01", "2026-12-05")).toBe(2);
  });
});

describe("computeRent", () => {
  it("charges nights for daily plans", () => {
    expect(computeRent(plan("daily"), "2026-11-01", "2026-11-04")).toBe(3000);
  });

  it("charges nothing for a zero-night daily stay", () => {
    expect(computeRent(plan("daily"), "2026-11-01", "2026-11-01")).toBe(0);
  });

  it("rounds weekly plans up to whole weeks", () => {
    expect(computeRent(plan("weekly"), "2026-11-01", "2026-11-14")).toBe(2000);
    expect(computeRent(plan("weekly"), "2026-11-01", "2026-11-08")).toBe(1000);
  });

  it("charges a monthly plan for a single-day inclusive stay", () => {
    expect(computeRent(plan("monthly"), "2026-11-01", "2026-11-01")).toBe(1000);
    expect(computeRent(plan("monthly"), "2026-11-01", "2027-02-28")).toBe(4000);
  });

  it("charges semesters in 4-month blocks", () => {
    expect(computeRent(plan("semester"), "2027-02-01", "2027-05-31")).toBe(1000);
    expect(computeRent(plan("semester"), "2027-02-01", "2027-06-30")).toBe(2000);
  });

  it("returns 0 for reversed ranges", () => {
    expect(computeRent(plan("monthly"), "2026-12-01", "2026-11-01")).toBe(0);
  });
});

describe("ranges and overlap", () => {
  it("treats nightly end dates as departure days and monthly end dates as inclusive", () => {
    expect(freeFrom("daily", "2026-11-04")).toBe("2026-11-04");
    expect(freeFrom("weekly", "2026-11-04")).toBe("2026-11-04");
    expect(freeFrom("monthly", "2027-01-31")).toBe("2027-02-01");
    expect(freeFrom("semester", "2027-05-31")).toBe("2027-06-01");
  });

  it("requires at least one night or day", () => {
    expect(validRange("daily", "2026-11-01", "2026-11-01")).toBe(false);
    expect(validRange("daily", "2026-11-01", "2026-11-02")).toBe(true);
    expect(validRange("monthly", "2026-11-01", "2026-11-01")).toBe(true);
    expect(validRange("monthly", "2026-11-02", "2026-11-01")).toBe(false);
  });

  it("allows back-to-back stays but rejects real overlaps", () => {
    expect(overlaps("2026-11-04", "2026-11-06", "2026-11-01", "2026-11-04")).toBe(false);
    expect(overlaps("2026-11-03", "2026-11-06", "2026-11-01", "2026-11-04")).toBe(true);
    expect(overlaps("2026-11-02", "2026-11-03", "2026-11-01", "2026-11-04")).toBe(true);
  });
});
