import { beforeEach, describe, expect, it } from "vitest";

import {
  actions,
  activeStayOnBed,
  bookableBeds,
  checkoutSettlement,
  DEMO_TODAY,
  fillFirstRooms,
  OVERRIDE_CODE,
  roomPartlyTaken,
  getState,
  inspectionChecklist,
  invoiceBalance,
  invoiceOverdue,
  kpis,
  PERIOD_START,
  roomGenders,
  roomFreeFrom,
} from "@/lib/demo/store";
import { addDays } from "@/lib/demo/calc";
import type { Booking, Gender, IdType, ItemCondition } from "@/lib/demo/types";

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
  gender: "male" as Gender,
  idType: "national_id" as IdType,
  idNumber: nationalId,
});

// These tests are about other rules, so they may open an empty room ahead of fill-first (tested on its own).
function book(bedId: string, start: string, end: string, planId = "pl-month", g = guest()) {
  const roomId = getState().beds.find((b) => b.id === bedId)!.roomId;
  const res = actions.createBooking({ guest: g, bedId, start, end, planId, override: { roomId, reason: "اختبار", code: OVERRIDE_CODE } });
  if (!res.ok) throw new Error(res.error);
  return res.data!;
}

function confirmAndCheckIn(b: Booking) {
  expect(actions.confirmBooking(b.id).ok).toBe(true);
  for (const k of ["id", "enrollment", "photo"] as const) actions.toggleDoc(b.id, k);
  // Check-in needs the first installment (with the deposit) collected.
  const inv = getState().invoices.find((i) => i.bookingId === b.id)!;
  expect(actions.recordPayment(inv.id, inv.schedule[0].amount, "cash", "").ok).toBe(true);
  const res = actions.checkIn(b.id);
  expect(res).toEqual({ ok: true });
}

/** A double hotel room (booked on the "pl-night" double rate) with no bookings at all, so tests don't depend on the random seed layout. */
function freeHotelBed() {
  const s = getState();
  const bed = s.beds.find((b) => {
    const room = s.rooms.find((r) => r.id === b.roomId)!;
    return (
      room.propertyId === "p2" && room.sleeps === 2 && room.hk === "ready" && !s.bookings.some((x) => x.bedId === b.id)
    );
  });
  if (!bed) throw new Error("no free hotel bed in seed");
  return bed.id;
}

type Finding = { condition: ItemCondition; note?: string; charge?: number };
/** Inspection rows for a booking's room: everything OK unless overridden by item key. */
function inspectionRows(bookingId: string, findings: Record<string, Finding> = {}) {
  const b = getState().bookings.find((x) => x.id === bookingId)!;
  return inspectionChecklist(getState(), b.bedId).map((c) => ({
    key: c.key,
    ...(findings[c.key] ?? { condition: "ok" as ItemCondition }),
  }));
}
const INSPECTOR = "سعاد إبراهيم";
/** Records a clean inspection, settles the balance, then checks out (early check-out approved). */
function checkOutClean(bookingId: string) {
  expect(actions.recordInspection(bookingId, inspectionRows(bookingId), INSPECTOR).ok).toBe(true);
  const b = getState().bookings.find((x) => x.id === bookingId)!;
  if (checkoutSettlement(getState(), b).balanceAfter !== 0)
    expect(actions.settleCheckout(bookingId, "cash", "").ok).toBe(true);
  return actions.checkOut(bookingId, true);
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

  it("finds a room's first free day after the bookings chained on it", () => {
    const bed = freeHotelBed();
    const room = getState().beds.find((b) => b.id === bed)!.roomId;
    expect(roomFreeFrom(getState(), room)).toBe(DEMO_TODAY);
    book(bed, DEMO_TODAY, addDays(DEMO_TODAY, 3), "pl-night");
    book(bed, addDays(DEMO_TODAY, 3), addDays(DEMO_TODAY, 5), "pl-night");
    expect(roomFreeFrom(getState(), room)).toBe(addDays(DEMO_TODAY, 5));
  });

  it("books a hotel room only on the night rate for its size", () => {
    const bed = freeHotelBed();
    const res = actions.createBooking({ guest: guest(), bedId: bed, start: "2026-12-01", end: "2026-12-03", planId: "pl-night-single" });
    expect(res.ok).toBe(false);
    expect(() => book(bed, "2026-12-01", "2026-12-03", "pl-night")).not.toThrow();
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

describe("guest identity", () => {
  const passport = (idNumber: string, nationality = "السودان") => ({
    ...guest(),
    idType: "passport" as IdType,
    idNumber,
    nationality,
  });
  const tryBook = (g: ReturnType<typeof guest>) =>
    actions.createBooking({
      guest: g,
      bedId: BED2,
      start: "2026-12-01",
      end: "2026-12-31",
      planId: "pl-month",
    });

  it("requires a 14-digit national ID", () => {
    expect(tryBook(guest("طالب", "123"))).toEqual({
      ok: false,
      error: "الرقم القومي يجب أن يتكون من 14 رقمًا",
    });
    expect(tryBook(guest("طالب", ""))).toMatchObject({ ok: false });
    expect(tryBook(guest("طالب", "2990101123456X"))).toMatchObject({ ok: false });
  });

  it("accepts a passport and stores it normalized with the nationality", () => {
    const b = book(BED2, "2026-12-01", "2026-12-31", "pl-month", passport(" a 1234567 "));
    const g = getState().guests.find((x) => x.id === b.guestId)!;
    expect(g).toMatchObject({ idType: "passport", idNumber: "A1234567", nationality: "السودان" });
  });

  it("rejects malformed passport numbers", () => {
    expect(tryBook(passport("A12"))).toMatchObject({ ok: false });
    expect(tryBook(passport("A1234567890"))).toMatchObject({ ok: false });
    expect(tryBook(passport("A12-4567"))).toMatchObject({ ok: false });
  });

  it("requires the nationality for passport holders", () => {
    expect(tryBook(passport("A1234567", " "))).toEqual({
      ok: false,
      error: "أدخل الجنسية لحامل جواز السفر",
    });
  });

  it("reuses the guest file for the same passport", () => {
    const a = book(BED2, "2026-12-01", "2026-12-31", "pl-month", passport("B7654321"));
    const b = book(BED3, "2027-01-01", "2027-01-31", "pl-month", passport("b7654321"));
    expect(a.guestId).toBe(b.guestId);
  });

  it("refuses a second profile with the same ID", () => {
    expect(actions.addGuest(passport("C1111111")).ok).toBe(true);
    expect(actions.addGuest(passport("C1111111"))).toEqual({
      ok: false,
      error: "يوجد ملف مسجل بنفس رقم الهوية",
    });
  });

  it("seeds some international students with passports", () => {
    const intl = getState().guests.filter((g) => g.idType === "passport");
    expect(intl.length).toBeGreaterThan(0);
    expect(intl.every((g) => g.kind === "student" && g.nationality)).toBe(true);
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

describe("check-in", () => {
  it("waits for the documents and the first installment with the deposit", () => {
    const b = book(BED2, "2026-11-01", "2026-12-31");
    actions.confirmBooking(b.id);
    for (const k of ["id", "enrollment", "photo"] as const) actions.toggleDoc(b.id, k);
    const inv = getState().invoices.find((i) => i.bookingId === b.id)!;
    expect(actions.checkIn(b.id)).toEqual({ ok: false, error: "لم تُسدَّد الدفعة الأولى والتأمين" });
    actions.recordPayment(inv.id, inv.schedule[0].amount - 1, "cash", "");
    expect(actions.checkIn(b.id).ok).toBe(false);
    actions.recordPayment(inv.id, 1, "cash", "");
    expect(actions.checkIn(b.id).ok).toBe(true);
  });
});

describe("check-out from a shared room", () => {
  it("keeps the room in service while other residents remain", () => {
    const b2 = book(BED2, "2026-11-01", "2026-11-30");
    confirmAndCheckIn(b2);

    expect(checkOutClean(bookingOn(BED1).id).ok).toBe(true);
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
    expect(checkOutClean(bookingOn(BED1).id).ok).toBe(true);
    expect(room().hk).toBe("dirty");
  });
});

describe("room gender", () => {
  it("gives every seeded guest a gender", () => {
    expect(getState().guests.every((g) => g.gender === "male" || g.gender === "female")).toBe(true);
  });

  it("never houses both genders in one seeded room, and keeps the scenario room male", () => {
    const s = getState();
    expect(s.rooms.filter((r) => roomGenders(s, r.id).size > 1).map((r) => r.code)).toEqual([]);
    expect([...roomGenders(s, ROOM)]).toEqual(["male"]);
  });

  it("fills seeded shared rooms in bed order, free beds last", () => {
    const s = getState();
    for (const room of s.rooms) {
      const occupied = s.beds
        .filter((b) => b.roomId === room.id)
        .map((b) => !!activeStayOnBed(s, b.id));
      // Once a free bed appears, no occupied bed may follow it.
      expect(occupied.slice(occupied.indexOf(false) >>> 0)).not.toContain(true);
    }
  });

  it("reports female residents in a seeded girls' room", () => {
    const s = getState();
    const girls = s.rooms.find((r) => r.propertyId === "p1" && roomGenders(s, r.id).has("female"));
    expect(girls).toBeDefined();
  });

  it("is empty for a vacant room", () => {
    checkOutClean(bookingOn(BED1).id);
    expect(roomGenders(getState(), ROOM).size).toBe(0);
  });
});

describe("fill-first in student housing", () => {
  // A month nobody is booked in yet; one quad gets a resident, another stays empty.
  const start = "2028-01-01";
  const end = "2028-01-31";
  const quads = () => getState().rooms.filter((r) => r.propertyId === "p1" && r.type === "quad" && r.hk === "ready");
  const bedsOf = (roomId: string) => getState().beds.filter((b) => b.roomId === roomId).map((b) => b.id);
  let partly: string;
  let empty: string;
  beforeEach(() => {
    [partly, empty] = quads().map((r) => r.id);
    book(bedsOf(partly)[0], start, end);
  });

  it("holds an empty room while partly filled rooms of its type have space", () => {
    expect(roomPartlyTaken(getState(), partly, start, end, "pl-month")).toBe(true);
    expect(fillFirstRooms(getState(), empty, start, end, "pl-month", "male").map((r) => r.id)).toContain(partly);
    const res = actions.createBooking({ guest: guest(), bedId: bedsOf(empty)[0], start, end, planId: "pl-month" });
    expect(res.ok).toBe(false);
  });

  it("books a partly filled room without an exception", () => {
    expect(actions.createBooking({ guest: guest(), bedId: bedsOf(partly)[1], start, end, planId: "pl-month" }).ok).toBe(true);
  });

  it("doesn't hold the room for the other gender, who can't share the partly filled one", () => {
    expect(fillFirstRooms(getState(), empty, start, end, "pl-month", "female").map((r) => r.id)).not.toContain(partly);
  });

  it("opens an empty room with the manager's code, the room and a reason", () => {
    const bed = bedsOf(empty)[0];
    const book1 = (override: { roomId: string; reason: string; code: string }) =>
      actions.createBooking({ guest: guest(), bedId: bed, start, end, planId: "pl-month", override });
    expect(book1({ roomId: empty, reason: "مجموعة أصحاب", code: "0000" }).ok).toBe(false);
    expect(book1({ roomId: partly, reason: "مجموعة أصحاب", code: OVERRIDE_CODE }).ok).toBe(false);
    expect(book1({ roomId: empty, reason: "  ", code: OVERRIDE_CODE }).ok).toBe(false);
    // The code stands in for the manager's approval, so the front desk can use it too.
    actions.setRole("frontdesk");
    const res = book1({ roomId: empty, reason: "مجموعة أصحاب", code: OVERRIDE_CODE });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data!.events.at(-1)!.text).toContain("مجموعة أصحاب");
  });
});

describe("single-gender shared rooms", () => {
  const female = () => ({ ...guest(), gender: "female" as Gender });

  it("rejects a female student in a room with a male resident", () => {
    const res = actions.createBooking({
      guest: female(),
      bedId: BED2,
      start: "2026-12-01",
      end: "2026-12-31",
      planId: "pl-month",
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toContain("A-204");
  });

  it("rejects a male student in a room booked by a female student, even before she arrives", () => {
    // Bed 1's male resident leaves after 2027-01-31; a female student books bed 2 from February.
    book(BED2, "2027-02-01", "2027-05-31", "pl-month", female());
    const res = actions.createBooking({
      guest: guest(),
      bedId: BED3,
      start: "2027-03-01",
      end: "2027-03-31",
      planId: "pl-month",
    });
    expect(res.ok).toBe(false);
  });

  it("allows the other gender once the room's bookings have ended", () => {
    // The male resident on bed 1 stays through 2027-01-31.
    expect(() => book(BED2, "2027-02-01", "2027-05-31", "pl-month", female())).not.toThrow();
  });

  it("allows the same gender to share the room", () => {
    expect(() => book(BED2, "2026-12-01", "2026-12-31")).not.toThrow();
  });

  it("uses the stored gender of an existing guest file", () => {
    const g = female();
    book(freeHotelBed(), "2026-12-01", "2026-12-03", "pl-night", g);
    // Same national ID submitted as male: the file says female, so the male room rejects it.
    const res = actions.createBooking({
      guest: { ...g, gender: "male" },
      bedId: BED2,
      start: "2026-12-01",
      end: "2026-12-31",
      planId: "pl-month",
    });
    expect(res.ok).toBe(false);
  });

  it("doesn't restrict single-bed units", () => {
    expect(() =>
      book(freeHotelBed(), "2026-12-01", "2026-12-03", "pl-night", female()),
    ).not.toThrow();
  });
});

describe("check-out inspection", () => {
  // Bed 1's resident: monthly Sep–Jan, deposit 3,000; invoice 33,000 with 21,000 paid, so 12,000 is due.
  // Leaving early on Nov 1: rent through November (18,000) plus a month's penalty; Dec–Jan (12,000) dropped.
  const resident = () => bookingOn(BED1);
  const invoiceOf = (bookingId: string) =>
    getState().invoices.find((i) => i.bookingId === bookingId)!;
  const balance = (bookingId: string) => invoiceBalance(getState(), invoiceOf(bookingId).id);
  const damagedBed = (charge: number) => ({
    bed: { condition: "damaged" as const, note: "مرتبة ممزقة", charge },
  });

  it("blocks check-out until the room is inspected", () => {
    expect(actions.checkOut(resident().id, true)).toEqual({
      ok: false,
      error: "يلزم فحص الغرفة قبل المغادرة، واعتماد المدير لأي خصومات",
    });
  });

  it("records a clean report under the inspector's name, which clears the way to check-out", () => {
    const id = resident().id;
    const inspection = () => getState().bookings.find((b) => b.id === id)!.inspection!;
    expect(balance(id)).toBe(12000);
    expect(actions.recordInspection(id, inspectionRows(id), "").ok).toBe(false);
    expect(actions.recordInspection(id, inspectionRows(id), INSPECTOR).ok).toBe(true);
    expect(inspection()).toMatchObject({ status: "approved", by: INSPECTOR });
    // 12,000 − 12,000 dropped + 6,000 penalty − 3,000 deposit = 3,000 to pay before leaving.
    expect(actions.checkOut(id, true)).toEqual({ ok: false, error: "يلزم سداد المستحق قبل المغادرة: ٣٬٠٠٠ ج.م." });
    expect(actions.settleCheckout(id, "cash", "").ok).toBe(true);
    expect(actions.checkOut(id, true).ok).toBe(true);
    expect(balance(id)).toBe(0);
    expect(invoiceOf(id).lines.slice(-3)).toMatchObject([
      { kind: "rent", amount: -12000 },
      { kind: "fee", amount: 6000 },
      { kind: "deposit", amount: -3000 },
    ]);
  });

  it("needs a manager to approve charges, then takes them from the deposit first", () => {
    const id = resident().id;
    actions.recordPayment(invoiceOf(id).id, 12000, "cash", "");
    actions.setRole("housekeeping");
    expect(actions.recordInspection(id, inspectionRows(id, damagedBed(1000)), INSPECTOR).ok).toBe(true);
    expect(actions.reviewInspection(id, true).ok).toBe(false);
    actions.setRole("manager");
    expect(actions.checkOut(id, true).ok).toBe(false);
    expect(actions.reviewInspection(id, true).ok).toBe(true);
    // Paid in full: 6,000 net of the cancelled stay + 3,000 deposit − 1,000 damages = 8,000 owed back,
    // refunded before the guest leaves.
    expect(actions.checkOut(id, true)).toEqual({ ok: false, error: "يلزم رد المستحق للنزيل قبل المغادرة: ٨٬٠٠٠ ج.م." });
    expect(actions.settleCheckout(id, "cash", "").ok).toBe(true);
    expect(getState().payments.at(-1)).toMatchObject({ amount: -8000 });
    expect(actions.checkOut(id, true).ok).toBe(true);
    expect(balance(id)).toBe(0);
    expect(invoiceOverdue(getState(), invoiceOf(id).id)).toBe(0);
  });

  it("collects damages beyond what the guest has credit for before check-out", () => {
    const id = resident().id;
    actions.recordPayment(invoiceOf(id).id, 12000, "cash", "");
    actions.recordInspection(id, inspectionRows(id, damagedBed(12000)), INSPECTOR);
    actions.reviewInspection(id, true);
    // 0 − 6,000 net of the cancelled stay − 3,000 deposit + 12,000 damages = 3,000, more than today's balance.
    expect(actions.checkOut(id, true).ok).toBe(false);
    expect(actions.settleCheckout(id, "cash", "").ok).toBe(true);
    expect(actions.checkOut(id, true).ok).toBe(true);
    expect(balance(id)).toBe(0);
    expect(invoiceOf(id).lines).toContainEqual(
      expect.objectContaining({ kind: "fee", amount: 12000 }),
    );
  });

  it("requires a description for damaged or missing items", () => {
    const id = resident().id;
    const res = actions.recordInspection(
      id,
      inspectionRows(id, { key: { condition: "missing", charge: 200 } }),
      INSPECTOR,
    );
    expect(res.ok).toBe(false);
  });

  it("lets the front desk and housekeeping inspect, but not accounting", () => {
    const id = resident().id;
    actions.setRole("accountant");
    expect(actions.recordInspection(id, inspectionRows(id), INSPECTOR).ok).toBe(false);
    actions.setRole("frontdesk");
    expect(actions.recordInspection(id, inspectionRows(id), INSPECTOR).ok).toBe(true);
    actions.setRole("housekeeping");
    expect(actions.recordInspection(id, inspectionRows(id), INSPECTOR).ok).toBe(true);
  });

  it("sends rejected charges back for a new inspection", () => {
    const id = resident().id;
    actions.recordInspection(id, inspectionRows(id, damagedBed(1000)), INSPECTOR);
    expect(actions.reviewInspection(id, false, "").ok).toBe(false);
    expect(actions.reviewInspection(id, false, "التلف قديم ومسجل عند الوصول").ok).toBe(true);
    expect(actions.checkOut(id, true).ok).toBe(false);
    expect(checkOutClean(id).ok).toBe(true);
  });

  it("checks hotel extras such as the minibar", () => {
    const keys = (bedId: string) => inspectionChecklist(getState(), bedId).map((c) => c.key);
    expect(keys(freeHotelBed())).toContain("minibar");
    expect(keys(BED1)).not.toContain("minibar");
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
