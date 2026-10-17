import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Section, StatusPill, run } from "@/components/stay/kit";
import { actions, bedLabel, bedProperty, can, getState, invoiceBalance, useDemo } from "@/lib/demo/store";
import { BOOKING_STATUS, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/bookings/$id")({
  head: () => meta("تفاصيل الحجز", "مراجعة الحجز وتأكيده وإنشاء العقد والفاتورة تلقائيًا."),
  component: BookingDetail,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const navigate = useNavigate();
  const [dlg, setDlg] = useState<null | "rejected" | "cancelled">(null);
  const [reason, setReason] = useState("");
  const b = s.bookings.find((x) => x.id === id);
  if (!b) return <p>{t("الحجز غير موجود", "Booking not found")}</p>;
  const g = s.guests.find((x) => x.id === b.guestId)!;
  const plan = s.plans.find((p) => p.id === b.planId)!;
  const contract = s.contracts.find((c) => c.bookingId === b.id);
  const inv = s.invoices.find((i) => i.bookingId === b.id);
  const prop = bedProperty(s, b.bedId);
  const review = can(s.role, "booking.review");
  return (
    <div>
      <PageHeader
        title={`${t("الحجز", "Booking")} ${b.code}`}
        subtitle={`${g.name} · ${bedLabel(s, b.bedId)} · ${prop ? t(prop.name, prop.nameEn) : ""}`}
        actions={
          <>
            <StatusPill map={BOOKING_STATUS} value={b.status} />
            {b.status === "pending" && (
              <>
                <Button disabled={!review} onClick={() => { if (run(actions.confirmBooking(b.id), t("تم تأكيد الحجز وإنشاء العقد والفاتورة", "Booking confirmed; contract & invoice created")) && getState().scenario.tourActive && b.scenario) { actions.tour({ step: 3 }); navigate({ to: "/stays", search: { tab: "arr" } }); } }}>
                  <CheckCircle2 className="size-4" /> {t("تأكيد الحجز", "Confirm booking")}
                </Button>
                <Button variant="outline" disabled={!review} onClick={() => setDlg("rejected")}><XCircle className="size-4" />{t("رفض", "Reject")}</Button>
              </>
            )}
            {["pending", "confirmed"].includes(b.status) && <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={!review} onClick={() => setDlg("cancelled")}><Ban className="size-4" />{t("إلغاء", "Cancel")}</Button>}
            {b.status === "confirmed" && <Button variant="secondary" onClick={() => navigate({ to: "/stays", search: { tab: "arr" } })}>{t("إلى الوصول المتوقع", "Go to arrivals")}</Button>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title={t("بيانات الحجز", "Booking details")}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <D k={t("الطالب / النزيل", "Guest")} v={<Link to="/guests" search={{ id: g.id }} className="text-primary">{g.name}</Link>} />
              <D k={t("التواصل", "Contact")} v={`${g.phone} · ${g.email}`} />
              <D k={t("الجهة", "Organization")} v={g.org ?? "—"} />
              <D k={t("الغرفة والسرير", "Room & bed")} v={bedLabel(s, b.bedId)} />
              <D k={t("فترة الإقامة", "Period")} v={`${fmt(b.start)} — ${fmt(b.end)}`} />
              <D k={t("خطة السعر", "Plan")} v={t(plan.name, plan.nameEn)} />
              <D k={t("رسوم الإقامة", "Rent")} v={money(b.rent)} />
              <D k={t("التأمين", "Deposit")} v={money(b.deposit)} />
            </dl>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title={t("العقد والفاتورة", "Contract & invoice")}>
            {contract && inv ? (
              <div className="space-y-2 text-sm">
                <p>{t("العقد:", "Contract:")} <Link to="/contracts" className="font-semibold text-primary">{contract.code}</Link></p>
                <p>{t("الفاتورة:", "Invoice:")} <Link to="/finance/$id" params={{ id: inv.id }} className="font-semibold text-primary">{inv.code}</Link></p>
                <p>{t("الرصيد المتبقي:", "Balance:")} <b>{money(invoiceBalance(s, inv.id))}</b></p>
                <p className="pt-2 text-xs text-muted-foreground">{t("جدول الاستحقاقات", "Schedule")}</p>
                <ul className="space-y-1 text-xs">{inv.schedule.map((x, i) => <li key={i} className="flex justify-between"><span>{fmt(x.due)}</span><span className="tabular-nums">{money(x.amount)}</span></li>)}</ul>
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("سيُنشأ العقد والفاتورة تلقائيًا عند التأكيد.", "Created automatically on confirmation.")}</p>}
          </Section>
          <Section title={t("سجل الأحداث", "Event log")}>
            <ol className="space-y-3 border-s-2 border-primary/30 ps-4 text-sm">
              {b.events.map((e, i) => (
                <li key={i} className="relative"><span className="absolute -start-[1.42rem] top-1.5 size-2.5 rounded-full bg-primary" /><p>{e.text}</p><p className="text-xs text-muted-foreground">{e.user} · {fmt(e.at, true)}</p></li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg === "rejected" ? t("رفض الحجز", "Reject booking") : t("إلغاء الحجز", "Cancel booking")}</DialogTitle></DialogHeader>
          <Textarea placeholder={t("السبب (مطلوب للتوثيق)", "Reason (required)")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button variant="destructive" onClick={() => { if (run(actions.rejectOrCancel(b.id, dlg!, reason), t("تم تنفيذ الإجراء", "Done"))) { setDlg(null); setReason(""); } }}>{t("تأكيد", "Confirm")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>;
}
