export type Lang = "ar" | "en";
export type Role =
  | "exec"
  | "manager"
  | "reservations"
  | "frontdesk"
  | "accountant"
  | "housekeeping"
  | "auditor";

export type PropertyType = "student" | "hotel" | "apartments";
export interface Property {
  id: string;
  name: string;
  nameEn: string;
  city: string;
  cityEn: string;
  type: PropertyType;
  amenities: string[];
}
export interface Building {
  id: string;
  propertyId: string;
  name: string;
  floors: number;
}
export type RoomType = "single" | "double" | "quad" | "hotel" | "apartment";
export type HkStatus = "ready" | "dirty" | "cleaning" | "inspection" | "maintenance";
export interface Room {
  id: string;
  propertyId: string;
  buildingId: string;
  code: string;
  floor: number;
  type: RoomType;
  hk: HkStatus;
  amenities: string[];
}
export interface Bed {
  id: string;
  roomId: string;
  label: string;
}
export interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string;
  kind: "student" | "guest";
  gender: Gender;
  org?: string;
  idType: IdType;
  /** 14-digit Egyptian national ID, or a passport number (uppercase letters/digits). */
  idNumber: string;
  /** Required for passport holders. */
  nationality?: string;
}
export type IdType = "national_id" | "passport";
export type Gender = "male" | "female";
export type NewGuest = Omit<Guest, "id">;
export type PlanPeriod = "daily" | "weekly" | "monthly" | "semester";
export interface Plan {
  id: string;
  name: string;
  nameEn: string;
  period: PlanPeriod;
  price: number;
  deposit: number;
}
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "checked_in"
  | "checked_out";
export interface TimelineEvent {
  at: string;
  text: string;
  user: string;
}
export interface Booking {
  id: string;
  code: string;
  guestId: string;
  bedId: string;
  start: string;
  end: string;
  planId: string;
  rent: number;
  deposit: number;
  status: BookingStatus;
  docs: { id: boolean; enrollment: boolean; photo: boolean };
  events: TimelineEvent[];
  createdAt: string;
  scenario?: boolean;
  /** Who was sent to inspect the room before check-out. */
  inspectionRequest?: { assignee: string; by: string; at: string };
  /** Pre-check-out room inspection; check-out requires it to be approved. */
  inspection?: Inspection;
}
export type ItemCondition = "ok" | "damaged" | "missing";
export interface InspectionItem {
  key: string;
  label: string;
  labelEn: string;
  condition: ItemCondition;
  note?: string;
  /** Amount charged to the guest for this item (0 when in good condition). */
  charge: number;
}
export interface Inspection {
  items: InspectionItem[];
  total: number;
  by: string;
  at: string;
  /** Charges need a manager's approval; a clean report waits for the front desk to confirm it. */
  status: "reported" | "pending_approval" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
}
export interface Contract {
  id: string;
  code: string;
  bookingId: string;
  start: string;
  end: string;
  status: "active" | "pending_start" | "ended" | "cancelled";
}
export interface InvoiceLine {
  label: string;
  labelEn: string;
  amount: number;
  kind: "rent" | "deposit" | "fee";
}
export interface Installment {
  due: string;
  amount: number;
}
export interface Invoice {
  id: string;
  code: string;
  bookingId: string;
  guestId: string;
  issued: string;
  lines: InvoiceLine[];
  schedule: Installment[];
  status: "open" | "void";
}
export type PayMethod = "cash" | "bank" | "online_demo";
export interface Payment {
  id: string;
  code: string;
  invoiceId: string;
  amount: number;
  method: PayMethod;
  reference: string;
  at: string;
  date: string;
  user: string;
  reversalOf?: string;
  reversed?: boolean;
  note?: string;
}
export interface Stay {
  id: string;
  bookingId: string;
  bedId: string;
  checkIn: string;
  checkInAt: string;
  checkOut?: string;
  checkOutAt?: string;
  status: "active" | "closed";
}
export type TaskStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "cleaned"
  | "inspected"
  | "approved";
export interface Task {
  id: string;
  code: string;
  roomId: string;
  type: "cleaning" | "maintenance";
  title: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  assignee?: string;
  notes: { at: string; user: string; text: string }[];
  createdAt: string;
  doneAt?: string;
  source?: string;
}
export interface Activity {
  id: string;
  at: string;
  user: string;
  role: Role;
  action: string;
  ref: string;
  scenario?: boolean;
}
export interface DemoState {
  version: number;
  lang: Lang;
  role: Role;
  propertyFilter: string; // "all" | property id
  properties: Property[];
  buildings: Building[];
  rooms: Room[];
  beds: Bed[];
  guests: Guest[];
  plans: Plan[];
  bookings: Booking[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  stays: Stay[];
  tasks: Task[];
  activities: Activity[];
  staff: string[];
  counters: Record<string, number>;
  scenario: {
    bookingId?: string;
    tourActive: boolean;
    step: number;
  };
}
