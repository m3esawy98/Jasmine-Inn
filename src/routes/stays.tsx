import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlarmClock, BedDouble, Check, CheckCircle2, ClipboardCheck, LogIn, LogOut, Undo2, Wallet, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Pill, Section, run } from "@/components/stay/kit";
import { actions, activeStayOnBed, bedLabel, bedProperty, can, checkInBlockers, checkInPayment, checkoutSettlement, DEMO_TODAY, getState, guestName, inScope, inspectionChecklist, invoiceBalance, useDemo } from "@/lib/demo/store";
import { addDays } from "@/lib/demo/calc";
import type { Booking, ItemCondition, PayMethod } from "@/lib/demo/types";
import { METHOD, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stays")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: s.tab === "arr" || s.tab === "in" || s.tab === "out" || s.tab === "late" ? s.tab : undefined }),
  head: () => meta("الإقامة والتسكين", "الوصول المتوقع وتسجيل الدخول والمغادرة مع قوائم تحقق منظمة."),
  component: Stays,
});

/** Arrivals and departures look this many days ahead of today. */
const WINDOW_DAYS = 7;
type Group = { key: string; label: string; tone: string; items: Booking[] };

function Stays() {
  const s = useDemo();
  const t = useT();
  const num = (n: number) => n.toLocaleString(s.lang === "ar" ? "ar-EG" : "en");
  const scoped = (b: Booking) => { const p = bedProperty(s, b.bedId); return !p || inScope(s, p.id); };
  const horizon = addDays(DEMO_TODAY, WINDOW_DAYS);
  const order = (key: (b: Booking) => string) => (a: Booking, b: Booking) => (b.scenario ? 1 : 0) - (a.scenario ? 1 : 0) || key(a).localeCompare(key(b));
  const soon = t(`خلال ${num(WINDOW_DAYS)} أيام`, `Next ${WINDOW_DAYS} days`);
  // Split by date relative to today: late, today, then the coming week.
  const byDate = (list: Booking[], key: (b: Booking) => string, late: string, today: string): Group[] =>
    [
      { key: "late", label: late, tone: "destructive", items: list.filter((b) => key(b) < DEMO_TODAY) },
      { key: "today", label: today, tone: "primary", items: list.filter((b) => key(b) === DEMO_TODAY) },
      { key: "soon", label: soon, tone: "muted", items: list.filter((b) => key(b) > DEMO_TODAY) },
    ].map((g) => ({ ...g, items: g.items.sort(order(key)) }));

  const confirmed = s.bookings.filter((b) => b.status === "confirmed" && b.start <= horizon && scoped(b));
  const checkedIn = s.bookings.filter((b) => b.status === "checked_in" && scoped(b)).sort(order((b) => b.end));
  // Residents past their departure date get their own tab and are left out of the others.
  const overstays = checkedIn.filter((b) => b.end < DEMO_TODAY);
  const inhouse = checkedIn.filter((b) => b.end >= DEMO_TODAY);
  const leaving = inhouse.filter((b) => b.end <= horizon);
  const arrivals = byDate(confirmed, (b) => b.start, t("متأخر عن موعد الوصول", "Late arrival"), t("وصول اليوم", "Arriving today"));
  const departures = byDate(leaving, (b) => b.end, t("تجاوز موعد المغادرة", "Past departure date"), t("مغادرة اليوم", "Leaving today"));

  const scenarioIn = s.bookings.find((b) => b.id === s.scenario.bookingId)?.status === "checked_in";
  const search = Route.useSearch();
  const [tab, setTab] = useState<string>(search.tab ?? (scenarioIn ? "in" : "arr"));
  const [sel, setSel] = useState<string | null>(null);
  // The resident just checked in from this page, listed first under In-house.
  const [justIn, setJustIn] = useState<string | null>(null);
  const residents = justIn ? [...inhouse].sort((a, b) => (b.id === justIn ? 1 : 0) - (a.id === justIn ? 1 : 0)) : inhouse;
  return (
    <div>
      <PageHeader
        title={t("الإقامة والتسكين", "Stays & check-in")}
        subtitle={t(`اليوم ${DEMO_TODAY} · الإشغال الفعلي يبدأ عند تسجيل الدخول وينتهي عند تسجيل المغادرة.`, `Today ${DEMO_TODAY} · actual occupancy runs from check-in to check-out.`)}
      />
      <Tabs dir={s.lang === "ar" ? "rtl" : "ltr"} value={tab} onValueChange={(v) => { setTab(v); setSel(null); }}>
        <TabsList>
          <TabsTrigger value="arr" className="gap-1.5"><LogIn className="size-4" />{t("تسجيل الدخول", "Check-in")} ({num(confirmed.length)})</TabsTrigger>
          <TabsTrigger value="in" className="gap-1.5"><BedDouble className="size-4" />{t("المقيمون حاليًا", "In-house")} ({num(inhouse.length)})</TabsTrigger>
          <TabsTrigger value="out" className="gap-1.5"><LogOut className="size-4" />{t("تسجيل المغادرة", "Check-out")} ({num(leaving.length)})</TabsTrigger>
          <TabsTrigger value="late" className={cn("gap-1.5", overstays.length > 0 && "text-destructive data-[state=active]:text-destructive")}><AlarmClock className="size-4" />{t("تجاوز موعد المغادرة", "Past departure date")} ({num(overstays.length)})</TabsTrigger>
        </TabsList>
        <TabsContent value="arr">
          <Split groups={arrivals} sel={sel} setSel={setSel} date={(b) => b.start} empty={t(`لا يوجد وصول متوقع خلال ${num(WINDOW_DAYS)} أيام`, `No arrivals in the next ${WINDOW_DAYS} days`)}>
            {(b) => <ArrivalPanel key={b.id} b={b} onCheckedIn={() => { setJustIn(b.id); setTab("in"); setSel(b.id); }} />}
          </Split>
        </TabsContent>
        <TabsContent value="in">
          <Split groups={[{ key: "all", label: "", tone: "muted", items: residents }]} fresh={justIn} sel={sel} setSel={setSel} date={(b) => b.end} empty={t("لا يوجد مقيمون حاليًا", "Nobody in-house")}>
            {(b) => <ResidentPanel key={b.id} b={b} />}
          </Split>
        </TabsContent>
        <TabsContent value="out">
          <Split groups={departures} sel={sel} setSel={setSel} date={(b) => b.end} empty={t(`لا توجد مغادرة متوقعة خلال ${num(WINDOW_DAYS)} أيام`, `No departures in the next ${WINDOW_DAYS} days`)}>
            {(b) => <ResidentPanel key={b.id} b={b} title={t("مغادرة متوقعة", "Expected departure")} />}
          </Split>
        </TabsContent>
        <TabsContent value="late">
          <Split groups={[{ key: "all", label: "", tone: "muted", items: overstays }]} sel={sel} setSel={setSel} date={(b) => b.end} empty={t("لا يوجد مقيمون تجاوزوا موعد المغادرة", "Nobody is past their departure date")}>
            {(b) => <ResidentPanel key={b.id} b={b} title={t("تجاوز موعد المغادرة", "Past departure date")} />}
          </Split>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Split({ groups, fresh, sel, setSel, date, empty, children }: { groups: Group[]; fresh?: string | null; sel: string | null; setSel: (v: string) => void; date: (b: Booking) => string; empty: string; children: (b: Booking) => ReactNode }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const all = groups.flatMap((g) => g.items);
  const current = all.find((b) => b.id === sel) ?? all[0];
  // Bring a booking picked from elsewhere (e.g. just checked in) into view in the list.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = listRef.current;
    const el = sel ? box?.querySelector(`[data-id="${sel}"]`) : null;
    if (!box || !el) return;
    // Scroll the list only (scrollIntoView would also move the page).
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (top < 0 || top > box.clientHeight - 60) box.scrollTop += top - box.clientHeight / 3;
  }, [sel]);
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section className="lg:col-span-2">
        <div ref={listRef} className="max-h-[640px] space-y-3 overflow-y-auto">
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.key}>
              {g.label && <p className="mb-1 px-2"><Pill tone={g.tone}>{g.label}</Pill></p>}
              <ul className="divide-y">
                {g.items.map((b) => (
                  <li key={b.id}>
                    <button data-id={b.id} onClick={() => setSel(b.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-start text-sm", current?.id === b.id && "bg-primary-soft")}>
                      <span><span className="font-medium">{guestName(s, b.guestId)}</span>{b.scenario && <Pill tone="primary" className="ms-2">{t("السيناريو", "Scenario")}</Pill>}{b.id === fresh && <Pill tone="success" className="ms-2">{t("تم الدخول الآن", "Just checked in")}</Pill>}<span className="block text-xs text-muted-foreground">{bedLabel(s, b.bedId)}</span></span>
                      <span className="text-xs text-muted-foreground">{fmt(date(b))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {all.length === 0 && <p className="p-4 text-sm text-muted-foreground">{empty}</p>}
        </div>
      </Section>
      <div className="lg:col-span-3">{current && children(current)}</div>
    </div>
  );
}

type StepDef = { title: string; who: string; done: boolean; note?: ReactNode; body?: ReactNode };

/** Numbered checklist: finished steps collapse to a summary line (details on demand), open steps show their controls. */
function Steps({ steps }: { steps: StepDef[] }) {
  const s = useDemo();
  const t = useT();
  const [shown, setShown] = useState<number[]>([]);
  return (
    <ol className="space-y-2">
      {steps.map((st, i) => {
        const open = !st.done || shown.includes(i);
        return (
          <li key={i} className={cn("rounded-lg border p-3", st.done ? "border-success/30 bg-success-soft/60" : "bg-card")}>
            <div className="flex items-start gap-3">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", st.done ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
                {st.done ? <Check className="size-3.5" /> : (i + 1).toLocaleString(s.lang === "ar" ? "ar-EG" : "en")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{st.title}</p>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{st.who}</span>
                    {st.done && st.body && (
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShown(open ? shown.filter((x) => x !== i) : [...shown, i])}>
                        {open ? t("إخفاء", "Hide") : t("التفاصيل", "Details")}
                      </Button>
                    )}
                  </span>
                </div>
                {st.note && <div className="mt-0.5 text-xs text-muted-foreground">{st.note}</div>}
                {open && st.body && <div className="mt-3">{st.body}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function GuestHeader({ b, children }: { b: Booking; children?: ReactNode }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-base font-semibold">{guestName(s, b.guestId)}</p>
        <p className="text-xs text-muted-foreground">{bedLabel(s, b.bedId)} · <Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">{b.code}</Link> · {fmt(b.start)} — {fmt(b.end)}</p>
      </div>
      {children}
      {!children && b.scenario && <Pill tone="primary">{t("السيناريو", "Scenario")}</Pill>}
    </div>
  );
}

/** An expected arrival: booking summary first; the check-in steps open on demand. */
function ArrivalPanel({ b, onCheckedIn }: { b: Booking; onCheckedIn: () => void }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  if (open) return <CheckInPanel b={b} onCheckedIn={onCheckedIn} />;
  const pay = checkInPayment(s, b);
  const docs = [b.docs.id, b.docs.enrollment, b.docs.photo].filter(Boolean).length;
  return (
    <Section title={t("وصول متوقع", "Expected arrival")}>
      <GuestHeader b={b} />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{t("موعد الوصول", "Arrival")}</dt><dd>{fmt(b.start)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("نهاية العقد", "Contract end")}</dt><dd>{fmt(b.end)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("المستندات", "Documents")}</dt><dd>{t(`${docs.toLocaleString("ar-EG")} من ٣`, `${docs} of 3`)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("الدفعة الأولى والتأمين", "First installment & deposit")}</dt><dd>{pay ? money(pay.due) : "—"}</dd></div>
      </dl>
      <Button size="lg" className="mt-4 w-full" disabled={!can(s.role, "stay.checkin")} onClick={() => setOpen(true)}><LogIn className="size-4" />{t("تسجيل الدخول", "Check in")}</Button>
    </Section>
  );
}

function CheckInPanel({ b, onCheckedIn }: { b: Booking; onCheckedIn: () => void }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const [method, setMethod] = useState<PayMethod>("cash");
  const [ref, setRef] = useState("");
  const g = s.guests.find((x) => x.id === b.guestId)!;
  const bed = s.beds.find((x) => x.id === b.bedId)!;
  const room = s.rooms.find((r) => r.id === bed.roomId)!;
  const occupant = activeStayOnBed(s, b.bedId);
  const blockers = checkInBlockers(s, b);
  const pay = checkInPayment(s, b);
  const payOk = !!pay && pay.paid >= pay.due;
  const docsOk = b.docs.id && b.docs.enrollment && b.docs.photo;
  const bedOk = room.hk === "ready" && !occupant;
  const early = b.start > DEMO_TODAY;
  const docs: [keyof Booking["docs"], string, string][] = [
    ["id", g.idType === "passport" ? "صورة جواز السفر" : "صورة بطاقة الرقم القومي", g.idType === "passport" ? "Passport copy" : "National ID copy"],
    ["enrollment", g.kind === "student" ? "إثبات القيد الجامعي" : "بيانات الجهة", "Enrollment / company proof"],
    ["photo", "صورة شخصية", "Photo"],
  ];
  const collect = () => {
    if (!pay) return;
    const amount = Math.min(pay.due - pay.paid, pay.balance);
    run(actions.recordPayment(pay.invoiceId, amount, method, ref), t(`تم تحصيل ${money(amount)} وإصدار الإيصال`, `Collected ${money(amount)}; receipt issued`));
  };
  const steps: StepDef[] = [
    {
      title: t("جاهزية السرير", "Bed ready"),
      who: t("النظافة", "Housekeeping"),
      done: bedOk,
      note: bedOk
        ? t(`${room.code} معتمدة والسرير فاضي`, `${room.code} approved and the bed is free`)
        : occupant
          ? t(`السرير لسه مشغول بمقيم حالي (${guestName(s, s.bookings.find((x) => x.id === occupant.bookingId)?.guestId ?? "")})`, "The bed is still occupied by a current resident")
          : t(`الغرفة ${room.code} لم تُعتمد جاهزيتها بعد — راجع مهام النظافة`, `Room ${room.code} not approved yet — see housekeeping`),
    },
    {
      title: t("استلام المستندات", "Receive documents"),
      who: t("الاستقبال", "Front desk"),
      done: docsOk,
      note: docsOk ? t("تم استلام كل المستندات", "All documents received") : t(`${docs.filter(([k]) => b.docs[k]).length.toLocaleString("ar-EG")} من ٣`, `${docs.filter(([k]) => b.docs[k]).length} of 3`),
      body: (
        <div className="flex flex-wrap gap-4">
          {docs.map(([k, ar, en]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm"><Checkbox checked={b.docs[k]} disabled={!can(s.role, "stay.checkin")} onCheckedChange={() => actions.toggleDoc(b.id, k)} />{t(ar, en)}</label>
          ))}
        </div>
      ),
    },
    {
      title: t("تحصيل الدفعة الأولى والتأمين", "Collect first installment & deposit"),
      who: t("الاستقبال", "Front desk"),
      done: payOk,
      note: pay ? t(`${money(Math.min(pay.paid, pay.due))} من ${money(pay.due)}`, `${money(Math.min(pay.paid, pay.due))} of ${money(pay.due)}`) : t("لا توجد فاتورة لهذا الحجز", "No invoice for this booking"),
      body: pay && !payOk && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(METHOD).map(([k, v]) => <SelectItem key={k} value={k}>{t(...v)}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-8 w-40 text-xs" placeholder={t("المرجع (اختياري)", "Reference (optional)")} value={ref} onChange={(e) => setRef(e.target.value)} />
          <Button size="sm" disabled={!can(s.role, "payment.record")} onClick={collect}>
            <Wallet className="size-4" /> {t(`تحصيل ${money(pay.due - pay.paid)}`, `Collect ${money(pay.due - pay.paid)}`)}
          </Button>
        </div>
      ),
    },
    {
      title: t("تسليم السرير وتسجيل الدخول", "Hand over the bed and check in"),
      who: t("الاستقبال", "Front desk"),
      done: false,
      note: early ? t(`موعد الوصول ${fmt(b.start)}`, `Arrival date ${fmt(b.start)}`) : undefined,
      body: (
        <>
          {blockers.length > 0 && <p className="mb-2 text-xs text-destructive">{t("أكمل الخطوات السابقة أولًا: ", "Finish the steps above first: ")}{blockers.join(" • ")}</p>}
          <Button size="lg" className="w-full" disabled={blockers.length > 0 || !can(s.role, "stay.checkin")} onClick={() => {
            if (!run(actions.checkIn(b.id), t("تم تسجيل الدخول وبدء الإقامة الفعلية", "Checked in"))) return;
            // The tour moves on to the invoice step; its "Continue" button opens the invoice when wanted.
            if (b.scenario && getState().scenario.tourActive) actions.tour({ step: 4 });
            onCheckedIn();
          }}><LogIn className="size-4" />{t("تسجيل الدخول", "Check in")}</Button>
        </>
      ),
    },
  ];
  return (
    <Section title={t("تسجيل الدخول", "Check-in")}>
      <GuestHeader b={b} />
      <Steps steps={steps} />
    </Section>
  );
}

/** A resident: stay summary first; the check-out steps open on demand (and stay open once started). */
function ResidentPanel({ b, title }: { b: Booking; title?: string }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const [leaving, setLeaving] = useState(!!b.inspection);
  if (leaving) return <CheckOutPanel b={b} />;
  const inv = s.invoices.find((i) => i.bookingId === b.id);
  const stay = s.stays.find((x) => x.bookingId === b.id && x.status === "active");
  const bal = inv ? invoiceBalance(s, inv.id) : 0;
  return (
    <Section title={title ?? t("مقيم حاليًا", "In-house")}>
      <GuestHeader b={b} />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{t("وقت الوصول", "Checked in")}</dt><dd>{stay ? fmt(stay.checkInAt, true) : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("نهاية العقد", "Contract end")}</dt><dd>{fmt(b.end)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("الرصيد", "Balance")}</dt><dd className={cn("font-semibold", bal > 0 ? "text-destructive" : "text-success")}>{money(bal)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("الفاتورة", "Invoice")}</dt><dd>{inv ? <Link to="/finance/$id" params={{ id: inv.id }} className="text-primary">{inv.code}</Link> : "—"}</dd></div>
      </dl>
      <Button variant="outline" className="mt-4 w-full" onClick={() => setLeaving(true)}><LogOut className="size-4" />{b.end > DEMO_TODAY ? t("بدء إجراءات مغادرة مبكرة", "Start early check-out") : t("بدء إجراءات المغادرة", "Start check-out")}</Button>
    </Section>
  );
}

function CheckOutPanel({ b }: { b: Booking }) {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const navigate = useNavigate();
  const [early, setEarly] = useState(false);
  const inv = s.invoices.find((i) => i.bookingId === b.id);
  const bal = inv ? invoiceBalance(s, inv.id) : 0;
  const isEarly = DEMO_TODAY < b.end;
  const inspected = b.inspection?.status === "approved";
  const settlement = checkoutSettlement(s, b);
  const due = settlement.balanceAfter;
  const plan = s.plans.find((p) => p.id === b.planId)!;
  const [method, setMethod] = useState<PayMethod>("cash");
  const [ref, setRef] = useState("");
  const dateOk = !isEarly || early;
  const steps: StepDef[] = [
    {
      title: t("موعد المغادرة", "Departure date"),
      who: t("المدير", "Manager"),
      done: dateOk,
      note: isEarly
        ? t(`مغادرة مبكرة — نهاية العقد ${fmt(b.end)}.`, `Early departure — contract ends ${fmt(b.end)}.`) +
          (settlement.early
            ? t(
                ` يُحتسب الإيجار حتى ${PERIOD_NAME[plan.period][2]} + غرامة ${PERIOD_NAME[plan.period][0]}، وتُلغى المدة الباقية.`,
                ` Rent runs through the current ${PERIOD_NAME[plan.period][1]} plus a one-${PERIOD_NAME[plan.period][1]} penalty; the rest is dropped.`,
              )
            : "") : DEMO_TODAY > b.end
          ? t(`متأخرة — نهاية العقد كانت ${fmt(b.end)}`, `Late — the contract ended ${fmt(b.end)}`)
          : t(`في موعدها (${fmt(b.end)})`, `On time (${fmt(b.end)})`),
      body: isEarly && (
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(!!v)} />{t("اعتماد مغادرة مبكرة (معتمدة داخل السيناريو التجريبي)", "Approve early departure (demo)")}</label>
      ),
    },
    {
      title: t("فحص الغرفة", "Room inspection"),
      who: t("الاستقبال يكلّف · النظافة تفحص", "Front desk assigns · housekeeping inspects"),
      done: inspected,
      note: inspected
        ? b.inspection!.total > 0 ? t(`خصومات معتمدة ${money(b.inspection!.total)}`, `Approved charges ${money(b.inspection!.total)}`) : t(`${b.inspection!.by}: كل المحتويات سليمة`, `${b.inspection!.by}: everything in good condition`)
        : b.inspection?.status === "pending_approval" ? t("بانتظار اعتماد المدير للخصومات", "Waiting for manager approval")
        : b.inspection?.status === "reported" ? t(`${b.inspection.by} أبلغ أن الغرفة سليمة — بانتظار تأكيدك`, `${b.inspection.by} reports the room is fine — confirm to continue`)
        : b.inspectionRequest ? t(`تم تكليف ${b.inspectionRequest.assignee} — بانتظار التقرير`, `${b.inspectionRequest.assignee} assigned — waiting for the report`)
        : undefined,
      body: <InspectionCard key={b.id} b={b} />,
    },
    {
      title: t("التسوية وتأكيد المغادرة", "Settle and check out"),
      who: t("الاستقبال", "Front desk"),
      done: false,
      body: (
        <>
          <dl className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
            <Line k={t("الرصيد الحالي على الفاتورة", "Current invoice balance")} v={money(bal)} />
            {inspected ? (
              <>
                {settlement.early && (
                  <>
                    <Line k={t("إلغاء المدة المتبقية (مغادرة مبكرة)", "Remaining stay cancelled (early departure)")} v={`− ${money(settlement.early.unused)}`} tone="text-success" />
                    <Line k={t(`غرامة مغادرة مبكرة (${PERIOD_NAME[plan.period][0]})`, `Early departure penalty (one ${PERIOD_NAME[plan.period][1]})`)} v={`+ ${money(settlement.early.penalty)}`} tone="text-destructive" />
                  </>
                )}
                {settlement.deposit > 0 && <Line k={t("رد التأمين", "Deposit returned")} v={`− ${money(settlement.deposit)}`} tone="text-success" />}
                {settlement.damages > 0 && <Line k={t("خصومات الفحص المعتمدة", "Approved inspection charges")} v={`+ ${money(settlement.damages)}`} tone="text-destructive" />}
                <div className="flex justify-between border-t pt-1 text-sm font-semibold">
                  <dt>{due > 0 ? t("المطلوب سداده قبل المغادرة", "To pay before leaving") : due < 0 ? t("يُرد للنزيل قبل المغادرة", "To refund before leaving") : t("لا يوجد مستحق", "Nothing outstanding")}</dt>
                  <dd className={due > 0 ? "text-destructive" : "text-success"}>{money(Math.abs(due))}</dd>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">{t("تُحسب التسوية بعد فحص الغرفة: التأمين يُرد مقابل المستحق، والخصومات تُخصم منه أولًا.", "Settlement is calculated after the room inspection.")}</p>
            )}
          </dl>
          {inspected && due !== 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHOD).map(([k, v]) => <SelectItem key={k} value={k}>{t(...v)}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="h-8 w-40 text-xs" placeholder={t("المرجع (اختياري)", "Reference (optional)")} value={ref} onChange={(e) => setRef(e.target.value)} />
              <Button size="sm" disabled={!can(s.role, "payment.record")} onClick={() => run(actions.settleCheckout(b.id, method, ref), due > 0 ? t(`تم تحصيل ${money(due)} وإصدار الإيصال`, `Collected ${money(due)}; receipt issued`) : t(`تم رد ${money(-due)} للنزيل`, `Refunded ${money(-due)} to the guest`))}>
                {due > 0 ? <Wallet className="size-4" /> : <Undo2 className="size-4" />}
                {due > 0 ? t(`تحصيل ${money(due)}`, `Collect ${money(due)}`) : t(`رد ${money(-due)} للنزيل`, `Refund ${money(-due)}`)}
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("ستُنشأ مهمة تنظيف للغرفة بعد التأكيد.", "A cleaning task will be created.")}</p>
          {(!dateOk || !inspected) && <p className="mt-2 text-xs text-destructive">{t("أكمل الخطوات السابقة أولًا.", "Finish the steps above first.")}</p>}
          {inspected && dateOk && due !== 0 && (
            <p className="mt-2 text-xs text-destructive">
              {due > 0 ? t("حصّل المستحق أولًا لتأكيد المغادرة.", "Collect what is owed before confirming check-out.") : t("رد المبلغ للنزيل أولًا لتأكيد المغادرة.", "Refund the guest before confirming check-out.")}
            </p>
          )}
          <Button size="lg" variant="destructive" className="mt-3 w-full" disabled={!inspected || !dateOk || due !== 0 || !can(s.role, "stay.checkout")} onClick={() => {
            if (!run(actions.checkOut(b.id, early), t("تم تسجيل المغادرة وتسوية التأمين وإنشاء مهمة تنظيف", "Checked out; deposit settled; cleaning task created"))) return;
            if (b.scenario && getState().scenario.tourActive) actions.tour({ step: 6 });
            // Continue straight to the room's new cleaning task.
            const task = getState().tasks.find((x) => x.source === b.code && x.status === "new");
            navigate({ to: "/housekeeping", search: { task: task?.id } });
          }}><LogOut className="size-4" />{t("تأكيد المغادرة", "Confirm check-out")}</Button>
        </>
      ),
    },
  ];
  return (
    <Section title={t("تسجيل مغادرة", "Check-out")}>
      <GuestHeader b={b} />
      <Steps steps={steps} />
    </Section>
  );
}

// [penalty unit, English unit, "through the current …"]
const PERIOD_NAME: Record<string, [string, string, string]> = {
  daily: ["ليلة", "night", "الليلة الحالية"],
  weekly: ["أسبوع", "week", "الأسبوع الحالي"],
  monthly: ["شهر", "month", "الشهر الحالي"],
  semester: ["فصل دراسي", "semester", "الفصل الدراسي الحالي"],
};

function Line({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className={cn("tabular-nums", tone)}>{v}</dd></div>;
}

const CONDITIONS: [ItemCondition, string, string][] = [
  ["ok", "سليم", "OK"],
  ["damaged", "تالف", "Damaged"],
  ["missing", "مفقود", "Missing"],
];
type Row = { condition: ItemCondition; note: string; charge: string };

/** Pre-check-out room inspection: housekeeping records it, a manager approves any charges. */
function InspectionCard({ b }: { b: Booking }) {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const checklist = inspectionChecklist(s, b.bedId);
  const ins = b.inspection;
  const req = b.inspectionRequest;
  const fromInspection = (): Record<string, Row> =>
    Object.fromEntries(
      checklist.map((c) => {
        const it = ins?.items.find((x) => x.key === c.key);
        return [c.key, { condition: it?.condition ?? "ok", note: it?.note ?? "", charge: it && it.charge ? String(it.charge) : "" }];
      }),
    );
  const [rows, setRows] = useState(fromInspection);
  // The form opens on demand: the inspection is an action someone starts, not a form waiting on screen.
  const [editing, setEditing] = useState(false);
  const [reject, setReject] = useState("");
  const canInspect = can(s.role, "stay.inspect");
  const canApprove = can(s.role, "inspection.approve");
  const total = Object.values(rows).reduce((a, r) => a + (r.condition === "ok" ? 0 : Number(r.charge) || 0), 0);
  const set = (key: string, patch: Partial<Row>) => setRows({ ...rows, [key]: { ...rows[key], ...patch } });
  const submit = () => {
    const res = actions.recordInspection(
      b.id,
      checklist.map((c) => ({ key: c.key, condition: rows[c.key].condition, note: rows[c.key].note, charge: rows[c.key].charge === "" ? 0 : Number(rows[c.key].charge) })),
    );
    if (run(res, total > 0 ? t("تم تسجيل الفحص وإرساله لاعتماد المدير", "Inspection recorded; sent for manager approval") : t("تم تسجيل التقرير: كل المحتويات سليمة — بانتظار تأكيد الاستقبال", "Report recorded: all in order"))) setEditing(false);
  };
  const form = (
        <>
          <p className="mb-3 text-sm font-medium">{req ? t(`تقرير الفحص — ${req.assignee}`, `Inspection report — ${req.assignee}`) : t("تقرير الفحص", "Inspection report")}</p>
          <ul className="space-y-2">
            {checklist.map((c) => {
              const r = rows[c.key];
              return (
                <li key={c.key} className={cn("rounded-lg border p-3", r.condition !== "ok" && "border-destructive/30 bg-destructive-soft/40")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t(c.label, c.labelEn)}</span>
                    <div className="flex gap-1">
                      {CONDITIONS.map(([k, ar, en]) => (
                        <Button key={k} type="button" size="sm" variant={r.condition === k ? (k === "ok" ? "default" : "destructive") : "outline"} className="h-7 px-2.5 text-xs" disabled={!canInspect} onClick={() => set(c.key, { condition: k })}>
                          {t(ar, en)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {r.condition !== "ok" && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Input className="sm:col-span-2" placeholder={t("وصف التلف أو المفقود", "Describe the damage or missing item")} value={r.note} disabled={!canInspect} onChange={(e) => set(c.key, { note: e.target.value })} />
                      <Input type="number" min={0} placeholder={t("قيمة الخصم (ج.م.)", "Charge (EGP)")} value={r.charge} disabled={!canInspect} onChange={(e) => set(c.key, { charge: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{t("إجمالي الخصومات:", "Total charges:")} <b className={cn(total > 0 && "text-destructive")}>{money(total)}</b>{total > 0 && <span className="ms-2 text-xs text-muted-foreground">{t("تحتاج اعتماد المدير", "needs manager approval")}</span>}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setRows(fromInspection()); setEditing(false); }}>{t("إلغاء", "Cancel")}</Button>
              <Button disabled={!canInspect} onClick={submit}><ClipboardCheck className="size-4" />{t("تسجيل الفحص", "Record inspection")}</Button>
            </div>
          </div>
        </>
  );
  const canAssign = can(s.role, "stay.checkout") || canInspect;
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState(req?.assignee ?? s.staff[0]);
  const assign = () => {
    if (run(actions.assignInspection(b.id, who), t(`تم تكليف ${who} بفحص الغرفة`, `${who} assigned to inspect the room`))) setPicking(false);
  };
  // Waiting on the inspector: assigned with no report yet, or the last report's charges were rejected.
  const awaiting = !!req && (!ins || ins.status === "rejected");
  const rejected = ins?.status === "rejected" && (
    <p className="mb-3 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
      {t("رفض المدير الخصومات:", "Manager rejected the charges:")} {ins.rejectReason} — {t("أعد الفحص.", "Please re-inspect.")}
    </p>
  );

  if (editing) return <div>{rejected}{form}</div>;
  if (picking || (!req && !ins))
    return (
      <div className="rounded-lg border border-dashed p-3">
        {picking ? (
          <>
            <p className="mb-2 text-sm">{t("من سيفحص الغرفة؟", "Who will inspect the room?")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{s.staff.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={assign}><ClipboardCheck className="size-4" />{t("تكليف بالفحص", "Assign")}</Button>
              <Button variant="ghost" onClick={() => setPicking(false)}>{t("إلغاء", "Cancel")}</Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("كلّف أحد فريق النظافة بفحص محتويات الغرفة قبل المغادرة.", "Send someone from housekeeping to check the room before departure.")}</p>
            <Button disabled={!canAssign} onClick={() => setPicking(true)}><ClipboardCheck className="size-4" />{t("بدء فحص الغرفة", "Start room inspection")}</Button>
          </div>
        )}
      </div>
    );
  if (awaiting)
    return (
      <div>
        {rejected}
        <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">
          <p className="font-medium">{t(`تم تكليف ${req!.assignee} بفحص الغرفة`, `${req!.assignee} is inspecting the room`)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmt(req!.at, true)} · {t("بانتظار تقرير الفاحص", "Waiting for the inspector's report")}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button disabled={!canInspect} onClick={() => setEditing(true)}><ClipboardCheck className="size-4" />{t("تسجيل تقرير الفحص", "Record the report")}</Button>
          {canAssign && <Button variant="ghost" onClick={() => setPicking(true)}>{t("تغيير الفاحص", "Change inspector")}</Button>}
        </div>
        {!canInspect && <p className="mt-2 text-xs text-muted-foreground">{t(`يسجّل ${req!.assignee} التقرير من حساب النظافة.`, `${req!.assignee} records the report from housekeeping.`)}</p>}
      </div>
    );
  if (!ins) return null;
  return (
    <div>
      <div className="mb-3">
        <Pill tone={ins.status === "approved" ? "success" : ins.status === "rejected" ? "destructive" : ins.status === "reported" ? "info" : "warning"}>
          {ins.status === "approved" ? t("معتمد", "Approved") : ins.status === "rejected" ? t("مرفوض", "Rejected") : ins.status === "reported" ? t("بانتظار تأكيدك", "Waiting for your confirmation") : t("بانتظار اعتماد المدير", "Awaiting manager approval")}
        </Pill>
      </div>
      {rejected}
          <p className="text-xs text-muted-foreground">{t("سجّله", "Recorded by")} {ins.by} · {fmt(ins.at, true)}{ins.reviewedBy && ` · ${ins.status === "approved" ? t("اعتمده", "approved by") : t("رفضه", "rejected by")} ${ins.reviewedBy}`}</p>
          {ins.items.every((x) => x.condition === "ok") ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{t("كل محتويات الغرفة سليمة.", "Everything in the room is in good condition.")}</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {ins.items.filter((x) => x.condition !== "ok").map((x) => (
                <li key={x.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{t(x.label, x.labelEn)}</b> <Pill tone="destructive">{x.condition === "missing" ? t("مفقود", "Missing") : t("تالف", "Damaged")}</Pill><span className="block text-xs text-muted-foreground">{x.note}</span></span>
                  <span className="tabular-nums">{money(x.charge)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 font-semibold"><span>{t("إجمالي الخصومات", "Total charges")}</span><span>{money(ins.total)}</span></li>
            </ul>
          )}
          {ins.status === "pending_approval" && (
            canApprove ? (
              <div className="mt-3 space-y-2 rounded-lg border border-warning/30 bg-warning-soft p-3">
                <p className="text-sm font-medium">{t("اعتماد الخصومات (المدير)", "Approve charges (manager)")}</p>
                <Textarea placeholder={t("سبب الرفض (مطلوب عند الرفض)", "Reason (required to reject)")} value={reject} onChange={(e) => setReject(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => run(actions.reviewInspection(b.id, true), t("تم اعتماد الخصومات", "Charges approved"))}><CheckCircle2 className="size-4" />{t("اعتماد الخصومات", "Approve charges")}</Button>
                  <Button variant="outline" onClick={() => { if (run(actions.reviewInspection(b.id, false, reject), t("تم رفض الخصومات وإعادة الفحص", "Charges rejected"))) { setReject(""); setEditing(true); } }}><XCircle className="size-4" />{t("رفض", "Reject")}</Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-warning">{t("بانتظار اعتماد المدير للخصومات قبل المغادرة.", "Waiting for a manager to approve the charges.")}</p>
            )
          )}
      {ins.status === "reported" &&
        (can(s.role, "stay.checkout") ? (
          <Button className="mt-3" onClick={() => run(actions.confirmInspection(b.id), t("تم تأكيد سلامة الغرفة", "Room confirmed OK"))}><CheckCircle2 className="size-4" />{t("الفحص تمام — متابعة", "Inspection OK — continue")}</Button>
        ) : (
          <p className="mt-3 text-sm text-info">{t("بانتظار تأكيد الاستقبال.", "Waiting for the front desk to confirm.")}</p>
        ))}
      {canInspect &&
        (ins.status === "rejected" ? (
          <Button className="mt-3" onClick={() => setEditing(true)}><ClipboardCheck className="size-4" />{t("إعادة فحص الغرفة", "Re-inspect the room")}</Button>
        ) : (
          ins.status !== "approved" && <Button variant="link" className="mt-1 block h-auto px-0 text-xs" onClick={() => setEditing(true)}>{t("إعادة الفحص", "Re-inspect")}</Button>
        ))}
    </div>
  );
}
