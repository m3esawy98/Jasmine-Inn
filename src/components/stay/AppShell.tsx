import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3, BedDouble, Bell, Building2, CalendarCheck, CalendarDays, ClipboardList, FileSignature, Globe, KeyRound,
  LayoutDashboard, Menu, Plus, RotateCcw, Search, Settings, ShieldCheck, Sparkles, Users, Wallet, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { actions, can, DEMO_TODAY, guestName, loadPersisted, ROLE_NAMES, ROLE_USERS, useDemo } from "@/lib/demo/store";
import type { Role } from "@/lib/demo/types";
import { useDate, useT } from "@/lib/demo/ui";
import { cn } from "@/lib/utils";
import { Pill, useAlerts } from "./kit";
import { TourPanel, startScenario } from "./Tour";
import { toast } from "sonner";

const NAV = [
  { to: "/", icon: LayoutDashboard, ar: "لوحة التحكم", en: "Dashboard" },
  { to: "/properties", icon: Building2, ar: "المنشآت والمباني", en: "Properties" },
  { to: "/units", icon: BedDouble, ar: "الغرف والشقق والأسرة", en: "Rooms & beds" },
  { to: "/guests", icon: Users, ar: "العملاء والطلاب", en: "Guests & students" },
  { to: "/bookings", icon: CalendarDays, ar: "الحجوزات", en: "Bookings" },
  { to: "/stays", icon: KeyRound, ar: "الإقامة والتسكين", en: "Stays & check-in" },
  { to: "/contracts", icon: FileSignature, ar: "العقود والأسعار", en: "Contracts & rates" },
  { to: "/finance", icon: Wallet, ar: "المالية والتحصيل", en: "Finance" },
  { to: "/housekeeping", icon: Wrench, ar: "النظافة والصيانة", en: "Housekeeping" },
  { to: "/reports", icon: BarChart3, ar: "التقارير والتحليلات", en: "Reports" },
  { to: "/users", icon: ShieldCheck, ar: "المستخدمون والصلاحيات", en: "Users & roles" },
  { to: "/settings", icon: Settings, ar: "الإعدادات", en: "Settings" },
] as const;

function NavList({ onNav }: { onNav?: () => void }) {
  const t = useT();
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <n.icon className={cn("size-4", active && "text-sidebar-primary")} />
            {t(n.ar, n.en)}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <BedDouble className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-base font-bold text-sidebar-accent-foreground">StayFlow</p>
        <p className="text-[11px] text-sidebar-foreground">Hospitality</p>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const s = useDemo();
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const k = q.trim();
    if (k.length < 2) return [];
    const out: { label: string; sub: string; to: string }[] = [];
    s.bookings.forEach((b) => {
      const g = guestName(s, b.guestId);
      if (b.code.includes(k.toUpperCase()) || g.includes(k)) out.push({ label: `${b.code} · ${g}`, sub: t("حجز", "Booking"), to: `/bookings/${b.id}` });
    });
    s.rooms.forEach((r) => r.code.includes(k.toUpperCase()) && out.push({ label: r.code, sub: t("وحدة", "Unit"), to: `/units?q=${r.code}` }));
    s.invoices.forEach((i) => i.code.includes(k.toUpperCase()) && out.push({ label: i.code, sub: t("فاتورة", "Invoice"), to: `/finance/${i.id}` }));
    return out.slice(0, 8);
  }, [q, s, t]);
  return (
    <Popover open={results.length > 0}>
      <PopoverTrigger asChild>
        <div className="relative hidden w-64 md:block">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث عن حجز، نزيل، غرفة، فاتورة…", "Search booking, guest, room…")} className="h-9 bg-muted/60 ps-9" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {results.map((r) => (
          <button key={r.to + r.label} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-sm hover:bg-muted" onClick={() => { setQ(""); navigate({ to: r.to as "/" }); }}>
            <span>{r.label}</span>
            <span className="text-xs text-muted-foreground">{r.sub}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const s = useDemo();
  const t = useT();
  const fmtDate = useDate();
  const navigate = useNavigate();
  const alerts = useAlerts();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadPersisted();
  }, []);
  useEffect(() => {
    document.documentElement.lang = s.lang;
    document.documentElement.dir = s.lang === "ar" ? "rtl" : "ltr";
  }, [s.lang]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-6 bg-sidebar p-4 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="rounded-xl border border-sidebar-border p-3 text-xs text-sidebar-foreground">
          <Pill tone="warning" className="mb-2">{t("بيانات تجريبية", "Demo data")}</Pill>
          <p>{t("كل الأرقام والأسماء توضيحية للعرض فقط.", "All figures and names are illustrative.")}</p>
        </div>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={s.lang === "ar" ? "right" : "left"} className="w-72 border-0 bg-sidebar p-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mb-6"><Brand /></div>
          <NavList onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <Select value={s.propertyFilter} onValueChange={actions.setPropertyFilter}>
            <SelectTrigger className="h-9 w-[150px] md:w-[200px]">
              <Building2 className="size-4 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("كل المنشآت", "All properties")}</SelectItem>
              {s.properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{t(p.name, p.nameEn)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <GlobalSearch />
          <div className="ms-auto flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground xl:inline-flex">
              <CalendarCheck className="size-3.5 text-primary" />
              {t("تاريخ العرض:", "Demo date:")} {fmtDate(DEMO_TODAY)} · {t("الفترة: أكتوبر–نوفمبر 2026", "Period: Oct–Nov 2026")}
            </span>
            <Button size="sm" variant="outline" className="hidden pulse-ring border-primary/40 text-primary md:inline-flex" onClick={() => startScenario(navigate)}>
              <Sparkles className="size-4" /> {t("السيناريو", "Scenario")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Plus className="size-4" /><span className="hidden sm:inline">{t("إجراء سريع", "Quick action")}</span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate({ to: "/bookings/new" })}>{t("حجز جديد", "New booking")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/stays" })}>{t("تسجيل وصول / مغادرة", "Check-in / out")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/finance" })}>{t("تسجيل دفعة", "Record payment")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/housekeeping" })}>{t("مهام النظافة", "Housekeeping tasks")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="relative">
                  <Bell className="size-5" />
                  {alerts.length > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-destructive" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                <p className="px-2 pb-2 text-sm font-semibold">{t("التنبيهات", "Alerts")}</p>
                {alerts.map((a) => (
                  <Link key={a.text} to={a.to as "/"} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                    <Pill tone={a.tone}>•</Pill> {a.text}
                  </Link>
                ))}
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" title="Language" onClick={() => actions.setLang(s.lang === "ar" ? "en" : "ar")}>
              <Globe className="size-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1 text-start hover:bg-muted">
                  <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{ROLE_USERS[s.role].replace(/^(م\.|أ\.)\s*/, "").charAt(0)}</span>
                  <span className="hidden leading-tight md:block">
                    <span className="block text-xs font-semibold">{ROLE_USERS[s.role]}</span>
                    <span className="block text-[11px] text-muted-foreground">{t(...ROLE_NAMES[s.role])}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("تبديل الدور التجريبي", "Switch demo role")}</p>
                {(Object.keys(ROLE_NAMES) as Role[]).map((r) => (
                  <DropdownMenuItem key={r} onClick={() => { actions.setRole(r); toast.info(t(`أنت الآن: ${ROLE_NAMES[r][0]}`, `Now acting as ${ROLE_NAMES[r][1]}`)); }} className={cn(r === s.role && "bg-muted font-semibold")}>
                    {t(...ROLE_NAMES[r])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex items-center justify-between gap-2 border-b bg-warning-soft px-4 py-1.5 text-xs text-warning md:px-6">
          <span className="font-medium">{t("بيانات تجريبية · الصلاحيات محاكاة في الواجهة فقط وليست نظام تفويض آمن · لا توجد مدفوعات حقيقية", "Demo data · Roles are UI simulation only · No real payments")}</span>
          <ResetButton disabled={!can(s.role, "demo.reset")} />
        </div>
        <main className="mx-auto max-w-[1400px] p-4 pb-40 md:p-6 md:pb-40">{children}</main>
      </div>
      <TourPanel />
    </div>
  );
}

function ResetButton({ disabled }: { disabled: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button disabled={disabled} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline disabled:opacity-50">
          <RotateCcw className="size-3" /> {t("إعادة ضبط البيانات التجريبية", "Reset demo data")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("إعادة ضبط البيانات التجريبية؟", "Reset demo data?")}</AlertDialogTitle>
          <AlertDialogDescription>{t("ستُحذف كل التغييرات المحفوظة وتعود البيانات لحالتها الأولى لإعادة تشغيل السيناريو.", "All changes will be discarded so the scenario can be replayed.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("إلغاء", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { actions.reset(); navigate({ to: "/" }); toast.success(t("تمت إعادة الضبط", "Demo reset")); }}>{t("إعادة الضبط", "Reset")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export { ClipboardList };
