import { useDemo } from "./store";
import type { BookingStatus, HkStatus, TaskStatus } from "./types";

export function useT() {
  const { lang } = useDemo();
  return (ar: string, en: string) => (lang === "ar" ? ar : en);
}
export function useMoney() {
  const { lang } = useDemo();
  return (n: number) =>
    lang === "ar" ? `${Math.round(n).toLocaleString("ar-EG")} ج.م.` : `EGP ${Math.round(n).toLocaleString("en-US")}`;
}
export function useNum() {
  const { lang } = useDemo();
  return (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
}
export function useDate() {
  const { lang } = useDemo();
  return (d: string, withTime = false) => {
    if (!d) return "—";
    const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
    return dt.toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  };
}

export const BOOKING_STATUS: Record<BookingStatus, [string, string, string]> = {
  pending: ["قيد المراجعة", "Under review", "warning"],
  confirmed: ["مؤكد", "Confirmed", "info"],
  rejected: ["مرفوض", "Rejected", "destructive"],
  cancelled: ["ملغى", "Cancelled", "muted"],
  checked_in: ["مقيم حاليًا", "In house", "success"],
  checked_out: ["غادر", "Checked out", "muted"],
};
export const HK_STATUS: Record<HkStatus, [string, string, string]> = {
  ready: ["جاهزة", "Ready", "success"],
  dirty: ["بانتظار التنظيف", "Awaiting cleaning", "warning"],
  cleaning: ["قيد التنظيف", "Cleaning", "info"],
  inspection: ["بانتظار الفحص", "Awaiting inspection", "warning"],
  maintenance: ["خارج الخدمة", "Out of service", "destructive"],
};
export const UNIT_STATUS: Record<string, [string, string, string]> = {
  available: ["متاحة", "Available", "success"],
  partial: ["متاحة جزئيًا", "Partially available", "info"],
  full: ["مشغولة بالكامل", "Fully occupied", "primary"],
  cleaning: ["بانتظار التنظيف/الفحص", "Not ready", "warning"],
  maintenance: ["خارج الخدمة", "Out of service", "destructive"],
};
export const TASK_STATUS: Record<TaskStatus, [string, string, string]> = {
  new: ["جديدة", "New", "warning"],
  assigned: ["تم التعيين", "Assigned", "info"],
  in_progress: ["قيد التنفيذ", "In progress", "info"],
  cleaned: ["اكتمل العمل", "Work done", "primary"],
  inspected: ["اجتاز الفحص", "Inspected", "primary"],
  approved: ["معتمدة للخدمة", "Approved", "success"],
};
export const METHOD: Record<string, [string, string]> = {
  cash: ["نقدي", "Cash"],
  bank: ["تحويل بنكي", "Bank transfer"],
  online_demo: ["دفع إلكتروني (تجريبي)", "Online (demo)"],
};
