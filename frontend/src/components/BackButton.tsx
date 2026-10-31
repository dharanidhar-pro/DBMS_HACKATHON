import { useLayoutEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/providers";
import { home } from "../lib/api";

const visited = new Map<number, string>();
export function RouteHistory() {
  const location = useLocation();
  useLayoutEffect(() => {
    const index = window.history.state?.idx;
    if (typeof index === "number") visited.set(index, location.pathname);
  }, [location]);
  return null;
}
export function BackButton({ fallback }: { fallback?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const safe = fallback || (user ? home(user.role) : "/");
  function back() {
    const previous = visited.get((window.history.state?.idx ?? 0) - 1);
    const publicPath =
      previous === "/" || previous === "/explore" || previous === "/access";
    const authorized = user
      ? previous?.startsWith(home(user.role).split("/dashboard")[0] + "/")
      : previous?.startsWith("/login/") || previous === "/register/customer";
    if (previous && previous !== pathname && (publicPath || authorized))
      navigate(-1);
    else navigate(safe, { replace: true });
  }
  return (
    <button type="button" className="back-link back-button" onClick={back}>
      <ArrowLeft size={15} />
      Back
    </button>
  );
}
export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={home(user.role)} replace /> : <Outlet />;
}
