import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, BedDouble, CheckCircle2, FlaskConical, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Pill, Section } from "@/components/stay/kit";
import { actions, activeStayOnBed, bedConflict, can, getState, useDemo } from "@/lib/demo/store";
import { computeRent } from "@/lib/demo/calc";
import { useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import type { Gender } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings/new")({
  head: () => meta("حجز جديد", "إنشاء حجز مع فحص فوري للتوافر ومنع ازدواج حجز الأسرة."),
  component: NewBooking,
});

function NewBooking() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const navigate = useNavigate();
  const scenarioMode = !s.scenario.bookingId;
  const [propertyId, setProperty] = useState("p1");
  const [buildingId, setBuilding] = useState("b1");
  const [roomId, setRoom] = useState("r-A-204");
  const [bedId, setBed] = useState("r-A-204-2");
  const [planId, setPlan] = useState("pl-month");
  const [start, setStart] = useState("2026-11-01");
  const [end, setEnd] = useState("2027-02-28");
  const [g, setG] = useState<{ name: string; phone: string; email: string; nationalId: string; org: string; gender: Gender | "" }>(
    scenarioMode
      ? { name: "عمر حسن", phone: "01012345678", email: "omar.hassan@example.com", nationalId: "30405120101234", org: "جامعة القاهرة", gender: "male" }
      : { name: "", phone: "", email: "", nationalId: "", org: "", gender: "" },
  );
  const [error, setError] = useState<string | null>(null);

  const buildings = s.buildings.filter((b) => b.propertyId === propertyId);
  const rooms = s.rooms.filter((r) => r.buildingId === buildingId);
  const beds = s.beds.filter((b) => b.roomId === roomId);
  const room = s.rooms.find((r) => r.id === roomId);
  const plan = s.plans.find((p) => p.id === planId)!;
  const rent = computeRent(plan, start, end);
  // The booking just saved from this form, while its inputs are unchanged. The form stays open in the
  // scenario, so without this the availability check would report the new booking as a conflict with itself.
  const [saved, setSaved] = useState<{ id: string; code: string; key: string } | null>(null);
  const key = `${bedId}|${start}|${end}|${planId}`;
  const mine = saved?.key === key ? saved : null;
  const bedStatus = useMemo(
    () =>
      beds.map((b) => {
        const c = bedConflict(s, b.id, start, end, planId);
        const own = !!mine && c?.id === mine.id;
        return { bed: b, conflict: own ? undefined : c, own, occupiedNow: !!activeStayOnBed(s, b.id) };
      }),
    [beds, s, start, end, planId, mine],
  );
  const sel = bedStatus.find((x) => x.bed.id === bedId);
  const allowed = can(s.role, "booking.create");

  const save = () => {
    const kind = s.properties.find((p) => p.id === propertyId)?.type === "student" ? "student" : "guest";
    if (!g.gender) {
      const msg = t("حدد النوع (ذكر / أنثى)", "Select gender");
      setError(msg);
      toast.error(msg);
      return;
    }
    const res = actions.createBooking({ guest: { ...g, gender: g.gender, kind }, bedId, start, end, planId, scenario: scenarioMode });
    if (!res.ok) { setError(res.error); toast.error(res.error); return; }
    setError(null);
    setSaved({ id: res.data!.id, code: res.data!.code, key });
    toast.success(t(`تم حفظ الحجز ${res.data!.code} بحالة «قيد المراجعة»`, `Booking ${res.data!.code} saved as Under review`));
    if (getState().scenario.tourActive && scenarioMode) actions.tour({ step: 2 });
    else navigate({ to: "/bookings/$id", params: { id: res.data!.id } });
  };

  const conflictTest = () => {
    const sb = getState().bookings.find((b) => b.id === getState().scenario.bookingId);
    if (!sb) { toast.error(t("احفظ حجز السيناريو أولًا", "Save the scenario booking first")); return; }
    const res = actions.createBooking({ guest: { name: "ياسين مختار", phone: "01099990000", email: "yassin@example.com", nationalId: "30501010101010", kind: "student", gender: "male" }, bedId: sb.bedId, start: "2026-12-01", end: "2027-01-31", planId: "pl-month" });
    if (!res.ok) {
      setError(res.error);
      actions.markConflictTested();
      setRoom(s.beds.find((b) => b.id === sb.bedId)!.roomId);
      toast.error(t("رفض النظام الحجز المتداخل", "Overlapping booking rejected"));
    }
  };

  return (
    <div>
      <PageHeader
        title={t("حجز جديد", "New booking")}
        subtitle={t("فحص التوافر يتم على مستوى السرير لمنع الازدواج وتجاوز الطاقة الاستيعابية.", "Availability is checked per bed to prevent double-booking.")}
        actions={
          s.scenario.bookingId && (
            <Button variant="outline" onClick={conflictTest} disabled={!allowed}>
              <FlaskConical className="size-4" /> {t("اختبار حجز متداخل", "Test overlapping booking")}
            </Button>
          )
        }
      />
      {!allowed && <RoleNote />}
      {error && (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">
          <ShieldAlert className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">{t("تم رفض الحجز", "Booking rejected")}</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title={t("الوحدة والفترة", "Unit & period")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("المنشأة", "Property")}>
                <Select value={propertyId} onValueChange={(v) => { setProperty(v); const b = s.buildings.find((x) => x.propertyId === v)!; setBuilding(b.id); const r = s.rooms.find((x) => x.buildingId === b.id)!; setRoom(r.id); setBed(s.beds.find((x) => x.roomId === r.id)!.id); setPlan(v === "p1" ? "pl-month" : v === "p2" ? "pl-night" : "pl-week"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{s.properties.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("المبنى", "Building")}>
                <Select value={buildingId} onValueChange={(v) => { setBuilding(v); const r = s.rooms.find((x) => x.buildingId === v)!; setRoom(r.id); setBed(s.beds.find((x) => x.roomId === r.id)!.id); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{buildings.map((b) => <SelectItem key={b.id} value={b.id}>{t("مبنى", "Building")} {b.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("الغرفة / الشقة", "Room / apartment")}>
                <Select value={roomId} onValueChange={(v) => { setRoom(v); setBed(s.beds.find((x) => x.roomId === v)!.id); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.code} {r.hk === "maintenance" ? `(${t("صيانة", "maint.")})` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("خطة السعر", "Rate plan")}>
                <Select value={planId} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{s.plans.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)} — {money(p.price)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("بداية الإقامة", "Start")}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label={t("نهاية الإقامة", "End")}><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{t("اختر السرير / الوحدة — توافر الفترة المحددة", "Pick bed — availability for selected period")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {bedStatus.map(({ bed, conflict, own, occupiedNow }) => {
                  const blocked = !own && (!!conflict || room?.hk === "maintenance");
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      onClick={() => setBed(bed.id)}
                      className={cn(
                        "rounded-xl border p-3 text-start transition",
                        bed.id === bedId ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
                        own ? "bg-primary-soft" : blocked ? "bg-destructive-soft" : "bg-success-soft",
                      )}
                    >
                      <BedDouble className={cn("size-5", own ? "text-primary" : blocked ? "text-destructive" : "text-success")} />
                      <p className="mt-1 text-sm font-semibold">{bed.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {own ? `${t("حجزك", "Your booking")} ${mine!.code}` : blocked ? (conflict ? `${t("محجوز", "Booked")} ${conflict.code}` : t("خارج الخدمة", "Out of service")) : t("متاح للفترة", "Available")}
                        {occupiedNow && ` · ${t("مشغول حاليًا", "occupied now")}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
          <Section title={t("بيانات الطالب / النزيل", "Guest details")}>
            {scenarioMode && <Pill tone="primary" className="mb-3">{t("بيانات السيناريو التجريبي", "Scenario demo data")}</Pill>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("الاسم", "Name")}><Input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></Field>
              <Field label={t("الهاتف", "Phone")}><Input value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} /></Field>
              <Field label={t("البريد الإلكتروني", "Email")}><Input value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} /></Field>
              <Field label={t("الرقم القومي", "National ID")}><Input value={g.nationalId} onChange={(e) => setG({ ...g, nationalId: e.target.value })} /></Field>
              <Field label={t("الجامعة / الجهة", "University / company")}><Input value={g.org} onChange={(e) => setG({ ...g, org: e.target.value })} /></Field>
              <Field label={t("النوع", "Gender")}>
                <Select value={g.gender} onValueChange={(v) => setG({ ...g, gender: v as Gender })}>
                  <SelectTrigger><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("ذكر", "Male")}</SelectItem>
                    <SelectItem value="female">{t("أنثى", "Female")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title={t("نتيجة فحص التوافر", "Availability check")}>
            {sel?.own ? (
              <div className="flex gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"><CheckCircle2 className="size-5 shrink-0" />{t(`تم حجز ${room?.code} / ${sel.bed.label} بالحجز ${mine!.code} (قيد المراجعة)`, `${room?.code} / ${sel.bed.label} booked as ${mine!.code} (under review)`)}</div>
            ) : sel && !sel.conflict && room?.hk !== "maintenance" ? (
              <div className="flex gap-2 rounded-lg bg-success-soft p-3 text-sm text-success"><CheckCircle2 className="size-5 shrink-0" />{t(`${room?.code} / ${sel.bed.label} متاح من ${start} إلى ${end}`, `${room?.code} / ${sel.bed.label} available ${start} → ${end}`)}</div>
            ) : (
              <div className="flex gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{sel?.conflict ? t(`متعارض مع ${sel.conflict.code} (${sel.conflict.start} → ${sel.conflict.end})`, `Conflicts with ${sel.conflict.code}`) : t("الوحدة خارج الخدمة", "Out of service")}</div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t(`الأسرة المتاحة في الغرفة: ${bedStatus.filter((x) => !x.conflict && !x.own).length} من ${bedStatus.length}`, `Free beds in room: ${bedStatus.filter((x) => !x.conflict && !x.own).length}/${bedStatus.length}`)}</p>
          </Section>
          <Section title={t("السعر الإجمالي", "Total price")}>
            <dl className="space-y-2 text-sm">
              <Row k={t("رسوم الإقامة", "Accommodation")} v={money(rent)} />
              <Row k={t("التأمين (منفصل عن الإيراد)", "Deposit (separate)")} v={money(plan.deposit)} />
              <div className="border-t pt-2"><Row k={<b>{t("إجمالي الفاتورة", "Invoice total")}</b>} v={<b className="text-lg text-primary">{money(rent + plan.deposit)}</b>} /></div>
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("أرقام توضيحية للعرض وليست أسعارًا معتمدة.", "Illustrative figures only.")}</p>
            <Button className="mt-4 w-full" size="lg" onClick={save} disabled={!allowed || !!mine}>{t("حفظ الحجز (قيد المراجعة)", "Save booking (under review)")}</Button>
          </Section>
        </div>
      </div>
    </div>
  );
}

export function RoleNote() {
  const t = useT();
  return <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{t("الدور الحالي لا يملك صلاحية تنفيذ هذا الإجراء. غيّر الدور من القائمة العلوية (محاكاة).", "Current role can't perform this action. Switch role from the top bar (simulation).")}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}
