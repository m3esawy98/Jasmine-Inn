import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Pill, Section, run } from "@/components/stay/kit";
import { actions, bedLabel, can, guestName, useDemo, DEMO_TODAY } from "@/lib/demo/store";
import { daysBetween } from "@/lib/demo/calc";
import { useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/contracts")({
  head: () => meta("العقود والأسعار", "خطط الأسعار اليومية والأسبوعية والشهرية والفصلية وعقود الإقامة."),
  component: Contracts,
});

const PERIOD: Record<string, [string, string]> = { daily: ["يومي", "Daily"], weekly: ["أسبوعي", "Weekly"], monthly: ["شهري", "Monthly"], semester: ["فصلي", "Semester"] };
const CST: Record<string, [string, string, string]> = { active: ["ساري", "Active", "success"], pending_start: ["بانتظار البدء", "Pending start", "info"], ended: ["منتهي", "Ended", "muted"], cancelled: ["ملغى", "Cancelled", "destructive"] };

function Contracts() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const [edit, setEdit] = useState<Record<string, { price: string; deposit: string }>>({});
  const editable = can(s.role, "pricing.edit");
  return (
    <div>
      <PageHeader title={t("العقود والأسعار", "Contracts & rates")} subtitle={t("الأسعار توضيحية للعرض وليست سياسات معتمدة.", "Illustrative rates.")} />
      <Section title={t("خطط الأسعار", "Rate plans")} className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{s.plans.map((p) => { const e = edit[p.id]; return (
          <div key={p.id} className="rounded-xl border p-4">
            <Pill tone="primary">{t(...PERIOD[p.period])}</Pill>
            <p className="mt-2 font-semibold">{t(p.name, p.nameEn)}</p>
            {e ? <div className="mt-2 space-y-2"><Input type="number" value={e.price} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, price: x.target.value } })} /><Input type="number" value={e.deposit} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, deposit: x.target.value } })} /><Button size="sm" onClick={() => { if (run(actions.updatePlan(p.id, Number(e.price), Number(e.deposit)), t("تم الحفظ", "Saved"))) { const n = { ...edit }; delete n[p.id]; setEdit(n); } }}>{t("حفظ", "Save")}</Button></div>
              : <><p className="mt-1 text-xl font-bold text-primary">{money(p.price)}</p><p className="text-xs text-muted-foreground">{t("تأمين", "Deposit")} {money(p.deposit)}</p>
                {editable && <Button size="sm" variant="ghost" className="mt-2 px-0" onClick={() => setEdit({ ...edit, [p.id]: { price: String(p.price), deposit: String(p.deposit) } })}>{t("تعديل", "Edit")}</Button>}</>}
          </div>); })}</div>
      </Section>
      <Section title={t("عقود الإقامة", "Stay contracts")}>
        <div className="overflow-x-auto overflow-y-hidden"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">{[t("العقد", "Contract"), t("الطرف", "Party"), t("الوحدة", "Unit"), t("المدة", "Term"), t("التجديد خلال", "Renewal in"), t("الحالة", "Status")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>{s.contracts.slice().reverse().slice(0, 80).map((c) => { const b = s.bookings.find((x) => x.id === c.bookingId)!; const d = daysBetween(DEMO_TODAY, c.end); return (
            <tr key={c.id} className="border-b"><td className="px-3 py-2.5 font-semibold">{c.code}</td><td className="px-3 py-2.5"><Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">{guestName(s, b.guestId)}</Link></td><td className="px-3 py-2.5">{bedLabel(s, b.bedId)}</td><td className="px-3 py-2.5 text-xs">{fmt(c.start)} — {fmt(c.end)}</td>
              <td className="px-3 py-2.5">{c.status === "active" ? (d <= 30 ? <Pill tone="warning">{d} {t("يوم", "days")}</Pill> : `${d} ${t("يوم", "days")}`) : "—"}</td><td className="px-3 py-2.5"><Pill tone={CST[c.status][2]}>{t(CST[c.status][0], CST[c.status][1])}</Pill></td></tr>); })}</tbody>
        </table></div>
      </Section>
    </div>
  );
}
