import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";
import { PageHeader, Pill, Section } from "@/components/stay/kit";
import { activeStayOnBed, useDemo } from "@/lib/demo/store";
import { useNum, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";

export const Route = createFileRoute("/properties")({
  head: () => meta("المنشآت والمباني", "إدارة المنشآت والمباني والأدوار والطاقة الاستيعابية."),
  component: Properties,
});

const TYPE: Record<string, [string, string]> = { student: ["سكن طلبة", "Student housing"], hotel: ["فندق", "Hotel"], apartments: ["شقق فندقية", "Serviced apartments"] };

function Properties() {
  const s = useDemo();
  const t = useT();
  const num = useNum();
  return (
    <div>
      <PageHeader title={t("المنشآت والمباني", "Properties & buildings")} subtitle={t("رؤية موحدة لكل المنشآت والطاقة الاستيعابية الفعلية.", "Unified view of all properties and capacity.")} />
      <div className="grid gap-4 lg:grid-cols-3">
        {s.properties.map((p) => {
          const rooms = s.rooms.filter((r) => r.propertyId === p.id);
          const beds = s.beds.filter((b) => rooms.some((r) => r.id === b.roomId));
          const occ = beds.filter((b) => activeStayOnBed(s, b.id)).length;
          const pct = Math.round((occ / beds.length) * 100);
          return (
            <Section key={p.id}>
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" /></span>
                <Pill tone="primary">{t(...TYPE[p.type])}</Pill>
              </div>
              <h2 className="mt-3 text-lg font-bold">{t(p.name, p.nameEn)}</h2>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{t(p.city, p.cityEn)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{num(rooms.length)}</p><p className="text-xs text-muted-foreground">{t("وحدات", "Units")}</p></div>
                <div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{num(beds.length)}</p><p className="text-xs text-muted-foreground">{t("السعة", "Capacity")}</p></div>
                <div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{num(rooms.filter((r) => r.hk === "maintenance").length)}</p><p className="text-xs text-muted-foreground">{t("صيانة", "Maint.")}</p></div>
              </div>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>{t("الإشغال الفعلي", "Occupancy")}</span><b>{num(pct)}٪</b></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{t("المباني", "Buildings")}</p>
              <div className="mt-1 flex flex-wrap gap-2">{s.buildings.filter((b) => b.propertyId === p.id).map((b) => <Pill key={b.id}>{t("مبنى", "Bldg")} {b.name} · {num(b.floors)} {t("أدوار", "floors")}</Pill>)}</div>
              <p className="mt-3 text-xs font-medium text-muted-foreground">{t("المرافق", "Amenities")}</p>
              <p className="mt-1 text-sm">{p.amenities.join(" · ")}</p>
              <Link to="/units" search={{ q: undefined }} className="mt-4 inline-block text-sm font-medium text-primary">{t("عرض توزيع الغرف ←", "View room map →")}</Link>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
