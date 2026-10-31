import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Palette,
  ParkingCircle,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTheme, useToast } from "../lib/providers";
import { money, send } from "../lib/api";
import type { Facility, Page } from "../types";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="PARKLY home">
      <span className="brand-icon">
        P<span />
      </span>
      {!compact && (
        <span>
          parkly<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="theme-switch">
      <Palette size={17} />
      <span className="sr-only">Theme</span>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as typeof theme)}
      >
        <option value="midnight">Midnight Electric</option>
        <option value="arctic">Arctic Light</option>
        <option value="emerald">Emerald Drive</option>
      </select>
    </label>
  );
}
export function Badge({
  children,
  kind = "",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={`badge ${kind.toLowerCase()}`}>{children}</span>;
}
export function Loading({ label = "Finding your space…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={25} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => unknown;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle />
      <div>
        <strong>We couldn’t load this.</strong>
        <p>{error?.message || "Please try again."}</p>
        {retry && (
          <button className="button secondary small" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ParkingCircle size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  data,
  setPage,
}: {
  data?: Pick<Page<unknown>, "page" | "page_size" | "total">;
  setPage: (n: number) => void;
}) {
  if (!data || data.total <= data.page_size) return null;
  return (
    <div className="pagination">
      <span>
        {(data.page - 1) * data.page_size + 1}–
        {Math.min(data.page * data.page_size, data.total)} of {data.total}
      </span>
      <button
        className="icon-button"
        aria-label="Previous page"
        disabled={data.page === 1}
        onClick={() => setPage(data.page - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        className="icon-button"
        aria-label="Next page"
        disabled={data.page * data.page_size >= data.total}
        onClick={() => setPage(data.page + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = saved;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  text,
  label = "Confirm",
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  label?: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">{text}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Go back
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="spin" size={17} /> : null}
          {label}
        </button>
      </div>
    </Modal>
  );
}
export interface FormField {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  hint?: string;
}
export function EntityForm({
  fields,
  initial = {},
  endpoint,
  method = "POST",
  onDone,
  submit = "Save changes",
  transform,
}: {
  fields: FormField[];
  initial?: Record<string, unknown>;
  endpoint: string;
  method?: string;
  onDone?: () => void;
  submit?: string;
  transform?: (data: Record<string, unknown>) => unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({ defaultValues: initial });
  const cache = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      send(endpoint, transform ? transform(data) : data, method),
    onSuccess: () => {
      cache.invalidateQueries();
      toast("Changes saved.");
      onDone?.();
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
    >
      {fields.map((f) => (
        <label
          className={f.type === "checkbox" ? "check-field" : "field"}
          key={f.name}
        >
          <span>
            {f.label}
            {f.required && <span className="required"> *</span>}
          </span>
          {f.options ? (
            <select
              aria-label={f.label}
              {...register(f.name, {
                required: f.required ? "Choose an option." : false,
              })}
            >
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              aria-label={f.label}
              rows={3}
              {...register(f.name, {
                required: f.required ? "This field is required." : false,
              })}
            />
          ) : (
            <input
              type={f.type || "text"}
              step={f.type === "number" ? "any" : undefined}
              aria-label={f.label}
              {...register(f.name, {
                required: f.required ? "This field is required." : false,
                ...(f.type === "number"
                  ? { valueAsNumber: true, min: f.min, max: f.max }
                  : {}),
              })}
              min={f.min}
              max={f.max}
            />
          )}{" "}
          {f.hint && <small>{f.hint}</small>}
          {errors[f.name] && (
            <small className="form-error">
              {String(errors[f.name]?.message)}
            </small>
          )}
        </label>
      ))}
      {mutation.error && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      <button className="button" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 size={17} className="spin" />}
        {submit}
      </button>
    </form>
  );
}
export function FacilityArt({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      className={`facility-art art-${variant % 3}`}
      viewBox="0 0 440 190"
      role="img"
      aria-label="Architectural parking illustration"
    >
      <defs>
        <pattern
          id={`grid-${variant}`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M24 0H0V24"
            fill="none"
            stroke="currentColor"
            opacity=".08"
          />
        </pattern>
      </defs>
      <rect width="440" height="190" fill="currentColor" opacity=".035" />
      <rect width="440" height="190" fill={`url(#grid-${variant})`} />
      <path
        d="M0 160L440 107M0 195L440 140"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".18"
      />
      <path
        d="M100 146V62L280 26L363 71V113L184 163Z"
        fill="var(--art-building)"
        stroke="currentColor"
        opacity=".7"
      />
      <path
        d="M100 62L184 100L363 71M184 100V163M100 95L184 132L363 101"
        fill="none"
        stroke="currentColor"
        opacity=".3"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M${201 + i * 22} ${109 - i * 4}v16`}
          stroke="currentColor"
          strokeWidth="12"
          opacity=".25"
        />
      ))}
      <rect
        x="126"
        y="83"
        width="26"
        height="32"
        rx="4"
        fill="var(--accent)"
        transform="skewY(23) translate(0 -54)"
      />
      <text
        x="133"
        y="68"
        fill="var(--on-accent)"
        fontSize="20"
        fontWeight="800"
        transform="skewY(23) translate(0 -15)"
      >
        P
      </text>
      <path
        d="M48 155v-23m-6 3q6-27 12 0"
        stroke="var(--accent)"
        fill="none"
        strokeWidth="7"
      />
      <circle cx="388" cy="76" r="18" fill="currentColor" opacity=".06" />
    </svg>
  );
}
export function FacilityCard({
  facility,
  index = 0,
  to,
}: {
  facility: Facility;
  index?: number;
  to?: string;
}) {
  return (
    <Link className="facility-card" to={to || `/app/parking/${facility.id}`}>
      <div className="facility-image">
        <FacilityArt variant={index} />
        {facility.demo && <span className="demo-label">Demo facility</span>}
        <span className="availability-pill">
          <span />
          {facility.available_slots} available now
        </span>
      </div>
      <div className="facility-content">
        <div className="row-between">
          <h3>{facility.name}</h3>
          <ArrowRight size={18} />
        </div>
        <p>
          <MapPin size={13} />
          {facility.city} · {facility.address.split(",")[0]}
        </p>
        <div className="facility-bottom">
          <span>Covered · EV spaces</span>
          <strong>
            {money(facility.hourly_rate)}
            <small> / hour</small>
          </strong>
        </div>
      </div>
    </Link>
  );
}
