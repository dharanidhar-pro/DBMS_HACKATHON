import { BackButton } from "../components/BackButton";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  ArrowRight,
  CarFront,
  Check,
  Clock3,
  CornerDownRight,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { api, dateTime, money, params, send } from "../lib/api";
import { useToast } from "../lib/providers";
import {
  Badge,
  Empty,
  ErrorState,
  FacilityCard,
  Loading,
  Modal,
  PageHeading,
  Pagination,
} from "../components/ui";
import { Footer, PublicNav } from "./Public";
import type {
  Facility,
  Page,
  Recommendation,
  Reservation,
  Slot,
  Vehicle,
} from "../types";

export function FindParking({ publicView = false }: { publicView?: boolean }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["facilities", search, available, page],
    queryFn: () =>
      api<Page<Facility>>(
        `/facilities?${params({ q: search, available_only: available, page, page_size: 9 })}`,
      ),
    refetchInterval: 30000,
  });
  const contents = (
    <>
      <PageHeading
        eyebrow="A SPACE FOR EVERY STOP"
        title="Where are you heading?"
        text="Find your facility. We’ll help with the perfect space."
      />
      <form
        className="parking-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <div className="search-input">
          <MapPin size={20} />
          <label className="sr-only" htmlFor="destination">
            Search destination
          </label>
          <input
            id="destination"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a facility, neighbourhood, or city"
          />
        </div>
        <button className="button">
          <Search size={17} />
          Find parking
        </button>
      </form>
      <div className="row-between search-summary">
        <span>
          {query.data
            ? `${query.data.total} places to make your next stop`
            : "Discover your next destination"}
        </span>
        <label className="check-field">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => {
              setAvailable(e.target.checked);
              setPage(1);
            }}
          />
          Available now
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="facility-grid">
          {query.data.items.map((f, i) => (
            <FacilityCard key={f.id} facility={f} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          title="Let’s try a different destination."
          text="No facilities match this search. Try a city or facility name, or clear your filters."
          action={
            <button
              className="button secondary"
              onClick={() => {
                setQ("");
                setSearch("");
                setAvailable(false);
              }}
            >
              Clear search
            </button>
          }
        />
      )}
      <Pagination data={query.data} setPage={setPage} />
      <div className="discovery-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Your space. Thoughtfully selected.</strong>
          <p>
            Select a facility to see availability for your arrival and departure
            times. Inventory refreshes every 30 seconds.
          </p>
        </div>
      </div>
    </>
  );
  return publicView ? (
    <>
      <PublicNav />
      <main className="container explore-page">{contents}</main>
      <Footer />
    </>
  ) : (
    contents
  );
}
export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected?: string;
  onSelect: (slot: Slot) => void;
}) {
  return (
    <div className="lot-layout">
      <div className="lot-boundary">
        <div className="lot-top-label">
          <span>PARKING INVENTORY</span>
          <span>SELECT A SPACE TO EXPLORE</span>
        </div>
        <div className="slot-grid">
          {slots.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Space ${s.label}, ${s.availability.toLowerCase()}${s.charging ? ", EV charging" : ""}${s.accessible ? ", accessible" : ""}`}
              aria-pressed={selected === s.id}
              className={`parking-slot ${s.availability.toLowerCase()} ${s.eligible ? "eligible" : "ineligible"} ${selected === s.id ? "selected" : ""} ${i % 12 >= 6 ? "lower-row" : ""}`}
              onClick={() => onSelect(s)}
            >
              <span className="slot-label">{s.label}</span>
              <span className="slot-symbol">
                {s.availability === "MAINTENANCE" ? (
                  <Wrench size={23} />
                ) : s.availability === "OCCUPIED" ||
                  s.availability === "RESERVED" ? (
                  <CarFront size={30} />
                ) : s.charging ? (
                  <Zap size={23} />
                ) : s.accessible ? (
                  <Accessibility size={23} />
                ) : selected === s.id ? (
                  <Check size={23} />
                ) : (
                  <span className="available-mark" />
                )}
              </span>
              <small>
                {s.availability === "AVAILABLE"
                  ? s.vehicle_type === "MOTORCYCLE"
                    ? "Motorcycle"
                    : s.charging
                      ? "EV"
                      : s.accessible
                        ? "Accessible"
                        : "Available"
                  : s.availability.toLowerCase()}
              </small>
            </button>
          ))}
        </div>
        <div className="lot-road">
          <span>→</span>
          <span className="road-dashes" />
          <span>DRIVE AISLE</span>
          <span className="road-dashes" />
          <span>→</span>
        </div>
        <div className="lot-entrance">
          <CornerDownRight size={16} />
          ENTRANCE{" "}
          <span>Layout is schematic. Follow facility signage on arrival.</span>
        </div>
      </div>
    </div>
  );
}
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ParkingDetail() {
  const { parkingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const cache = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [arrival, setArrival] = useState(() =>
    localInput(new Date(Date.now() + 2 * 3600000)),
  );
  const [departure, setDeparture] = useState(() =>
    localInput(new Date(Date.now() + 4 * 3600000)),
  );
  const [accessible, setAccessible] = useState(false);
  const [charging, setCharging] = useState(false);
  const [covered, setCovered] = useState(true);
  const [zone, setZone] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [review, setReview] = useState(false);
  const facility = useQuery({
    queryKey: ["facility", parkingId],
    queryFn: () => api<Facility>(`/facilities/${parkingId}`),
  });
  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api<Vehicle[]>("/vehicles"),
  });
  useEffect(() => {
    if (!vehicleId && vehicles.data?.length) setVehicleId(vehicles.data[0].id);
  }, [vehicles.data, vehicleId]);
  const validTime =
    !!arrival && !!departure && new Date(arrival) < new Date(departure);
  const interval = validTime
    ? {
        arrival: new Date(arrival).toISOString(),
        departure: new Date(departure).toISOString(),
      }
    : {};
  const payload = {
    facility_id: parkingId,
    vehicle_id: vehicleId,
    ...interval,
    accessible,
    charging,
    prefer_covered: covered,
  };
  const slots = useQuery({
    queryKey: [
      "slots",
      parkingId,
      interval,
      vehicleId,
      zone,
      q,
      type,
      accessible,
      charging,
      available,
      page,
    ],
    queryFn: () =>
      api<Page<Slot>>(
        `/slots?${params({ facility_id: parkingId, ...interval, vehicle_id: vehicleId, zone_id: zone, q, vehicle_type: type, accessible, charging, available_only: available, page, page_size: 48 })}`,
      ),
    enabled: validTime,
    refetchInterval: 30000,
  });
  const recommendation = useMutation({
    mutationFn: () => send<Recommendation>("/allocation/recommend", payload),
    onSuccess: (data) =>
      setSelected({
        ...data.recommendation.slot,
        eligible: true,
        availability: "AVAILABLE",
        unavailable_reason: null,
      }),
  });
  const book = useMutation({
    mutationFn: () =>
      send<Reservation>("/reservations", { ...payload, slot_id: selected?.id }),
    onSuccess: (r) => {
      cache.invalidateQueries();
      toast("Your space is reserved. See you there.");
      navigate(`/app/reservations/${r.id}`);
    },
    onError: () => slots.refetch(),
  });
  useEffect(() => {
    setSelected(null);
    recommendation.reset();
    setPage(1);
  }, [vehicleId, arrival, departure, accessible, charging, covered, parkingId]);
  const selectedNow =
    selected &&
    (slots.data?.items.find((s) => s.id === selected.id) || selected);
  if (facility.isPending) return <Loading />;
  if (facility.error)
    return <ErrorState error={facility.error} retry={facility.refetch} />;
  const f = facility.data;
  const estimate = validTime
    ? Math.ceil(
        (f.hourly_rate *
          Math.ceil(
            (new Date(departure).getTime() - new Date(arrival).getTime()) /
              60000,
          )) /
          60,
      )
    : 0;
  return (
    <>
      <BackButton fallback="/app/find-parking" />
      <PageHeading
        eyebrow="MAKE THIS YOUR NEXT STOP"
        title={f.name}
        text={`${f.address}, ${f.city}`}
        action={
          <div className="facility-price">
            {money(f.hourly_rate)}
            <small> / hour</small>
          </div>
        }
      />
      {f.demo && (
        <div className="info-banner">
          <Info size={16} />
          Demonstration facility · explore the complete booking experience with
          sample inventory.
        </div>
      )}
      <div className="booking-workspace">
        <div className="booking-main">
          <section className="panel booking-filters">
            <div className="section-heading compact-heading">
              <h2>Your arrival, your way.</h2>
              <SlidersHorizontal size={18} />
            </div>
            <fieldset disabled={recommendation.isPending || book.isPending}>
              <div className="booking-inputs">
                <label className="field">
                  <span>Your vehicle</span>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.data?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} · {v.vehicle_type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Arrival</span>
                  <input
                    type="datetime-local"
                    value={arrival}
                    onChange={(e) => setArrival(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Departure</span>
                  <input
                    type="datetime-local"
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value)}
                  />
                </label>
              </div>
              <div className="preference-row">
                <label>
                  <input
                    type="checkbox"
                    checked={accessible}
                    onChange={(e) => setAccessible(e.target.checked)}
                  />
                  <Accessibility size={15} />
                  Accessible space
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={charging}
                    onChange={(e) => setCharging(e.target.checked)}
                  />
                  <Zap size={15} />
                  EV charging required
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={covered}
                    onChange={(e) => setCovered(e.target.checked)}
                  />
                  Prefer covered
                </label>
              </div>
            </fieldset>
            {!validTime && (
              <p className="form-error">
                Choose an arrival before your departure.
              </p>
            )}
            {vehicles.error && (
              <ErrorState error={vehicles.error} retry={vehicles.refetch} />
            )}{" "}
            {!vehicles.isPending &&
              !vehicles.error &&
              !vehicles.data?.length && (
                <div className="info-banner">
                  Add a vehicle to get a compatible recommendation.{" "}
                  <Link to="/app/vehicles">
                    Add vehicle <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            <div className="smart-allocation-row">
              <div>
                <Sparkles size={20} />
                <span>
                  <strong>Let’s find your perfect fit.</strong>
                  <small>
                    Matched to your vehicle, needs, and preferences.
                  </small>
                </span>
              </div>
              <button
                className="button"
                disabled={
                  !vehicleId ||
                  !validTime ||
                  recommendation.isPending ||
                  book.isPending
                }
                onClick={() => recommendation.mutate()}
              >
                {recommendation.isPending ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <Sparkles size={16} />
                )}
                Recommend a space
              </button>
            </div>
            {recommendation.error && (
              <p className="form-error" role="alert">
                {recommendation.error.message}
              </p>
            )}
          </section>
          <section className="panel parking-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>Find your place.</h2>
                <p className="muted">
                  Availability for your selected time · refreshes every 30s
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Refresh availability"
                onClick={() => slots.refetch()}
              >
                <RefreshCw
                  size={17}
                  className={slots.isFetching ? "spin" : ""}
                />
              </button>
            </div>
            <div className="lot-toolbar">
              <label className="search-input">
                <Search size={15} />
                <input
                  aria-label="Search space ID"
                  placeholder="Space ID"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <select
                aria-label="Parking zone"
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All zones</option>
                {f.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {z.level}
                  </option>
                ))}
              </select>
              <select
                aria-label="Space type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                <option value="CAR">Car</option>
                <option value="SUV">SUV</option>
                <option value="MOTORCYCLE">Motorcycle</option>
              </select>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => {
                    setAvailable(e.target.checked);
                    setPage(1);
                  }}
                />
                Available only
              </label>
            </div>
            {!validTime ? (
              <Empty
                title="Choose your times."
                text="Select a valid arrival and departure to see available spaces."
              />
            ) : slots.isPending ? (
              <Loading label="Checking available spaces…" />
            ) : slots.error ? (
              <ErrorState error={slots.error} retry={slots.refetch} />
            ) : slots.data?.items.length ? (
              <SlotGrid
                slots={slots.data.items}
                selected={selected?.id}
                onSelect={setSelected}
              />
            ) : (
              <Empty
                title="No spaces in this view."
                text="Adjust your filters or try a different time."
              />
            )}
            <Pagination data={slots.data} setPage={setPage} />
            <div className="lot-legend">
              <span>
                <i className="available" />
                Available
              </span>
              <span>
                <CarFront size={13} />
                Reserved / occupied
              </span>
              <span>
                <Wrench size={13} />
                Maintenance
              </span>
              <span>
                <Zap size={13} />
                EV
              </span>
              <span>
                <Accessibility size={13} />
                Accessible
              </span>
            </div>
          </section>
        </div>
        <aside className="booking-sidebar">
          <section className="panel selection-panel">
            <div className="eyebrow">YOUR PARKING PLAN</div>
            {selectedNow ? (
              <>
                <div className="selected-space">
                  <div>
                    <small>SPACE</small>
                    <strong>{selectedNow.label}</strong>
                  </div>
                  <Badge kind={selectedNow.availability}>
                    {selectedNow.availability}
                  </Badge>
                </div>
                {selectedNow.unavailable_reason ? (
                  <div className="info-banner">
                    {selectedNow.unavailable_reason}
                  </div>
                ) : (
                  <p className="muted">
                    <Check size={15} />
                    Available for the selected interval
                  </p>
                )}
                <div className="selected-features">
                  <span>
                    <CarFront size={16} />
                    {selectedNow.vehicle_type}
                  </span>
                  <span>
                    <MapPin size={16} />
                    {selectedNow.distance_m} m to entrance
                  </span>
                  {selectedNow.charging && (
                    <span>
                      <Zap size={16} />
                      EV charging
                    </span>
                  )}
                  {selectedNow.accessible && (
                    <span>
                      <Accessibility size={16} />
                      Accessible
                    </span>
                  )}
                </div>
                {recommendation.data?.recommendation.slot.id ===
                  selectedNow.id && (
                  <div className="recommendation-summary">
                    <Sparkles size={18} />
                    <strong>
                      {recommendation.data.recommendation.explanation.score}/100
                      match
                    </strong>
                    {recommendation.data.recommendation.explanation.reasons.map(
                      (r) => (
                        <small key={r}>{r}</small>
                      ),
                    )}
                  </div>
                )}
                <div className="detail-row">
                  <span>Estimated total</span>
                  <strong>{money(estimate)}</strong>
                </div>
                <p className="fine-print">
                  No payment collected. Availability is checked again at
                  confirmation.
                </p>
                <button
                  className="button full"
                  disabled={
                    !selectedNow.eligible ||
                    !vehicleId ||
                    !validTime ||
                    book.isPending
                  }
                  onClick={() => setReview(true)}
                >
                  Review reservation <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <div className="selection-empty">
                <div>
                  <CarFront size={36} />
                </div>
                <h3>A space that feels right.</h3>
                <p>
                  Select a space on the parking layout, or let us recommend your
                  best match.
                </p>
              </div>
            )}
          </section>
          <div className="booking-reassurance">
            <ShieldCheck size={19} />
            <p>
              Your reservation is confirmed only after a final availability
              check.
            </p>
          </div>
        </aside>
      </div>
      {review && selectedNow && (
        <Modal
          title="One step from parked."
          onClose={() => {
            if (!book.isPending) setReview(false);
          }}
        >
          <div className="review-summary">
            <Badge>
              {f.demo ? "DEMONSTRATION RESERVATION" : "REVIEW YOUR RESERVATION"}
            </Badge>
            <h3>
              {f.name} · {selectedNow.label}
            </h3>
            <div className="detail-row">
              <span>Vehicle</span>
              <strong>
                {vehicles.data?.find((v) => v.id === vehicleId)?.registration}
              </strong>
            </div>
            <div className="detail-row">
              <span>Arrival</span>
              <strong>{dateTime(new Date(arrival).toISOString())}</strong>
            </div>
            <div className="detail-row">
              <span>Departure</span>
              <strong>{dateTime(new Date(departure).toISOString())}</strong>
            </div>
            <div className="detail-row total">
              <span>Estimated cost</span>
              <strong>{money(estimate)}</strong>
            </div>
            <p className="fine-print">
              Estimate only. No payment will be collected.
            </p>
          </div>
          {book.error && (
            <p className="form-error" role="alert">
              {book.error.message}
            </p>
          )}
          <button
            className="button full"
            disabled={book.isPending}
            onClick={() => book.mutate()}
          >
            {book.isPending ? (
              <Loader2 size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            Confirm reservation
          </button>
        </Modal>
      )}
    </>
  );
}
