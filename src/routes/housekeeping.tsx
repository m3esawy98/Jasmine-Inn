import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Brush, CheckCircle2, ClipboardCheck, Play, ShieldCheck, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Pill, Section, StatusPill, run } from "@/components/stay/kit";
import { actions, can, getState, inScope, useDemo } from "@/lib/demo/store";
import type { Task } from "@/lib/demo/types";
import { HK_STATUS, TASK_STATUS, useDate, useT } from "@/lib/demo/ui";
import { meta } from "@/lib/demo/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/housekeeping")({
  // `task`: opened with this task selected, e.g. the cleaning task a check-out just created.
  validateSearch: (s: Record<string, unknown>): { task?: string } => (typeof s.task === "string" ? { task: s.task } : {}),
  head: () => meta("النظافة والصيانة", "مهام التنظيف والصيانة وفحص الجاهزية واعتماد عودة الوحدات للخدمة."),
  component: HK,
});

function HK() {
  const s = useDemo();
  const t = useT();
  const [filter, setFilter] = useState("open");
  const scenarioCode = s.bookings.find((b) => b.id === s.scenario.bookingId)?.code;
  const tasks = s.tasks.filter((x) => inScope(s, s.rooms.find((r) => r.id === x.roomId)!.propertyId) && (filter === "all" || (filter === "open" ? x.status !== "approved" : x.status === "approved")))
    .sort((a, b) => (b.source === scenarioCode ? 1 : 0) - (a.source === scenarioCode ? 1 : 0));
  const search = Route.useSearch();
  const [sel, setSel] = useState<string | null>(() => search.task ?? s.tasks.find((x) => x.source === scenarioCode && x.status !== "approved")?.id ?? null);
  const cur = s.tasks.find((x) => x.id === sel) ?? tasks[0];
  return (
    <div>
      <PageHeader title={t("النظافة والتشغيل", "Housekeeping & maintenance")} subtitle={t("الوحدة لا تعود «متاحة» إلا بعد اعتماد الجاهزية.", "Units return to Available only after readiness approval.")} actions={
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">{t("مهام مفتوحة", "Open")}</SelectItem><SelectItem value="done">{t("معتمدة", "Approved")}</SelectItem><SelectItem value="all">{t("الكل", "All")}</SelectItem></SelectContent></Select>
      } />
      <div className="grid gap-4 lg:grid-cols-5">
        <Section className="lg:col-span-2">
          <ul className="divide-y">{tasks.map((x) => { const r = s.rooms.find((y) => y.id === x.roomId)!; return (
            <li key={x.id}><button onClick={() => setSel(x.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-start text-sm", cur?.id === x.id && "bg-primary-soft")}>
              <span className="flex items-center gap-2">{x.type === "cleaning" ? <Brush className="size-4 text-primary" /> : <Wrench className="size-4 text-warning" />}<span><b>{r.code}</b> · {x.title}{x.source === scenarioCode && scenarioCode && <Pill tone="primary" className="ms-1">{t("السيناريو", "Scenario")}</Pill>}<span className="block text-xs text-muted-foreground">{x.code} · {x.assignee ?? t("غير معيّن", "Unassigned")}</span></span></span>
              <StatusPill map={TASK_STATUS} value={x.status} />
            </button></li>); })}
            {tasks.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("لا توجد مهام", "No tasks")}</p>}
          </ul>
        </Section>
        <div className="lg:col-span-3">{cur && <TaskPanel task={cur} />}</div>
      </div>
    </div>
  );
}

function TaskPanel({ task }: { task: Task }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const navigate = useNavigate();
  const [who, setWho] = useState(s.staff[0]);
  const [note, setNote] = useState("");
  const room = s.rooms.find((r) => r.id === task.roomId)!;
  const upd = can(s.role, "task.update"), appr = can(s.role, "task.approve");
  const steps = [
    { to: "assigned", icon: UserPlus, label: t("تعيين الموظف", "Assign"), perm: upd },
    { to: "in_progress", icon: Play, label: t("بدء التنفيذ", "Start"), perm: upd },
    { to: "cleaned", icon: CheckCircle2, label: t("تسجيل الاكتمال", "Mark done"), perm: upd },
    { to: "inspected", icon: ClipboardCheck, label: t("فحص الجاهزية", "Inspect"), perm: upd },
    { to: "approved", icon: ShieldCheck, label: t("اعتماد الغرفة للخدمة", "Approve for service"), perm: appr },
  ] as const;
  const order = ["new", "assigned", "in_progress", "cleaned", "inspected", "approved"];
  const idx = order.indexOf(task.status);
  return (
    <Section title={`${task.code} — ${room.code}`} actions={<StatusPill map={HK_STATUS} value={room.hk} />}>
      <p className="mb-4 text-sm text-muted-foreground">{task.title} · {t("أُنشئت", "Created")} {fmt(task.createdAt, true)}</p>
      <ol className="space-y-2">{steps.map((st, i) => { const done = idx > i, curStep = idx === i; return (
        <li key={st.to} className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3", done ? "border-success/30 bg-success-soft" : curStep ? "border-primary/40" : "opacity-60")}>
          <st.icon className={cn("size-4", done ? "text-success" : "text-primary")} />
          <span className="flex-1 text-sm font-medium">{i + 1}. {st.label}{st.to === "assigned" && task.assignee && ` — ${task.assignee}`}</span>
          {curStep && st.to === "assigned" && <Select value={who} onValueChange={setWho}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent>{s.staff.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}
          {curStep && <Button size="sm" disabled={!st.perm} onClick={() => {
            if (run(actions.taskStep(task.id, st.to, { assignee: who }), st.to === "approved" ? t(`أصبحت ${room.code} متاحة`, `${room.code} is now available`) : t("تم التحديث", "Updated")) && st.to === "approved") {
              if (getState().scenario.tourActive) actions.tour({ step: 7 });
              // Show the room back in service on the room map.
              navigate({ to: "/units", search: { q: room.code, pid: room.propertyId, from: undefined } });
            }
          }}>{t("تنفيذ", "Do")}</Button>}
        </li>); })}</ol>
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">{t("ملاحظات الفحص", "Inspection notes")}</p>
        <ul className="mb-2 space-y-1 text-sm">{task.notes.map((n, i) => <li key={i} className="rounded-md bg-muted/50 p-2">{n.text}<span className="block text-xs text-muted-foreground">{n.user} · {fmt(n.at, true)}</span></li>)}</ul>
        <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("مثال: تم تغيير المفارش وفحص التكييف", "e.g. linens changed, AC checked")} /><Button variant="outline" disabled={!upd} onClick={() => { if (run(actions.addTaskNote(task.id, note), t("أضيفت الملاحظة", "Note added"))) setNote(""); }}>{t("إضافة", "Add")}</Button></div>
      </div>
    </Section>
  );
}
