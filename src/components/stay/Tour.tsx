import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Pause, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, getState, useDemo } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { useT } from "@/lib/demo/ui";
import { cn } from "@/lib/utils";

type Step = { to: string; title: [string, string]; body: [string, string]; done?: (s: DemoState) => boolean };

const sb = (s: DemoState) => s.bookings.find((b) => b.id === s.scenario.bookingId);
const sInv = (s: DemoState) => s.invoices.find((i) => i.bookingId === s.scenario.bookingId);
const sTask = (s: DemoState) => {
  const b = sb(s);
  return b ? s.tasks.find((t) => t.source === b.code) : undefined;
};

export const STEPS: Step[] = [
  { to: "/", title: ["رحلة الحجز إلى التحصيل", "Booking-to-collection journey"], body: ["سنتابع الطالب عمر حسن من طلب الإقامة في إقامة النيل (الغرفة A-204) حتى اعتماد جاهزية الغرفة. لاحظ مؤشرات لوحة التحكم قبل البدء.", "We'll follow student Omar Hassan from booking request at Nile Residence (room A-204) until the room is approved ready. Note the dashboard KPIs first."] },
  { to: "/bookings/new", title: ["1. إنشاء الحجز", "1. Create booking"], body: ["البيانات معبأة مسبقًا. اختر سريرًا متاحًا في A-204، راجع نتيجة فحص التوافر والسعر (27,000 ج.م.)، ثم احفظ الحجز بحالة «قيد المراجعة».", "Data is prefilled. Pick a free bed in A-204, review availability and price (EGP 27,000), then save as Under review."], done: (s) => !!sb(s) },
  { to: "/bookings/new", title: ["اختبار منع الازدواج", "Double-booking test"], body: ["اضغط «اختبار حجز متداخل» لمحاولة حجز السرير نفسه لطالب آخر في فترة متداخلة. سيرفض النظام ويشرح السبب، بينما تبقى الأسرة الأخرى متاحة.", "Click “Test overlapping booking” to book the same bed for someone else. The system rejects it and explains why; other beds stay bookable."], done: (s) => s.scenario.conflictTested },
  { to: "/bookings/$id", title: ["2. المراجعة والتأكيد", "2. Review & confirm"], body: ["راجع تفاصيل الحجز ثم اضغط «تأكيد الحجز». سينشأ عقد وفاتورة وجدول استحقاقات، وتزيد الحجوزات المستقبلية — دون تغيير الإشغال الفعلي.", "Review then “Confirm booking”. A contract, invoice and schedule are created; future bookings rise — actual occupancy does not."], done: (s) => !!sb(s) && sb(s)!.status !== "pending" },
  { to: "/stays", title: ["3. تسجيل الوصول", "3. Check-in"], body: ["في «الوصول المتوقع» أكمل قائمة التحقق (المستندات وشرط الدفع). لن يُفعّل زر تسجيل الوصول قبل استيفاء الشروط.", "In Arrivals complete the checklist (documents, payment term). Check-in stays disabled until conditions are met."], done: (s) => ["checked_in", "checked_out"].includes(sb(s)?.status ?? "") },
  { to: "/finance/$inv", title: ["4. الفاتورة والتحصيل", "4. Invoice & collection"], body: ["اضغط «تسجيل دفعة» وسجّل 10,000 ج.م. سيتحدث الرصيد إلى 17,000 ج.م. وينشأ إيصال قابل للطباعة.", "Click “Record payment” for EGP 10,000. Balance updates to 17,000 and a printable receipt is created."], done: (s) => { const i = sInv(s); return !!i && s.payments.some((p) => p.invoiceId === i.id); } },
  { to: "/stays", title: ["5. تسجيل المغادرة", "5. Check-out"], body: ["في تبويب «المقيمون حاليًا» اختر عمر حسن، وسجّل فحص الغرفة قبل المغادرة (أي خصومات تحتاج اعتماد المدير). بعدها اعتمد المغادرة المبكرة (للعرض) وأكد: يُسوّى التأمين، وتنشأ مهمة تنظيف.", "In In-house pick Omar and record the pre-check-out room inspection (any charges need a manager's approval). Then approve early check-out (demo) and confirm: the deposit is settled and a cleaning task is created."], done: (s) => sb(s)?.status === "checked_out" },
  { to: "/housekeeping", title: ["6. التنظيف واعتماد الجاهزية", "6. Cleaning & readiness"], body: ["افتح مهمة A-204: عيّن الموظف، ابدأ التنفيذ، أضف ملاحظة، سجّل الاكتمال، نفّذ الفحص، ثم اعتمد الغرفة. فقط عندها تصبح متاحة.", "Open the A-204 task: assign, start, add a note, complete, inspect, approve. Only then does it become available."], done: (s) => sTask(s)?.status === "approved" },
  { to: "/", title: ["7. النتيجة النهائية", "7. Outcome"], body: ["راجع ملخص الرحلة والسجل الزمني في لوحة التحكم. كل خطوة غيّرت البيانات المشتركة نفسها.", "Review the journey summary and timeline on the dashboard. Every step changed the same shared data."] },
];

function resolve(to: string, s: DemoState) {
  if (to === "/bookings/$id") return s.scenario.bookingId ? `/bookings/${s.scenario.bookingId}` : "/bookings";
  if (to === "/finance/$inv") { const i = sInv(s); return i ? `/finance/${i.id}` : "/finance"; }
  return to;
}

export function startScenario(navigate: (o: { to: string }) => void) {
  actions.tour({ tourActive: true, step: getState().scenario.bookingId ? getState().scenario.step : 0 });
  navigate({ to: resolve(STEPS[getState().scenario.step].to, getState()) });
}

export function TourPanel() {
  const s = useDemo();
  const t = useT();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!s.scenario.tourActive) return null;
  const i = s.scenario.step;
  const step = STEPS[i];
  const done = step.done?.(s);
  const target = resolve(step.to, s);
  const go = (n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    actions.tour({ step: k });
    navigate({ to: resolve(STEPS[k].to, getState()) as "/" });
  };
  return (
    <div className="fixed bottom-4 end-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border bg-card p-4 shadow-[var(--shadow-float)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" /> {t("دليل السيناريو", "Scenario guide")} · {i + 1}/{STEPS.length}
        </span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" title={t("إيقاف مؤقت", "Pause")} onClick={() => actions.tour({ tourActive: false })}>
            <Pause className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => actions.tour({ tourActive: false })}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mb-3 flex gap-1">
        {STEPS.map((st, k) => (
          <span key={k} className={cn("h-1.5 flex-1 rounded-full", k < i || st.done?.(s) ? "bg-primary" : k === i ? "bg-primary/40" : "bg-muted")} />
        ))}
      </div>
      <h3 className="font-semibold">{t(...step.title)}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(...step.body)}</p>
      {step.done && (
        <p className={cn("mt-2 inline-flex items-center gap-1.5 text-xs font-medium", done ? "text-success" : "text-muted-foreground")}>
          {done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
          {done ? t("تم تنفيذ الخطوة", "Step completed") : t("بانتظار تنفيذ الخطوة", "Waiting for this step")}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" disabled={i === 0} onClick={() => go(i - 1)}>
          <ChevronRight className="size-4 ltr:rotate-180" /> {t("السابق", "Previous")}
        </Button>
        {path !== target && (
          <Button size="sm" variant="secondary" onClick={() => navigate({ to: target as "/" })}>
            {t("متابعة", "Continue")}
          </Button>
        )}
        <Button size="sm" disabled={i === STEPS.length - 1} onClick={() => go(i + 1)}>
          {t("التالي", "Next")} <ChevronLeft className="size-4 ltr:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
