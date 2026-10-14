import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, Receipt, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, Section, run } from "@/components/stay/kit";
import { actions, bedLabel, can, depositHeld, getState, invoiceBalance, invoiceOverdue, invoicePaid, invoiceTotal, useDemo } from "@/lib/demo/store";
import type { PayMethod } from "@/lib/demo/types";
import { METHOD, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/finance/$id")({
  head: () => meta("الملف المالي", "تفاصيل الفاتورة وسجل المدفوعات والرصيد المتبقي."),
  component: InvoicePage,
});

function InvoicePage() {
  const { id } = Route.useParams();
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [corr, setCorr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const inv = s.invoices.find((i) => i.id === id);
  if (!inv) return <p>{t("الفاتورة غير موجودة", "Invoice not found")}</p>;
  const b = s.bookings.find((x) => x.id === inv.bookingId)!;
  const g = s.guests.find((x) => x.id === inv.guestId)!;
  const pays = s.payments.filter((p) => p.invoiceId === id);
  const total = invoiceTotal(s, id), paid = invoicePaid(s, id), bal = invoiceBalance(s, id);
  const rp = s.payments.find((p) => p.id === receipt);
  return (
    <div>
      <PageHeader title={`${t("الملف المالي", "Financial file")} — ${g.name}`} subtitle={`${inv.code} · ${bedLabel(s, b.bedId)} · `} actions={
        <Button disabled={!can(s.role, "payment.record") || bal <= 0 || inv.status === "void"} onClick={() => setOpen(true)}><Receipt className="size-4" />{t("تسجيل دفعة", "Record payment")}</Button>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[[t("إجمالي الفاتورة", "Total"), money(total), ""], [t("المحصل", "Paid"), money(paid), "text-success"], [t("الرصيد المتبقي", "Balance"), money(bal), "text-primary"], [t("متأخر", "Overdue"), money(invoiceOverdue(s, id)), "text-destructive"]].map(([k, v, c]) => (
          <div key={k} className="card-surface p-4"><p className="text-xs text-muted-foreground">{k}</p><p className={`mt-1 font-display text-2xl font-bold tabular-nums ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={t("بنود الفاتورة", "Invoice lines")}>
          <ul className="space-y-2 text-sm">{inv.lines.map((l) => <li key={l.label} className="flex justify-between"><span>{t(l.label, l.labelEn)} {l.kind === "deposit" && <Pill tone="info">{t("منفصل عن الإيراد", "Not revenue")}</Pill>}</span><span className="tabular-nums">{money(l.amount)}</span></li>)}
            <li className="flex justify-between border-t pt-2 font-semibold"><span>{t("الإجمالي", "Total")}</span><span>{money(total)}</span></li></ul>
          <p className="mt-3 text-xs text-muted-foreground">{t(`تأمين محتفظ به: ${money(depositHeld(s, id))} · رقم الحجز `, `Deposit held: ${money(depositHeld(s, id))} · booking `)}<Link to="/bookings/$id" params={{ id: b.id }} className="text-primary">{b.code}</Link></p>
          <p className="mt-4 text-xs font-medium text-muted-foreground">{t("جدول الاستحقاقات", "Schedule")}</p>
          <ul className="mt-1 space-y-1 text-xs">{inv.schedule.map((x, i) => <li key={i} className="flex justify-between"><span>{fmt(x.due)}</span><span>{money(x.amount)}</span></li>)}</ul>
        </Section>
        <Section title={t("سجل المدفوعات", "Payment history")} className="lg:col-span-2">
          {pays.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد مدفوعات بعد", "No payments yet")}</p>}
          <ul className="divide-y text-sm">{pays.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><b>{p.code}</b> · {t(...METHOD[p.method])} {p.reference && `· ${p.reference}`} {p.reversalOf && <Pill tone="warning">{t("قيد تصحيح:", "Correction:")} {p.note}</Pill>} {p.reversed && <Pill>{t("معكوس", "Reversed")}</Pill>}<span className="block text-xs text-muted-foreground">{p.user} · {fmt(p.at, true)}</span></span>
              <span className="flex items-center gap-2"><b className="tabular-nums">{money(p.amount)}</b>
                <Button size="sm" variant="ghost" onClick={() => setReceipt(p.id)}><Printer className="size-4" /></Button>
                {!p.reversed && !p.reversalOf && <Button size="sm" variant="ghost" disabled={!can(s.role, "payment.correct")} onClick={() => setCorr(p.id)} title={t("تصحيح موثق", "Documented correction")}><Undo2 className="size-4" /></Button>}</span>
            </li>))}</ul>
          <p className="mt-3 text-[11px] text-muted-foreground">{t("لا يمكن حذف عملية تحصيل معتمدة؛ يتم التصحيح بقيد عكسي موثق بالسبب.", "Approved payments can't be deleted; use a documented reversal.")}</p>
        </Section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("تسجيل دفعة", "Record payment")} — {inv.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("الرصيد الحالي:", "Current balance:")} <b>{money(bal)}</b> → {t("بعد الدفعة:", "after:")} <b className="text-primary">{money(bal - (Number(amount) || 0))}</b></p>
            <div><Label>{t("المبلغ", "Amount")}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>{t("طريقة الدفع", "Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(METHOD).map(([k, v]) => <SelectItem key={k} value={k}>{t(...v)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{t("المرجع (اختياري)", "Reference")}</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
            {method === "online_demo" && <p className="rounded-md bg-warning-soft p-2 text-xs text-warning">{t("محاكاة فقط — لا يتم تنفيذ أي دفع إلكتروني حقيقي.", "Simulation only — no real charge.")}</p>}
          </div>
          <DialogFooter><Button onClick={() => { const r = actions.recordPayment(id, Number(amount), method, ref); if (run(r, t("تم تسجيل الدفعة وإصدار الإيصال", "Payment recorded"))) { setOpen(false); setReceipt(r.ok ? r.data! : null); if (b.scenario && getState().scenario.tourActive) actions.tour({ step: 6 }); } }}>{t("تأكيد التسجيل", "Confirm")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rp} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          {rp && <div className="print-area space-y-3 text-sm">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><img src="/jasmine-mark.svg" alt="" className="size-7" />Jasmine Inn</h2><Pill tone="warning">{t("إيصال تجريبي", "Demo receipt")}</Pill></div>
            <p>{t("إيصال رقم", "Receipt")} <b>{rp.code}</b> · {fmt(rp.at, true)}</p>
            <p>{t("استلمنا من", "Received from")}: <b>{g.name}</b></p>
            <p>{t("المبلغ", "Amount")}: <b>{money(rp.amount)}</b> — {t(...METHOD[rp.method])}</p>
            <p>{t("عن الفاتورة", "For invoice")} {inv.code} · {bedLabel(s, b.bedId)}</p>
            <p>{t("الرصيد المتبقي", "Remaining balance")}: <b>{money(bal)}</b></p>
            <p className="text-xs text-muted-foreground">{t("المستلم:", "Received by:")} {rp.user}</p>
          </div>}
          <DialogFooter><Button onClick={() => window.print()}><Printer className="size-4" />{t("طباعة", "Print")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!corr} onOpenChange={(o) => !o && setCorr(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("قيد تصحيح موثق", "Documented correction")}</DialogTitle></DialogHeader>
          <Textarea placeholder={t("سبب التصحيح", "Reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button variant="destructive" onClick={() => { if (run(actions.correctPayment(corr!, reason), t("تم تسجيل قيد التصحيح", "Correction recorded"))) { setCorr(null); setReason(""); } }}>{t("تسجيل القيد", "Record")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
