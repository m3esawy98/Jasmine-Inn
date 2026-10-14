import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, Clock, PiggyBank, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kpi, PageHeader, Pill, Section } from "@/components/stay/kit";
import { bedProperty, depositHeld, guestName, inScope, invoiceBalance, invoiceOverdue, invoicePaid, invoiceTotal, kpis, useDemo } from "@/lib/demo/store";
import { METHOD, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/finance/")({
  head: () => meta("المالية والتحصيل", "الفواتير والمدفوعات والأرصدة والمتأخرات والتأمينات."),
  component: Finance,
});

function Finance() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const [q, setQ] = useState("");
  const k = kpis(s);
  const invs = s.invoices.filter((i) => { const b = s.bookings.find((x) => x.id === i.bookingId)!; const p = bedProperty(s, b.bedId); return (!p || inScope(s, p.id)) && (!q || i.code.includes(q.toUpperCase()) || guestName(s, i.guestId).includes(q)); })
    .sort((a, b) => (s.bookings.find((x) => x.id === b.bookingId)?.scenario ? 1 : 0) - (s.bookings.find((x) => x.id === a.bookingId)?.scenario ? 1 : 0));
  const ids = new Set(invs.map((i) => i.id));
  const pays = s.payments.filter((p) => ids.has(p.invoiceId)).slice().reverse();
  const deposits = invs.reduce((a, i) => a + depositHeld(s, i.id), 0);
  return (
    <div>
      <PageHeader title={t("المالية والتحصيل", "Finance & collection")} subtitle={t("المدفوعات تجريبية ولا تمثل معاملات حقيقية. التأمين منفصل عن إيرادات الإقامة.", "Demo payments only. Deposits kept separate from revenue.")} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Banknote} label={t("تحصيلات الفترة", "Collected")} value={money(k.collected)} tone="success" />
        <Kpi icon={Wallet} label={t("الأرصدة المستحقة", "Outstanding")} value={money(k.outstanding)} tone="warning" />
        <Kpi icon={Clock} label={t("المتأخرات", "Overdue")} value={money(k.overdue)} tone="destructive" />
        <Kpi icon={PiggyBank} label={t("تأمينات محتفظ بها", "Deposits held")} value={money(deposits)} tone="info" />
      </div>
      <Tabs dir={s.lang === "ar" ? "rtl" : "ltr"} defaultValue="inv">
        <TabsList><TabsTrigger value="inv">{t("الفواتير", "Invoices")}</TabsTrigger><TabsTrigger value="pay">{t("المدفوعات والإيصالات", "Payments")}</TabsTrigger></TabsList>
        <TabsContent value="inv">
          <Section>
            <Input className="mb-3 max-w-sm" placeholder={t("بحث بالفاتورة أو الاسم", "Search")} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b">{[t("الفاتورة", "Invoice"), t("العميل", "Guest"), t("الإجمالي", "Total"), t("المحصل", "Paid"), t("الرصيد", "Balance"), t("متأخر", "Overdue")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>{invs.slice(0, 80).map((i) => { const od = invoiceOverdue(s, i.id); return (
                <tr key={i.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2.5"><Link to="/finance/$id" params={{ id: i.id }} className="font-semibold text-primary">{i.code}</Link>{i.status === "void" && <Pill className="ms-2">{t("ملغاة", "Void")}</Pill>}</td>
                  <td className="px-3 py-2.5">{guestName(s, i.guestId)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{money(invoiceTotal(s, i.id))}</td>
                  <td className="px-3 py-2.5 tabular-nums">{money(invoicePaid(s, i.id))}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{money(invoiceBalance(s, i.id))}</td>
                  <td className="px-3 py-2.5">{od > 0 ? <Pill tone="destructive">{money(od)}</Pill> : <Pill tone="success">{t("منتظم", "On time")}</Pill>}</td>
                </tr>); })}</tbody>
            </table></div>
          </Section>
        </TabsContent>
        <TabsContent value="pay">
          <Section><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b">{[t("الإيصال", "Receipt"), t("الفاتورة", "Invoice"), t("المبلغ", "Amount"), t("الطريقة", "Method"), t("التاريخ", "Date"), t("المستخدم", "User")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{pays.slice(0, 80).map((p) => (
              <tr key={p.id} className="border-b"><td className="px-3 py-2">{p.code}{p.reversalOf && <Pill tone="warning" className="ms-2">{t("قيد تصحيح", "Correction")}</Pill>}{p.reversed && <Pill className="ms-2">{t("معكوس", "Reversed")}</Pill>}</td>
                <td className="px-3 py-2"><Link to="/finance/$id" params={{ id: p.invoiceId }} className="text-primary">{s.invoices.find((i) => i.id === p.invoiceId)?.code}</Link></td>
                <td className="px-3 py-2 tabular-nums">{money(p.amount)}</td><td className="px-3 py-2">{t(...METHOD[p.method])}</td><td className="px-3 py-2 text-xs">{fmt(p.date)}</td><td className="px-3 py-2 text-xs">{p.user}</td></tr>))}</tbody>
          </table></div></Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
