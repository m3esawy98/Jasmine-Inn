import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Section, StatusPill } from "@/components/stay/kit";
import { bedLabel, bedProperty, guestName, inScope, useDemo, DEMO_TODAY } from "@/lib/demo/store";
import { addDays } from "@/lib/demo/calc";
import { BOOKING_STATUS, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/")({
  head: () => meta("الحجوزات", "قائمة الحجوزات وحالاتها مع تقويم التوافر لكل سرير ووحدة."),
  component: Bookings,
});

function Bookings() {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const list = useMemo(
    () =>
      s.bookings.filter((b) => {
        const p = bedProperty(s, b.bedId);
        if (p && !inScope(s, p.id)) return false;
        if (st !== "all" && b.status !== st) return false;
        const k = q.trim();
        return !k || b.code.includes(k.toUpperCase()) || guestName(s, b.guestId).includes(k) || bedLabel(s, b.bedId).includes(k.toUpperCase());
      }),
    [s, q, st],
  );
  return (
    <div>
      <PageHeader title={t("الحجوزات", "Bookings")} subtitle={t("الحجز المؤكد لا يُحتسب إشغالًا فعليًا قبل تسجيل الوصول.", "Confirmed ≠ occupied until check-in.")} actions={<Button asChild><Link to="/bookings/new"><Plus className="size-4" />{t("حجز جديد", "New booking")}</Link></Button>} />
      <Tabs dir={s.lang === "ar" ? "rtl" : "ltr"} defaultValue="list">
        <TabsList><TabsTrigger value="list">{t("عرض جدولي", "List")}</TabsTrigger><TabsTrigger value="cal">{t("تقويم التوافر", "Availability calendar")}</TabsTrigger></TabsList>
        <TabsContent value="list">
          <Section>
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-60 flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالكود أو الاسم أو الغرفة", "Search code, name, room")} /></div>
              <Select value={st} onValueChange={setSt}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("كل الحالات", "All statuses")}</SelectItem>
                  {Object.entries(BOOKING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v[0], v[1])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr className="border-b text-start">{[t("الكود", "Code"), t("النزيل", "Guest"), t("الوحدة", "Unit"), t("الفترة", "Period"), t("القيمة", "Amount"), t("الحالة", "Status")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {list.slice(0, 80).map((b) => (
                    <tr key={b.id} className={cn("border-b last:border-0 hover:bg-muted/40", b.scenario && "bg-primary-soft/60")}>
                      <td className="px-3 py-2.5"><Link to="/bookings/$id" params={{ id: b.id }} className="font-semibold text-primary">{b.code}</Link></td>
                      <td className="px-3 py-2.5">{guestName(s, b.guestId)}</td>
                      <td className="px-3 py-2.5">{bedLabel(s, b.bedId)}</td>
                      <td className="px-3 py-2.5 text-xs">{fmt(b.start)} — {fmt(b.end)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money(b.rent + b.deposit)}</td>
                      <td className="px-3 py-2.5"><StatusPill map={BOOKING_STATUS} value={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">{t(`${list.length} حجز`, `${list.length} bookings`)}</p>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="cal"><Calendar /></TabsContent>
      </Tabs>
    </div>
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
