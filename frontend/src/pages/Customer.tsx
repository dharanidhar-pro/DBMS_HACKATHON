import { BackButton } from "../components/BackButton";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  Download,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Ticket,
  Trash2,
  Zap,
} from "lucide-react";
import { api, dateTime, money, params, send } from "../lib/api";
import { useAuth, useToast } from "../lib/providers";
import {
  Badge,
  Confirm,
  Empty,
  EntityForm,
  ErrorState,
  FacilityCard,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  ThemeSwitch,
  type FormField,
} from "../components/ui";
import type {
  Dashboard,
  Facility,
  Notice,
  Page,
  Reservation,
  Vehicle,
} from "../types";

export function ReservationCard({
  reservation: r,
}: {
  reservation: Reservation;
}) {
  return (
    <Link to={`/app/reservations/${r.id}`} className="reservation-card">
      <div className="reservation-symbol">
        <Ticket size={22} />
      </div>
      <div className="reservation-card-main">
        <div className="row-between">
          <h3>{r.facility_name}</h3>
          <Badge kind={r.status}>{r.status.replace("_", " ")}</Badge>
        </div>
        <p>
          <MapPin size={13} />
          {r.facility_address}
        </p>
        <div className="reservation-meta">
          <span>
            <CalendarDays size={14} />
            {dateTime(r.arrival)}
          </span>
          <span>
            <CarFront size={14} />
            {r.registration}
          </span>
          <strong>Space {r.slot_label}</strong>
        </div>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
export function CustomerDashboard() {
  const { user } = useAuth();
  const data = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
  });
  const facilities = useQuery({
    queryKey: ["dashboard-facilities"],
    queryFn: () => api<Page<Facility>>("/facilities?page_size=3"),
    refetchInterval: 30000,
  });
  const notices = useQuery({
    queryKey: ["dashboard-notices"],
    queryFn: () => api<Page<Notice>>("/notifications?unread=true&page_size=3"),
  });
  if (data.isPending) return <Loading />;
  if (data.error) return <ErrorState error={data.error} retry={data.refetch} />;
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE SPACE FOR YOUR DAY"
        title={`Good to see you, ${user?.name.split(" ")[0]}.`}
        text="Your next arrival, taken care of."
        action={
          <Link className="button" to="/app/find-parking">
            Find parking <ArrowUpRight size={17} />
          </Link>
        }
      />
      <div className="dashboard-banner">
        <div>
          <Badge>
            <Sparkles size={12} />
            YOUR JOURNEY, SIMPLIFIED
          </Badge>
          <h2>
            Less time circling.
            <br />
            More time <span>being there.</span>
          </h2>
          <p>A parking space that fits your vehicle and your plans.</p>
          <Link className="text-link" to="/app/find-parking">
            Plan your next arrival <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-parking-sign">
          P<span>YOUR SPACE AWAITS</span>
          <div className="banner-route" />
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>
            Your reservations
            <Ticket size={18} />
          </span>
          <strong>{data.data.reservations}</strong>
          <small>All your journeys, in one place</small>
        </div>
        <div className="stat-card">
          <span>
            Registered vehicles
            <CarFront size={18} />
          </span>
          <strong>{data.data.vehicles}</strong>
          <Link to="/app/vehicles">
            Manage your garage <ArrowRight size={13} />
          </Link>
        </div>
        <div className="stat-card">
          <span>
            Next arrival
            <Clock3 size={18} />
          </span>
          <strong className="stat-text">
            {data.data.upcoming[0]
              ? dateTime(data.data.upcoming[0].arrival)
              : "Open possibilities"}
          </strong>
          <small>
            {data.data.upcoming[0]?.facility_name ||
              "Find a space for your next stop"}
          </small>
        </div>
      </div>
      <div className="section-heading compact-heading">
        <h2>Your upcoming arrivals</h2>
        <Link to="/app/reservations" className="text-link">
          All reservations <ArrowRight size={16} />
        </Link>
      </div>
      {data.data.upcoming.length ? (
        <div className="stack">
          {data.data.upcoming.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      ) : (
        <Empty
          title="Your next journey starts here."
          text="Choose a facility and reserve a space that works for you."
          action={
            <Link className="button secondary small" to="/app/find-parking">
              Find your space <ArrowRight size={15} />
            </Link>
          }
        />
      )}
      <div className="section-heading compact-heading">
        <h2>Discover your next stop</h2>
        <Link className="text-link" to="/app/find-parking">
          Explore parking <ArrowRight size={16} />
        </Link>
      </div>
      {facilities.error ? (
        <ErrorState error={facilities.error} retry={facilities.refetch} />
      ) : (
        <div className="facility-grid">
          {facilities.data?.items.map((f, i) => (
            <FacilityCard key={f.id} facility={f} index={i} />
          ))}
        </div>
      )}
      {!!notices.data?.items.length && (
        <section className="panel dashboard-notices">
          <div className="section-heading compact-heading">
            <h2>While you were away</h2>
            <Link to="/app/notifications" className="text-link">
              Notifications <ArrowRight size={15} />
            </Link>
          </div>
          {notices.data.items.map((n) => (
            <div key={n.id} className="notice-preview">
              <Bell size={16} />
              <span>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </span>
            </div>
          ))}
        </section>
      )}
      {!!data.data.recent.length && (
        <>
          <div className="section-heading compact-heading">
            <h2>Recent reservations</h2>
            <Link className="text-link" to="/app/history">
              View history <ArrowRight size={16} />
            </Link>
          </div>
          {data.data.recent.slice(0, 3).map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </>
      )}
    </>
  );
}
const vehicleFields: FormField[] = [
  { name: "registration", label: "Registration number", required: true },
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
  { name: "make", label: "Make" },
  { name: "model", label: "Model" },
  { name: "electric", label: "This is an electric vehicle", type: "checkbox" },
];
export function Vehicles() {
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api<Vehicle[]>("/vehicles"),
  });
  return (
    <>
      <PageHeading
        eyebrow="YOUR GARAGE"
        title="Made for your kind of drive."
        text="Keep your vehicles ready for their next journey."
        action={
          <button className="button" onClick={() => setEditing("new")}>
            <Plus size={17} />
            Add vehicle
          </button>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.length ? (
        <div className="vehicle-grid">
          {query.data.map((v, i) => (
            <article className="vehicle-card" key={v.id}>
              <div className="row-between">
                <Badge>{v.vehicle_type}</Badge>
                {v.electric && (
                  <Badge kind="confirmed">
                    <Zap size={12} />
                    Electric
                  </Badge>
                )}
              </div>
              <div className={`vehicle-graphic vehicle-${i % 3}`}>
                <CarFront strokeWidth={1} size={112} />
                <span />
              </div>
              <div className="number-plate">
                <small>IND</small>
                {v.registration}
              </div>
              <h3>
                {[v.make, v.model].filter(Boolean).join(" ") ||
                  "Your everyday ride"}
              </h3>
              <div className="vehicle-actions">
                <button className="text-link" onClick={() => setEditing(v)}>
                  <Pencil size={14} />
                  Edit details
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${v.registration}`}
                  onClick={() => setRemoving(v)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Your garage is ready."
          text="Add your first vehicle so we can find a parking space that fits."
          action={
            <button
              className="button secondary"
              onClick={() => setEditing("new")}
            >
              <Plus size={16} />
              Add your first vehicle
            </button>
          }
        />
      )}{" "}
      {editing && (
        <Modal
          title={editing === "new" ? "Add your vehicle" : "Edit vehicle"}
          onClose={() => setEditing(null)}
        >
          <EntityForm
            fields={vehicleFields}
            initial={
              editing === "new"
                ? { vehicle_type: "CAR", electric: false }
                : (editing as unknown as Record<string, unknown>)
            }
            endpoint={
              editing === "new" ? "/vehicles" : `/vehicles/${editing.id}`
            }
            method={editing === "new" ? "POST" : "PUT"}
            transform={(d) =>
              Object.fromEntries(vehicleFields.map((f) => [f.name, d[f.name]]))
            }
            onDone={() => setEditing(null)}
            submit={editing === "new" ? "Add vehicle" : "Save vehicle"}
          />
        </Modal>
      )}
      {removing && (
        <Confirm
          title="Remove this vehicle?"
          text={`Remove ${removing.registration} from your garage? Previous reservations will remain in your history.`}
          label="Remove vehicle"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await send(`/vehicles/${removing.id}`, undefined, "DELETE");
            cache.invalidateQueries();
            toast("Vehicle removed.");
          }}
        />
      )}
    </>
  );
}
export function Reservations({ history = false }: { history?: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["reservations", history, status, page],
    refetchInterval: 30000,
    queryFn: () =>
      api<Page<Reservation>>(
        `/reservations?${params({ status, page })}`,
      ),
  });
  return (
    <>
      <PageHeading
        eyebrow={history ? "THE PLACES YOU’VE BEEN" : "YOUR ARRIVALS"}
        title={
          history ? "Every journey, remembered." : "A space in your plans."
        }
        text={
          history
            ? "Review all your bookings, including upcoming, completed, and cancelled reservations."
            : "All your bookings, and everything you need to arrive."
        }
        action={
          <Link className="button" to="/app/find-parking">
            <Plus size={17} />
            New reservation
          </Link>
        }
      />
      <div className="filter-bar">
        <div className="tabs">
          {[
            ["", "All bookings"],
            ["CONFIRMED", "Confirmed"],
            ["ACTIVE", "Active"],
            ["CANCELLED", "Cancelled"],
            ["COMPLETED", "Completed"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="stack">
          {query.data.items.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      ) : (
        <Empty
          title="A fresh start."
          text="Bookings matching this view will appear here."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
    </>
  );
}
export function ReservationDetail() {
  const { reservationId } = useParams();
  const [confirm, setConfirm] = useState(false);
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => api<Reservation>(`/reservations/${reservationId}`),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={query.refetch} />;
  const r = query.data;
  const canCancel =
    r.status === "CONFIRMED" && new Date(r.cancellation_deadline) > new Date();
  function downloadCalendar() {
    const escape = (v: string) =>
      v
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
    const dt = (d: string) =>
      new Date(d)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const contents = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PARKLY//Parking//EN\r\nBEGIN:VEVENT\r\nUID:${r.id}@parkly\r\nDTSTAMP:${dt(new Date().toISOString())}\r\nDTSTART:${dt(r.arrival)}\r\nDTEND:${dt(r.departure)}\r\nSUMMARY:${escape(`Parking at ${r.facility_name} — ${r.slot_label}`)}\r\nLOCATION:${escape(r.facility_address)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const url = URL.createObjectURL(
      new Blob([contents], { type: "text/calendar" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `parkly-${r.id.slice(0, 8)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <BackButton fallback="/app/reservations" />
      <PageHeading
        eyebrow={`BOOKING ${r.id.slice(0, 8).toUpperCase()}`}
        title={
          r.status === "CONFIRMED"
            ? "Your space is waiting."
            : "Your reservation."
        }
        text="Everything you need for a smoother arrival."
        action={<Badge kind={r.status}>{r.status.replace("_", " ")}</Badge>}
      />
      <div className="detail-grid">
        <section className="panel reservation-detail">
          <div className="row-between">
            <div>
              <h2>{r.facility_name}</h2>
              <p>
                <MapPin size={15} />
                {r.facility_address}
              </p>
            </div>
            <div className="space-ticket">
              <small>YOUR SPACE</small>
              <strong>{r.slot_label}</strong>
            </div>
          </div>
          {r.facility_demo && (
            <div className="info-banner">
              Demonstration facility. This booking is for testing the platform,
              not a physical parking service.
            </div>
          )}
          <div className="booking-time-grid">
            <div>
              <small>ARRIVAL</small>
              <strong>{dateTime(r.arrival)}</strong>
            </div>
            <ArrowRight size={21} />
            <div>
              <small>DEPARTURE</small>
              <strong>{dateTime(r.departure)}</strong>
            </div>
          </div>
          <div className="detail-row">
            <span>Vehicle</span>
            <strong>
              {r.registration} · {r.vehicle_type}
            </strong>
          </div>
          <div className="detail-row">
            <span>Hourly rate</span>
            <strong>{money(r.hourly_rate)}</strong>
          </div>
          <div className="detail-row total">
            <span>Estimated cost</span>
            <strong>{money(r.estimated_cost)}</strong>
          </div>
          <p className="fine-print">
            Estimate only. No payment has been collected. Times use your
            device’s local timezone.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={downloadCalendar}>
              <Download size={15} />
              Add to calendar
            </button>
            {canCancel && (
              <button
                className="button danger"
                onClick={() => setConfirm(true)}
              >
                Cancel reservation
              </button>
            )}
          </div>
          {r.status === "CONFIRMED" && (
            <p className="fine-print">
              Cancellation closes {dateTime(r.cancellation_deadline)}.
            </p>
          )}
        </section>
        <aside className="stack">
          <section className="panel allocation-panel">
            <div className="eyebrow">
              <Sparkles size={15} />A THOUGHTFUL MATCH
            </div>
            <div className="match-score">
              <strong>
                {r.explanation.score}
                <small>/100</small>
              </strong>
              <span>Allocation score</span>
            </div>
            <h3>{r.explanation.selection}</h3>
            {r.explanation.reasons.map((t) => (
              <p className="reason" key={t}>
                <Check size={15} />
                {t}
              </p>
            ))}
          </section>
          <section className="panel">
            <h3>Reservation timeline</h3>
            <div className="timeline">
              {r.history?.map((h) => (
                <div key={h.id}>
                  <span />
                  <strong>{h.status.replace("_", " ")}</strong>
                  <small>{dateTime(h.created_at)}</small>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {confirm && (
        <Confirm
          title="Cancel this reservation?"
          text={`Your space at ${r.facility_name} will become available to other drivers.`}
          label="Cancel reservation"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await send(`/reservations/${r.id}/cancel`);
            cache.invalidateQueries();
            toast("Reservation cancelled.");
          }}
        />
      )}
    </>
  );
}
export function Notifications() {
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", unread, page],
    queryFn: () =>
      api<Page<Notice> & { unread_count: number }>(
        `/notifications?${params({ unread, page })}`,
      ),
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: (id: string) => send(`/notifications/${id}/read`),
    onSuccess: () => cache.invalidateQueries(),
  });
  return (
    <>
      <PageHeading
        eyebrow="STAY IN THE KNOW"
        title="Your latest updates."
        text="Booking confirmations and changes, all in one place."
      />
      <div className="filter-bar">
        <label className="check-field">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setPage(1);
            }}
          />
          Unread only {query.data && `(${query.data.unread_count})`}
        </label>
      </div>
      {mutation.error && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="stack">
          {query.data.items.map((n) => (
            <article
              key={n.id}
              className={`notice-card ${n.read ? "read" : ""}`}
            >
              <span className="notice-icon">
                <Bell size={20} />
              </span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                <small>{dateTime(n.created_at)}</small>
                {n.reservation_id && (
                  <Link
                    className="text-link"
                    to={`/app/reservations/${n.reservation_id}`}
                  >
                    View booking <ArrowRight size={13} />
                  </Link>
                )}
              </div>
              {!n.read && (
                <button
                  className="button secondary small"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(n.id)}
                >
                  Mark as read
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="You’re all caught up."
          text="Updates about your parking reservations will appear here."
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
    </>
  );
}
export function Profile({ settings = false }: { settings?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title={settings ? "Your preferences." : "A little about you."}
        text={
          settings
            ? "Choose how PARKLY looks and feels."
            : "Manage the details behind your journeys."
        }
      />
      {settings ? (
        <section className="panel narrow-panel">
          <h2>Your look. Your space.</h2>
          <p className="muted">
            Choose a theme. Your preference is saved on this device.
          </p>
          <ThemeSwitch />
          <div className="theme-previews">
            {["midnight", "arctic", "emerald"].map((t) => (
              <div className={`theme-preview ${t}`} key={t}>
                <span />
                <span />
                <span />
                <strong>
                  {t === "midnight"
                    ? "Midnight Electric"
                    : t === "arctic"
                      ? "Arctic Light"
                      : "Emerald Drive"}
                </strong>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Without a saved choice, PARKLY follows your system’s light or dark
            appearance.
          </p>
        </section>
      ) : (
        <div className="profile-grid">
          <section className="panel">
            <div className="profile-identity">
              <span className="avatar">{user?.name[0]}</span>
              <div>
                <h2>{user?.name}</h2>
                <p>{user?.email}</p>
              </div>
            </div>
            <EntityForm
              fields={[{ name: "name", label: "Full name", required: true }]}
              initial={{ name: user?.name }}
              endpoint="/auth/me"
              method="PATCH"
            />
            <div className="detail-row">
              <span>Account type</span>
              <Badge>{user?.role}</Badge>
            </div>
            <p className="fine-print">
              Email changes are handled by the organization operating your
              PARKLY installation.
            </p>
          </section>
          <section className="panel">
            <h2>Keep your account secure.</h2>
            <p className="muted">
              Changing your password signs out your other sessions.
            </p>
            <EntityForm
              fields={[
                {
                  name: "current_password",
                  label: "Current password",
                  type: "password",
                  required: true,
                },
                {
                  name: "new_password",
                  label: "New password",
                  type: "password",
                  required: true,
                  hint: "At least 12 characters, with a letter and a number.",
                },
              ]}
              endpoint="/auth/password"
              submit="Update password"
              onDone={() => navigate(0)}
            />
          </section>
        </div>
      )}
    </>
  );
}
