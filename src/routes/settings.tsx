import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, Pill, Section } from "@/components/stay/kit";
import { actions, useDemo } from "@/lib/demo/store";
import { useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/settings")({
  head: () => meta("الإعدادات", "إعدادات اللغة والعملة وسياسات التشغيل في العرض التجريبي."),
  component: Settings,
});

function Settings() {
  const s = useDemo();
  const t = useT();
  const rules: [string, string][] = [
    ["الحجز المؤكد لا يُحتسب إشغالًا قبل تسجيل الدخول", "Confirmed booking isn't occupancy until check-in"],
    ["منع حجز السرير نفسه في فترات متداخلة", "No overlapping bookings per bed"],
    ["الغرفة لا تصبح متاحة بعد المغادرة إلا باعتماد الجاهزية", "Room available only after readiness approval"],
    ["لا حذف لعمليات التحصيل؛ التصحيح بقيد عكسي موثق", "No payment deletion; documented reversals"],
    ["التأمين يُعرض منفصلًا عن إيرادات الإقامة", "Deposits separate from revenue"],
    ["تسجيل الدخول يتطلب: تأكيد الحجز، المستندات، جاهزية السرير، مراجعة شرط الدفع", "Check-in requires confirmation, docs, readiness, payment term"],
  ];
  return (
    <div className="space-y-4">
      <PageHeader title={t("الإعدادات", "Settings")} />
      <Section title={t("اللغة والعملة", "Language & currency")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={s.lang === "ar" ? "default" : "outline"} onClick={() => actions.setLang("ar")}>العربية (RTL)</Button>
          <Button variant={s.lang === "en" ? "default" : "outline"} onClick={() => actions.setLang("en")}>English (LTR)</Button>
          <Pill tone="primary">{t("العملة: الجنيه المصري (ج.م.)", "Currency: EGP")}</Pill>
        </div>
      </Section>
      <Section title={t("قواعد التشغيل المطبقة", "Enforced operating rules")}>
        <ul className="space-y-2 text-sm">{rules.map((r) => <li key={r[0]} className="rounded-lg border p-3">✓ {t(...r)}</li>)}</ul>
      </Section>
      <Section title={t("البيانات والتخزين", "Data & storage")}>
        <p className="text-sm text-muted-foreground">{t("تُحفظ التغييرات على هذا الجهاز فقط. طبقة البيانات منظمة لربطها لاحقًا بقاعدة بيانات مشتركة للعرض المتزامن على أكثر من جهاز.", "Changes are saved on this device only; the data layer is ready for a shared database later.")}</p>
      </Section>
    </div>
  );
}
