import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, getState, useDemo } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { useT } from "@/lib/demo/ui";
import { cn } from "@/lib/utils";

/** `gate`: "Next" stays disabled until the step is done. */
type Step = { to: string; title: [string, string]; body: [string, string]; done?: (s: DemoState) => boolean; gate?: boolean };

const sb = (s: DemoState) => s.bookings.find((b) => b.id === s.scenario.bookingId);
const sInv = (s: DemoState) => s.invoices.find((i) => i.bookingId === s.scenario.bookingId);
const sTask = (s: DemoState) => {
  const b = sb(s);
  return b ? s.tasks.find((t) => t.source === b.code) : undefined;
};

export const STEPS: Step[] = [
  { to: "/", title: ["رحلة الحجز إلى التحصيل", "Booking-to-collection journey"], body: ["سنتابع الطالب عمر حسن من الحجز حتى مغادرته وتجهيز غرفته من جديد (جاسمين إسكان جامعي، الغرفة A-204). اضغط «التالي» للبدء.", "We'll follow student Omar Hassan from booking to check-out and getting his room ready again (Jasmine University Housing, room A-204). Press “Next” to start."] },
  { to: "/bookings/new", title: ["1. إنشاء الحجز", "1. Create booking"], body: ["البيانات معبأة مسبقًا. اضغط «التالي» في كل خطوة من خطوات الحجز الخمس، ثم «حفظ الحجز». السعر الإجمالي 27,000 ج.م.", "The details are prefilled. Press “Next” through the five booking steps, then “Save booking”. Total price: EGP 27,000."], done: (s) => !!sb(s), gate: true },
  { to: "/bookings/$id", title: ["2. المراجعة والتأكيد", "2. Review & confirm"], body: ["افتح حجز عمر حسن (المعلَّم «جديد») واضغط «تأكيد الحجز». يُنشأ العقد والفاتورة تلقائيًا.", "Open Omar's booking (marked “New”) and press “Confirm booking”. The contract and invoice are created automatically."], done: (s) => !!sb(s) && sb(s)!.status !== "pending" },
  { to: "/stays", title: ["3. تسجيل الدخول", "3. Check-in"], body: ["اختر عمر حسن واضغط «تسجيل الدخول». علّم المستندات الثلاثة، وحصّل الدفعة الأولى والتأمين (9,000 ج.م.)، ثم اضغط «تسجيل الدخول».", "Pick Omar and press “Check in”. Tick the three documents, collect the first installment and deposit (EGP 9,000), then press “Check in”."], done: (s) => ["checked_in", "checked_out"].includes(sb(s)?.status ?? "") },
  { to: "/finance/$inv", title: ["4. الفاتورة والتحصيل", "4. Invoice & collection"], body: ["اضغط «متابعة» لفتح الفاتورة: الدفعة الأولى مسجلة والمتبقي 18,000 ج.م. تُحصَّل باقي الأقساط من هنا بزر «تسجيل دفعة».", "Press “Continue” to open the invoice: the first installment is recorded and EGP 18,000 remains. Later installments are collected here with “Record payment”."], done: (s) => { const i = sInv(s); return !!i && s.payments.some((p) => p.invoiceId === i.id); } },
  { to: "/stays", title: ["5. تسجيل المغادرة", "5. Check-out"], body: ["عمر سيغادر مبكرًا. اختره من «المقيمون حاليًا» واضغط «بدء إجراءات مغادرة مبكرة»، ثم: اعتمد المغادرة المبكرة، اضغط «بدء فحص الغرفة» وسجّل الفحص، ثم حصّل المستحق (3,000 ج.م.) واضغط «تأكيد المغادرة».", "Omar is leaving early. Pick him under In-house and press “Start early check-out”, then: approve the early departure, press “Start room inspection” and record it, then collect what's owed (EGP 3,000) and press “Confirm check-out”."], done: (s) => sb(s)?.status === "checked_out" },
  { to: "/housekeeping", title: ["6. التنظيف واعتماد الجاهزية", "6. Cleaning & readiness"], body: ["افتح مهمة تنظيف A-204 ونفّذ خطواتها بالترتيب حتى «اعتماد الغرفة للخدمة». بعدها فقط يصبح السرير متاحًا للحجز.", "Open the A-204 cleaning task and run its steps in order up to “Approve for service”. Only then is the bed bookable again."], done: (s) => sTask(s)?.status === "approved" },
  { to: "/", title: ["7. النتيجة النهائية", "7. Outcome"], body: ["اضغط «متابعة» لرؤية ملخص الرحلة في لوحة التحكم: كل خطوة نفذتها ظهرت في الأرقام والسجل.", "Press “Continue” to see the journey summary on the dashboard: every step you took shows up in the numbers and the log."] },
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
  // Docked under the sticky header: it pushes the page down instead of covering it. On phones it is too
  // tall to pin, so it scrolls away with the page.
  return (
    <div className="z-10 border-b md:sticky md:top-16 border-primary/20 bg-primary-soft px-4 py-2.5 md:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> {t("دليل السيناريو", "Scenario guide")} · {(i + 1).toLocaleString(s.lang === "ar" ? "ar-EG" : "en")}/{STEPS.length.toLocaleString(s.lang === "ar" ? "ar-EG" : "en")}
          </span>
          <h3 className="flex-1 text-sm font-semibold">{t(...step.title)}</h3>
          {step.done && (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", done ? "text-success" : "text-muted-foreground")}>
              {done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
              {done ? t("تم تنفيذ الخطوة", "Step completed") : step.gate ? t("أكمل الخطوات الخمس واحفظ الحجز للمتابعة", "Finish the five steps and save the booking to continue") : t("بانتظار تنفيذ الخطوة", "Waiting for this step")}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 bg-card" disabled={i === 0} onClick={() => go(i - 1)}>
              <ChevronRight className="size-4 ltr:rotate-180" /> {t("السابق", "Previous")}
            </Button>
            {path !== target && (
              <Button size="sm" variant="outline" className="h-8 bg-card" onClick={() => navigate({ to: target as "/" })}>
                {t("متابعة", "Continue")}
              </Button>
            )}
            <Button size="sm" className="h-8" disabled={i === STEPS.length - 1 || (step.gate && !done)} onClick={() => go(i + 1)}>
              {t("التالي", "Next")} <ChevronLeft className="size-4 ltr:rotate-180" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" title={t("إغلاق الدليل", "Close guide")} onClick={() => actions.tour({ tourActive: false })}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(...step.body)}</p>
        <div className="mt-2 flex gap-1">
          {STEPS.map((st, k) => (
            <span key={k} className={cn("h-1 flex-1 rounded-full", k < i || st.done?.(s) ? "bg-primary" : k === i ? "bg-primary/40" : "bg-primary/10")} />
          ))}
        </div>
      </div>
    </div>
  );
}
