import type { ReactNode } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DEMO_TODAY, invoiceOverdue, kpis, useDemo } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { useT } from "@/lib/demo/ui";

const TONES: Record<string, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  info: "bg-info-soft text-info border-info/20",
  female: "bg-female-soft text-female border-female/25",
  destructive: "bg-destructive-soft text-destructive border-destructive/20",
  primary: "bg-primary-soft text-primary border-primary/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export function Pill({ tone = "muted", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[tone] ?? TONES.muted, className)}>
      {children}
    </span>
  );
}

export function StatusPill({ map, value }: { map: Record<string, [string, string, string]>; value: string }) {
  const t = useT();
  const v = map[value];
  if (!v) return null;
  return <Pill tone={v[2]}>{t(v[0], v[1])}</Pill>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ icon: Icon, label, value, hint, tone = "primary" }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-8 place-items-center rounded-lg border", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-surface p-4 md:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Run a store action and surface its real result. */
export function run(res: { ok: boolean; error?: string }, success: string) {
  if (res.ok) toast.success(success);
  else toast.error(res.error ?? "تعذر تنفيذ الإجراء");
  return res.ok;
}

export function useAlerts() {
  const s = useDemo();
  const t = useT();
  return computeAlerts(s, t);
}
export function computeAlerts(s: DemoState, t: (a: string, e: string) => string) {
  const k = kpis(s);
  const overdue = s.invoices.filter((i) => i.status === "open" && invoiceOverdue(s, i.id) > 0).length;
  const notReady = s.rooms.filter((r) => r.hk !== "ready" && r.hk !== "maintenance").length;
  const out: { tone: string; text: string; to: string; search?: Record<string, string> }[] = [];
  if (k.overstays.length) out.push({ tone: "destructive", text: t(`${k.overstays.length} مقيمين تجاوزوا موعد المغادرة`, `${k.overstays.length} residents past their departure date`), to: "/stays", search: { tab: "late" } });
  if (k.pending) out.push({ tone: "warning", text: t(`${k.pending} حجوزات تنتظر المراجعة`, `${k.pending} bookings awaiting review`), to: "/bookings", search: { status: "pending" } });
  if (k.arrivals.length) out.push({ tone: "info", text: t(`${k.arrivals.length} وصول متوقع اليوم`, `${k.arrivals.length} arrivals expected today`), to: "/stays", search: { tab: "arr" } });
  if (k.departures.length) out.push({ tone: "info", text: t(`${k.departures.length} مغادرة مستحقة اليوم`, `${k.departures.length} departures due today`), to: "/stays", search: { tab: "out" } });
  if (overdue) out.push({ tone: "destructive", text: t(`${overdue} فواتير بها مبالغ متأخرة`, `${overdue} invoices overdue`), to: "/finance" });
  if (notReady) out.push({ tone: "warning", text: t(`${notReady} وحدات بانتظار التنظيف أو الفحص`, `${notReady} units not ready`), to: "/housekeeping" });
  if (k.oos) out.push({ tone: "destructive", text: t(`${k.oos} وحدات خارج الخدمة للصيانة`, `${k.oos} units out of service`), to: "/housekeeping" });
  return out;
}
export { DEMO_TODAY };

/** Class for a TabsList of CardTabs: one row of equal cards, each as wide as the longest one-line name;
 *  two per row on phones, where names may wrap. */
export const CARD_TABS =
  "grid h-auto w-full grid-cols-2 items-stretch justify-start gap-2 bg-transparent p-0 sm:inline-grid sm:w-auto sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none";

/** A tab drawn as a large card: icon at the start edge (right in Arabic), name and count centered beside it.
 *  `alert` turns it red (e.g. overdue items); without a count the name sits alone. */
export function CardTab({ value, icon: Icon, label, count, alert }: { value: string; icon: LucideIcon; label: string; count?: string; alert?: boolean }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "h-auto min-w-36 justify-start gap-2.5 whitespace-normal rounded-xl sm:whitespace-nowrap border bg-card p-3 pe-4 text-center text-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-primary-soft data-[state=active]:shadow-none",
        alert && "border-destructive/40 data-[state=active]:border-destructive data-[state=active]:bg-destructive-soft",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-muted", alert ? "text-destructive" : "text-primary")}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {count !== undefined && <span className={cn("block text-xl font-bold tabular-nums", alert && "text-destructive")}>{count}</span>}
      </span>
    </TabsTrigger>
  );
}
