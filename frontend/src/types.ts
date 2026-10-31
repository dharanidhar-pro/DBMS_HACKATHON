export type Role = "CUSTOMER" | "OPERATOR" | "ADMIN";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface Vehicle {
  id: string;
  registration: string;
  vehicle_type: string;
  make: string;
  model: string;
  electric: boolean;
  active: boolean;
}
export interface Zone {
  id: string;
  name: string;
  level: string;
}
export interface Facility {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string;
  hourly_rate: number;
  active: boolean;
  demo: boolean;
  operator_id?: string | null;
  total_slots: number;
  available_slots: number;
  zones: Zone[];
}
export interface Slot {
  id: string;
  facility_id: string;
  zone_id: string;
  zone_name: string;
  label: string;
  vehicle_type: string;
  accessible: boolean;
  charging: boolean;
  covered: boolean;
  distance_m: number;
  state: string;
  availability: string;
  eligible: boolean;
  unavailable_reason: string | null;
  position: number;
}
export interface Explanation {
  score: number;
  factors: Record<string, number>;
  weights: Record<string, number>;
  compatible: boolean;
  distance_m: number;
  reasons: string[];
  selection?: string;
  eligible_candidates?: number;
}
export interface Reservation {
  id: string;
  facility_id: string;
  vehicle_id: string;
  slot_id: string;
  arrival: string;
  departure: string;
  status: string;
  estimated_cost: number;
  hourly_rate: number;
  explanation: Explanation;
  facility_name: string;
  facility_address: string;
  facility_demo: boolean;
  slot_label: string;
  registration: string;
  vehicle_type: string;
  created_at: string;
  cancellation_deadline: string;
  history?: { id: string; status: string; created_at: string }[];
}
export interface Notice {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  reservation_id: string | null;
}
export interface Dashboard {
  reservations: number;
  vehicles: number;
  upcoming: Reservation[];
  recent: Reservation[];
}
export interface Recommendation {
  recommendation: { slot: Slot; explanation: Explanation };
  alternatives: { slot: Slot; explanation: Explanation }[];
  eligible_count: number;
  estimated_cost: number;
  message: string;
}
export interface Analytics {
  total_reservations: number;
  cancellations: number;
  cancellation_rate: number;
  average_duration_hours: number;
  total_slots: number;
  occupied_slots: number;
  reserved_slots: number;
  maintenance_slots: number;
  available_slots: number;
  occupancy_percent: number;
  reserved_utilization_percent: number;
  total_facilities: number;
  total_users: number | null;
  daily: { date: string; reservations: number }[];
  vehicle_types: { name: string; value: number }[];
  peak_hours: { hour: number; reservations: number }[];
  facility_performance: { name: string; reservations: number }[];
}
export interface Settings {
  weights: Record<string, number>;
  cancellation_minutes: number;
  max_booking_hours: number;
}
