import { RouteHistory, GuestOnly } from "./components/BackButton";
import {
  BrowserRouter,
  Navigate,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Component, useEffect, type ReactNode } from "react";
import { AppLayout, Guard } from "./components/Layout";
import { Logo } from "./components/ui";
import { Access, Landing, Legal } from "./pages/Public";
import {
  AdminLogin,
  CustomerLogin,
  OperatorLogin,
  Register,
} from "./pages/Auth";
import {
  CustomerDashboard,
  Notifications,
  Profile,
  ReservationDetail,
  Reservations,
  Vehicles,
} from "./pages/Customer";
import { FindParking, ParkingDetail } from "./pages/Parking";
import {
  AuditLogs,
  FacilitiesManagement,
  OperationsDashboard,
  OperationsReservations,
  Roles,
  SlotsManagement,
  SystemSettings,
  UsersManagement,
} from "./pages/Operations";

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <Logo />
        <h1>Let’s get you back on the road.</h1>
        <p>This page ran into a problem. Reload to try again.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function AppRoutes() {
  return (
    <>
      <ScrollReset />
      <RouteHistory />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/access" element={<Access />} />
        <Route path="/explore" element={<FindParking publicView />} />
        <Route element={<GuestOnly />}>
          <Route path="/login/customer" element={<CustomerLogin />} />
          <Route path="/login/operator" element={<OperatorLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/register/customer" element={<Register />} />
        </Route>
        <Route path="/privacy" element={<Legal type="privacy" />} />
        <Route path="/terms" element={<Legal type="terms" />} />
        <Route element={<Guard role="CUSTOMER" />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="find-parking" element={<FindParking />} />
            <Route path="parking/:parkingId" element={<ParkingDetail />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="reservations" element={<Reservations key="reservations" />} />
            <Route
              path="reservations/:reservationId"
              element={<ReservationDetail />}
            />
            <Route path="history" element={<Reservations key="history" history />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Profile settings />} />
          </Route>
        </Route>
        <Route element={<Guard role="OPERATOR" />}>
          <Route path="/operator" element={<AppLayout />}>
            <Route
              index
              element={<Navigate to="/operator/dashboard" replace />}
            />
            <Route path="dashboard" element={<OperationsDashboard />} />
            <Route path="parking" element={<FacilitiesManagement />} />
            <Route path="slots" element={<SlotsManagement />} />
            <Route path="reservations" element={<OperationsReservations />} />
            <Route
              path="occupancy"
              element={<OperationsDashboard mode="occupancy" />}
            />
            <Route
              path="reports"
              element={<OperationsDashboard mode="analytics" />}
            />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
        <Route element={<Guard role="ADMIN" />}>
          <Route path="/admin" element={<AppLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<OperationsDashboard />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="roles" element={<Roles />} />
            <Route path="parking-lots" element={<FacilitiesManagement />} />
            <Route path="slots" element={<SlotsManagement />} />
            <Route path="reservations" element={<OperationsReservations />} />
            <Route
              path="analytics"
              element={<OperationsDashboard mode="analytics" />}
            />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="system-settings" element={<SystemSettings />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="not-found">
              <Logo />
              <span className="eyebrow">A SMALL DETOUR</span>
              <h1>This space hasn’t been mapped.</h1>
              <p>Let’s get you back to somewhere familiar.</p>
              <Link to="/" className="button">
                Back to PARKLY
              </Link>
            </div>
          }
        />
      </Routes>
    </>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
