import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, LogIn, LogOut, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Pill, Section, run } from "@/components/stay/kit";
import { actions, bedLabel, bedProperty, can, checkInBlockers, checkoutSettlement, DEMO_TODAY, getState, guestName, inScope, inspectionChecklist, invoiceBalance, useDemo } from "@/lib/demo/store";
import type { Booking, ItemCondition } from "@/lib/demo/types";
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
  const inspected = b.inspection?.status === "approved";
  const settlement = checkoutSettlement(s, b);
  return (
    <div className="space-y-4">
      <InspectionCard key={b.id} b={b} />
      <Section title={`${t("تسجيل مغادرة", "Check-out")} — ${guestName(s, b.guestId)}`}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">{t("الوحدة", "Unit")}</dt><dd>{bedLabel(s, b.bedId)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("وقت الوصول", "Checked in")}</dt><dd>{stay ? fmt(stay.checkInAt, true) : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("نهاية العقد", "Contract end")}</dt><dd>{fmt(b.end)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("الرصيد الحالي", "Current balance")}</dt><dd className={cn("font-semibold", bal > 0 ? "text-destructive" : "text-success")}>{money(bal)}</dd></div>
        </dl>
        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{t("تسوية التأمين عند المغادرة", "Deposit settlement at check-out")}</p>
          {inspected ? (
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("التأمين", "Deposit")}</dt><dd>{money(settlement.deposit)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("خصومات الفحص المعتمدة", "Approved inspection charges")}</dt><dd className={cn(settlement.damages > 0 && "text-destructive")}>{money(settlement.damages)}</dd></div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <dt>{settlement.balanceAfter < 0 ? t("يُرد للنزيل بعد المغادرة", "Refund due to guest") : settlement.balanceAfter > 0 ? t("مستحق على النزيل بعد المغادرة", "Due from guest") : t("الحساب مسدد بالكامل", "Account settled")}</dt>
                <dd className={settlement.balanceAfter > 0 ? "text-destructive" : "text-success"}>{money(Math.abs(settlement.balanceAfter))}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("تُحسب بعد فحص الغرفة: الخصومات تُخصم من التأمين أولًا، وأي زيادة تُضاف على الفاتورة.", "Calculated after the room inspection: charges come out of the deposit first; anything beyond it is added to the invoice.")}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("ستُنشأ مهمة تنظيف للغرفة بعد التأكيد.", "A cleaning task will be created.")}</p>
        </div>
        {isEarly && <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={early} onCheckedChange={(v) => setEarly(!!v)} />{t("اعتماد مغادرة مبكرة (معتمدة داخل السيناريو التجريبي)", "Approve early check-out (demo)")}</label>}
        {!inspected && <p className="mt-3 text-sm text-destructive">{t("لا يمكن تأكيد المغادرة قبل فحص الغرفة واعتماد المدير لأي خصومات.", "Check-out needs the room inspection, and a manager's approval of any charges.")}</p>}
        <Button size="lg" variant="destructive" className="mt-4 w-full" disabled={!inspected || (isEarly && !early) || !can(s.role, "stay.checkout")} onClick={() => {
          if (run(actions.checkOut(b.id, early), t("تم تسجيل المغادرة وتسوية التأمين وإنشاء مهمة تنظيف", "Checked out; deposit settled; cleaning task created")) && b.scenario && getState().scenario.tourActive) { actions.tour({ step: 7 }); navigate({ to: "/housekeeping" }); }
        }}><LogOut className="size-4" />{t("تأكيد المغادرة", "Confirm check-out")}</Button>
      </Section>
    </div>
  );
}

const CONDITIONS: [ItemCondition, string, string][] = [
  ["ok", "سليم", "OK"],
  ["damaged", "تالف", "Damaged"],
  ["missing", "مفقود", "Missing"],
];
type Row = { condition: ItemCondition; note: string; charge: string };

/** Pre-check-out room inspection: housekeeping records it, a manager approves any charges. */
function InspectionCard({ b }: { b: Booking }) {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const checklist = inspectionChecklist(s, b.bedId);
  const ins = b.inspection;
  const fromInspection = (): Record<string, Row> =>
    Object.fromEntries(
      checklist.map((c) => {
        const it = ins?.items.find((x) => x.key === c.key);
        return [c.key, { condition: it?.condition ?? "ok", note: it?.note ?? "", charge: it && it.charge ? String(it.charge) : "" }];
      }),
    );
  const [rows, setRows] = useState(fromInspection);
  const [editing, setEditing] = useState(!ins || ins.status === "rejected");
  const [reject, setReject] = useState("");
  const canInspect = can(s.role, "stay.inspect");
  const canApprove = can(s.role, "inspection.approve");
  const total = Object.values(rows).reduce((a, r) => a + (r.condition === "ok" ? 0 : Number(r.charge) || 0), 0);
  const set = (key: string, patch: Partial<Row>) => setRows({ ...rows, [key]: { ...rows[key], ...patch } });
  const submit = () => {
    const res = actions.recordInspection(
      b.id,
      checklist.map((c) => ({ key: c.key, condition: rows[c.key].condition, note: rows[c.key].note, charge: rows[c.key].charge === "" ? 0 : Number(rows[c.key].charge) })),
    );
    if (run(res, total > 0 ? t("تم تسجيل الفحص وإرساله لاعتماد المدير", "Inspection recorded; sent for manager approval") : t("تم تسجيل الفحص — كل المحتويات سليمة", "Inspection recorded — all in order"))) setEditing(false);
  };
  const statusPill = ins && !editing && (
    <Pill tone={ins.status === "approved" ? "success" : ins.status === "rejected" ? "destructive" : "warning"}>
      {ins.status === "approved" ? t("معتمد", "Approved") : ins.status === "rejected" ? t("مرفوض", "Rejected") : t("بانتظار اعتماد المدير", "Awaiting manager approval")}
    </Pill>
  );
  return (
    <Section title={t("فحص الغرفة قبل المغادرة", "Pre-check-out room inspection")} actions={statusPill}>
      {ins?.status === "rejected" && (
        <p className="mb-3 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
          {t("رفض المدير الخصومات:", "Manager rejected the charges:")} {ins.rejectReason} — {t("أعد الفحص.", "Please re-inspect.")}
        </p>
      )}
      {editing ? (
        <>
          {!canInspect && <p className="mb-3 text-sm text-muted-foreground">{t("يسجّل الفحص مسؤول النظافة والصيانة.", "The inspection is recorded by housekeeping.")}</p>}
          <ul className="space-y-2">
            {checklist.map((c) => {
              const r = rows[c.key];
              return (
                <li key={c.key} className={cn("rounded-lg border p-3", r.condition !== "ok" && "border-destructive/30 bg-destructive-soft/40")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t(c.label, c.labelEn)}</span>
                    <div className="flex gap-1">
                      {CONDITIONS.map(([k, ar, en]) => (
                        <Button key={k} type="button" size="sm" variant={r.condition === k ? (k === "ok" ? "default" : "destructive") : "outline"} className="h-7 px-2.5 text-xs" disabled={!canInspect} onClick={() => set(c.key, { condition: k })}>
                          {t(ar, en)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {r.condition !== "ok" && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Input className="sm:col-span-2" placeholder={t("وصف التلف أو المفقود", "Describe the damage or missing item")} value={r.note} disabled={!canInspect} onChange={(e) => set(c.key, { note: e.target.value })} />
                      <Input type="number" min={0} placeholder={t("قيمة الخصم (ج.م.)", "Charge (EGP)")} value={r.charge} disabled={!canInspect} onChange={(e) => set(c.key, { charge: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{t("إجمالي الخصومات:", "Total charges:")} <b className={cn(total > 0 && "text-destructive")}>{money(total)}</b>{total > 0 && <span className="ms-2 text-xs text-muted-foreground">{t("تحتاج اعتماد المدير", "needs manager approval")}</span>}</span>
            <div className="flex gap-2">
              {ins && ins.status !== "rejected" && <Button variant="ghost" onClick={() => { setRows(fromInspection()); setEditing(false); }}>{t("إلغاء", "Cancel")}</Button>}
              <Button disabled={!canInspect} onClick={submit}><ClipboardCheck className="size-4" />{t("تسجيل الفحص", "Record inspection")}</Button>
            </div>
          </div>
        </>
      ) : ins ? (
        <>
          <p className="text-xs text-muted-foreground">{t("سجّله", "Recorded by")} {ins.by} · {fmt(ins.at, true)}{ins.reviewedBy && ` · ${ins.status === "approved" ? t("اعتمده", "approved by") : t("رفضه", "rejected by")} ${ins.reviewedBy}`}</p>
          {ins.items.every((x) => x.condition === "ok") ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{t("كل محتويات الغرفة سليمة.", "Everything in the room is in good condition.")}</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {ins.items.filter((x) => x.condition !== "ok").map((x) => (
                <li key={x.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{t(x.label, x.labelEn)}</b> <Pill tone="destructive">{x.condition === "missing" ? t("مفقود", "Missing") : t("تالف", "Damaged")}</Pill><span className="block text-xs text-muted-foreground">{x.note}</span></span>
                  <span className="tabular-nums">{money(x.charge)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 font-semibold"><span>{t("إجمالي الخصومات", "Total charges")}</span><span>{money(ins.total)}</span></li>
            </ul>
          )}
          {ins.status === "pending_approval" && (
            canApprove ? (
              <div className="mt-3 space-y-2 rounded-lg border border-warning/30 bg-warning-soft p-3">
                <p className="text-sm font-medium">{t("اعتماد الخصومات (المدير)", "Approve charges (manager)")}</p>
                <Textarea placeholder={t("سبب الرفض (مطلوب عند الرفض)", "Reason (required to reject)")} value={reject} onChange={(e) => setReject(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => run(actions.reviewInspection(b.id, true), t("تم اعتماد الخصومات", "Charges approved"))}><CheckCircle2 className="size-4" />{t("اعتماد الخصومات", "Approve charges")}</Button>
                  <Button variant="outline" onClick={() => { if (run(actions.reviewInspection(b.id, false, reject), t("تم رفض الخصومات وإعادة الفحص", "Charges rejected"))) { setReject(""); setEditing(true); } }}><XCircle className="size-4" />{t("رفض", "Reject")}</Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-warning">{t("بانتظار اعتماد المدير للخصومات قبل المغادرة.", "Waiting for a manager to approve the charges.")}</p>
            )
          )}
          {canInspect && <Button variant="link" className="mt-1 h-auto px-0 text-xs" onClick={() => setEditing(true)}>{t("إعادة الفحص", "Re-inspect")}</Button>}
        </>
      ) : null}
    </Section>
  );
}
