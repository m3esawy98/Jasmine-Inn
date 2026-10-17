import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Hourglass, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Pill, Section, StatusPill } from "@/components/stay/kit";
import { bedLabel, bedProperty, guestName, inScope, useDemo, DEMO_TODAY } from "@/lib/demo/store";
import { addDays } from "@/lib/demo/calc";
import { BOOKING_STATUS, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import type { Booking } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/")({
  // `created`: a booking just saved from the new-booking form, shown first and marked.
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" && s.status in BOOKING_STATUS ? s.status : undefined,
    created: typeof s.created === "string" ? s.created : undefined,
  }),
  head: () => meta("الحجوزات", "قائمة الحجوزات وحالاتها مع تقويم التوافر لكل سرير ووحدة."),
  component: Bookings,
});

function Bookings() {
  const s = useDemo();
  const t = useT();
  const search = Route.useSearch();
  const pending = s.bookings.filter((b) => b.status === "pending" && inScopeBooking(s, b)).length;
  return (
    <div>
      <PageHeader title={t("الحجوزات", "Bookings")} subtitle={t("الحجز المؤكد لا يُحتسب إشغالًا فعليًا قبل تسجيل الدخول.", "Confirmed ≠ occupied until check-in.")} actions={<Button asChild><Link to="/bookings/new"><Plus className="size-4" />{t("حجز جديد", "New booking")}</Link></Button>} />
      <Tabs dir={s.lang === "ar" ? "rtl" : "ltr"} defaultValue={search.status === "pending" ? "pending" : "all"}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5"><Hourglass className="size-4" />{t("حجوزات قيد المراجعة", "Pending review")} ({pending.toLocaleString(s.lang === "ar" ? "ar-EG" : "en")})</TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5"><List className="size-4" />{t("جميع الحجوزات", "All bookings")}</TabsTrigger>
          <TabsTrigger value="cal" className="gap-1.5"><CalendarDays className="size-4" />{t("تقويم التوافر", "Availability calendar")}</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><BookingList status="pending" created={search.created} /></TabsContent>
        <TabsContent value="all"><BookingList initialStatus={search.status && search.status !== "pending" ? search.status : "all"} created={search.created} /></TabsContent>
        <TabsContent value="cal"><Calendar /></TabsContent>
      </Tabs>
    </div>
  );
}

const inScopeBooking = (s: ReturnType<typeof useDemo>, b: Booking) => {
  const p = bedProperty(s, b.bedId);
  return !p || inScope(s, p.id);
};

/** Bookings table: fixed to one `status`, or with a status filter starting at `initialStatus`. */
function BookingList({ status, initialStatus = "all", created }: { status?: string; initialStatus?: string; created?: string }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const [q, setQ] = useState("");
  const [picked, setSt] = useState(initialStatus);
  const st = status ?? picked;
  const list = useMemo(
    () =>
      s.bookings.filter((b) => {
        if (!inScopeBooking(s, b)) return false;
        if (st !== "all" && b.status !== st) return false;
        const k = q.trim();
        return !k || b.code.includes(k.toUpperCase()) || guestName(s, b.guestId).includes(k) || bedLabel(s, b.bedId).includes(k.toUpperCase());
      }).sort((a, b) => (b.id === created ? 1 : 0) - (a.id === created ? 1 : 0)),
    [s, q, st, created],
  );
  return (
    <Section>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالكود أو الاسم أو الغرفة", "Search code, name, room")} /></div>
        {!status && (
          <Select value={st} onValueChange={setSt}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("كل الحالات", "All statuses")}</SelectItem>
              {Object.entries(BOOKING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v[0], v[1])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b text-start">{[t("الكود", "Code"), t("النزيل", "Guest"), t("الوحدة", "Unit"), t("الفترة", "Period"), t("القيمة", "Amount"), t("الحالة", "Status")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {list.slice(0, 80).map((b) => (
              <tr key={b.id} className={cn("border-b last:border-0 hover:bg-muted/40", b.scenario && "bg-primary-soft/60", b.id === created && "bg-success-soft")}>
                <td className="px-3 py-2.5"><Link to="/bookings/$id" params={{ id: b.id }} className="font-semibold text-primary">{b.code}</Link>{b.id === created && <Pill tone="success" className="ms-2">{t("جديد", "New")}</Pill>}</td>
                <td className="px-3 py-2.5">{guestName(s, b.guestId)}</td>
                <td className="px-3 py-2.5">{bedLabel(s, b.bedId)}</td>
                <td className="px-3 py-2.5 text-xs">{fmt(b.start)} — {fmt(b.end)}</td>
                <td className="px-3 py-2.5 tabular-nums">{money(b.rent + b.deposit)}</td>
                <td className="px-3 py-2.5"><StatusPill map={BOOKING_STATUS} value={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{status === "pending" ? t("لا توجد حجوزات تنتظر المراجعة", "Nothing waiting for review") : t("لا توجد حجوزات", "No bookings")}</p>}
        {list.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{t(`${list.length} حجز`, `${list.length} bookings`)}</p>}
      </div>
    </Section>
  );
}

function Calendar() {
  const s = useDemo();
  const t = useT();
  const [pid, setPid] = useState("p1");
  const days = Array.from({ length: 21 }, (_, i) => addDays(DEMO_TODAY, i - 3));
  const beds = s.beds.filter((b) => s.rooms.find((r) => r.id === b.roomId)!.propertyId === pid).slice(0, 40);
  const colors: Record<string, string> = { pending: "bg-warning/70", confirmed: "bg-info/70", checked_in: "bg-success/80", checked_out: "bg-muted-foreground/30" };
  return (
    <Section title={t("تقويم التوافر (21 يومًا)", "Availability (21 days)")} actions={
      <Select value={pid} onValueChange={setPid}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{s.properties.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>)}</SelectContent></Select>
    }>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead><tr><th className="sticky start-0 bg-card px-2 py-1 text-start">{t("السرير", "Bed")}</th>{days.map((d) => <th key={d} className={cn("w-8 px-0.5 py-1 font-normal text-muted-foreground", d === DEMO_TODAY && "text-primary font-bold")}>{d.slice(8)}</th>)}</tr></thead>
          <tbody>
            {beds.map((b) => (
              <tr key={b.id}>
                <td className="sticky start-0 whitespace-nowrap bg-card px-2 py-0.5">{bedLabel(s, b.id)}</td>
                {days.map((d) => {
                  const bk = s.bookings.find((x) => x.bedId === b.id && ["pending", "confirmed", "checked_in"].includes(x.status) && x.start <= d && x.end >= d);
                  return <td key={d} className="px-0.5 py-0.5"><div title={bk?.code} className={cn("h-5 w-7 rounded", bk ? colors[bk.status] : "bg-muted")} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {(["pending", "confirmed", "checked_in"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-3 rounded", colors[k])} />{t(BOOKING_STATUS[k][0], BOOKING_STATUS[k][1])}</span>)}
      </div>
    </Section>
  );
}
