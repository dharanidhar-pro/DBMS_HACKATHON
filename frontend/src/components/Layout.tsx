import { BackButton } from "./BackButton";
import { useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CarFront,
  ChevronRight,
  Grid2X2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, home } from "../lib/api";
import { useAuth, useToast } from "../lib/providers";
import { ErrorState, Loading, Logo, ThemeSwitch } from "./ui";
import type { Notice, Page, Role } from "../types";

export function Guard({ role }: { role: Role }) {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <Loading label="Opening your workspace…" />;
  if (error) return <ErrorState error={error} retry={refresh} />;
  if (!user) return <Navigate to={`/login/${role.toLowerCase()}`} replace />;
  if (user.role !== role) return <Navigate to={home(user.role)} replace />;
  return <Outlet />;
}
export function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const notices = useQuery({
    queryKey: ["notification-count"],
    queryFn: () =>
      api<Page<Notice> & { unread_count: number }>(
        "/notifications?page_size=1",
      ),
    refetchInterval: 30000,
  });
  if (!user) return null;
  const prefix =
    user.role === "CUSTOMER"
      ? "/app"
      : user.role === "OPERATOR"
        ? "/operator"
        : "/admin";
  const links =
    user.role === "CUSTOMER"
      ? ([
          ["dashboard", "Overview", LayoutDashboard],
          ["find-parking", "Find parking", Search],
          ["vehicles", "My vehicles", CarFront],
          ["reservations", "Reservations", Ticket],
          ["history", "Booking history", History],
          ["notifications", "Notifications", Bell],
          ["profile", "My profile", UserRound],
          ["settings", "Preferences", Settings2],
        ] as const)
      : user.role === "OPERATOR"
        ? ([
            ["dashboard", "Overview", LayoutDashboard],
            ["parking", "My facilities", Building2],
            ["slots", "Parking spaces", Grid2X2],
            ["reservations", "Reservations", Ticket],
            ["occupancy", "Occupancy", Activity],
            ["reports", "Reports", BarChart3],
            ["profile", "My profile", UserRound],
          ] as const)
        : ([
            ["dashboard", "Overview", LayoutDashboard],
            ["users", "Users", Users],
            ["roles", "Roles & access", ShieldCheck],
            ["parking-lots", "Facilities", Building2],
            ["slots", "Parking spaces", Grid2X2],
            ["reservations", "Reservations", Ticket],
            ["analytics", "Analytics", BarChart3],
            ["audit-logs", "Audit trail", History],
            ["system-settings", "System settings", SlidersHorizontal],
          ] as const);
  const active = links.find((l) =>
    location.pathname.startsWith(`${prefix}/${l[0]}`),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="tiny-dot" />
          {user.role === "CUSTOMER"
            ? "YOUR EVERYDAY, SIMPLIFIED"
            : user.role === "OPERATOR"
              ? "OPERATIONS WORKSPACE"
              : "PLATFORM WORKSPACE"}
        </div>
        <nav aria-label="Workspace navigation">
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`${prefix}/${path}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === "notifications" && !!notices.data?.unread_count && (
                <span className="nav-count">{notices.data.unread_count}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="avatar">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.role.toLowerCase()} account</small>
            </span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => logout().catch((e) => toast(e.message, true))}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{active?.[1] || "Your parking"}</strong>
          </div>
          <div className="header-actions">
            <ThemeSwitch />
            {user.role === "CUSTOMER" && (
              <Link
                to="/app/notifications"
                className="icon-button notification-button"
                aria-label="Notifications"
              >
                <Bell size={19} />
                {!!notices.data?.unread_count && <span />}
              </Link>
            )}
            <span className="avatar small-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main className="app-content" id="main-content">
          {!location.pathname.endsWith("/dashboard") &&
            !location.pathname.match(/\/app\/(parking|reservations)\/.+/) && (
              <BackButton />
            )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Find your space. Move smarter.</span>
          <span>
            PARKLY ·{" "}
            {user.role === "CUSTOMER"
              ? "Made for your journey"
              : "Operations with clarity"}
          </span>
        </footer>
      </div>
    </div>
  );
}
