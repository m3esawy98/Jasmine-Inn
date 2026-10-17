import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader, Pill, Section } from "@/components/stay/kit";
import { PERMS, ROLE_NAMES, ROLE_USERS, actions, useDemo, type Perm } from "@/lib/demo/store";
import type { Role } from "@/lib/demo/types";
import { useDate, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/users")({
  head: () => meta("المستخدمون والصلاحيات", "الأدوار والصلاحيات وسجل الأنشطة الكامل."),
  component: Users,
});

const PL: [Perm, string, string][] = [
  ["booking.create", "إنشاء الحجوزات", "Create bookings"], ["booking.review", "مراجعة/تأكيد الحجوزات", "Review bookings"], ["stay.checkin", "تسجيل الدخول", "Check-in"], ["stay.checkout", "تسجيل المغادرة", "Check-out"], ["stay.inspect", "فحص الغرفة قبل المغادرة", "Pre-check-out inspection"], ["inspection.approve", "اعتماد خصومات الفحص", "Approve inspection charges"],
  ["payment.record", "تسجيل التحصيل", "Record payments"], ["payment.correct", "قيود التصحيح", "Corrections"], ["task.update", "تحديث مهام النظافة", "Update tasks"], ["task.approve", "اعتماد الجاهزية", "Approve readiness"],
  ["unit.edit", "تعديل/حجب الوحدات", "Edit units"], ["pricing.edit", "تعديل الأسعار", "Edit pricing"],
];

function Users() {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const [q, setQ] = useState("");
  return (
    <div className="space-y-4">
      <PageHeader title={t("المستخدمون والصلاحيات", "Users & permissions")} subtitle={t("محاكاة للعرض فقط — ليست نظام تفويض آمنًا للإنتاج.", "UI simulation — not production authorization.")} />
      <Section title={t("مصفوفة الصلاحيات (اضغط على الدور للتبديل)", "Permission matrix (click to switch)")}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-2 py-2 text-start">{t("الدور / المستخدم", "Role / user")}</th>{PL.map(([k, ar, en]) => <th key={k} className="px-2 py-2 text-center font-medium">{t(ar, en)}</th>)}</tr></thead>
          <tbody>{(Object.keys(ROLE_NAMES) as Role[]).map((r) => (
            <tr key={r} className={cn("cursor-pointer border-b hover:bg-muted/40", s.role === r && "bg-primary-soft")} onClick={() => actions.setRole(r)}>
              <td className="px-2 py-2.5"><b>{t(...ROLE_NAMES[r])}</b><span className="block text-xs text-muted-foreground">{ROLE_USERS[r]}</span></td>
              {PL.map(([k]) => <td key={k} className="px-2 py-2.5 text-center">{PERMS[r].includes(k) ? <Check className="mx-auto size-4 text-success" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" />}</td>)}
            </tr>))}</tbody>
        </table></div>
      </Section>
      <Section title={t("سجل الأنشطة", "Activity log")} actions={<Input className="w-56" placeholder={t("بحث", "Search")} value={q} onChange={(e) => setQ(e.target.value)} />}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">{[t("الوقت", "Time"), t("المستخدم", "User"), t("الدور", "Role"), t("الإجراء", "Action"), t("السجل المرتبط", "Reference")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>{s.activities.filter((a) => !q || a.action.includes(q) || a.user.includes(q) || a.ref.includes(q)).slice(0, 150).map((a) => (
            <tr key={a.id} className="border-b"><td className="whitespace-nowrap px-3 py-2 text-xs">{fmt(a.at, true)}</td><td className="px-3 py-2">{a.user}</td><td className="px-3 py-2 text-xs">{t(...ROLE_NAMES[a.role])}</td><td className="px-3 py-2">{a.action}</td><td className="px-3 py-2">{a.ref && <Pill>{a.ref}</Pill>}</td></tr>))}</tbody>
        </table></div>
      </Section>
    </div>
  );
}
