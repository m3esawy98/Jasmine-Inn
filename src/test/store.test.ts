import { beforeEach, describe, expect, it } from "vitest";

import { actions, getState, invoiceBalance, kpis, PERIOD_START } from "@/lib/demo/store";
import type { Booking } from "@/lib/demo/types";

// Scenario room A-204 is a quad: bed 1 is occupied (monthly, 2026-09-01 → 2027-01-31), beds 2-4 are free.
const BED1 = "r-A-204-1";
const BED2 = "r-A-204-2";
const BED3 = "r-A-204-3";
const ROOM = "r-A-204";

let nid = 0;
const guest = (name = "ضيف تجريبي", nationalId = `299${String(++nid).padStart(11, "0")}`) => ({
  name,
  phone: "01000000000",
  email: "test@example.com",
  kind: "student" as const,
  nationalId,
});

function book(bedId: string, start: string, end: string, planId = "pl-month", g = guest()) {
  const res = actions.createBooking({ guest: g, bedId, start, end, planId });
  if (!res.ok) throw new Error(res.error);
  return res.data!;
}

function confirmAndCheckIn(b: Booking) {
  expect(actions.confirmBooking(b.id).ok).toBe(true);
  for (const k of ["id", "enrollment", "photo"] as const) actions.toggleDoc(b.id, k);
  const res = actions.checkIn(b.id);
  expect(res).toEqual({ ok: true });
}

/** A hotel bed with no bookings at all, so tests don't depend on the random seed layout. */
function freeHotelBed() {
  const s = getState();
  const bed = s.beds.find((b) => {
    const room = s.rooms.find((r) => r.id === b.roomId)!;
    return (
      room.propertyId === "p2" && room.hk === "ready" && !s.bookings.some((x) => x.bedId === b.id)
    );
  });
  if (!bed) throw new Error("no free hotel bed in seed");
  return bed.id;
}

const room = () => getState().rooms.find((r) => r.id === ROOM)!;
const bookingOn = (bedId: string) =>
  getState().bookings.find((b) => b.bedId === bedId && b.status === "checked_in")!;

beforeEach(() => {
  actions.reset();
  actions.setRole("manager");
});

describe("availability", () => {
  it("lets a hotel guest arrive on the previous guest's departure day", () => {
    const bed = freeHotelBed();
    book(bed, "2026-12-01", "2026-12-04", "pl-night");
    expect(() => book(bed, "2026-12-04", "2026-12-06", "pl-night")).not.toThrow();
  });

  it("rejects a hotel booking that overlaps an existing night", () => {
    const bed = freeHotelBed();
    book(bed, "2026-12-01", "2026-12-04", "pl-night");
    const res = actions.createBooking({
      guest: guest(),
      bedId: bed,
      start: "2026-12-03",
      end: "2026-12-05",
      planId: "pl-night",
    });
    expect(res.ok).toBe(false);
  });

  it("treats a monthly end date as the last occupied day", () => {
    const sameDay = actions.createBooking({
      guest: guest(),
      bedId: BED1,
      start: "2027-01-31",
      end: "2027-03-31",
      planId: "pl-month",
    });
    expect(sameDay.ok).toBe(false);
    expect(() => book(BED1, "2027-02-01", "2027-03-31")).not.toThrow();
  });

  it("rejects a zero-night hotel booking but allows a one-day monthly one", () => {
    const bed = freeHotelBed();
    const zero = actions.createBooking({
      guest: guest(),
      bedId: bed,
      start: "2026-12-01",
      end: "2026-12-01",
      planId: "pl-night",
    });
    expect(zero).toEqual({ ok: false, error: "تواريخ الإقامة غير صحيحة" });
    expect(() => book(BED2, "2026-12-01", "2026-12-01")).not.toThrow();
  });
});

describe("guests", () => {
  it("keeps two people with the same name as separate guests", () => {
    const a = book(
      BED2,
      "2026-12-01",
      "2026-12-31",
      "pl-month",
      guest("سارة علي", "29900000000901"),
    );
    const b = book(
      BED3,
      "2026-12-01",
      "2026-12-31",
      "pl-month",
      guest("سارة علي", "29900000000902"),
    );
    expect(a.guestId).not.toBe(b.guestId);
  });

  it("reuses the guest file when the national ID matches", () => {
    const a = book(
      BED2,
      "2026-12-01",
      "2026-12-31",
      "pl-month",
      guest("سارة علي", "29900000000903"),
    );
    const b = book(
      BED3,
      "2027-01-01",
      "2027-01-31",
      "pl-month",
      guest("سارة  علي", "29900000000903"),
    );
    expect(a.guestId).toBe(b.guestId);
  });
});

describe("cancelling a paid booking", () => {
  it("voids the invoice, turns payments into a credit and drops it from outstanding", () => {
    const b = book(BED2, "2026-12-01", "2027-03-31");
    actions.confirmBooking(b.id);
    const inv = getState().invoices.find((i) => i.bookingId === b.id)!;
    expect(actions.recordPayment(inv.id, 5000, "cash", "").ok).toBe(true);

    const before = kpis(getState());
    expect(actions.rejectOrCancel(b.id, "cancelled", "طلب الطالب").ok).toBe(true);
    const after = kpis(getState());

    expect(getState().invoices.find((i) => i.id === inv.id)!.status).toBe("void");
    expect(invoiceBalance(getState(), inv.id)).toBe(-5000);
    expect(before.outstanding - after.outstanding).toBeGreaterThan(0);
    expect(after.collected).toBe(before.collected);
  });

  it("refunds the credit through a documented correction", () => {
    const b = book(BED2, "2026-12-01", "2027-03-31");
    actions.confirmBooking(b.id);
    const inv = getState().invoices.find((i) => i.bookingId === b.id)!;
    actions.recordPayment(inv.id, 5000, "cash", "");
    actions.rejectOrCancel(b.id, "cancelled", "طلب الطالب");
    const pay = getState().payments.find((p) => p.invoiceId === inv.id)!;
    expect(actions.correctPayment(pay.id, "رد المبلغ").ok).toBe(true);
    expect(invoiceBalance(getState(), inv.id)).toBe(0);
  });
});

describe("check-out from a shared room", () => {
  it("keeps the room in service while other residents remain", () => {
    const b2 = book(BED2, "2026-11-01", "2026-11-30");
    confirmAndCheckIn(b2);

    expect(actions.checkOut(bookingOn(BED1).id, true).ok).toBe(true);
    expect(room().hk).toBe("ready");
    const task = getState().tasks.find((t) => t.roomId === ROOM && t.status === "new")!;
    expect(task.type).toBe("cleaning");

    // Working the cleaning task doesn't take the occupied room out of service either.
    actions.setRole("housekeeping");
    expect(actions.taskStep(task.id, "assigned", { assignee: "سعاد إبراهيم" }).ok).toBe(true);
    expect(actions.taskStep(task.id, "in_progress").ok).toBe(true);
    expect(room().hk).toBe("ready");

    // A free bed in the room can still be checked into.
    actions.setRole("manager");
    expect(() => confirmAndCheckIn(book(BED3, "2026-11-01", "2026-11-30"))).not.toThrow();
  });

  it("marks the room dirty when the last resident leaves", () => {
    expect(actions.checkOut(bookingOn(BED1).id, true).ok).toBe(true);
    expect(room().hk).toBe("dirty");
  });
});

describe("dashboard KPIs", () => {
  it("counts collections from the start of the previous month", () => {
    expect(PERIOD_START).toBe("2026-10-01");
  });
});

describe("permissions", () => {
  it("denies actions to the read-only auditor", () => {
    actions.setRole("auditor");
    const res = actions.createBooking({
      guest: guest(),
      bedId: BED2,
      start: "2026-12-01",
      end: "2026-12-31",
      planId: "pl-month",
    });
    expect(res.ok).toBe(false);
  });
});
