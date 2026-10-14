import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, Section, StatusPill, run } from "@/components/stay/kit";
import { actions, bedLabel, can, invoiceBalance, useDemo } from "@/lib/demo/store";
import { BOOKING_STATUS, useDate, useMoney, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import type { Gender } from "@/lib/demo/types";

export const Route = createFileRoute("/guests")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => meta("العملاء والطلاب", "ملفات موحدة للطلاب والنزلاء مع سجل الحجوزات والفواتير."),
  component: Guests,
});

function Guests() {
  const s = useDemo();
  const t = useT();
  const money = useMoney();
  const fmt = useDate();
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(search.id ?? null);
  const [add, setAdd] = useState(false);
  const empty = { name: "", phone: "", email: "", nationalId: "", org: "", gender: "" as Gender | "" };
  const [f, setF] = useState(empty);
  const list = s.guests.filter((g) => !q || g.name.includes(q) || g.phone.includes(q)).slice().reverse();
  const g = s.guests.find((x) => x.id === open);
  const gb = g ? s.bookings.filter((b) => b.guestId === g.id) : [];
  return (
    <div>
      <PageHeader title={t("العملاء والطلاب", "Guests & students")} actions={<Button disabled={!can(s.role, "guest.edit")} onClick={() => setAdd(true)}><Plus className="size-4" />{t("إضافة ملف", "Add profile")}</Button>} />
      <Section>
        <div className="relative mb-3 max-w-sm"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالاسم أو الهاتف", "Search name or phone")} /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">{[t("الاسم", "Name"), t("النوع", "Type"), t("الجهة", "Org"), t("الهاتف", "Phone"), t("الحجوزات", "Bookings")].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>{list.slice(0, 100).map((x) => (
            <tr key={x.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setOpen(x.id)}>
              <td className="px-3 py-2.5 font-medium">{x.name}</td><td className="px-3 py-2.5"><Pill tone={x.kind === "student" ? "primary" : "info"}>{x.kind === "student" ? t("طالب", "Student") : t("نزيل", "Guest")}</Pill></td>
              <td className="px-3 py-2.5">{x.org ?? "—"}</td><td className="px-3 py-2.5" dir="ltr">{x.phone}</td><td className="px-3 py-2.5">{s.bookings.filter((b) => b.guestId === x.id).length}</td>
            </tr>))}</tbody>
        </table></div>
      </Section>
      <Sheet open={!!g} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {g && <>
            <SheetHeader><SheetTitle>{g.name}</SheetTitle></SheetHeader>
            <div className="space-y-4 p-4 text-sm">
              <p className="text-muted-foreground">{g.phone} · {g.email} · {g.org ?? ""}</p>
              <p className="font-semibold">{t("الحجوزات والإقامة", "Bookings & stays")}</p>
              {gb.map((b) => { const inv = s.invoices.find((i) => i.bookingId === b.id); const c = s.contracts.find((x) => x.bookingId === b.id); return (
                <div key={b.id} className="rounded-lg border p-3">
                  <div className="flex justify-between"><Link to="/bookings/$id" params={{ id: b.id }} className="font-semibold text-primary">{b.code}</Link><StatusPill map={BOOKING_STATUS} value={b.status} /></div>
                  <p className="text-xs text-muted-foreground">{bedLabel(s, b.bedId)} · {fmt(b.start)} — {fmt(b.end)}</p>
                  {c && <p className="mt-1 text-xs">{t("العقد", "Contract")} {c.code}</p>}
                  {inv && <p className="text-xs">{t("الفاتورة", "Invoice")} <Link to="/finance/$id" params={{ id: inv.id }} className="text-primary">{inv.code}</Link> · {t("الرصيد", "Balance")} {money(invoiceBalance(s, inv.id))}</p>}
                </div>); })}
              <p className="font-semibold">{t("سجل التعاملات", "Transactions")}</p>
              <ul className="space-y-1 text-xs">{s.payments.filter((p) => s.invoices.find((i) => i.id === p.invoiceId)?.guestId === g.id).map((p) => <li key={p.id} className="flex justify-between"><span>{p.code} · {fmt(p.date)}</span><span>{money(p.amount)}</span></li>)}</ul>
            </div>
          </>}
        </SheetContent>
      </Sheet>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("ملف جديد", "New profile")}</DialogTitle></DialogHeader>
          <div className="grid gap-2">{(["name", "phone", "email", "nationalId", "org"] as const).map((k) => <Input key={k} placeholder={{ name: t("الاسم", "Name"), phone: t("الهاتف", "Phone"), email: t("البريد", "Email"), nationalId: t("الرقم القومي", "National ID"), org: t("الجامعة / الجهة", "Org") }[k]} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
            <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v as Gender })}>
              <SelectTrigger><SelectValue placeholder={t("النوع", "Gender")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("ذكر", "Male")}</SelectItem>
                <SelectItem value="female">{t("أنثى", "Female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={() => { if (!f.gender) { run({ ok: false, error: t("حدد النوع (ذكر / أنثى)", "Select gender") }, ""); return; } if (run(actions.addGuest({ ...f, gender: f.gender, kind: "student" }), t("تمت الإضافة", "Added"))) { setAdd(false); setF(empty); } }}>{t("حفظ", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
