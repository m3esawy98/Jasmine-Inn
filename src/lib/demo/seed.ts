import type {
  Bed,
  Booking,
  Building,
  Contract,
  DemoState,
  Guest,
  Invoice,
  Payment,
  Plan,
  Property,
  Room,
  RoomType,
  Stay,
  Task,
  Activity,
  Gender,
} from "./types";
import { addDays, addMonths, computeRent } from "./calc";

export const DEMO_TODAY = "2026-11-01";
export const STATE_VERSION = 6;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FIRST: Record<Gender, string[]> = {
  male: ["أحمد", "محمد", "يوسف", "كريم", "مصطفى", "خالد", "زياد", "عمرو", "طارق", "حسام", "إياد", "سليم"],
  female: ["مريم", "سارة", "نور", "هبة", "ليلى", "آية", "فريدة", "دينا", "رنا", "ملك", "جنى", "هالة"],
};
const NATIONALITIES = ["السودان", "سوريا", "اليمن", "الأردن", "ماليزيا", "نيجيريا"];
const LAST = ["السيد", "عبد الله", "إبراهيم", "فاروق", "الشريف", "منصور", "رضوان", "سالم", "عادل", "النجار", "شاكر", "حمدي", "الجمال", "زكي", "مراد"];
const ORGS = ["جامعة القاهرة", "جامعة عين شمس", "الجامعة الأمريكية", "جامعة حلوان", "الجامعة البريطانية"];

export const ROLE_USERS: Record<string, string> = {
  exec: "م. هشام الدسوقي",
  manager: "أ. رانيا فؤاد",
  reservations: "أ. مينا جرجس",
  frontdesk: "أ. سلمى عاطف",
  accountant: "أ. وليد سمير",
  housekeeping: "أ. فاطمة حسين",
  auditor: "أ. نادر كمال",
};

export function createSeed(): DemoState {
  const r = rng(42);
  const properties: Property[] = [
    { id: "p1", name: "إقامة النيل", nameEn: "Nile Residence", city: "القاهرة - المنيل", cityEn: "Cairo - Manial", type: "student", amenities: ["واي فاي", "مكتبة مذاكرة", "مطبخ مشترك", "مغسلة", "أمن 24 ساعة"] },
    { id: "p2", name: "فندق كورنيش الإسكندرية", nameEn: "Alexandria Corniche Hotel", city: "الإسكندرية", cityEn: "Alexandria", type: "hotel", amenities: ["إطلالة بحرية", "مطعم", "خدمة غرف", "موقف سيارات"] },
    { id: "p3", name: "شقق التجمع الفندقية", nameEn: "New Cairo Serviced Apartments", city: "القاهرة الجديدة", cityEn: "New Cairo", type: "apartments", amenities: ["مطبخ مجهز", "حمام سباحة", "صالة رياضية", "تنظيف أسبوعي"] },
  ];
  const buildings: Building[] = [
    { id: "b1", propertyId: "p1", name: "A", floors: 3 },
    { id: "b2", propertyId: "p1", name: "B", floors: 2 },
    { id: "b3", propertyId: "p2", name: "T", floors: 4 },
    { id: "b4", propertyId: "p3", name: "C", floors: 3 },
  ];
  const rooms: Room[] = [];
  const beds: Bed[] = [];
  const addRoom = (b: Building, floor: number, idx: number, type: RoomType) => {
    const code = `${b.name}-${floor}${String(idx).padStart(2, "0")}`;
    const id = `r-${code}`;
    const amen =
      type === "apartment" ? ["غرفتا نوم", "مطبخ", "صالة"] : type === "hotel" ? ["تكييف", "تلفاز", "ميني بار"] : ["تكييف", "مكاتب مذاكرة", "خزائن"];
    rooms.push({ id, propertyId: b.propertyId, buildingId: b.id, code, floor, type, hk: "ready", amenities: amen });
    const n = type === "quad" ? 4 : type === "double" ? 2 : 1;
    for (let i = 1; i <= n; i++) beds.push({ id: `${id}-${i}`, roomId: id, label: n === 1 ? (type === "single" ? "سرير 1" : "الوحدة") : `سرير ${i}` });
  };
  for (const b of buildings) {
    for (let f = 1; f <= b.floors; f++) {
      if (b.propertyId === "p1") {
        addRoom(b, f, 1, "single");
        addRoom(b, f, 2, "single");
        addRoom(b, f, 3, "double");
        addRoom(b, f, 4, "quad");
        addRoom(b, f, 5, "quad");
        addRoom(b, f, 6, "quad");
      } else if (b.propertyId === "p2") {
        for (let i = 1; i <= 8; i++) addRoom(b, f, i, "hotel");
      } else {
        for (let i = 1; i <= 4; i++) addRoom(b, f, i, "apartment");
      }
    }
  }

  const plans: Plan[] = [
    { id: "pl-month", name: "شهري - سكن طلبة", nameEn: "Monthly - Student", period: "monthly", price: 6000, deposit: 3000 },
    { id: "pl-sem", name: "فصل دراسي (4 أشهر)", nameEn: "Semester (4 months)", period: "semester", price: 22000, deposit: 3000 },
    { id: "pl-night", name: "ليلة فندقية", nameEn: "Hotel night", period: "daily", price: 2200, deposit: 0 },
    { id: "pl-week", name: "أسبوعي - شقة فندقية", nameEn: "Weekly - Apartment", period: "weekly", price: 14000, deposit: 5000 },
    { id: "pl-apt-month", name: "شهري - شقة فندقية", nameEn: "Monthly - Apartment", period: "monthly", price: 42000, deposit: 15000 },
  ];

  const guests: Guest[] = [];
  const bookings: Booking[] = [];
  const contracts: Contract[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const stays: Stay[] = [];
  const tasks: Task[] = [];
  const activities: Activity[] = [];
  const c = { BK: 1000, CT: 500, INV: 2000, RC: 7000, ST: 0, TK: 300, G: 0 };

  const newGuest = (kind: "student" | "guest", gender: Gender = r() < 0.5 ? "female" : "male") => {
    c.G++;
    const first = FIRST[gender][Math.floor(r() * FIRST[gender].length)];
    const name = `${first} ${LAST[Math.floor(r() * LAST.length)]}`;
    const g: Guest = {
      id: `g${c.G}`,
      name,
      phone: `010${Math.floor(10000000 + r() * 89999999)}`,
      email: `guest${c.G}@example.com`,
      kind,
      gender,
      org: kind === "student" ? ORGS[Math.floor(r() * ORGS.length)] : undefined,
      idType: "national_id",
      idNumber: `3${Math.floor(1e12 + r() * 8e12)}`,
    };
    // Roughly one student in eight is an international student registered by passport.
    if (kind === "student" && r() < 0.12) {
      g.idType = "passport";
      g.idNumber = `${"ABCNPS"[Math.floor(r() * 6)]}${Math.floor(1000000 + r() * 8999999)}`;
      g.nationality = NATIONALITIES[Math.floor(r() * NATIONALITIES.length)];
    }
    guests.push(g);
    return g;
  };

  // Student rooms are single-gender; the scenario room is male (the scenario student is male).
  const roomGender = new Map<string, Gender>();
  const genderFor = (bed: Bed) => {
    const room = rooms.find((x) => x.id === bed.roomId)!;
    if (room.propertyId !== "p1") return undefined;
    if (!roomGender.has(room.id)) roomGender.set(room.id, room.id === "r-A-204" || r() < 0.5 ? "male" : "female");
    return roomGender.get(room.id);
  };
  const makeBooking = (bed: Bed, planId: string, start: string, end: string, status: Booking["status"], kind: "student" | "guest") => {
    const g = newGuest(kind, genderFor(bed));
    const plan = plans.find((p) => p.id === planId)!;
    const rent = computeRent(plan, start, end);
    c.BK++;
    const b: Booking = {
      id: `bk${c.BK}`,
      code: `BK-${c.BK}`,
      guestId: g.id,
      bedId: bed.id,
      start,
      end,
      planId,
      rent,
      deposit: plan.deposit,
      status,
      docs: { id: true, enrollment: kind === "student", photo: true },
      events: [{ at: `${addDays(start, -14)}T10:00:00`, text: "تم إنشاء الحجز", user: ROLE_USERS.reservations }],
      createdAt: `${addDays(start, -14)}T10:00:00`,
    };
    if (kind !== "student") b.docs.enrollment = true;
    bookings.push(b);
    if (status !== "pending" && status !== "rejected" && status !== "cancelled") {
      b.events.push({ at: `${addDays(start, -12)}T12:00:00`, text: "تم تأكيد الحجز وإنشاء العقد والفاتورة", user: ROLE_USERS.manager });
      c.CT++;
      contracts.push({
        id: `ct${c.CT}`,
        code: `CT-${c.CT}`,
        bookingId: b.id,
        start,
        end,
        status: status === "checked_out" ? "ended" : status === "checked_in" ? "active" : "pending_start",
      });
      c.INV++;
      const inv: Invoice = {
        id: `inv${c.INV}`,
        code: `INV-${c.INV}`,
        bookingId: b.id,
        guestId: g.id,
        issued: addDays(start, -12),
        lines: [
          { label: `رسوم الإقامة (${plan.name})`, labelEn: `Accommodation (${plan.nameEn})`, amount: rent, kind: "rent" },
          ...(plan.deposit ? [{ label: "تأمين قابل للاسترداد", labelEn: "Refundable deposit", amount: plan.deposit, kind: "deposit" as const }] : []),
        ],
        schedule: buildSchedule(plan, start, end, rent, plan.deposit),
        status: "open",
      };
      invoices.push(inv);
      return { b, inv, g };
    }
    return { b, g };
  };

  const pay = (inv: Invoice, amount: number, date: string, method: Payment["method"]) => {
    if (amount <= 0) return;
    c.RC++;
    payments.push({
      id: `pm${c.RC}`,
      code: `RC-${c.RC}`,
      invoiceId: inv.id,
      amount,
      method,
      reference: method === "bank" ? `TRX-${Math.floor(r() * 900000 + 100000)}` : "",
      at: `${date}T11:30:00`,
      date,
      user: ROLE_USERS.accountant,
    });
  };

  const scenarioRoom = "r-A-204";
  const startPool = ["2026-06-01", "2026-07-01", "2026-08-15", "2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
  for (const bed of beds) {
    const room = rooms.find((x) => x.id === bed.roomId)!;
    if (room.id === scenarioRoom) {
      if (bed.id.endsWith("-1")) {
        const { b, inv } = makeBooking(bed, "pl-month", "2026-09-01", "2027-01-31", "checked_in", "student");
        stays.push({ id: `st${++c.ST}`, bookingId: b.id, bedId: bed.id, checkIn: b.start, checkInAt: `${b.start}T14:00:00`, status: "active" });
        pay(inv!, 15000, "2026-09-01", "bank");
        pay(inv!, 6000, "2026-10-02", "cash");
      }
      continue;
    }
    if (room.propertyId === "p1") {
      const x = r();
      if (x < 0.68) {
        const start = startPool[Math.floor(r() * startPool.length)];
        const end = addDays(addMonths(start, r() < 0.5 ? 5 : 8), -1);
        const { b, inv } = makeBooking(bed, r() < 0.7 ? "pl-month" : "pl-sem", start, end, "checked_in", "student");
        stays.push({ id: `st${++c.ST}`, bookingId: b.id, bedId: bed.id, checkIn: start, checkInAt: `${start}T13:00:00`, status: "active" });
        const due = inv!.schedule.filter((s) => s.due <= DEMO_TODAY).reduce((a, s) => a + s.amount, 0);
        const ratio = r();
        const paid = ratio < 0.2 ? due - 6000 : ratio < 0.35 ? due - 3000 : due;
        let left = Math.max(0, paid);
        let d = start;
        while (left > 0) {
          const amt = Math.min(left, left > 12000 ? 9000 : left);
          pay(inv!, amt, d, r() < 0.5 ? "bank" : "cash");
          left -= amt;
          d = addDays(d, 30);
          if (d > DEMO_TODAY) d = addDays(DEMO_TODAY, -3);
        }
      } else if (x < 0.74) {
        makeBooking(bed, "pl-month", r() < 0.5 ? "2026-11-15" : "2026-12-01", "2027-03-31", "confirmed", "student");
      } else if (x < 0.78) {
        makeBooking(bed, "pl-sem", "2027-02-01", "2027-05-31", "pending", "student");
      }
    } else if (room.propertyId === "p2") {
      const x = r();
      if (x < 0.55) {
        const start = addDays(DEMO_TODAY, -Math.floor(r() * 5) - 1);
        const end = addDays(DEMO_TODAY, Math.floor(r() * 4));
        const { b, inv } = makeBooking(bed, "pl-night", start, end, "checked_in", "guest");
        stays.push({ id: `st${++c.ST}`, bookingId: b.id, bedId: bed.id, checkIn: start, checkInAt: `${start}T15:00:00`, status: "active" });
        pay(inv!, r() < 0.6 ? b.rent : Math.round(b.rent / 2), start, r() < 0.5 ? "online_demo" : "cash");
      } else if (x < 0.65) {
        makeBooking(bed, "pl-night", DEMO_TODAY, addDays(DEMO_TODAY, 3), "confirmed", "guest");
      } else if (x < 0.72) {
        makeBooking(bed, "pl-night", addDays(DEMO_TODAY, 6), addDays(DEMO_TODAY, 9), "pending", "guest");
      }
      // past closed stays for history
      if (r() < 0.6) {
        const s = addDays("2026-06-01", Math.floor(r() * 120));
        const e = addDays(s, 2 + Math.floor(r() * 5));
        if (e < addDays(DEMO_TODAY, -7)) {
          const { b, inv } = makeBooking(bed, "pl-night", s, e, "checked_out", "guest");
          stays.push({ id: `st${++c.ST}`, bookingId: b.id, bedId: bed.id, checkIn: s, checkInAt: `${s}T15:00:00`, checkOut: e, checkOutAt: `${e}T11:00:00`, status: "closed" });
          pay(inv!, b.rent, s, "online_demo");
        }
      }
    } else {
      const x = r();
      if (x < 0.6) {
        const start = startPool[Math.floor(r() * startPool.length)];
        const end = addDays(addMonths(start, 6), -1);
        const { b, inv } = makeBooking(bed, "pl-apt-month", start, end, "checked_in", "guest");
        stays.push({ id: `st${++c.ST}`, bookingId: b.id, bedId: bed.id, checkIn: start, checkInAt: `${start}T14:00:00`, status: "active" });
        const due = inv!.schedule.filter((s) => s.due <= DEMO_TODAY).reduce((a, s) => a + s.amount, 0);
        pay(inv!, r() < 0.3 ? due - 42000 : due, start, "bank");
      } else if (x < 0.75) {
        makeBooking(bed, "pl-week", addDays(DEMO_TODAY, 4), addDays(DEMO_TODAY, 17), "confirmed", "guest");
      }
    }
  }

  // Fill shared rooms in bed order: residents on the lowest-numbered beds, then confirmed, then pending
  // bookings, free beds last. Each bed's bookings move together, so no overlaps are introduced.
  const rank = (bedId: string) => {
    const st = bookings.filter((b) => b.bedId === bedId).map((b) => b.status);
    return st.includes("checked_in") ? 0 : st.includes("confirmed") ? 1 : st.includes("pending") ? 2 : 3;
  };
  for (const room of rooms) {
    const roomBeds = beds.filter((b) => b.roomId === room.id);
    if (roomBeds.length < 2) continue;
    const target = new Map(
      [...roomBeds].sort((a, b) => rank(a.id) - rank(b.id)).map((from, i) => [from.id, roomBeds[i].id]),
    );
    for (const b of bookings) if (target.has(b.bedId)) b.bedId = target.get(b.bedId)!;
    for (const st of stays) if (target.has(st.bedId)) st.bedId = target.get(st.bedId)!;
  }

  // Rooms needing housekeeping / maintenance (only rooms with no active stays)
  const freeRooms = rooms.filter(
    (rm) => rm.id !== scenarioRoom && !stays.some((s) => s.status === "active" && beds.find((b) => b.id === s.bedId)?.roomId === rm.id) &&
      !bookings.some((b) => ["confirmed", "pending"].includes(b.status) && beds.find((bd) => bd.id === b.bedId)?.roomId === rm.id),
  );
  const mk = (rm: Room, type: Task["type"], title: string, status: Task["status"], prio: Task["priority"], assignee?: string) => {
    c.TK++;
    tasks.push({ id: `tk${c.TK}`, code: `TK-${c.TK}`, roomId: rm.id, type, title, status, priority: prio, assignee, notes: [], createdAt: `${addDays(DEMO_TODAY, -1)}T09:00:00`, source: "seed" });
  };
  if (freeRooms[0]) { freeRooms[0].hk = "maintenance"; mk(freeRooms[0], "maintenance", "إصلاح تسريب في الحمام", "in_progress", "high", "م. سامي الفني"); }
  if (freeRooms[1]) { freeRooms[1].hk = "maintenance"; mk(freeRooms[1], "maintenance", "استبدال وحدة التكييف", "assigned", "normal", "م. سامي الفني"); }
  if (freeRooms[2]) { freeRooms[2].hk = "dirty"; mk(freeRooms[2], "cleaning", "تنظيف بعد المغادرة", "new", "normal"); }
  if (freeRooms[3]) { freeRooms[3].hk = "cleaning"; mk(freeRooms[3], "cleaning", "تنظيف بعد المغادرة", "in_progress", "normal", "أم كلثوم محمود"); }
  if (freeRooms[4]) { freeRooms[4].hk = "inspection"; mk(freeRooms[4], "cleaning", "تنظيف عميق", "cleaned", "low", "سعاد إبراهيم"); }
  // historical approved tasks
  for (let i = 5; i < 11 && freeRooms[i]; i++) mk(freeRooms[i], "cleaning", "تنظيف دوري", "approved", "low", "أم كلثوم محمود");

  const seedActs: [string, string, string][] = [
    ["2026-10-31T17:40:00", "reservations", "تأكيد 3 حجوزات فندقية لعطلة نهاية الأسبوع"],
    ["2026-10-31T15:10:00", "accountant", "تسجيل تحصيلات يومية بقيمة 48,600 ج.م."],
    ["2026-10-31T12:05:00", "housekeeping", "اعتماد جاهزية 4 غرف في فندق كورنيش الإسكندرية"],
    ["2026-10-30T19:20:00", "manager", "حجب غرفتين للصيانة في إقامة النيل"],
  ];
  seedActs.forEach(([at, role, action], i) =>
    activities.push({ id: `a-seed-${i}`, at, user: ROLE_USERS[role], role: role as Activity["role"], action, ref: "" }),
  );

  return {
    version: STATE_VERSION,
    lang: "ar",
    role: "manager",
    propertyFilter: "all",
    properties,
    buildings,
    rooms,
    beds,
    guests,
    plans,
    bookings,
    contracts,
    invoices,
    payments,
    stays,
    tasks,
    activities,
    staff: ["أم كلثوم محمود", "سعاد إبراهيم", "رجب عبد العزيز", "م. سامي الفني"],
    counters: c,
    scenario: { tourActive: false, step: 0 },
  };
}

export function buildSchedule(plan: Plan, start: string, end: string, rent: number, deposit: number) {
  if (plan.period !== "monthly") return [{ due: start, amount: rent + deposit }];
  const months = Math.max(1, Math.round(rent / plan.price));
  const out = [];
  for (let i = 0; i < months; i++) {
    out.push({ due: addMonths(start, i), amount: plan.price + (i === 0 ? deposit : 0) });
  }
  const diff = rent + deposit - out.reduce((a, s) => a + s.amount, 0);
  if (diff !== 0) out[out.length - 1].amount += diff;
  void end;
  return out;
}
