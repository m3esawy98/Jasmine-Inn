import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, LogIn, LogOut, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Pill, Section, run } from "@/components/stay/kit";
import { actions, bedLabel, bedProperty, can, checkInBlockers, DEMO_TODAY, getState, guestName, inScope, invoiceBalance, useDemo } from "@/lib/demo/store";
import type { Booking } from "@/lib/demo/types";
import { useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stays")({
  head: () => meta("الإقامة والتسكين", "الوصول المتوقع وتسجيل الوصول والمغادرة مع قوائم تحقق منظمة."),
  component: Stays,
});

function Stays() {
  const s = useDemo();
  const t = useT();
  const scoped = (b: Booking) => { const p = bedProperty(s, b.bedId); return !p || inScope(s, p.id); };
  const arrivals = s.bookings.filter((b) => b.status === "confirmed" && b.start <= "2026-11-07" && scoped(b)).sort((a, b) => (b.scenario ? 1 : 0) - (a.scenario ? 1 : 0) || a.start.localeCompare(b.start));
  const inhouse = s.bookings.filter((b) => b.status === "checked_in" && scoped(b)).sort((a, b) => (b.scenario ? 1 : 0) - (a.scenario ? 1 : 0) || a.end.localeCompare(b.end));
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState(s.scenario.bookingId && s.bookings.find((b) => b.id === s.scenario.bookingId)?.status === "checked_in" ? "in" : "arr");
  return (
    <div>
      <PageHeader title={t("الإقامة والتسكين", "Stays & check-in")} subtitle={t("الإشغال الفعلي يبدأ عند تسجيل الوصول وينتهي عند تسجيل المغادرة.", "Actual occupancy starts at check-in.")} />
      <Tabs dir={s.lang === "ar" ? "rtl" : "ltr"} value={tab} onValueChange={(v) => { setTab(v); setSel(null); }}>
        <TabsList>
          <TabsTrigger value="arr">{t("الوصول المتوقع", "Arrivals")} ({arrivals.length})</TabsTrigger>
          <TabsTrigger value="in">{t("المقيمون حاليًا / المغادرة", "In-house / departures")} ({inhouse.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="arr"><Split list={arrivals} sel={sel} setSel={setSel} mode="in" /></TabsContent>
        <TabsContent value="in"><Split list={inhouse} sel={sel} setSel={setSel} mode="out" /></TabsContent>
      </Tabs>
    </div>
  );
}

function Split({ list, sel, setSel, mode }: { list: Booking[]; sel: string | null; setSel: (v: string) => void; mode: "in" | "out" }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const current = list.find((b) => b.id === sel) ?? list[0];
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section className="lg:col-span-2">
        <ul className="max-h-[560px] divide-y overflow-y-auto">
          {list.map((b) => (
            <li key={b.id}>
              <button onClick={() => setSel(b.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-start text-sm", current?.id === b.id && "bg-primary-soft")}>
                <span><span className="font-medium">{guestName(s, b.guestId)}</span>{b.scenario && <Pill tone="primary" className="ms-2">{t("السيناريو", "Scenario")}</Pill>}<span className="block text-xs text-muted-foreground">{bedLabel(s, b.bedId)}</span></span>
                <span className={cn("text-xs", (mode === "in" ? b.start : b.end) <= DEMO_TODAY ? "font-semibold text-primary" : "text-muted-foreground")}>{fmt(mode === "in" ? b.start : b.end)}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("لا توجد سجلات", "Nothing here")}</p>}
        </ul>
      </Section>
      <div className="lg:col-span-3">{current && (mode === "in" ? <CheckInPanel b={current} /> : <CheckOutPanel b={current} />)}</div>
    </div>
  );
}

function CheckInPanel({ b }: { b: Booking }) {
  const s = useDemo();
  const t = useT();
  const navigate = useNavigate();
  const [payOk, setPayOk] = useState(false);
  const bed = s.beds.find((x) => x.id === b.bedId)!;
  const room = s.rooms.find((r) => r.id === bed.roomId)!;
  const docsOk = b.docs.id && b.docs.enrollment && b.docs.photo;
  const blockers = checkInBlockers(s, b);
  const checks = [
    { ok: b.status === "confirmed", label: t("مراجعة الحجز: مؤكد", "Booking reviewed: confirmed") },
    { ok: docsOk, label: t("التحقق من المستندات المطلوبة", "Required documents verified"), docs: true },
    { ok: room.hk === "ready" && !blockers.some((x) => x.includes("مشغول")), label: t(`جاهزية السرير (${room.code} معتمدة)`, `Bed ready (${room.code} approved)`) },
    { ok: payOk, label: t("شرط الدفع: سداد الدفعة الأولى خلال 7 أيام من الوصول (شرط السيناريو)", "Payment term: first installment within 7 days (scenario rule)"), pay: true },
  ];
  const allOk = checks.every((c) => c.ok);
  const docs: [keyof Booking["docs"], string, string][] = [["id", "الهوية", "ID"], ["enrollment", "القيد / الجهة", "Enrollment"], ["photo", "صورة", "Photo"]];
  return (
    <Section title={`${t("تسجيل وصول", "Check-in")} — ${guestName(s, b.guestId)}`}>
      <p className="mb-4 text-sm text-muted-foreground">{bedLabel(s, b.bedId)} · {b.code}</p>
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className={cn("rounded-lg border p-3 text-sm", c.ok ? "border-success/30 bg-success-soft" : "bg-muted/30")}>
            <div className="flex items-center gap-2">{c.ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-muted-foreground" />}{c.label}</div>
            {c.docs && <div className="mt-2 flex flex-wrap gap-4 ps-6">{docs.map(([k, ar, en]) => <label key={k} className="flex items-center gap-1.5 text-xs"><Checkbox checked={b.docs[k]} onCheckedChange={() => actions.toggleDoc(b.id, k)} />{t(ar, en)}</label>)}</div>}
            {c.pay && <label className="mt-2 flex items-center gap-1.5 ps-6 text-xs"><Checkbox checked={payOk} onCheckedChange={(v) => setPayOk(!!v)} />{t("تمت مراجعة شرط الدفع مع الطالب", "Payment term reviewed")}</label>}
          </div>
        ))}
      </div>
      {!allOk && <p className="mt-3 text-sm text-destructive">{t("لا يمكن تسجيل الوصول: ", "Check-in blocked: ")}{[...blockers, ...(payOk ? [] : [t("شرط الدفع لم يُراجع", "payment term not reviewed")])].join(" • ")}</p>}
      <Button size="lg" className="mt-4 w-full" disabled={!allOk || !can(s.role, "stay.checkin")} onClick={() => {
        if (run(actions.checkIn(b.id), t("تم تسجيل الوصول وبدء الإقامة الفعلية", "Checked in")) && b.scenario && getState().scenario.tourActive) {
          actions.tour({ step: 5 });
          const inv = getState().invoices.find((i) => i.bookingId === b.id);
          if (inv) navigate({ to: "/finance/$id", params: { id: inv.id } });
        }
      }}><LogIn className="size-4" />{t("تسجيل الوصول", "Check in")}</Button>
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
  const stay = s.stays.find((x) => x.bookingId === b.id && x.status === "active");
  const bal = inv ? invoiceBalance(s, inv.id) : 0;
  const isEarly = DEMO_TODAY < b.end;
  return (
    <Section title={`${t("تسجيل مغادرة", "Check-out")} — ${guestName(s, b.guestId)}`}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{t("الوحدة", "Unit")}</dt><dd>{bedLabel(s, b.bedId)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("وقت الوصول", "Checked in")}</dt><dd>{stay ? fmt(stay.checkInAt, true) : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("نهاية العقد", "Contract end")}</dt><dd>{fmt(b.end)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{t("الرصيد المستحق", "Balance due")}</dt><dd className={cn("font-semibold", bal > 0 ? "text-destructive" : "text-success")}>{money(bal)}</dd></div>
      </dl>
      <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{t("ملخص قبل التأكيد", "Summary")}</p>
        <ul className="mt-1 list-disc ps-5 text-xs text-muted-foreground">
          <li>{t(`الرصيد المتبقي ${money(bal)} يبقى مستحقًا في الملف المالي`, `Remaining ${money(bal)} stays on the account`)}</li>
          <li>{t("التأمين يُسوّى بعد فحص الغرفة", "Deposit settled after inspection")}</li>
          <li>{t("ستُنشأ مهمة تنظيف وتصبح الغرفة «بانتظار التنظيف»", "A cleaning task will be created")}</li>
        </ul>
      </div>
      {isEarly && <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(!!v)} />{t("اعتماد مغادرة مبكرة (معتمدة داخل السيناريو التجريبي)", "Approve early check-out (demo)")}</label>}
      <Button size="lg" variant="destructive" className="mt-4 w-full" disabled={(isEarly && !early) || !can(s.role, "stay.checkout")} onClick={() => {
        if (run(actions.checkOut(b.id, early), t("تم تسجيل المغادرة وإنشاء مهمة تنظيف", "Checked out; cleaning task created")) && b.scenario && getState().scenario.tourActive) { actions.tour({ step: 7 }); navigate({ to: "/housekeeping" }); }
      }}><LogOut className="size-4" />{t("تأكيد المغادرة", "Confirm check-out")}</Button>
    </Section>
  );
}
