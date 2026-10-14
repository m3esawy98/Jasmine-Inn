import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Section } from "@/components/stay/kit";
import { activeStayOnBed, DEMO_TODAY, invoiceBalance, invoiceOverdue, roomStatus, useDemo } from "@/lib/demo/store";
import { addDays } from "@/lib/demo/calc";
import { TASK_STATUS, UNIT_STATUS, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/reports")({
  head: () => meta("التقارير والتحليلات", "تقارير الإشغال الفعلي والمستقبلي والتوافر والتحصيل وأداء التشغيل."),
  component: Reports,
});
const C = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-destructive)"];

function Reports() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const byProp = s.properties.map((p) => {
    const rooms = s.rooms.filter((r) => r.propertyId === p.id);
    const beds = s.beds.filter((b) => rooms.some((r) => r.id === b.roomId));
    const ids = new Set(beds.map((b) => b.id));
    const occ = beds.filter((b) => activeStayOnBed(s, b.id)).length;
    const fut = s.bookings.filter((b) => ids.has(b.bedId) && b.status === "confirmed").length;
    const avail = rooms.reduce((a, r) => { const st = roomStatus(s, r.id); return st === "available" || st === "partial" ? a + s.beds.filter((b) => b.roomId === r.id && !activeStayOnBed(s, b.id)).length : a; }, 0);
    const inv = s.invoices.filter((i) => ids.has(s.bookings.find((b) => b.id === i.bookingId)!.bedId) && i.status === "open");
    return { name: t(p.name, p.nameEn), occ, fut, avail, due: inv.reduce((a, i) => a + Math.max(0, invoiceBalance(s, i.id)), 0), od: inv.reduce((a, i) => a + invoiceOverdue(s, i.id), 0) };
  });
  const flow = Array.from({ length: 7 }, (_, i) => { const d = addDays(DEMO_TODAY, i); return { name: d.slice(5), arr: s.bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status) && b.start === d).length, dep: s.bookings.filter((b) => b.status === "checked_in" && b.end === d).length }; });
  const unitMix = Object.keys(UNIT_STATUS).map((k) => ({ name: t(UNIT_STATUS[k][0], UNIT_STATUS[k][1]), value: s.rooms.filter((r) => roomStatus(s, r.id) === k).length }));
  const taskMix = Object.keys(TASK_STATUS).map((k) => ({ name: t(TASK_STATUS[k as keyof typeof TASK_STATUS][0], TASK_STATUS[k as keyof typeof TASK_STATUS][1]), value: s.tasks.filter((x) => x.status === k).length }));
  const ax = { reversed: s.lang === "ar" };
  return (
    <div className="space-y-4">
      <PageHeader title={t("التقارير والتحليلات", "Reports & analytics")} subtitle={t("كل التقارير محسوبة مباشرة من بيانات العرض.", "Computed live from demo data.")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("الإشغال الفعلي والمستقبلي والتوافر حسب المنشأة", "Occupancy, future & availability")}><div className="h-64"><ResponsiveContainer><BarChart data={byProp}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} {...ax} /><YAxis orientation={s.lang === "ar" ? "right" : "left"} /><Tooltip /><Legend /><Bar dataKey="occ" name={t("مشغول", "Occupied")} fill={C[0]} radius={[4, 4, 0, 0]} /><Bar dataKey="fut" name={t("مستقبلي مؤكد", "Future")} fill={C[4]} radius={[4, 4, 0, 0]} /><Bar dataKey="avail" name={t("متاح", "Available")} fill={C[2]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Section>
        <Section title={t("الوصول والمغادرة - 7 أيام", "Arrivals & departures - 7 days")}><div className="h-64"><ResponsiveContainer><BarChart data={flow}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" {...ax} /><YAxis allowDecimals={false} orientation={s.lang === "ar" ? "right" : "left"} /><Tooltip /><Legend /><Bar dataKey="arr" name={t("وصول", "Arrivals")} fill={C[0]} radius={[4, 4, 0, 0]} /><Bar dataKey="dep" name={t("مغادرة", "Departures")} fill={C[3]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Section>
        <Section title={t("حالة الوحدات", "Unit status")}><div className="h-64"><ResponsiveContainer><PieChart><Pie data={unitMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{unitMix.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></Section>
        <Section title={t("أداء مهام النظافة والصيانة", "Housekeeping performance")}><div className="h-64"><ResponsiveContainer><PieChart><Pie data={taskMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{taskMix.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></Section>
      </div>
      <Section title={t("التحصيل والمتأخرات حسب المنشأة", "Receivables by property")}>
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="px-3 py-2 text-start">{t("المنشأة", "Property")}</th><th className="px-3 py-2 text-start">{t("المستحق", "Outstanding")}</th><th className="px-3 py-2 text-start">{t("المتأخر", "Overdue")}</th></tr></thead>
          <tbody>{byProp.map((p) => <tr key={p.name} className="border-b"><td className="px-3 py-2">{p.name}</td><td className="px-3 py-2">{money(p.due)}</td><td className="px-3 py-2 text-destructive">{money(p.od)}</td></tr>)}</tbody></table>
      </Section>
    </div>
  );
}
