import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, BedDouble, DoorClosed, House, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, Section, StatusPill, run } from "@/components/stay/kit";
import { actions, activeStayOnBed, can, DEMO_TODAY, guestName, roomGenders, roomStatus, upcomingBookingOnBed, useDemo } from "@/lib/demo/store";
import { UNIT_STATUS, useNum, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import type { Room, RoomType } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

/** Apartments and hotel rooms are booked whole, so they show one unit icon rather than a bed that reads as "one bed". */
const UnitIcon = ({ type, className }: { type?: RoomType; className?: string }) =>
  type === "apartment" ? <House className={className} /> : type === "hotel" ? <DoorClosed className={className} /> : <BedDouble className={className} />;

/** Room sizes to filter by: student rooms by their bed count, hotel rooms by how many they sleep. Apartments are all one size. */
const ROOM_SIZE: [string, string, string][] = [["single", "فردي", "Single"], ["double", "ثنائي", "Double"], ["quad", "رباعي", "Quad"]];
const roomSize = (r: Room) => (r.type === "hotel" ? (r.sleeps === 1 ? "single" : "double") : r.type);

export const Route = createFileRoute("/units")({
  // `from`: set by the properties page so this page offers a way back to it.
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
    pid: typeof s.pid === "string" ? s.pid : undefined,
    from: s.from === "properties" ? ("properties" as const) : undefined,
  }),
  head: () => meta("الغرف والشقق والأسرة", "عرض مرئي لتوزيع الغرف والأسرة وحالتها وحجب الوحدات للصيانة."),
  component: Units,
});

function Units() {
  const s = useDemo();
  const t = useT();
  const num = useNum();
  const shortDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(s.lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "long",
      // Only show the year when it isn't the current demo year.
      ...(d.slice(0, 4) !== DEMO_TODAY.slice(0, 4) && { year: "numeric" }),
    });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [pid, setPid] = useState(s.properties.some((p) => p.id === search.pid) ? search.pid! : s.propertyFilter === "all" ? "p1" : s.propertyFilter);
  const [q, setQ] = useState(search.q ?? "");
  const [st, setSt] = useState("all");
  const [type, setType] = useState("all");
  // Sizes present in this property, so the hotel offers single and double and apartments get no filter.
  const sizes = ROOM_SIZE.filter(([k]) => s.rooms.some((r) => r.propertyId === pid && roomSize(r) === k));
  const [block, setBlock] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rooms = s.rooms.filter((r) => r.propertyId === pid && (!q || r.code.includes(q.toUpperCase())) && (st === "all" || roomStatus(s, r.id) === st) && (type === "all" || roomSize(r) === type));
  const buildings = s.buildings.filter((b) => b.propertyId === pid);
  // Each property's rooms share one kind (beds, hotel rooms or apartments), so the legend follows it.
  const legendType = s.rooms.find((r) => r.propertyId === pid)?.type;
  // Same words as the student room-type filter: single, double, quad.
  const size = (n: number) => (n === 1 ? t("فردي", "single") : n === 2 ? t("ثنائي", "double") : n === 4 ? t("رباعي", "quad") : t(`${num(n)} أفراد`, `for ${n}`));
  return (
    <div>
      <PageHeader title={t("الغرف والشقق والأسرة", "Rooms, apartments & beds")} subtitle={t("حالة كل سرير محسوبة من الإقامات الفعلية واعتماد الجاهزية.", "Bed status derives from real stays and readiness.")} actions={search.from === "properties" && (
        <Button variant="outline" asChild>
          <Link to="/properties">
            <ArrowRight className="size-4 ltr:rotate-180" />
            {t("المنشآت والمباني", "Properties & buildings")}
          </Link>
        </Button>
      )} />
      <Section>
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={pid} onValueChange={(v) => { setPid(v); setType("all"); }}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{s.properties.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>)}</SelectContent></Select>
          <Input className="w-40" placeholder={t("رقم الغرفة", "Room code")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={st} onValueChange={setSt}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("كل الحالات", "All")}</SelectItem>{Object.entries(UNIT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v[0], v[1])}</SelectItem>)}</SelectContent></Select>
          {sizes.length > 1 && (
            <Select value={type} onValueChange={setType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("كل الأنواع", "All types")}</SelectItem>{sizes.map(([k, ar, en]) => <SelectItem key={k} value={k}>{t(ar, en)}</SelectItem>)}</SelectContent></Select>
          )}
        </div>
        {buildings.map((b) => {
          const br = rooms.filter((r) => r.buildingId === b.id);
          if (!br.length) return null;
          return (
            <div key={b.id} className="mb-6">
              <h3 className="mb-3 text-sm font-semibold">{t("مبنى", "Building")} {b.name}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {br.map((r) => {
                  const beds = s.beds.filter((x) => x.roomId === r.id);
                  const status = roomStatus(s, r.id);
                  // Partially free rooms with a female resident must only take female students.
                  const female = roomGenders(s, r.id).has("female");
                  const girls = status === "partial" && female;
                  // Free beds already promised to an upcoming (pending or confirmed) booking.
                  const upcoming = beds
                    .filter((bd) => !activeStayOnBed(s, bd.id))
                    .map((bd) => upcomingBookingOnBed(s, bd.id))
                    .filter((b) => !!b)
                    .sort((a, b) => a.start.localeCompare(b.start));
                  // Occupied, then upcoming, then free, so they sit in that order from the start (right in Arabic).
                  const rank = (bedId: string) => (activeStayOnBed(s, bedId) ? 0 : upcomingBookingOnBed(s, bedId) ? 1 : 2);
                  return (
                    <div
                      key={r.id}
                      // Every room opens its page: who is staying there, and a new booking for free ones.
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate({ to: "/rooms/$id", params: { id: r.id } })}
                      onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && navigate({ to: "/rooms/$id", params: { id: r.id } })}
                      className="cursor-pointer rounded-xl border p-3 transition hover:border-primary/50 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between"><b>{r.code}</b>{can(s.role, "unit.edit") && r.hk === "ready" && <button title={t("حجب للصيانة", "Block")} onClick={(e) => { e.stopPropagation(); setBlock(r.id); }}><Lock className="size-3.5 text-muted-foreground hover:text-destructive" /></button>}</div>
                      {(r.type === "apartment" || r.type === "hotel") && <p className="text-xs text-muted-foreground">{r.type === "apartment" ? t(`شقة ${size(r.sleeps)}`, `Apartment (${size(r.sleeps)})`) : t(`غرفة ${size(r.sleeps)}`, `Room (${size(r.sleeps)})`)}</p>}
                      <div className="my-2 flex flex-wrap gap-1">{[...beds].sort((x, y) => rank(x.id) - rank(y.id)).map((bd) => { const st2 = activeStayOnBed(s, bd.id); const bk = st2 && s.bookings.find((x) => x.id === st2.bookingId); const next = !st2 && upcomingBookingOnBed(s, bd.id); return <span key={bd.id} title={bk ? guestName(s, bk.guestId) : next ? `${bd.label} · ${t("حجز قادم", "Upcoming")} ${next.code} ${shortDate(next.start)}` : bd.label}><UnitIcon type={r.type} className={cn("size-5", st2 ? "text-muted-foreground/60" : r.hk !== "ready" ? "text-warning" : next ? "text-info" : "text-success")} /></span>; })}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill map={UNIT_STATUS} value={status} />
                        {girls && <Pill tone="female">{t("بنات فقط", "Female only")}</Pill>}
                        {status === "full" && female && <Pill tone="female">{r.type === "hotel" || r.type === "apartment" ? t("نزيلة", "Female guest") : t("بنات", "Female")}</Pill>}
                      </div>
                      {upcoming.length > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-info">
                          {upcoming.length === 1
                            ? t(`حجز قادم من ${shortDate(upcoming[0].start)}`, `Upcoming booking from ${shortDate(upcoming[0].start)}`)
                            : t(`${num(upcoming.length)} حجوزات قادمة · أقربها ${shortDate(upcoming[0].start)}`, `${num(upcoming.length)} upcoming · first ${shortDate(upcoming[0].start)}`)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><UnitIcon type={legendType} className="size-4 text-muted-foreground/60" />{t("مشغول", "Occupied")}</span><span className="flex items-center gap-1"><UnitIcon type={legendType} className="size-4 text-success" />{t("متاح", "Free")}</span><span className="flex items-center gap-1"><UnitIcon type={legendType} className="size-4 text-info" />{t("متاح وعليه حجز قادم", "Free, upcoming booking")}</span><span className="flex items-center gap-1"><UnitIcon type={legendType} className="size-4 text-warning" />{t("غير جاهز", "Not ready")}</span><Pill>{t("حجب الوحدات متاح لمدير المنشأة والإدارة العليا", "Blocking: managers only")}</Pill></div>
      </Section>
      <Dialog open={!!block} onOpenChange={(o) => !o && setBlock(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("حجب الوحدة للصيانة", "Block for maintenance")}</DialogTitle></DialogHeader>
          <Input placeholder={t("سبب الحجب", "Reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button variant="destructive" onClick={() => { if (run(actions.blockRoom(block!, reason), t("تم حجب الوحدة وإنشاء مهمة صيانة", "Blocked; task created"))) { setBlock(null); setReason(""); } }}>{t("حجب", "Block")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
