import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowLeftRight, BedDouble, CalendarClock, CheckCircle2, Circle, ClipboardCheck, DoorOpen, Hourglass, LogIn, LogOut, Play, Wallet, Wrench, Banknote, Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kpi, Pill, Section, useAlerts } from "@/components/stay/kit";
import { startScenario } from "@/components/stay/Tour";
import { DEMO_TODAY, inScope, invoiceBalance, invoicePaid, kpis, useDemo, bedLabel, guestName, activeStayOnBed } from "@/lib/demo/store";
import { useDate, useMoney, useNum, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => meta("لوحة التحكم التنفيذية", "مؤشرات الإشغال الفعلي والحجوزات والتحصيل لجميع المنشآت في StayFlow Hospitality."),
  component: Dashboard,
});

const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const MONTH_AR = ["يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر"];
const MONTH_EN = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

function Dashboard() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const num = useNum();
  const fmt = useDate();
  const navigate = useNavigate();
  const k = kpis(s);
  const alerts = useAlerts();

  const charts = useMemo(() => {
    const scopeBeds = s.beds.filter((b) => inScope(s, s.rooms.find((r) => r.id === b.roomId)!.propertyId));
    const ids = new Set(scopeBeds.map((b) => b.id));
    const occ = MONTHS.map((m, i) => {
      const d = i === MONTHS.length - 1 ? DEMO_TODAY : `${m}-15`;
      const n = s.stays.filter((x) => ids.has(x.bedId) && x.checkIn <= d && (!x.checkOut || x.checkOut > d)).length;
      return { name: t(MONTH_AR[i], MONTH_EN[i]), occ: Math.round((n / scopeBeds.length) * 100) };
    });
    const pay = MONTHS.map((m, i) => {
      const inScopeInv = new Set(s.invoices.filter((iv) => ids.has(s.bookings.find((b) => b.id === iv.bookingId)!.bedId)).map((iv) => iv.id));
      const v = s.payments.filter((p) => inScopeInv.has(p.invoiceId) && p.date.startsWith(m)).reduce((a, p) => a + p.amount, 0);
      return { name: t(MONTH_AR[i], MONTH_EN[i]), v: Math.round(v / 1000) };
    });
    const props = s.properties.map((p) => {
      const beds = s.beds.filter((b) => s.rooms.find((r) => r.id === b.roomId)!.propertyId === p.id);
      const o = beds.filter((b) => activeStayOnBed(s, b.id)).length;
      const inv = s.invoices.filter((iv) => beds.some((b) => b.id === s.bookings.find((x) => x.id === iv.bookingId)!.bedId) && iv.status === "open");
      return {
        name: t(p.name, p.nameEn),
        occ: Math.round((o / beds.length) * 100),
        due: Math.round(inv.reduce((a, iv) => a + Math.max(0, invoiceBalance(s, iv.id)), 0) / 1000),
      };
    });
    return { occ, pay, props };
  }, [s, t]);

  const sc = s.bookings.find((b) => b.id === s.scenario.bookingId);

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 md:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <Pill tone="primary" className="mb-3 border-0">{t("بيانات تجريبية · تاريخ العرض", "Demo data · demo date")} {fmt(DEMO_TODAY)}</Pill>
            <h1 className="text-2xl font-extrabold leading-snug md:text-3xl">{t("رحلة الحجز إلى التحصيل", "From booking to collection")}</h1>
            <p className="mt-2 text-sm opacity-85 md:text-base">
              {t("من طلب الإقامة حتى جاهزية الغرفة — شاهد أثر كل خطوة على الإشغال والتحصيل والتشغيل في الوقت الفعلي.", "From stay request to room readiness — watch every step update occupancy, collection and operations live.")}
            </p>
          </div>
          <Button size="lg" variant="secondary" className="h-12 px-6 text-base font-bold" onClick={() => startScenario(navigate)}>
            <Play className="size-5" /> {sc ? t("متابعة السيناريو", "Resume scenario") : t("ابدأ السيناريو", "Start scenario")}
          </Button>
        </div>
      </section>

      {sc && <Journey />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={BedDouble} label={t("إجمالي الغرف / الأسرة", "Rooms / beds")} value={`${num(k.rooms)} / ${num(k.beds)}`} />
        <Kpi icon={DoorOpen} label={t("أسرة مشغولة فعليًا", "Occupied beds")} value={num(k.occupied)} hint={t("بعد تسجيل الوصول فقط", "Only after check-in")} tone="success" />
        <Kpi icon={ArrowLeftRight} label={t("نسبة الإشغال الفعلي", "Actual occupancy")} value={`${num(Math.round(k.occupancy * 1000) / 10)}٪`} tone="success" />
        <Kpi icon={CalendarClock} label={t("حجوزات مستقبلية مؤكدة", "Future confirmed")} value={num(k.future)} tone="info" />
        <Kpi icon={CheckCircle2} label={t("السعة المتاحة", "Available capacity")} value={num(k.available)} hint={t(`${num(k.notReadyBeds)} سرير بانتظار الجاهزية`, `${k.notReadyBeds} awaiting readiness`)} tone="primary" />
        <Kpi icon={Wrench} label={t("وحدات خارج الخدمة", "Out of service")} value={num(k.oos)} tone="destructive" />
        <Kpi icon={Hourglass} label={t("حجوزات تنتظر المراجعة", "Pending review")} value={num(k.pending)} tone="warning" />
        <Kpi icon={Banknote} label={t("تحصيلات الفترة", "Period collections")} value={money(k.collected)} hint={t("منذ 1 أكتوبر", "Since Oct 1")} tone="success" />
        <Kpi icon={Wallet} label={t("مستحق / متأخر", "Outstanding / overdue")} value={money(k.outstanding)} hint={<span className="text-destructive">{t("متأخر:", "Overdue:")} {money(k.overdue)}</span>} tone="warning" />
        <Kpi icon={LogIn} label={t("وصول / مغادرة اليوم", "Arrivals / departures")} value={`${num(k.arrivals.length)} / ${num(k.departures.length)}`} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={t("تطور الإشغال الفعلي ٪", "Occupancy trend %")} className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={charts.occ}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} reversed={s.lang === "ar"} />
                <YAxis tick={{ fontSize: 12 }} orientation={s.lang === "ar" ? "right" : "left"} domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="occ" name={t("الإشغال ٪", "Occupancy %")} stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title={t("تنبيهات تحتاج إلى تدخل", "Needs attention")}>
          <div className="space-y-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد تنبيهات", "No alerts")}</p>}
            {alerts.map((a) => (
              <Link key={a.text} to={a.to as "/"} className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50">
                <AlertTriangle className={cn("size-4 shrink-0", a.tone === "destructive" ? "text-destructive" : a.tone === "info" ? "text-info" : "text-warning")} />
                {a.text}
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("التحصيل الشهري (ألف ج.م.)", "Monthly collections (k EGP)")}>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={charts.pay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} reversed={s.lang === "ar"} />
                <YAxis tick={{ fontSize: 12 }} orientation={s.lang === "ar" ? "right" : "left"} />
                <Tooltip />
                <Bar dataKey="v" name={t("التحصيل", "Collected")} fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title={t("مقارنة المنشآت", "Property comparison")}>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={charts.props}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} reversed={s.lang === "ar"} />
                <YAxis tick={{ fontSize: 12 }} orientation={s.lang === "ar" ? "right" : "left"} />
                <Tooltip />
                <Legend />
                <Bar dataKey="occ" name={t("الإشغال ٪", "Occupancy %")} fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="due" name={t("المستحق (ألف)", "Outstanding (k)")} fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title={t("أحدث الأنشطة والتغييرات", "Recent activity")} actions={<Link to="/users" className="text-sm text-primary">{t("سجل الأنشطة الكامل", "Full log")}</Link>}>
        <ul className="divide-y">
          {s.activities.slice(0, 8).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                {a.scenario && <Pill tone="primary">{t("السيناريو", "Scenario")}</Pill>}
                {a.action}
              </span>
              <span className="text-xs text-muted-foreground">{a.user} · {fmt(a.at, true)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Journey() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const b = s.bookings.find((x) => x.id === s.scenario.bookingId)!;
  const inv = s.invoices.find((i) => i.bookingId === b.id);
  const task = s.tasks.find((x) => x.source === b.code);
  const paid = inv ? invoicePaid(s, inv.id) : 0;
  const steps = [
    { label: t("الحجز", "Booking"), ok: !["pending", "rejected", "cancelled"].includes(b.status), v: t("مؤكد", "Confirmed"), value: t("عقد وفاتورة تلقائيًا", "Auto contract & invoice") },
    { label: t("الإقامة", "Stay"), ok: b.status === "checked_out" || b.status === "checked_in", v: b.status === "checked_out" ? t("مكتملة", "Completed") : t("نشطة", "Active"), value: t("إشغال فعلي موثق", "Verified occupancy") },
    { label: t("التحصيل", "Collection"), ok: paid > 0, v: inv ? `${money(paid)} · ${t("الرصيد", "bal.")} ${money(invoiceBalance(s, inv.id))}` : "—", value: t("رصيد محدث وإيصال", "Updated balance & receipt") },
    { label: t("المغادرة", "Check-out"), ok: b.status === "checked_out", v: t("مسجلة", "Recorded"), value: t("مهمة تنظيف تلقائية", "Auto cleaning task") },
    { label: t("التنظيف", "Cleaning"), ok: !!task && ["cleaned", "inspected", "approved"].includes(task.status), v: t("مكتمل", "Done"), value: t("متابعة المسؤول", "Accountable staff") },
    { label: t("الجاهزية", "Readiness"), ok: task?.status === "approved", v: t("معتمدة", "Approved"), value: t("لا تسكين قبل الاعتماد", "No check-in before approval") },
  ];
  const timeline = s.activities.filter((a) => a.scenario).slice().reverse();
  return (
    <Section title={t(`ملخص الرحلة — ${guestName(s, b.guestId)} · ${bedLabel(s, b.bedId)}`, `Journey — ${guestName(s, b.guestId)} · ${bedLabel(s, b.bedId)}`)} actions={<Link to="/bookings/$id" params={{ id: b.id }} className="text-sm text-primary">{b.code}</Link>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((st) => (
          <div key={st.label} className={cn("rounded-xl border p-3", st.ok ? "border-success/30 bg-success-soft" : "bg-muted/40")}>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {st.ok ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />} {st.label}
            </div>
            <p className="mt-1 text-xs">{st.ok ? st.v : t("لم يتم بعد", "Not yet")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{st.value}</p>
          </div>
        ))}
      </div>
      {timeline.length > 0 && (
        <ol className="mt-5 space-y-3 border-s-2 border-primary/30 ps-4">
          {timeline.map((a) => (
            <li key={a.id} className="relative text-sm">
              <span className="absolute -start-[1.42rem] top-1.5 size-2.5 rounded-full bg-primary" />
              <span className="font-medium">{a.action}</span>
              <span className="ms-2 text-xs text-muted-foreground">{a.user} · {fmt(a.at, true)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck className="size-4 text-primary" /><Building className="hidden" />{t("كل خطوة سُجلت تلقائيًا مع المستخدم والوقت — رقابة كاملة دون جداول يدوية.", "Every step was logged with user and time — full control without spreadsheets.")} <LogOut className="hidden" /></p>
    </Section>
  );
}
