import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, Section, StatusPill, run } from "@/components/stay/kit";
import { actions, activeStayOnBed, can, guestName, roomGenders, roomStatus, useDemo } from "@/lib/demo/store";
import { UNIT_STATUS, useNum, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/units")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => meta("الغرف والشقق والأسرة", "عرض مرئي لتوزيع الغرف والأسرة وحالتها وحجب الوحدات للصيانة."),
  component: Units,
});

function Units() {
  const s = useDemo();
  const t = useT();
  const num = useNum();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [pid, setPid] = useState(s.propertyFilter === "all" ? "p1" : s.propertyFilter);
  const [q, setQ] = useState(search.q ?? "");
  const [st, setSt] = useState("all");
  const [block, setBlock] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rooms = s.rooms.filter((r) => r.propertyId === pid && (!q || r.code.includes(q.toUpperCase())) && (st === "all" || roomStatus(s, r.id) === st));
  const buildings = s.buildings.filter((b) => b.propertyId === pid);
  return (
    <div>
      <PageHeader title={t("الغرف والشقق والأسرة", "Rooms, apartments & beds")} subtitle={t("حالة كل سرير محسوبة من الإقامات الفعلية واعتماد الجاهزية.", "Bed status derives from real stays and readiness.")} />
      <Section>
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={pid} onValueChange={setPid}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{s.properties.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>)}</SelectContent></Select>
          <Input className="w-40" placeholder={t("رقم الغرفة", "Room code")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={st} onValueChange={setSt}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("كل الحالات", "All")}</SelectItem>{Object.entries(UNIT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v[0], v[1])}</SelectItem>)}</SelectContent></Select>
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
                  const free = beds.filter((bd) => !activeStayOnBed(s, bd.id)).length;
                  // Partially free rooms with a female resident must only take female students.
                  const girls = status === "partial" && roomGenders(s, r.id).has("female");
                  const hasResidents = status === "partial" || status === "full";
                  return (
                    <div
                      key={r.id}
                      // Rooms with residents open the room detail page listing who is staying there.
                      {...(hasResidents && {
                        role: "link",
                        tabIndex: 0,
                        onClick: () => navigate({ to: "/rooms/$id", params: { id: r.id } }),
                        onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && navigate({ to: "/rooms/$id", params: { id: r.id } }),
                      })}
                      className={cn("rounded-xl border p-3", hasResidents && "cursor-pointer transition hover:border-primary/50 hover:shadow-sm", girls && "border-female/40 bg-female-soft", r.code === "A-204" && "ring-2 ring-primary/40")}
                    >
                      <div className="flex items-center justify-between"><b>{r.code}</b>{can(s.role, "unit.edit") && r.hk === "ready" && <button title={t("حجب للصيانة", "Block")} onClick={(e) => { e.stopPropagation(); setBlock(r.id); }}><Lock className="size-3.5 text-muted-foreground hover:text-destructive" /></button>}</div>
                      <div className="my-2 flex flex-wrap gap-1">{/* occupied beds first, so they sit at the start (right in Arabic) */}{[...beds].sort((x, y) => Number(!!activeStayOnBed(s, y.id)) - Number(!!activeStayOnBed(s, x.id))).map((bd) => { const st2 = activeStayOnBed(s, bd.id); const bk = st2 && s.bookings.find((x) => x.id === st2.bookingId); return <span key={bd.id} title={bk ? guestName(s, bk.guestId) : bd.label}><BedDouble className={cn("size-5", st2 ? "text-muted-foreground/60" : r.hk !== "ready" ? "text-warning" : "text-success")} /></span>; })}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill map={UNIT_STATUS} value={status} />
                        {girls && <Pill tone="female">{t("بنات فقط", "Female only")}</Pill>}
                        {status === "partial" && (
                          <span className={cn("text-xs font-medium", girls ? "text-female" : "text-success")}>
                            {t(`متاح ${num(free)} من ${num(beds.length)}`, `Free ${num(free)} of ${num(beds.length)}`)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><BedDouble className="size-4 text-muted-foreground/60" />{t("مشغول", "Occupied")}</span><span className="flex items-center gap-1"><BedDouble className="size-4 text-success" />{t("متاح", "Free")}</span><span className="flex items-center gap-1"><BedDouble className="size-4 text-warning" />{t("غير جاهز", "Not ready")}</span><span className="flex items-center gap-1"><span className="size-3 rounded-sm border border-female/40 bg-female-soft" />{t("متاحة جزئيًا وبها طالبات", "Partial with female residents")}</span><Pill>{t("حجب الوحدات متاح لمدير المنشأة والإدارة العليا", "Blocking: managers only")}</Pill></div>
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
