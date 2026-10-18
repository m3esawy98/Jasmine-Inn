import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, BedDouble, Check, CheckCircle2, ChevronLeft, ChevronRight, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Pill, Section } from "@/components/stay/kit";
import { GuestIdFields } from "@/components/stay/GuestIdFields";
import { actions, activeStayOnBed, bedConflict, bookableBeds, can, DEMO_TODAY, getState, planForRoom, roomGenders, roomUnavailableReason, useDemo } from "@/lib/demo/store";
import { addDays, computeRent, validRange } from "@/lib/demo/calc";
import { useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import type { Gender, IdType, RoomType } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings/new")({
  // `room`: started from a room's page, so that room is fixed and its room (and, for whole units, bed) steps are skipped.
  validateSearch: (s: Record<string, unknown>): { room?: string } => (typeof s.room === "string" ? { room: s.room } : {}),
  head: () => meta("حجز جديد", "إنشاء حجز مع فحص فوري للتوافر ومنع ازدواج حجز الأسرة."),
  component: NewBooking,
});

const STEPS: [string, string][] = [
  ["المدة ونوع السكن", "Period & housing"],
  ["اختيار الغرفة", "Room"],
  ["اختيار السرير", "Bed"],
  ["بيانات الطالب", "Guest details"],
  ["المراجعة والحفظ", "Review & save"],
];

const ROOM_TYPE: Record<RoomType, [string, string]> = {
  single: ["فردية", "Single"],
  double: ["مزدوجة", "Double"],
  quad: ["رباعية", "Quad"],
  hotel: ["فندقية", "Hotel"],
  apartment: ["شقة", "Apartment"],
};

/** For a shared room, the gender of its current residents when they're all one, to preset the housing type. */
function roomGender(s: ReturnType<typeof useDemo>, roomId: string): Gender | "" {
  if (s.beds.filter((b) => b.roomId === roomId).length < 2) return "";
  const g = roomGenders(s, roomId);
  return g.size === 1 ? [...g][0] : "";
}

function NewBooking() {
  const s = useDemo();
  const search = Route.useSearch();
  const fromRoom = s.rooms.find((r) => r.id === search.room);
  // A booking started from a room is the user's own, not the guided scenario's.
  const scenarioMode = !s.scenario.bookingId && !fromRoom;
  // The form's starting values depend on the scenario, which is only known once the saved demo data loads.
  return <BookingWizard key={`${scenarioMode}|${fromRoom?.id ?? ""}`} scenarioMode={scenarioMode} fromRoomId={fromRoom?.id} />;
}

function BookingWizard({ scenarioMode, fromRoomId }: { scenarioMode: boolean; fromRoomId?: string }) {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const navigate = useNavigate();
  const num = (n: number) => n.toLocaleString(s.lang === "ar" ? "ar-EG" : "en");
  const [step, setStep] = useState(0);
  const fromRoom = s.rooms.find((r) => r.id === fromRoomId);
  // Stays fixed until the user asks for another room (e.g. this one isn't free for their dates).
  const [fixedId, setFixedId] = useState(fromRoom?.id ?? null);
  const fromPlan = fromRoom && s.plans.find((p) => p.id === planForRoom(fromRoom));
  const [propertyId, setProperty] = useState(fromRoom?.propertyId ?? "p1");
  const [roomId, setRoom] = useState<string | null>(scenarioMode ? "r-A-204" : (fromRoom?.id ?? null));
  const [bedId, setBed] = useState(scenarioMode ? "r-A-204-2" : "");
  const [planId, setPlan] = useState(fromPlan?.id ?? "pl-month");
  // Nights and weeks start today; monthly stays keep the usual term dates.
  const shortStay = fromPlan && (fromPlan.period === "daily" || fromPlan.period === "weekly");
  const [start, setStart] = useState(shortStay ? DEMO_TODAY : "2026-11-01");
  const [end, setEnd] = useState(shortStay ? addDays(DEMO_TODAY, fromPlan.period === "daily" ? 3 : 14) : "2027-02-28");
  const [g, setG] = useState<{ name: string; phone: string; email: string; idType: IdType; idNumber: string; nationality: string; org: string; gender: Gender | "" }>(
    scenarioMode
      ? { name: "عمر حسن", phone: "01012345678", email: "omar.hassan@example.com", idType: "national_id", idNumber: "30405120101234", nationality: "", org: "جامعة القاهرة", gender: "male" }
      : { name: "", phone: "", email: "", idType: "national_id", idNumber: "", nationality: "", org: "", gender: fromRoom ? roomGender(s, fromRoom.id) : "" },
  );
  const [error, setError] = useState<string | null>(null);

  const room = s.rooms.find((r) => r.id === roomId);
  const plan = s.plans.find((p) => p.id === planId)!;
  const rent = computeRent(plan, start, end);
  const datesOk = !!start && !!end && validRange(plan.period, start, end);
  // The booking just saved from this form, while its inputs are unchanged. The form stays open in the
  // scenario, so without this the availability check would report the new booking as a conflict with itself.
  const [saved, setSaved] = useState<{ id: string; code: string; key: string } | null>(null);
  const key = `${bedId}|${start}|${end}|${planId}`;
  const mine = saved?.key === key ? saved : null;

  const roomOptions = useMemo(
    () =>
      g.gender && datesOk
        ? s.rooms
            .filter((r) => r.propertyId === propertyId)
            .map((r) => ({ room: r, free: bookableBeds(s, r.id, start, end, planId, g.gender as Gender), total: s.beds.filter((b) => b.roomId === r.id).length }))
            .filter((x) => x.free.length > 0 || x.room.id === roomId)
        : [],
    [s, propertyId, start, end, planId, g.gender, datesOk, roomId],
  );
  const bedStatus = useMemo(() => {
    if (!roomId || !g.gender) return [];
    const open = new Set(bookableBeds(s, roomId, start, end, planId, g.gender).map((b) => b.id));
    return s.beds
      .filter((b) => b.roomId === roomId)
      .map((b) => {
        const c = bedConflict(s, b.id, start, end, planId);
        const own = !!mine && c?.id === mine.id;
        return { bed: b, conflict: own ? undefined : c, own, blocked: !own && !open.has(b.id), occupiedNow: !!activeStayOnBed(s, b.id) };
      });
  }, [s, roomId, start, end, planId, g.gender, mine]);
  const sel = bedStatus.find((x) => x.bed.id === bedId);
  const allowed = can(s.role, "booking.create");

  // Changing an earlier step invalidates the choices made after it; a fixed room stays, only its bed is re-picked.
  const resetRoom = () => { if (!fixedId) setRoom(null); setBed(""); };
  const pickRoom = (rid: string) => {
    setRoom(rid);
    setBed(g.gender ? (bookableBeds(s, rid, start, end, planId, g.gender)[0]?.id ?? "") : "");
  };
  const fixed = s.rooms.find((r) => r.id === fixedId);
  const fixedWhole = !!fixed && s.beds.filter((b) => b.roomId === fixed.id).length === 1;
  const unavailable = fixed && g.gender && datesOk ? roomUnavailableReason(s, fixed.id, start, end, planId, g.gender) : undefined;
  // In a fixed shared room, the housing type its residents for these dates rule out (e.g. boys in a girls' room).
  const blockedGender = (v: Gender) => !!fixed && datesOk && roomUnavailableReason(s, fixed.id, start, end, planId, v) === "gender";
  // A fixed room skips choosing the room, and a whole unit (one bookable place) skips choosing the bed too.
  const visible = [0, 1, 2, 3, 4].filter((i) => !(fixed && i === 1) && !(fixedWhole && i === 2));
  const go = (to: number) => {
    // Leaving the first step with a fixed room picks its first free bed for the chosen dates.
    if (fixed && step === 0) pickRoom(fixed.id);
    setStep(to);
  };
  const nextStep = visible.find((i) => i > step);
  const prevStep = [...visible].reverse().find((i) => i < step);
  // Whether each step (but the last) is complete enough to move past it.
  const ready = [
    !!g.gender && datesOk && !unavailable,
    !!room,
    !!sel && (!sel.blocked || sel.own),
    !!g.name.trim() && !!g.phone.trim() && !!g.idNumber.trim(),
  ];
  const canOpen = (i: number) => ready.slice(0, i).every(Boolean);

  const save = () => {
    const kind = s.properties.find((p) => p.id === propertyId)?.type === "student" ? "student" : "guest";
    if (!g.gender || !bedId) return;
    const res = actions.createBooking({ guest: { ...g, gender: g.gender, kind }, bedId, start, end, planId, scenario: scenarioMode });
    if (!res.ok) { setError(res.error); toast.error(res.error); return; }
    setError(null);
    setSaved({ id: res.data!.id, code: res.data!.code, key });
    toast.success(t(`تم حفظ الحجز ${res.data!.code} بحالة «قيد المراجعة»`, `Booking ${res.data!.code} saved as Under review`));
    if (getState().scenario.tourActive && scenarioMode) actions.tour({ step: 2 });
    navigate({ to: "/bookings", search: { status: "pending", created: res.data!.id } });
  };

  const buildingName = (id: string) => s.buildings.find((b) => b.id === id)?.name;
  const property = s.properties.find((p) => p.id === propertyId);
  const Prev = s.lang === "ar" ? ChevronRight : ChevronLeft;
  const Next = s.lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div>
      <PageHeader
        title={t("حجز جديد", "New booking")}
        subtitle={t("مرحلة الحجز: حجز سرير لفترة محددة. المستندات والدفع تُستكمل لاحقًا عند التسكين.", "Booking stage: reserve a bed for a period. Documents and payment are completed at check-in.")}
      />
      {!allowed && <RoleNote />}
      {error && (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">
          <ShieldAlert className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">{t("تم رفض الحجز", "Booking rejected")}</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      <ol className={cn("mb-4 grid gap-2", visible.length === 5 ? "grid-cols-5" : visible.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {visible.map((i, n) => {
          const [ar, en] = STEPS[i];
          const done = i < step;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!canOpen(i)}
                onClick={() => go(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border p-2 text-start text-xs transition disabled:opacity-50 sm:p-3 sm:text-sm",
                  i === step ? "border-primary bg-primary-soft font-semibold" : "bg-card hover:border-primary/40",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs", i === step || done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {done ? <Check className="size-3.5" /> : num(n + 1)}
                </span>
                <span className="hidden sm:inline">{t(ar, en)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title={`${num(visible.indexOf(step) + 1)}. ${t(...STEPS[step])}`}>
            {step === 0 && (
              <div className="space-y-4">
                {fixed && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm">
                    <span>{t("حجز", "Booking")} <b>{fixed.code}</b> · {t(...ROOM_TYPE[fixed.type])}{fixed.type === "hotel" && ` · ${fixed.sleeps === 1 ? t("فردي", "single") : t("ثنائي", "double")}`}</span>
                    <Button variant="link" className="h-auto p-0" onClick={() => { setFixedId(null); setRoom(null); setBed(""); }}>{t("اختيار غرفة أخرى", "Choose another room")}</Button>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("المنشأة", "Property")}>
                    <Select value={propertyId} disabled={!!fixed} onValueChange={(v) => { setProperty(v); resetRoom(); setPlan(v === "p1" ? "pl-month" : v === "p2" ? "pl-night" : "pl-week"); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{s.properties.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("خطة السعر", "Rate plan")}>
                    <Select value={planId} onValueChange={(v) => { setPlan(v); resetRoom(); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{s.plans.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)} — {money(p.price)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("بداية الإقامة", "Start")}><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); resetRoom(); }} /></Field>
                  <Field label={t("نهاية الإقامة", "End")}><Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); resetRoom(); }} /></Field>
                </div>
                {!datesOk && <p className="text-xs text-destructive">{t("تواريخ الإقامة غير صحيحة لهذه الخطة", "Dates are not valid for this plan")}</p>}
                {fixed && unavailable && (
                  <p className="flex items-center gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {unavailable === "maintenance" ? t(`${fixed.code} محجوبة للصيانة.`, `${fixed.code} is blocked for maintenance.`)
                      : unavailable === "plan" ? t(`خطة السعر لا تناسب ${fixed.code}؛ اختر الخطة المناسبة لها.`, `This rate plan doesn't fit ${fixed.code}; pick the one that does.`)
                      : unavailable === "gender" ? t(`${fixed.code} يسكنها ${g.gender === "male" ? "بنات" : "أولاد"} في هذه الفترة.`, `${fixed.code} houses ${g.gender === "male" ? "girls" : "boys"} for these dates.`)
                      : t(`${fixed.code} محجوزة في هذه الفترة؛ غيّر التواريخ أو اختر غرفة أخرى.`, `${fixed.code} is booked for these dates; change them or choose another room.`)}
                  </p>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">{t("نوع السكن", "Housing type")}</Label>
                  <div className="mt-1.5 grid max-w-sm grid-cols-2 gap-2">
                    {(["male", "female"] as const).map((v) => (
                      <Button key={v} type="button" variant={g.gender === v ? "default" : "outline"} disabled={blockedGender(v)} onClick={() => { if (g.gender !== v) { setG({ ...g, gender: v }); resetRoom(); } }}>
                        {v === "male" ? t("سكن أولاد", "Boys") : t("سكن بنات", "Girls")}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 &&
              (roomOptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("لا توجد غرف متاحة لهذه الفترة ونوع السكن", "No rooms available for this period and housing type")}</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {t(`${num(roomOptions.length)} غرفة متاحة ${g.gender === "male" ? "لسكن الأولاد" : "لسكن البنات"} من ${start} إلى ${end}`, `${roomOptions.length} rooms open to ${g.gender === "male" ? "boys" : "girls"}, ${start} → ${end}`)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {roomOptions.map(({ room: r, free, total }) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pickRoom(r.id)}
                        className={cn("rounded-xl border bg-success-soft p-3 text-start transition", r.id === roomId ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40")}
                      >
                        <p className="text-sm font-semibold">{r.code}</p>
                        <p className="text-xs text-muted-foreground">{t("مبنى", "Building")} {buildingName(r.buildingId)} · {t(...ROOM_TYPE[r.type])}{r.type === "hotel" && ` · ${r.sleeps === 1 ? t("فردي", "single") : t("ثنائي", "double")}`}</p>
                        {/* A hotel room or apartment is booked whole, so it has no beds to count. */}
                        <p className="mt-1 text-xs text-success">{r.type === "hotel" || r.type === "apartment" ? t("متاحة", "Free") : t(`${num(free.length)} من ${num(total)} سرير متاح`, `${free.length}/${total} beds free`)}</p>
                      </button>
                    ))}
                  </div>
                </>
              ))}

            {step === 2 && room && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {bedStatus.map(({ bed, conflict, own, blocked, occupiedNow }) => (
                  <button
                    key={bed.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => setBed(bed.id)}
                    className={cn(
                      "rounded-xl border p-3 text-start transition disabled:cursor-not-allowed",
                      bed.id === bedId ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
                      own ? "bg-primary-soft" : blocked ? "bg-destructive-soft" : "bg-success-soft",
                    )}
                  >
                    <BedDouble className={cn("size-5", own ? "text-primary" : blocked ? "text-destructive" : "text-success")} />
                    <p className="mt-1 text-sm font-semibold">{bed.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {own ? `${t("حجزك", "Your booking")} ${mine!.code}` : blocked ? (conflict ? `${t("محجوز", "Booked")} ${conflict.code}` : room.hk === "maintenance" ? t("خارج الخدمة", "Out of service") : t("غير متاح", "Unavailable")) : t("متاح للفترة", "Available")}
                      {occupiedNow && ` · ${t("مشغول حاليًا", "occupied now")}`}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <>
                {scenarioMode && <Pill tone="primary" className="mb-3">{t("بيانات السيناريو التجريبي", "Scenario demo data")}</Pill>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("الاسم", "Name")}><Input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></Field>
                  <Field label={t("الهاتف", "Phone")}><Input value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} /></Field>
                  <Field label={t("البريد الإلكتروني", "Email")}><Input value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} /></Field>
                  <Field label={t("الجامعة / الجهة", "University / company")}><Input value={g.org} onChange={(e) => setG({ ...g, org: e.target.value })} /></Field>
                  <GuestIdFields value={g} onChange={(v) => setG({ ...g, ...v })} />
                </div>
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="size-4 shrink-0" />
                  {t("صور المستندات (الهوية، القيد، الصورة الشخصية) تُستلم عند التسكين وليس الآن.", "Document copies (ID, enrollment, photo) are collected at check-in, not now.")}
                </p>
              </>
            )}

            {step === 4 && room && (
              <div className="space-y-4">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <D k={t("الطالب / النزيل", "Guest")} v={`${g.name} · ${g.phone}`} />
                  <D k={t("نوع السكن", "Housing type")} v={g.gender === "male" ? t("سكن أولاد", "Boys") : t("سكن بنات", "Girls")} />
                  <D k={t("المنشأة", "Property")} v={property ? t(property.name, property.nameEn) : "—"} />
                  <D k={t("الغرفة والسرير", "Room & bed")} v={`${room.code} / ${sel?.bed.label ?? "—"}`} />
                  <D k={t("فترة الإقامة", "Period")} v={`${start} → ${end}`} />
                  <D k={t("خطة السعر", "Plan")} v={t(plan.name, plan.nameEn)} />
                </dl>
                {sel?.own ? (
                  <div className="flex gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"><CheckCircle2 className="size-5 shrink-0" />{t(`تم حجز ${room.code} / ${sel.bed.label} بالحجز ${mine!.code} (قيد المراجعة)`, `${room.code} / ${sel.bed.label} booked as ${mine!.code} (under review)`)}</div>
                ) : sel && !sel.blocked ? (
                  <div className="flex gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"><CheckCircle2 className="size-5 shrink-0" />{t(`${room.code} / ${sel.bed.label} متاح من ${start} إلى ${end}`, `${room.code} / ${sel.bed.label} available ${start} → ${end}`)}</div>
                ) : (
                  <div className="flex gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{sel?.conflict ? t(`متعارض مع ${sel.conflict.code} (${sel.conflict.start} → ${sel.conflict.end})`, `Conflicts with ${sel.conflict.code}`) : t("السرير غير متاح", "Bed unavailable")}</div>
                )}
                <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">{t("بعد الحفظ", "After saving")}</p>
                  <p>{t("١. يُراجَع الحجز ويُؤكَّد ← يُنشأ العقد والفاتورة.", "1. The booking is reviewed and confirmed → contract and invoice are created.")}</p>
                  <p>{t("٢. يوم الوصول: استلام المستندات وتحصيل الدفعة الأولى والتأمين، ثم التسكين.", "2. Arrival day: collect documents, the first installment and deposit, then check in.")}</p>
                </div>
                <Button className="w-full" size="lg" onClick={save} disabled={!allowed || !!mine || !ready.every(Boolean)}>{t("حفظ الحجز (قيد المراجعة)", "Save booking (under review)")}</Button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <Button variant="ghost" disabled={prevStep === undefined} onClick={() => prevStep !== undefined && setStep(prevStep)}>
                <Prev className="size-4" /> {t("السابق", "Back")}
              </Button>
              {nextStep !== undefined && (
                <Button disabled={!ready[step]} onClick={() => go(nextStep)}>
                  {t("التالي", "Next")} <Next className="size-4" />
                </Button>
              )}
            </div>
          </Section>
        </div>

        {/* Rows fill in as their step is reached, so prefilled scenario data doesn't show ahead of the wizard. */}
        <Section title={t("ملخص الحجز", "Booking summary")}>
          <dl className="space-y-2 text-sm">
            <Row k={t("الفترة", "Period")} v={datesOk ? `${start} → ${end}` : "—"} />
            <Row k={t("نوع السكن", "Housing")} v={g.gender ? (g.gender === "male" ? t("أولاد", "Boys") : t("بنات", "Girls")) : "—"} />
            <Row k={t("الغرفة", "Room")} v={((step >= 1 || fixed) && room?.code) || "—"} />
            <Row k={t("السرير", "Bed")} v={(step >= 2 && sel?.bed.label) || "—"} />
            <Row k={t("الطالب", "Guest")} v={(step >= 3 && g.name) || "—"} />
          </dl>
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <Row k={t("رسوم الإقامة", "Accommodation")} v={money(rent)} />
            <Row k={t("التأمين (منفصل عن الإيراد)", "Deposit (separate)")} v={money(plan.deposit)} />
            <div className="border-t pt-2"><Row k={<b>{t("إجمالي الفاتورة", "Invoice total")}</b>} v={<b className="text-lg text-primary">{money(rent + plan.deposit)}</b>} /></div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("أرقام توضيحية للعرض وليست أسعارًا معتمدة.", "Illustrative figures only.")}</p>
        </Section>
      </div>
    </div>
  );
}

export function RoleNote() {
  const t = useT();
  return <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{t("الدور الحالي لا يملك صلاحية تنفيذ هذا الإجراء. غيّر الدور من القائمة العلوية (محاكاة).", "Current role can't perform this action. Switch role from the top bar (simulation).")}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-end tabular-nums">{v}</dd></div>;
}
function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>;
}
