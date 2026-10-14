import { useSyncExternalStore } from "react";
import type { Booking, DemoState, Gender, NewGuest, PayMethod, Role, Task, TaskStatus } from "./types";
import { createSeed, DEMO_TODAY, ROLE_USERS, STATE_VERSION, buildSchedule } from "./seed";
import { addMonths, computeRent, freeFrom, overlaps, validRange } from "./calc";

const KEY = "stayflow-demo-state";
let state: DemoState = createSeed();
const listeners = new Set<() => void>();
let loaded = false;

function emit() {
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }
}
function set(fn: (s: DemoState) => DemoState) {
  state = fn(state);
  emit();
}
export function loadPersisted() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === STATE_VERSION) {
        state = parsed;
        listeners.forEach((l) => l());
      }
    }
  } catch {
    /* ignore */
  }
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export const getState = () => state;

// ---------------- permissions (UI simulation only) ----------------
export type Perm =
  | "booking.create"
  | "booking.review"
  | "stay.checkin"
  | "stay.checkout"
  | "payment.record"
  | "payment.correct"
  | "task.update"
  | "task.approve"
  | "unit.edit"
  | "pricing.edit"
  | "guest.edit"
  | "demo.reset";
const ALL: Perm[] = ["booking.create", "booking.review", "stay.checkin", "stay.checkout", "payment.record", "payment.correct", "task.update", "task.approve", "unit.edit", "pricing.edit", "guest.edit", "demo.reset"];
export const PERMS: Record<Role, Perm[]> = {
  exec: ALL,
  manager: ALL,
  reservations: ["booking.create", "booking.review", "guest.edit"],
  frontdesk: ["booking.create", "stay.checkin", "stay.checkout", "guest.edit"],
  accountant: ["payment.record", "payment.correct"],
  housekeeping: ["task.update", "task.approve"],
  auditor: [],
};
export const can = (role: Role, p: Perm) => PERMS[role].includes(p);

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const deny = (): Result<never> => ({ ok: false, error: "صلاحية غير متاحة للدور الحالي (محاكاة صلاحيات)" });
const nowIso = () => {
  const d = new Date();
  return `${DEMO_TODAY}T${d.toTimeString().slice(0, 8)}`;
};
const user = () => ROLE_USERS[state.role];
function log(s: DemoState, action: string, ref: string, scenario?: boolean): DemoState {
  const a = { id: `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: nowIso(), user: ROLE_USERS[s.role], role: s.role, action, ref, scenario };
  return { ...s, activities: [a, ...s.activities] };
}
function next(s: DemoState, k: string) {
  const n = (s.counters[k] ?? 0) + 1;
  s.counters = { ...s.counters, [k]: n };
  return n;
}
const isScenario = (s: DemoState, bookingId: string) => s.scenario.bookingId === bookingId;
const ACTIVE_BOOKING = ["pending", "confirmed", "checked_in"];

// ---------------- availability ----------------
const planPeriod = (s: DemoState, planId: string) => s.plans.find((p) => p.id === planId)?.period ?? "daily";
export function bedConflict(s: DemoState, bedId: string, start: string, end: string, planId: string, ignoreId?: string) {
  const until = freeFrom(planPeriod(s, planId), end);
  return s.bookings.find(
    (b) =>
      b.id !== ignoreId &&
      b.bedId === bedId &&
      ACTIVE_BOOKING.includes(b.status) &&
      overlaps(start, until, b.start, freeFrom(planPeriod(s, b.planId), b.end)),
  );
}
/** An overlapping active booking of the other gender in the same shared room, if any. */
export function genderConflict(s: DemoState, bedId: string, start: string, end: string, planId: string, gender: Gender) {
  const roomId = s.beds.find((b) => b.id === bedId)?.roomId;
  const roomBeds = new Set(s.beds.filter((b) => b.roomId === roomId).map((b) => b.id));
  if (roomBeds.size < 2) return undefined;
  const until = freeFrom(planPeriod(s, planId), end);
  return s.bookings.find(
    (b) =>
      roomBeds.has(b.bedId) &&
      b.bedId !== bedId &&
      ACTIVE_BOOKING.includes(b.status) &&
      overlaps(start, until, b.start, freeFrom(planPeriod(s, b.planId), b.end)) &&
      s.guests.find((g) => g.id === b.guestId)?.gender !== gender,
  );
}
/** Start of the collections period shown on the dashboard (previous month through today). */
export const PERIOD_START = addMonths(`${DEMO_TODAY.slice(0, 7)}-01`, -1);

// ---------------- actions ----------------
export const actions = {
  setLang(lang: DemoState["lang"]) {
    set((s) => ({ ...s, lang }));
  },
  setRole(role: Role) {
    set((s) => log({ ...s, role }, `تبديل الدور التجريبي`, role));
  },
  setPropertyFilter(id: string) {
    set((s) => ({ ...s, propertyFilter: id }));
  },
  reset() {
    const lang = state.lang;
    state = { ...createSeed(), lang };
    emit();
  },
  tour(patch: Partial<DemoState["scenario"]>) {
    set((s) => ({ ...s, scenario: { ...s.scenario, ...patch } }));
  },
  markConflictTested() {
    set((s) => log({ ...s, scenario: { ...s.scenario, conflictTested: true } }, "رفض محاولة حجز متداخل على سرير محجوز", "فحص التوافر", true));
  },

  createBooking(input: {
    guestId?: string;
    guest?: NewGuest;
    bedId: string;
    start: string;
    end: string;
    planId: string;
    scenario?: boolean;
  }): Result<Booking> {
    if (!can(state.role, "booking.create")) return deny();
    const s = { ...state };
    const plan = s.plans.find((p) => p.id === input.planId);
    if (!plan) return { ok: false, error: "اختر خطة السعر" };
    if (!input.start || !input.end || !validRange(plan.period, input.start, input.end))
      return { ok: false, error: "تواريخ الإقامة غير صحيحة" };
    const bed = s.beds.find((b) => b.id === input.bedId);
    if (!bed) return { ok: false, error: "اختر سريرًا أو وحدة" };
    const room = s.rooms.find((r) => r.id === bed.roomId)!;
    if (room.hk === "maintenance") return { ok: false, error: `الوحدة ${room.code} محجوبة للصيانة ولا يمكن حجزها` };
    const conflict = bedConflict(s, bed.id, input.start, input.end, plan.id);
    if (conflict) {
      return {
        ok: false,
        error: `مرفوض: ${room.code} / ${bed.label} محجوز بالحجز ${conflict.code} من ${conflict.start} إلى ${conflict.end}. اختر سريرًا آخر متاحًا في الغرفة نفسها أو فترة مختلفة.`,
      };
    }
    let guestId = input.guestId;
    if (!guestId) {
      if (!input.guest?.name.trim()) return { ok: false, error: "أدخل اسم النزيل/الطالب" };
      // Match on national ID, not name: two people can share a name.
      const nid = input.guest.nationalId.trim();
      const existing = nid ? s.guests.find((g) => g.nationalId === nid) : undefined;
      if (existing) guestId = existing.id;
      else {
        const gid = `g${next(s, "G")}`;
        s.guests = [...s.guests, { id: gid, ...input.guest!, name: input.guest!.name.trim() }];
        guestId = gid;
      }
    }
    const gender = s.guests.find((g) => g.id === guestId)?.gender;
    const mixed = gender && genderConflict(s, bed.id, input.start, input.end, plan.id, gender);
    if (mixed) {
      return {
        ok: false,
        error: `مرفوض: الغرفة ${room.code} مخصصة ${gender === "male" ? "للطالبات" : "للطلاب"} في هذه الفترة (الحجز ${mixed.code}). لا يمكن تسكين ${gender === "male" ? "طالب" : "طالبة"} فيها.`,
      };
    }
    const n = next(s, "BK");
    const booking: Booking = {
      id: `bk${n}`,
      code: `BK-${n}`,
      guestId: guestId!,
      bedId: bed.id,
      start: input.start,
      end: input.end,
      planId: plan.id,
      rent: computeRent(plan, input.start, input.end),
      deposit: plan.deposit,
      status: "pending",
      docs: { id: false, enrollment: false, photo: false },
      events: [{ at: nowIso(), text: "تم إنشاء الحجز بحالة «قيد المراجعة»", user: user() }],
      createdAt: nowIso(),
      scenario: input.scenario,
    };
    s.bookings = [booking, ...s.bookings];
    if (input.scenario) s.scenario = { ...s.scenario, bookingId: booking.id };
    state = log(s, `إنشاء حجز ${booking.code} - ${room.code} / ${bed.label}`, booking.code, input.scenario);
    emit();
    return { ok: true, data: booking };
  },

  toggleDoc(bookingId: string, key: keyof Booking["docs"]) {
    if (!can(state.role, "booking.review") && !can(state.role, "stay.checkin")) return deny();
    set((s) => {
      const bookings = s.bookings.map((b) => (b.id === bookingId ? { ...b, docs: { ...b.docs, [key]: !b.docs[key] } } : b));
      return { ...s, bookings };
    });
    return { ok: true } as Result;
  },

  confirmBooking(id: string): Result {
    if (!can(state.role, "booking.review")) return deny();
    const s = { ...state };
    const b = s.bookings.find((x) => x.id === id);
    if (!b || b.status !== "pending") return { ok: false, error: "لا يمكن تأكيد هذا الحجز في حالته الحالية" };
    const plan = s.plans.find((p) => p.id === b.planId)!;
    const ct = next(s, "CT");
    const inv = next(s, "INV");
    s.contracts = [...s.contracts, { id: `ct${ct}`, code: `CT-${ct}`, bookingId: b.id, start: b.start, end: b.end, status: "pending_start" }];
    s.invoices = [
      ...s.invoices,
      {
        id: `inv${inv}`,
        code: `INV-${inv}`,
        bookingId: b.id,
        guestId: b.guestId,
        issued: DEMO_TODAY,
        lines: [
          { label: `رسوم الإقامة (${plan.name})`, labelEn: `Accommodation (${plan.nameEn})`, amount: b.rent, kind: "rent" },
          ...(b.deposit ? [{ label: "تأمين قابل للاسترداد", labelEn: "Refundable deposit", amount: b.deposit, kind: "deposit" as const }] : []),
        ],
        schedule: buildSchedule(plan, b.start, b.end, b.rent, b.deposit),
        status: "open",
      },
    ];
    s.bookings = s.bookings.map((x) =>
      x.id === id
        ? { ...x, status: "confirmed", events: [...x.events, { at: nowIso(), text: `تم التأكيد وإنشاء العقد CT-${ct} والفاتورة INV-${inv}`, user: user() }] }
        : x,
    );
    state = log(s, `تأكيد الحجز ${b.code} وإنشاء العقد CT-${ct} والفاتورة INV-${inv}`, b.code, isScenario(s, id));
    emit();
    return { ok: true };
  },

  rejectOrCancel(id: string, kind: "rejected" | "cancelled", reason: string): Result {
    if (!can(state.role, "booking.review")) return deny();
    const s = { ...state };
    const b = s.bookings.find((x) => x.id === id);
    if (!b) return { ok: false, error: "غير موجود" };
    if (kind === "rejected" && b.status !== "pending") return { ok: false, error: "الرفض متاح للحجوزات قيد المراجعة فقط" };
    if (kind === "cancelled" && !["pending", "confirmed"].includes(b.status)) return { ok: false, error: "لا يمكن إلغاء حجز بعد تسجيل الوصول" };
    if (!reason.trim()) return { ok: false, error: "سبب الإجراء مطلوب للتوثيق" };
    s.bookings = s.bookings.map((x) =>
      x.id === id ? { ...x, status: kind, events: [...x.events, { at: nowIso(), text: `${kind === "rejected" ? "رفض" : "إلغاء"} الحجز: ${reason}`, user: user() }] } : x,
    );
    s.contracts = s.contracts.map((c) => (c.bookingId === id ? { ...c, status: "cancelled" } : c));
    // Void even when paid: the balance becomes a credit owed to the guest (see invoiceBalance), refunded via a correction.
    s.invoices = s.invoices.map((i) => (i.bookingId === id ? { ...i, status: "void" } : i));
    state = log(s, `${kind === "rejected" ? "رفض" : "إلغاء"} الحجز ${b.code}`, b.code, isScenario(s, id));
    emit();
    return { ok: true };
  },

  checkIn(id: string): Result {
    if (!can(state.role, "stay.checkin")) return deny();
    const s = { ...state };
    const b = s.bookings.find((x) => x.id === id);
    if (!b || b.status !== "confirmed") return { ok: false, error: "تسجيل الوصول متاح للحجوزات المؤكدة فقط" };
    const issue = checkInBlockers(s, b);
    if (issue.length) return { ok: false, error: issue.join(" • ") };
    const n = next(s, "ST");
    const at = nowIso();
    s.stays = [...s.stays, { id: `st${n}`, bookingId: id, bedId: b.bedId, checkIn: DEMO_TODAY, checkInAt: at, status: "active" }];
    s.bookings = s.bookings.map((x) => (x.id === id ? { ...x, status: "checked_in", events: [...x.events, { at, text: "تسجيل الوصول وبدء الإقامة الفعلية", user: user() }] } : x));
    s.contracts = s.contracts.map((c) => (c.bookingId === id ? { ...c, status: "active" } : c));
    state = log(s, `تسجيل وصول ${guestName(s, b.guestId)} - ${bedLabel(s, b.bedId)}`, b.code, isScenario(s, id));
    emit();
    return { ok: true };
  },

  checkOut(id: string, earlyApproved: boolean): Result {
    if (!can(state.role, "stay.checkout")) return deny();
    const s = { ...state };
    const b = s.bookings.find((x) => x.id === id);
    const stay = s.stays.find((x) => x.bookingId === id && x.status === "active");
    if (!b || !stay) return { ok: false, error: "لا توجد إقامة فعلية نشطة" };
    if (DEMO_TODAY < b.end && !earlyApproved) return { ok: false, error: "المدة لم تنتهِ بعد؛ يلزم اعتماد مغادرة مبكرة" };
    const at = nowIso();
    const bed = s.beds.find((x) => x.id === b.bedId)!;
    const room = s.rooms.find((r) => r.id === bed.roomId)!;
    s.stays = s.stays.map((x) => (x.id === stay.id ? { ...x, status: "closed", checkOut: DEMO_TODAY, checkOutAt: at } : x));
    s.bookings = s.bookings.map((x) =>
      x.id === id ? { ...x, status: "checked_out", events: [...x.events, { at, text: earlyApproved && DEMO_TODAY < b.end ? "مغادرة مبكرة معتمدة" : "تسجيل المغادرة", user: user() }] } : x,
    );
    s.contracts = s.contracts.map((c) => (c.bookingId === id ? { ...c, status: "ended" } : c));
    // A shared room with other residents stays in service; only the vacated bed is cleaned.
    const shared = occupiedBeds(s, room.id) > 0;
    if (!shared) s.rooms = s.rooms.map((r) => (r.id === room.id ? { ...r, hk: "dirty" } : r));
    const t = next(s, "TK");
    s.tasks = [
      { id: `tk${t}`, code: `TK-${t}`, roomId: room.id, type: "cleaning", title: `تنظيف وفحص ${shared ? bed.label + " " : ""}بعد مغادرة ${guestName(s, b.guestId)}`, status: "new", priority: "high", notes: [], createdAt: at, source: b.code },
      ...s.tasks,
    ];
    state = log(s, `تسجيل مغادرة ${guestName(s, b.guestId)} وإنشاء مهمة تنظيف TK-${t} للغرفة ${room.code}`, b.code, isScenario(s, id));
    emit();
    return { ok: true };
  },

  recordPayment(invoiceId: string, amount: number, method: PayMethod, reference: string): Result<string> {
    if (!can(state.role, "payment.record")) return deny();
    const s = { ...state };
    const inv = s.invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status === "void") return { ok: false, error: "الفاتورة غير متاحة" };
    const bal = invoiceBalance(s, invoiceId);
    if (!(amount > 0)) return { ok: false, error: "أدخل مبلغًا صحيحًا" };
    if (amount > bal) return { ok: false, error: `المبلغ أكبر من الرصيد المتبقي (${bal.toLocaleString("ar-EG")} ج.م.)` };
    const n = next(s, "RC");
    s.payments = [...s.payments, { id: `pm${n}`, code: `RC-${n}`, invoiceId, amount, method, reference, at: nowIso(), date: DEMO_TODAY, user: user() }];
    const b = s.bookings.find((x) => x.id === inv.bookingId);
    state = log(s, `تسجيل دفعة ${amount.toLocaleString("ar-EG")} ج.م. على ${inv.code} (إيصال RC-${n})`, inv.code, b ? isScenario(s, b.id) : false);
    emit();
    return { ok: true, data: `pm${n}` };
  },

  correctPayment(paymentId: string, reason: string): Result {
    if (!can(state.role, "payment.correct")) return deny();
    if (!reason.trim()) return { ok: false, error: "سبب التصحيح مطلوب" };
    const s = { ...state };
    const p = s.payments.find((x) => x.id === paymentId);
    if (!p || p.reversed || p.reversalOf) return { ok: false, error: "لا يمكن تصحيح هذه العملية" };
    const n = next(s, "RC");
    s.payments = [
      ...s.payments.map((x) => (x.id === paymentId ? { ...x, reversed: true } : x)),
      { id: `pm${n}`, code: `RC-${n}`, invoiceId: p.invoiceId, amount: -p.amount, method: p.method, reference: p.code, at: nowIso(), date: DEMO_TODAY, user: user(), reversalOf: p.id, note: reason },
    ];
    state = log(s, `قيد تصحيح موثق لعكس الإيصال ${p.code}: ${reason}`, p.code);
    emit();
    return { ok: true };
  },

  taskStep(taskId: string, to: TaskStatus, extra?: { assignee?: string }): Result {
    const perm = to === "approved" ? "task.approve" : "task.update";
    if (!can(state.role, perm)) return deny();
    const s = { ...state };
    const t = s.tasks.find((x) => x.id === taskId);
    if (!t) return { ok: false, error: "غير موجود" };
    const order: TaskStatus[] = ["new", "assigned", "in_progress", "cleaned", "inspected", "approved"];
    if (order.indexOf(to) !== order.indexOf(t.status) + 1) return { ok: false, error: "يجب تنفيذ الخطوات بالترتيب" };
    if (to === "assigned" && !extra?.assignee) return { ok: false, error: "اختر الموظف المسؤول" };
    const room = s.rooms.find((r) => r.id === t.roomId)!;
    const keepHk = t.type === "cleaning" && occupiedBeds(s, room.id) > 0;
    const hk = keepHk ? room.hk : to === "in_progress" ? (t.type === "maintenance" ? "maintenance" : "cleaning") : to === "cleaned" || to === "inspected" ? (t.type === "maintenance" ? "maintenance" : "inspection") : to === "approved" ? "ready" : room.hk;
    s.rooms = s.rooms.map((r) => (r.id === room.id ? { ...r, hk } : r));
    s.tasks = s.tasks.map((x) => (x.id === taskId ? { ...x, status: to, assignee: extra?.assignee ?? x.assignee, doneAt: to === "approved" ? nowIso() : x.doneAt } : x));
    const labels: Record<TaskStatus, string> = { new: "", assigned: `تعيين ${extra?.assignee}`, in_progress: "بدء التنفيذ", cleaned: "تسجيل اكتمال العمل", inspected: "اجتياز فحص الجاهزية", approved: `اعتماد الغرفة ${room.code} للخدمة - أصبحت متاحة` };
    const scen = s.scenario.bookingId ? t.source === s.bookings.find((b) => b.id === s.scenario.bookingId)?.code : false;
    state = log(s, `${t.code}: ${labels[to]}`, room.code, scen);
    emit();
    return { ok: true };
  },

  addTaskNote(taskId: string, text: string): Result {
    if (!can(state.role, "task.update")) return deny();
    if (!text.trim()) return { ok: false, error: "اكتب الملاحظة" };
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...t.notes, { at: nowIso(), user: user(), text }] } : t));
      return log({ ...s, tasks }, `إضافة ملاحظة على ${s.tasks.find((t) => t.id === taskId)?.code}`, taskId);
    });
    return { ok: true };
  },

  blockRoom(roomId: string, reason: string): Result {
    if (!can(state.role, "unit.edit")) return deny();
    const s = { ...state };
    const room = s.rooms.find((r) => r.id === roomId)!;
    if (occupiedBeds(s, roomId) > 0) return { ok: false, error: "لا يمكن حجب وحدة بها إقامة فعلية" };
    if (!reason.trim()) return { ok: false, error: "سبب الحجب مطلوب" };
    s.rooms = s.rooms.map((r) => (r.id === roomId ? { ...r, hk: "maintenance" } : r));
    const t = next(s, "TK");
    const task: Task = { id: `tk${t}`, code: `TK-${t}`, roomId, type: "maintenance", title: reason, status: "new", priority: "high", notes: [], createdAt: nowIso(), source: "block" };
    s.tasks = [task, ...s.tasks];
    state = log(s, `حجب ${room.code} للصيانة: ${reason}`, room.code);
    emit();
    return { ok: true };
  },

  addGuest(g: NewGuest): Result {
    if (!can(state.role, "guest.edit")) return deny();
    if (!g.name.trim()) return { ok: false, error: "الاسم مطلوب" };
    const s = { ...state };
    const id = `g${next(s, "G")}`;
    s.guests = [...s.guests, { id, ...g }];
    state = log(s, `إضافة ملف ${g.kind === "student" ? "طالب" : "نزيل"}: ${g.name}`, id);
    emit();
    return { ok: true };
  },

  updatePlan(id: string, price: number, deposit: number): Result {
    if (!can(state.role, "pricing.edit")) return deny();
    set((s) => log({ ...s, plans: s.plans.map((p) => (p.id === id ? { ...p, price, deposit } : p)) }, `تعديل خطة السعر ${s.plans.find((p) => p.id === id)?.name}`, id));
    return { ok: true };
  },
};

// ---------------- selectors ----------------
export const guestName = (s: DemoState, id: string) => s.guests.find((g) => g.id === id)?.name ?? "—";
export function bedLabel(s: DemoState, bedId: string) {
  const bed = s.beds.find((b) => b.id === bedId);
  const room = bed && s.rooms.find((r) => r.id === bed.roomId);
  return room ? `${room.code} / ${bed!.label}` : "—";
}
export function bedProperty(s: DemoState, bedId: string) {
  const bed = s.beds.find((b) => b.id === bedId);
  const room = bed && s.rooms.find((r) => r.id === bed.roomId);
  return room ? s.properties.find((p) => p.id === room.propertyId) : undefined;
}
export const activeStayOnBed = (s: DemoState, bedId: string) => s.stays.find((x) => x.bedId === bedId && x.status === "active");
export const occupiedBeds = (s: DemoState, roomId: string) =>
  s.beds.filter((b) => b.roomId === roomId && activeStayOnBed(s, b.id)).length;
/** Genders of the residents currently staying in a room (empty when vacant). */
export function roomGenders(s: DemoState, roomId: string) {
  const out = new Set<Gender>();
  for (const b of s.beds) {
    if (b.roomId !== roomId) continue;
    const stay = activeStayOnBed(s, b.id);
    const booking = stay && s.bookings.find((x) => x.id === stay.bookingId);
    const guest = booking && s.guests.find((g) => g.id === booking.guestId);
    if (guest) out.add(guest.gender);
  }
  return out;
}

export function invoicePaid(s: DemoState, invoiceId: string) {
  return s.payments.filter((p) => p.invoiceId === invoiceId).reduce((a, p) => a + p.amount, 0);
}
export function invoiceTotal(s: DemoState, invoiceId: string) {
  return s.invoices.find((i) => i.id === invoiceId)?.lines.reduce((a, l) => a + l.amount, 0) ?? 0;
}
/** Open invoice: amount still due. Void invoice: minus whatever was paid (a credit owed back to the guest). */
export function invoiceBalance(s: DemoState, id: string) {
  const voided = s.invoices.find((i) => i.id === id)?.status === "void";
  return (voided ? 0 : invoiceTotal(s, id)) - invoicePaid(s, id);
}
export function invoiceOverdue(s: DemoState, id: string) {
  const inv = s.invoices.find((i) => i.id === id);
  if (!inv || inv.status === "void") return 0;
  const due = inv.schedule.filter((x) => x.due < DEMO_TODAY).reduce((a, x) => a + x.amount, 0);
  return Math.max(0, due - invoicePaid(s, id));
}
export function depositHeld(s: DemoState, id: string) {
  const inv = s.invoices.find((i) => i.id === id);
  const dep = inv?.lines.filter((l) => l.kind === "deposit").reduce((a, l) => a + l.amount, 0) ?? 0;
  return Math.min(dep, Math.max(0, invoicePaid(s, id)));
}

export function checkInBlockers(s: DemoState, b: Booking) {
  const out: string[] = [];
  const bed = s.beds.find((x) => x.id === b.bedId)!;
  const room = s.rooms.find((r) => r.id === bed.roomId)!;
  if (b.status !== "confirmed") out.push("الحجز غير مؤكد");
  if (!b.docs.id || !b.docs.enrollment || !b.docs.photo) out.push("المستندات المطلوبة غير مكتملة");
  if (room.hk !== "ready") out.push(`الغرفة ${room.code} غير معتمدة الجاهزية`);
  if (activeStayOnBed(s, b.bedId)) out.push("السرير مشغول بإقامة فعلية");
  return out;
}

export type UnitStatus = "available" | "partial" | "full" | "cleaning" | "maintenance";
export function roomStatus(s: DemoState, roomId: string): UnitStatus {
  const room = s.rooms.find((r) => r.id === roomId)!;
  if (room.hk === "maintenance") return "maintenance";
  if (room.hk !== "ready") return "cleaning";
  const total = s.beds.filter((b) => b.roomId === roomId).length;
  const occ = occupiedBeds(s, roomId);
  return occ === 0 ? "available" : occ < total ? "partial" : "full";
}

export function inScope(s: DemoState, propertyId: string) {
  return s.propertyFilter === "all" || s.propertyFilter === propertyId;
}

export function kpis(s: DemoState) {
  const rooms = s.rooms.filter((r) => inScope(s, r.propertyId));
  const roomIds = new Set(rooms.map((r) => r.id));
  const beds = s.beds.filter((b) => roomIds.has(b.roomId));
  const bedIds = new Set(beds.map((b) => b.id));
  const occupied = beds.filter((b) => activeStayOnBed(s, b.id)).length;
  const oos = rooms.filter((r) => r.hk === "maintenance");
  const oosBeds = beds.filter((b) => oos.some((r) => r.id === b.roomId)).length;
  const notReadyBeds = beds.filter((b) => {
    const r = rooms.find((x) => x.id === b.roomId)!;
    return r.hk !== "ready" && r.hk !== "maintenance" && !activeStayOnBed(s, b.id);
  }).length;
  const bookings = s.bookings.filter((b) => bedIds.has(b.bedId));
  const future = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const available = beds.length - occupied - oosBeds - notReadyBeds;
  const scoped = s.invoices.filter((i) => bookings.some((b) => b.id === i.bookingId));
  const invoices = scoped.filter((i) => i.status === "open");
  // Cash received counts even if the invoice was later voided; refunds net out as reversals.
  const scopedIds = new Set(scoped.map((i) => i.id));
  const collected = s.payments.filter((p) => scopedIds.has(p.invoiceId) && p.date >= PERIOD_START).reduce((a, p) => a + p.amount, 0);
  const outstanding = invoices.reduce((a, i) => a + Math.max(0, invoiceBalance(s, i.id)), 0);
  const overdue = invoices.reduce((a, i) => a + invoiceOverdue(s, i.id), 0);
  const arrivals = future.filter((b) => b.start === DEMO_TODAY);
  const departures = bookings.filter((b) => b.status === "checked_in" && b.end <= DEMO_TODAY);
  return {
    rooms: rooms.length,
    beds: beds.length,
    occupied,
    occupancy: beds.length ? occupied / beds.length : 0,
    future: future.length,
    pending: pending.length,
    available,
    oos: oos.length,
    notReadyBeds,
    collected,
    outstanding,
    overdue,
    arrivals,
    departures,
  };
}

export const ROLE_NAMES: Record<Role, [string, string]> = {
  exec: ["الإدارة العليا", "Executive"],
  manager: ["مدير المنشأة", "Property manager"],
  reservations: ["مسؤول الحجوزات", "Reservations"],
  frontdesk: ["موظف الاستقبال", "Front desk"],
  accountant: ["المحاسب", "Accountant"],
  housekeeping: ["مسؤول النظافة والصيانة", "Housekeeping"],
  auditor: ["المراجع (قراءة فقط)", "Auditor (read-only)"],
};
export { DEMO_TODAY, ROLE_USERS };
