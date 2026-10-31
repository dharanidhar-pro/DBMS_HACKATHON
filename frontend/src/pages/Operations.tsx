import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronRight,
  Download,
  Grid2X2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, dateTime, money, params, send } from "../lib/api";
import { useAuth, useToast } from "../lib/providers";
import {
  Badge,
  Confirm,
  Empty,
  EntityForm,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  type FormField,
} from "../components/ui";
import { SlotGrid } from "./Parking";
import type {
  Analytics,
  Facility,
  Page,
  Reservation,
  Role,
  Settings,
  Slot,
  User,
} from "../types";

function useFacilities() {
  return useQuery({
    queryKey: ["management-facilities"],
    queryFn: () => api<Page<Facility>>("/management/facilities"),
    refetchInterval: 30000,
  });
}
export function OperationsDashboard({
  mode = "overview",
}: {
  mode?: "overview" | "analytics" | "occupancy";
}) {
  const { user } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [facility, setFacility] = useState("");
  const facilities = useFacilities();
  const queryString = params({ start, end, facility_id: facility });
  const query = useQuery({
    queryKey: ["analytics", start, end, facility],
    queryFn: () => api<Analytics>(`/analytics/overview?${queryString}`),
    refetchInterval: 30000,
  });
  const prefix = user?.role === "ADMIN" ? "/admin" : "/operator";
  return (
    <>
      <PageHeading
        eyebrow={
          user?.role === "ADMIN"
            ? "THE BIG PICTURE"
            : "EVERY ARRIVAL, ACCOUNTED FOR"
        }
        title={
          mode === "occupancy"
            ? "A clear view of your spaces."
            : mode === "analytics"
              ? "The story behind your spaces."
              : `Your operations, at a glance.`
        }
        text="Database-backed insights across your authorized facilities. Refreshes every 30 seconds."
        action={
          <a
            className="button secondary"
            href={`/api/v1/analytics/export?${queryString}`}
            download
          >
            <Download size={16} />
            Export CSV
          </a>
        }
      />
      <div className="filter-bar report-filters">
        <label className="field">
          <span>Facility</span>
          <select
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
          >
            <option value="">All authorized facilities</option>
            {facilities.data?.items.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Start date (UTC)</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          <span>End date (UTC)</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button
          className="text-link"
          onClick={() => {
            setStart("");
            setEnd("");
            setFacility("");
          }}
        >
          Reset filters
        </button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <>
          <div className="stat-grid four">
            <div className="stat-card">
              <span>
                Authorized facilities
                <Building2 size={18} />
              </span>
              <strong>{query.data.total_facilities}</strong>
              <Link
                to={`${prefix}/${user?.role === "ADMIN" ? "parking-lots" : "parking"}`}
              >
                View facilities <ArrowRight size={13} />
              </Link>
            </div>
            <div className="stat-card">
              <span>
                Total parking spaces
                <Grid2X2 size={18} />
              </span>
              <strong>{query.data.total_slots}</strong>
              <small>{query.data.available_slots} available now</small>
            </div>
            <div className="stat-card">
              <span>
                Current occupancy
                <Activity size={18} />
              </span>
              <strong>
                {query.data.occupancy_percent}
                <small>%</small>
              </strong>
              <small>
                {query.data.occupied_slots} checked in ·{" "}
                {query.data.reserved_slots} reserved now
              </small>
            </div>
            <div className="stat-card">
              <span>
                {user?.role === "ADMIN" ? "Platform users" : "Reservations"}
                {user?.role === "ADMIN" ? (
                  <Users size={18} />
                ) : (
                  <Ticket size={18} />
                )}
              </span>
              <strong>
                {user?.role === "ADMIN"
                  ? query.data.total_users
                  : query.data.total_reservations}
              </strong>
              <small>
                {user?.role === "ADMIN"
                  ? "Across all account roles"
                  : "Arrivals in the selected period"}
              </small>
            </div>
          </div>
          <div className="analytics-grid">
            <section className="panel chart-panel">
              <div className="section-heading compact-heading">
                <div>
                  <h2>Arrivals over time</h2>
                  <p className="muted">
                    {query.data.total_reservations} reservations in this period
                  </p>
                </div>
                <Badge>UTC</Badge>
              </div>
              {query.data.total_reservations ? (
                <div
                  className="chart"
                  role="img"
                  aria-label={`Daily arrivals chart, ${query.data.total_reservations} reservations`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={query.data.daily}>
                      <defs>
                        <linearGradient
                          id="chart-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--accent)"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--accent)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => v.slice(5)}
                        stroke="var(--muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="var(--muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="reservations"
                        stroke="var(--accent)"
                        fill="url(#chart-fill)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="Your story is just beginning."
                  text="Reservation trends will appear when bookings are made in this date range."
                />
              )}
            </section>
            <section className="panel occupancy-panel">
              <h2>Spaces right now</h2>
              <div
                className="occupancy-ring"
                style={{
                  background: `conic-gradient(var(--accent) ${query.data.occupancy_percent}%, var(--border) 0)`,
                }}
              >
                <div>
                  <strong>{query.data.occupancy_percent}%</strong>
                  <small>checked in</small>
                </div>
              </div>
              {[
                ["Available", query.data.available_slots, "available"],
                ["Occupied", query.data.occupied_slots, "occupied"],
                ["Reserved", query.data.reserved_slots, "reserved"],
                ["Unavailable", query.data.maintenance_slots, "maintenance"],
              ].map(([label, count, kind]) => (
                <div className="detail-row" key={label}>
                  <span>
                    <i className={`status-dot ${kind}`} />
                    {label}
                  </span>
                  <strong>{count}</strong>
                </div>
              ))}
            </section>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Cancellation rate</span>
              <strong>
                {query.data.cancellation_rate}
                <small>%</small>
              </strong>
              <small>{query.data.cancellations} cancelled reservations</small>
            </div>
            <div className="stat-card">
              <span>Average reservation</span>
              <strong>
                {query.data.average_duration_hours}
                <small> h</small>
              </strong>
              <small>Duration of selected-period bookings</small>
            </div>
            <div className="stat-card">
              <span>Reserved capacity utilization</span>
              <strong>
                {query.data.reserved_utilization_percent}
                <small>%</small>
              </strong>
              <small>Booked slot-hours / available slot-hours</small>
            </div>
          </div>
          {mode !== "occupancy" && (
            <div className="analytics-grid">
              <section className="panel">
                <h2>Facility performance</h2>
                {query.data.facility_performance.length ? (
                  query.data.facility_performance.map((f) => (
                    <div key={f.name} className="performance-row">
                      <Building2 size={18} />
                      <strong>{f.name}</strong>
                      <span>{f.reservations} reservations</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No reservations in this date range.</p>
                )}
              </section>
              <section className="panel">
                <h2>Vehicle mix</h2>
                {query.data.vehicle_types.length ? (
                  query.data.vehicle_types.map((v) => (
                    <div className="detail-row" key={v.name}>
                      <span>{v.name}</span>
                      <strong>{v.value}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Vehicle distribution will appear with reservation activity.
                  </p>
                )}
              </section>
            </div>
          )}
          {mode === "analytics" && (
            <section className="panel chart-panel">
              <h2>Arrival hours (UTC)</h2>
              {query.data.peak_hours.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={query.data.peak_hours}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="hour" stroke="var(--muted)" />
                      <YAxis allowDecimals={false} stroke="var(--muted)" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                        }}
                      />
                      <Bar
                        dataKey="reservations"
                        fill="var(--accent)"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="No peak hours yet."
                  text="Arrival activity will appear as reservations are created."
                />
              )}
            </section>
          )}
          <section className="panel quick-operations">
            <div>
              <BarChart3 size={23} />
              <h3>Keep your next arrival moving.</h3>
            </div>
            <Link className="button secondary" to={`${prefix}/reservations`}>
              Manage reservations <ChevronRight size={17} />
            </Link>
          </section>
        </>
      )}
    </>
  );
}
export function FacilitiesManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [editing, setEditing] = useState<Facility | "new" | null>(null);
  const [zone, setZone] = useState<Facility | null>(null);
  const query = useFacilities();
  const operators = useQuery({
    queryKey: ["operator-options"],
    queryFn: () => api<Page<User>>("/admin/users?role=OPERATOR&page_size=100"),
    enabled: isAdmin,
  });
  const fields: FormField[] = [
    { name: "name", label: "Facility name", required: true },
    { name: "address", label: "Street address", required: true },
    { name: "city", label: "City", required: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "hourly_rate",
      label: "Hourly rate (paise)",
      type: "number",
      required: true,
      min: 0,
      hint: "100 paise = ₹1. Rates are estimates; no payments are collected.",
    },
    {
      name: "operator_id",
      label: "Assigned operator",
      options:
        operators.data?.items
          .filter((u) => u.active)
          .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` })) || [],
    },
    { name: "active", label: "Accepting reservations", type: "checkbox" },
  ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR PARKING NETWORK"
        title={
          isAdmin
            ? "Places that keep people moving."
            : "Your facilities. Your focus."
        }
        text="Manage facility details, operator assignments, and zones."
        action={
          isAdmin && (
            <button className="button" onClick={() => setEditing("new")}>
              <Plus size={17} />
              Create facility
            </button>
          )
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="management-facilities">
          {query.data.items.map((f) => (
            <article key={f.id} className="panel facility-management-card">
              <div className="row-between">
                <div className="facility-icon">
                  <Building2 size={24} />
                </div>
                <Badge kind={f.active ? "confirmed" : "cancelled"}>
                  {f.active ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>
              <h2>{f.name}</h2>
              <p className="muted">
                {f.address}, {f.city}
              </p>
              {f.demo && <Badge>DEMO FACILITY</Badge>}
              <div className="facility-kpis">
                <div>
                  <strong>{f.total_slots}</strong>
                  <span>spaces</span>
                </div>
                <div>
                  <strong>{f.available_slots}</strong>
                  <span>available now</span>
                </div>
                <div>
                  <strong>{money(f.hourly_rate)}</strong>
                  <span>per hour</span>
                </div>
              </div>
              <div className="zone-tags">
                {f.zones.map((z) => (
                  <Badge key={z.id}>
                    {z.name} · {z.level}
                  </Badge>
                ))}
              </div>
              <div className="form-actions">
                {isAdmin && (
                  <>
                    <button
                      className="button secondary small"
                      onClick={() => setEditing(f)}
                    >
                      <Pencil size={14} />
                      Edit facility
                    </button>
                    <button className="text-link" onClick={() => setZone(f)}>
                      <Plus size={14} />
                      Add zone
                    </button>
                  </>
                )}
                <Link
                  className="text-link"
                  to={`${isAdmin ? "/admin" : "/operator"}/slots?facility=${f.id}`}
                >
                  Manage spaces <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            isAdmin
              ? "Build your parking network."
              : "No assigned facilities yet."
          }
          text={
            isAdmin
              ? "Create your first facility, then add its parking spaces."
              : "An administrator can assign facilities to your account."
          }
        />
      )}
      {editing && (
        <Modal
          title={editing === "new" ? "Create a facility" : "Edit facility"}
          onClose={() => setEditing(null)}
        >
          <EntityForm
            fields={fields}
            initial={
              editing === "new"
                ? {
                    active: true,
                    hourly_rate: 6000,
                    description: "",
                    operator_id: "",
                  }
                : (editing as unknown as Record<string, unknown>)
            }
            endpoint={
              editing === "new" ? "/facilities" : `/facilities/${editing.id}`
            }
            method={editing === "new" ? "POST" : "PUT"}
            transform={(d) => ({
              ...Object.fromEntries(fields.map((f) => [f.name, d[f.name]])),
              operator_id: d.operator_id || null,
            })}
            onDone={() => setEditing(null)}
            submit="Save facility"
          />
        </Modal>
      )}
      {zone && (
        <Modal
          title={`Add a zone · ${zone.name}`}
          onClose={() => setZone(null)}
        >
          <EntityForm
            fields={[
              { name: "name", label: "Zone name", required: true },
              { name: "level", label: "Level", required: true },
            ]}
            initial={{ level: "Ground" }}
            endpoint={`/facilities/${zone.id}/zones`}
            onDone={() => setZone(null)}
            submit="Add zone"
          />
        </Modal>
      )}
    </>
  );
}
export function SlotsManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const facilities = useFacilities();
  const [facilityId, setFacilityId] = useState(
    new URLSearchParams(window.location.search).get("facility") || "",
  );
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Slot | "new" | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const id = facilityId || facilities.data?.items[0]?.id;
  const facility = facilities.data?.items.find((f) => f.id === id);
  const query = useQuery({
    queryKey: ["managed-slots", id, q, state, type, page],
    queryFn: () =>
      api<Page<Slot>>(
        `/slots?${params({ facility_id: id, q, state, vehicle_type: type, page, page_size: 48 })}`,
      ),
    enabled: !!id,
    refetchInterval: 30000,
  });
  const fields: FormField[] = [
    ...(editing === "new"
      ? [
          {
            name: "zone_id",
            label: "Zone",
            required: true,
            options:
              facility?.zones.map((z) => ({ value: z.id, label: z.name })) ||
              [],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          { name: "label", label: "Space identifier", required: true },
          {
            name: "vehicle_type",
            label: "Vehicle type",
            required: true,
            options: [
              { value: "CAR", label: "Car" },
              { value: "SUV", label: "SUV" },
              { value: "MOTORCYCLE", label: "Motorcycle" },
            ],
          },
          {
            name: "distance_m",
            label: "Distance from entrance (m)",
            type: "number",
            min: 0,
            required: true,
          },
          { name: "accessible", label: "Accessible space", type: "checkbox" },
          { name: "charging", label: "EV charging", type: "checkbox" },
          { name: "covered", label: "Covered parking", type: "checkbox" },
        ]
      : []),
    {
      name: "state",
      label: "Inventory status",
      required: true,
      options: [
        { value: "AVAILABLE", label: "Available" },
        { value: "MAINTENANCE", label: "Under maintenance" },
        ...(isAdmin ? [{ value: "INACTIVE", label: "Inactive" }] : []),
      ],
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="EVERY SPACE MATTERS"
        title="Parking inventory, with clarity."
        text="Select a space to inspect or update it. Existing bookings are protected."
        action={
          isAdmin && (
            <button
              className="button"
              disabled={!id}
              onClick={() => setEditing("new")}
            >
              <Plus size={17} />
              Add space
            </button>
          )
        }
      />
      {facilities.error && (
        <ErrorState error={facilities.error} retry={facilities.refetch} />
      )}
      <div className="filter-bar lot-toolbar">
        <select
          aria-label="Facility"
          value={id || ""}
          onChange={(e) => {
            setFacilityId(e.target.value);
            setPage(1);
            setSelected(null);
          }}
        >
          <option value="">Choose facility</option>
          {facilities.data?.items.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <label className="search-input">
          <Search size={15} />
          <input
            aria-label="Search slots"
            placeholder="Search space ID"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Slot status"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available inventory</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select
          aria-label="Vehicle type filter"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All vehicles</option>
          <option>CAR</option>
          <option>SUV</option>
          <option>MOTORCYCLE</option>
        </select>
      </div>
      {!id ? (
        <Empty
          title="Choose a facility."
          text="Parking spaces from your authorized facilities will appear here."
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <section className="panel">
          <SlotGrid
            slots={query.data.items}
            selected={selected?.id}
            onSelect={setSelected}
          />
        </section>
      ) : (
        <Empty
          title="Room for your next space."
          text="No spaces match this view. Adjust your filters or add inventory."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
      {selected && (
        <section className="panel selected-management">
          <div>
            <Badge kind={selected.availability}>{selected.availability}</Badge>
            <h2>
              {selected.label} · {selected.zone_name}
            </h2>
            <p className="muted">
              {selected.vehicle_type} · {selected.distance_m} m from entrance
              {selected.accessible ? " · Accessible" : ""}
              {selected.charging ? " · EV charging" : ""}
            </p>
            {selected.unavailable_reason && (
              <p>{selected.unavailable_reason}</p>
            )}
          </div>
          <button
            className="button secondary"
            onClick={() => setEditing(selected)}
          >
            <Wrench size={16} />
            {isAdmin ? "Edit space" : "Set maintenance status"}
          </button>
        </section>
      )}
      {editing && (
        <Modal
          title={
            editing === "new"
              ? "Add a parking space"
              : `Update ${editing.label}`
          }
          onClose={() => setEditing(null)}
        >
          <p className="fine-print">
            Changes are blocked while this space has active or upcoming
            bookings.
          </p>
          <EntityForm
            fields={fields}
            initial={
              editing === "new"
                ? {
                    vehicle_type: "CAR",
                    distance_m: 20,
                    accessible: false,
                    charging: false,
                    covered: true,
                    state: "AVAILABLE",
                  }
                : (editing as unknown as Record<string, unknown>)
            }
            endpoint={editing === "new" ? "/slots" : `/slots/${editing.id}`}
            method={editing === "new" ? "POST" : "PATCH"}
            transform={(d) => ({
              ...Object.fromEntries(fields.map((f) => [f.name, d[f.name]])),
              ...(editing === "new" ? { facility_id: id } : {}),
            })}
            onDone={() => {
              setEditing(null);
              setSelected(null);
            }}
            submit="Save space"
          />
        </Modal>
      )}
    </>
  );
}
export function OperationsReservations() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [facility, setFacility] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [change, setChange] = useState<{
    r: Reservation;
    status: string;
  } | null>(null);
  const facilities = useFacilities();
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["operations-reservations", page, status, facility],
    queryFn: () =>
      api<Page<Reservation>>(
        `/reservations?${params({ page, status, facility_id: facility })}`,
      ),
    refetchInterval: 30000,
  });
  return (
    <>
      <PageHeading
        eyebrow="KEEP EVERY ARRIVAL MOVING"
        title="Reservations, under control."
        text="View booking details and manage arrivals at your authorized facilities."
      />
      <div className="filter-bar">
        <select
          aria-label="Reservation facility"
          value={facility}
          onChange={(e) => {
            setFacility(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All authorized facilities</option>
          {facilities.data?.items.map((f) => (
            <option value={f.id} key={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Reservation status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking / facility</th>
                <th>Vehicle / space</th>
                <th>Arrival</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(r)}
                    >
                      {r.id.slice(0, 8).toUpperCase()}
                    </button>
                    <small>{r.facility_name}</small>
                  </td>
                  <td>
                    <strong>{r.registration}</strong>
                    <small>Space {r.slot_label}</small>
                  </td>
                  <td>
                    {dateTime(r.arrival)}
                    <small>Until {dateTime(r.departure)}</small>
                  </td>
                  <td>
                    <Badge kind={r.status}>{r.status.replace("_", " ")}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      {r.status === "CONFIRMED" && (
                        <>
                          <button
                            className="button secondary small"
                            onClick={() => setChange({ r, status: "ACTIVE" })}
                          >
                            Check in
                          </button>
                          <button
                            className="text-link"
                            onClick={() =>
                              setChange({ r, status: "CANCELLED" })
                            }
                          >
                            Cancel
                          </button>
                          <button
                            className="text-link"
                            onClick={() => setChange({ r, status: "NO_SHOW" })}
                          >
                            No-show
                          </button>
                        </>
                      )}
                      {r.status === "ACTIVE" && (
                        <button
                          className="button secondary small"
                          onClick={() => setChange({ r, status: "COMPLETED" })}
                        >
                          Check out
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="All quiet for now."
          text="Reservations for your selected facilities and filters will appear here."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
      {selected && (
        <Modal
          title={`Booking ${selected.id.slice(0, 8).toUpperCase()}`}
          onClose={() => setSelected(null)}
        >
          <h3>
            {selected.facility_name} · {selected.slot_label}
          </h3>
          <p>{selected.registration}</p>
          <div className="detail-row">
            <span>Arrival</span>
            <strong>{dateTime(selected.arrival)}</strong>
          </div>
          <div className="detail-row">
            <span>Departure</span>
            <strong>{dateTime(selected.departure)}</strong>
          </div>
          <div className="detail-row">
            <span>Estimated cost</span>
            <strong>{money(selected.estimated_cost)}</strong>
          </div>
          <h3>Allocation explanation</h3>
          <p>
            {selected.explanation.score}/100 · {selected.explanation.selection}
          </p>
          {selected.explanation.reasons.map((r) => (
            <p className="muted" key={r}>
              {r}
            </p>
          ))}
        </Modal>
      )}
      {change && (
        <Confirm
          title={`Update this reservation?`}
          text={`Change booking ${change.r.id.slice(0, 8).toUpperCase()} at ${change.r.facility_name} to ${change.status.toLowerCase().replace("_", " ")}? The customer will receive an in-app notification.`}
          label="Update reservation"
          onClose={() => setChange(null)}
          onConfirm={async () => {
            await send(
              `/reservations/${change.r.id}/status`,
              { status: change.status },
              "PATCH",
            );
            cache.invalidateQueries();
            toast("Reservation updated.");
          }}
        />
      )}
    </>
  );
}
export function UsersManagement() {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [change, setChange] = useState<{
    user: User;
    payload: { role?: Role; active?: boolean };
  } | null>(null);
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["users", q, role, page],
    queryFn: () => api<Page<User>>(`/admin/users?${params({ q, role, page })}`),
  });
  return (
    <>
      <PageHeading
        action={
          <button className="button" onClick={() => setCreating(true)}>
            <Plus size={17} />
            Create operator
          </button>
        }
        eyebrow="THE PEOPLE BEHIND THE PLATFORM"
        title="The right access. For everyone."
        text="Manage account roles and status. Access changes revoke existing sessions."
      />
      {creating && (
        <Modal
          title="Create operator account"
          onClose={() => setCreating(false)}
        >
          <p className="fine-print">
            Choose a unique initial password and share it securely with the
            operator. They can change it in their profile.
          </p>
          <EntityForm
            fields={[
              { name: "name", label: "Full name", required: true },
              {
                name: "email",
                label: "Email address",
                type: "email",
                required: true,
              },
              {
                name: "password",
                label: "Initial password",
                type: "password",
                required: true,
                hint: "At least 12 characters, including a letter and a number.",
              },
            ]}
            endpoint="/admin/operators"
            submit="Create operator"
            onDone={() => setCreating(false)}
          />
        </Modal>
      )}
      <div className="filter-bar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search users"
            placeholder="Search names or emails"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Filter users by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option>CUSTOMER</option>
          <option>OPERATOR</option>
          <option>ADMIN</option>
        </select>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      onChange={(e) =>
                        setChange({
                          user: u,
                          payload: { role: e.target.value as Role },
                        })
                      }
                    >
                      <option>CUSTOMER</option>
                      <option>OPERATOR</option>
                      <option>ADMIN</option>
                    </select>
                  </td>
                  <td>
                    <Badge kind={u.active ? "confirmed" : "cancelled"}>
                      {u.active ? "ACTIVE" : "DISABLED"}
                    </Badge>
                  </td>
                  <td>{dateTime(u.created_at)}</td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        setChange({ user: u, payload: { active: !u.active } })
                      }
                    >
                      {u.active ? "Disable" : "Enable"} account
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No accounts match."
          text="Try a different name, email, or role filter."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
      <p className="fine-print">
        Privileged accounts can also be provisioned using the documented secure
        setup command. The last active administrator is protected.
      </p>
      {change && (
        <Confirm
          title="Change account access?"
          text={`Update ${change.user.name} (${change.user.email}) to ${change.payload.role || (change.payload.active ? "an active account" : "a disabled account")}? Their current sessions will be revoked.`}
          label="Update access"
          onClose={() => setChange(null)}
          onConfirm={async () => {
            await send(
              `/admin/users/${change.user.id}`,
              change.payload,
              "PATCH",
            );
            cache.invalidateQueries();
            toast("Account access updated.");
          }}
        />
      )}
    </>
  );
}
export function Roles() {
  const query = useQuery({
    queryKey: ["roles"],
    queryFn: () =>
      api<{ role: string; permissions: string[] }[]>("/admin/roles"),
  });
  return (
    <>
      <PageHeading
        eyebrow="ACCESS WITH INTENTION"
        title="A workspace for every role."
        text="Permissions are enforced by the API on every protected request."
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <div className="portal-grid">
          {query.data.map((r) => (
            <section className="panel role-card" key={r.role}>
              <ShieldCheck size={30} />
              <h2>{r.role}</h2>
              <ul>
                {r.permissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link className="text-link" to="/admin/users">
                Manage role assignments <ArrowRight size={15} />
              </Link>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
export function AuditLogs() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["audit", q, page],
    queryFn: () =>
      api<
        Page<{
          id: string;
          action: string;
          entity_id: string | null;
          actor_id: string | null;
          created_at: string;
          details: Record<string, unknown>;
        }>
      >(`/admin/audit-logs?${params({ q, page })}`),
  });
  return (
    <>
      <PageHeading
        eyebrow="A CLEAR RECORD"
        title="Every important action, accounted for."
        text="A read-only record of account, inventory, reservation, and configuration changes."
      />
      <div className="filter-bar">
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="Search audit actions"
            placeholder="Filter actions, e.g. reservation"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor / entity</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Badge>{a.action}</Badge>
                  </td>
                  <td>
                    <small>
                      Actor: {a.actor_id?.slice(0, 8) || "Anonymous"}
                    </small>
                    <small>Entity: {a.entity_id?.slice(0, 8) || "—"}</small>
                  </td>
                  <td>{dateTime(a.created_at)}</td>
                  <td>
                    <details>
                      <summary>View details</summary>
                      <pre>{JSON.stringify(a.details, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No matching events."
          text="Important actions will appear here as the platform is used."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
    </>
  );
}
export function SystemSettings() {
  const query = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api<Settings>("/admin/settings"),
  });
  return (
    <>
      <PageHeading
        eyebrow="THOUGHTFUL RULES. BETTER MATCHES."
        title="Make the platform work your way."
        text="Hard eligibility requirements always take priority over ranking weights."
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <h2>Allocation & booking rules</h2>
            <p className="muted">
              Weights are normalized to 100% when saved. At least one must be
              positive.
            </p>
            <EntityForm
              key={JSON.stringify(query.data)}
              fields={[
                ...Object.keys(query.data.weights).map((k) => ({
                  name: k,
                  label: `${k[0].toUpperCase() + k.slice(1)} weight`,
                  type: "number",
                  min: 0,
                  max: 100,
                  required: true,
                })),
                {
                  name: "cancellation_minutes",
                  label: "Cancellation cutoff (minutes before arrival)",
                  type: "number",
                  min: 0,
                  max: 1440,
                  required: true,
                },
                {
                  name: "max_booking_hours",
                  label: "Maximum booking length (hours)",
                  type: "number",
                  min: 1,
                  max: 720,
                  required: true,
                },
              ]}
              initial={{
                ...query.data.weights,
                cancellation_minutes: query.data.cancellation_minutes,
                max_booking_hours: query.data.max_booking_hours,
              }}
              endpoint="/admin/settings"
              method="PUT"
              transform={(d) => ({
                weights: Object.fromEntries(
                  Object.keys(query.data.weights).map((k) => [k, d[k]]),
                ),
                cancellation_minutes: d.cancellation_minutes,
                max_booking_hours: d.max_booking_hours,
              })}
              submit="Save platform settings"
            />
          </section>
          <aside className="panel settings-explainer">
            <ShieldCheck size={31} />
            <h2>Eligibility comes first.</h2>
            <p>
              Vehicles must fit. Required accessibility and charging features
              must be present. Inactive, maintenance, and conflicting spaces are
              excluded before scoring.
            </p>
            <h3>How a recommendation is ranked</h3>
            <p>
              Eligible spaces are scored using vehicle fit, distance from the
              entrance, accessibility suitability, charging suitability, and
              covered-parking preference.
            </p>
            <p>
              Ties are resolved by entrance distance, space identifier, and
              database ID. Every reservation stores the factors and weights
              used.
            </p>
            <h3>Facility pricing</h3>
            <p>
              Hourly rates are configured per facility in integer paise.
              Reservations store a price snapshot and display an estimate.
            </p>
            <Link className="text-link" to="/admin/parking-lots">
              Manage facility rates <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}
