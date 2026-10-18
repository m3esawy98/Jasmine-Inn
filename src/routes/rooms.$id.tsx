import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BedDouble, CalendarDays, IdCard, Mail, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Pill, Section, StatusPill } from "@/components/stay/kit";
import {
  activeStayOnBed,
  can,
  DEMO_TODAY,
  roomBookedUp,
  roomFreeFrom,
  invoiceBalance,
  roomGenders,
  roomStatus,
  useDemo,
} from "@/lib/demo/store";
import type { RoomType } from "@/lib/demo/types";
import { BOOKING_STATUS, HK_STATUS, ID_TYPE, UNIT_STATUS, useDate, useMoney, useT } from "@/lib/demo/ui";
import { addDays } from "@/lib/demo/calc";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rooms/$id")({
  head: () => meta("تفاصيل الغرفة", "السكان الحاليون في الغرفة وحالة كل سرير."),
  component: RoomDetail,
});

const ROOM_TYPE: Record<RoomType, [string, string]> = {
  single: ["غرفة فردية", "Single room"],
  double: ["غرفة مزدوجة", "Double room"],
  quad: ["غرفة رباعية", "Quad room"],
  hotel: ["غرفة فندقية", "Hotel room"],
  apartment: ["شقة فندقية", "Apartment"],
};

function RoomDetail() {
  const { id } = Route.useParams();
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const money = useMoney();
  const room = s.rooms.find((r) => r.id === id);
  if (!room) return <p>{t("الغرفة غير موجودة", "Room not found")}</p>;
  const prop = s.properties.find((p) => p.id === room.propertyId)!;
  const building = s.buildings.find((b) => b.id === room.buildingId)!;
  const genders = roomGenders(s, room.id);
  const freeDay = roomFreeFrom(s, room.id);
  // In bed-number order, so the list matches the physical beds.
  const beds = s.beds.filter((b) => b.roomId === room.id);

  return (
    <div>
      <PageHeader
        title={`${t("الغرفة", "Room")} ${room.code}`}
        subtitle={`${t(prop.name, prop.nameEn)} · ${t("مبنى", "Building")} ${building.name} · ${t("الدور", "Floor")} ${room.floor} · ${t(...ROOM_TYPE[room.type])} · ${t(room.sleeps === 1 ? "يسع فردًا واحدًا" : room.sleeps === 2 ? "يسع فردين" : `يسع ${room.sleeps} أفراد`, `Sleeps ${room.sleeps}`)}`}
        actions={
          <>
            <StatusPill map={UNIT_STATUS} value={roomStatus(s, room.id)} />
            <StatusPill map={HK_STATUS} value={room.hk} />
            {/* Hotel rooms and apartments house guests, not students. */}
            {genders.size === 1 &&
              (genders.has("female") ? (
                <Pill tone="female">{prop.type === "student" ? t("طالبات", "Female") : t("نزيلة", "Female guest")}</Pill>
              ) : (
                <Pill tone="info">{prop.type === "student" ? t("طلاب", "Male") : t("نزيل", "Male guest")}</Pill>
              ))}
            {can(s.role, "booking.create") &&
              (room.hk === "maintenance" ? (
                <Button disabled title={t("الغرفة محجوبة للصيانة", "Blocked for maintenance")}><Plus className="size-4" />{t("حجز جديد", "New booking")} · {t("محجوبة للصيانة", "under maintenance")}</Button>
              ) : roomBookedUp(s, room.id) ? (
                <Button disabled><Plus className="size-4" />{t(`محجوزة حتى ${fmt(addDays(freeDay, -1))}`, `Booked until ${fmt(addDays(freeDay, -1))}`)}</Button>
              ) : (
                // An occupied room books ahead from the day it frees up.
                <Button asChild>
                  <Link to="/bookings/new" search={{ room: room.id }}><Plus className="size-4" />{freeDay > DEMO_TODAY ? t(`حجز من ${fmt(freeDay)}`, `Book from ${fmt(freeDay)}`) : t("حجز جديد", "New booking")}</Link>
                </Button>
              ))}
            <Button variant="outline" asChild>
              <Link to="/units" search={{ q: undefined, pid: room.propertyId, from: undefined }}>
                <ArrowRight className="size-4 ltr:rotate-180" />
                {t("الغرف والأسرة", "Rooms & beds")}
              </Link>
            </Button>
          </>
        }
      />
      <Section title={t("الأسرة والسكان الحاليون", "Beds & current residents")}>
        <div className="grid gap-3 md:grid-cols-2">
          {beds.map((bed) => {
            const stay = activeStayOnBed(s, bed.id);
            const booking = stay && s.bookings.find((b) => b.id === stay.bookingId);
            const guest = booking && s.guests.find((g) => g.id === booking.guestId);
            const inv = booking && s.invoices.find((i) => i.bookingId === booking.id);
            const upcoming = s.bookings
              .filter(
                (b) => b.bedId === bed.id && (b.status === "pending" || b.status === "confirmed"),
              )
              .sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div
                key={bed.id}
                className={cn("rounded-xl border p-4", !guest && "bg-success-soft/50")}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <BedDouble
                      className={cn("size-5", guest ? "text-muted-foreground" : "text-success")}
                    />
                    {bed.label}
                  </span>
                  {guest ? (
                    <Pill tone="primary">{t("مشغول", "Occupied")}</Pill>
                  ) : (
                    <Pill tone="success">{t("متاح", "Free")}</Pill>
                  )}
                </div>
                {guest && booking && stay ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/guests"
                        search={{ id: guest.id }}
                        className="text-base font-semibold text-primary"
                      >
                        {guest.name}
                      </Link>
                      <Pill tone={guest.gender === "female" ? "female" : "info"}>
                        {guest.gender === "female" ? t("أنثى", "Female") : t("ذكر", "Male")}
                      </Pill>
                      <Pill>
                        {guest.kind === "student"
                          ? t(guest.gender === "female" ? "طالبة" : "طالب", "Student")
                          : t(guest.gender === "female" ? "نزيلة" : "نزيل", "Guest")}
                      </Pill>
                    </div>
                    {guest.org && <p className="text-muted-foreground">{guest.org}</p>}
                    <ul className="space-y-1 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Phone className="size-3.5" />
                        <span dir="ltr">{guest.phone}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="size-3.5" />
                        <span dir="ltr">{guest.email}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <IdCard className="size-3.5" />
                        {t(...ID_TYPE[guest.idType])}: <span dir="ltr">{guest.idNumber}</span>
                        {guest.nationality && <Pill>{guest.nationality}</Pill>}
                      </li>
                      <li className="flex items-center gap-2">
                        <CalendarDays className="size-3.5" />
                        {t("من", "From")} {fmt(stay.checkIn)} {t("إلى", "to")} {fmt(booking.end)}
                      </li>
                    </ul>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs">
                      <span>
                        {t("الحجز", "Booking")}{" "}
                        <Link
                          to="/bookings/$id"
                          params={{ id: booking.id }}
                          className="font-semibold text-primary"
                        >
                          {booking.code}
                        </Link>
                      </span>
                      {inv && (
                        <span>
                          {t("الفاتورة", "Invoice")}{" "}
                          <Link
                            to="/finance/$id"
                            params={{ id: inv.id }}
                            className="font-semibold text-primary"
                          >
                            {inv.code}
                          </Link>{" "}
                          · {t("الرصيد", "Balance")} {money(invoiceBalance(s, inv.id))}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("لا يوجد مقيم حاليًا.", "No current resident.")}
                  </p>
                )}
                {upcoming.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t pt-2 text-xs">
                    {upcoming.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">{t("حجز قادم:", "Upcoming:")}</span>
                        <Link
                          to="/bookings/$id"
                          params={{ id: b.id }}
                          className="font-semibold text-primary"
                        >
                          {b.code}
                        </Link>
                        <span>{s.guests.find((g) => g.id === b.guestId)?.name}</span>
                        <span className="text-muted-foreground">
                          {fmt(b.start)} — {fmt(b.end)}
                        </span>
                        <StatusPill map={BOOKING_STATUS} value={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
