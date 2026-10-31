import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import { AuthProvider, ThemeProvider, ToastProvider } from "../lib/providers";
import type { User } from "../types";

const customer: User = {
  id: "u1",
  name: "Test Driver",
  email: "driver@example.com",
  role: "CUSTOMER",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
};
const facility = {
  id: "f1",
  name: "Test Garage",
  address: "12 Test Street",
  city: "Bengaluru",
  description: "Covered parking",
  hourly_rate: 6000,
  active: true,
  demo: true,
  total_slots: 1,
  available_slots: 1,
  zones: [{ id: "z1", name: "Zone A", level: "Ground" }],
};
const slot = {
  id: "s1",
  facility_id: "f1",
  zone_id: "z1",
  zone_name: "Zone A",
  label: "A-01",
  vehicle_type: "CAR",
  accessible: false,
  charging: false,
  covered: true,
  distance_m: 10,
  state: "AVAILABLE",
  availability: "AVAILABLE",
  eligible: true,
  unavailable_reason: null,
  position: 1,
};
const explanation = {
  score: 95,
  compatible: true,
  distance_m: 10,
  reasons: ["Fits your car", "10 m from the entrance"],
  factors: { distance: 0.83 },
  weights: { distance: 1 },
  selection: "Your selected eligible space",
};
const reservation = {
  id: "r1",
  facility_id: "f1",
  vehicle_id: "v1",
  slot_id: "s1",
  facility_name: "Test Garage",
  facility_address: "12 Test Street",
  facility_demo: true,
  slot_label: "A-01",
  registration: "KA01AB1234",
  vehicle_type: "CAR",
  arrival: "2099-11-01T10:00:00Z",
  departure: "2099-11-01T12:00:00Z",
  status: "CONFIRMED",
  estimated_cost: 12000,
  hourly_rate: 6000,
  explanation,
  cancellation_deadline: "2099-11-01T09:45:00Z",
  history: [],
  created_at: "2026-01-01T00:00:00Z",
};
let session: User | null = null;
let authFail = false;
let fetchFail = false;
let reservationStatus = "CONFIRMED";
function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}
beforeEach(() => {
  session = null;
  authFail = false;
  fetchFail = false;
  reservationStatus = "CONFIRMED";
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options: RequestInit = {}) => {
      const path = String(url).replace("/api/v1", "").split("?")[0];
      if (path === "/auth/me")
        return session
          ? response(session)
          : response({ detail: "Sign in" }, 401);
      if (path.startsWith("/auth/login/")) {
        if (authFail)
          return response(
            { detail: "Email or password is incorrect for this portal." },
            401,
          );
        session = {
          ...customer,
          role: path.endsWith("admin")
            ? "ADMIN"
            : path.endsWith("operator")
              ? "OPERATOR"
              : "CUSTOMER",
        };
        return response(session);
      }
      if (path === "/auth/register") {
        session = null;
        return response(customer, 201);
      }
      if (path === "/dashboard")
        return response({
          reservations: 0,
          vehicles: 1,
          upcoming: [],
          recent: [],
        });
      if (path === "/facilities")
        return fetchFail
          ? response({ detail: "Service unavailable" }, 503)
          : response({ items: [facility], total: 1, page: 1, page_size: 20 });
      if (path === "/facilities/f1") return response(facility);
      if (path === "/vehicles")
        return response([
          {
            id: "v1",
            registration: "KA01AB1234",
            vehicle_type: "CAR",
            make: "Test",
            model: "Car",
            electric: false,
            active: true,
          },
        ]);
      if (path === "/slots")
        return response({ items: [slot], total: 1, page: 1, page_size: 20 });
      if (path === "/allocation/recommend")
        return response({
          recommendation: { slot, explanation },
          alternatives: [],
          eligible_count: 1,
          estimated_cost: 12000,
          message: "Rechecked at confirmation",
        });
      if (path === "/reservations" && options.method === "POST")
        return response(reservation, 201);
      if (path === "/reservations/r1/cancel") {
        reservationStatus = "CANCELLED";
        return response({ ...reservation, status: reservationStatus });
      }
      if (path === "/reservations/r1")
        return response({ ...reservation, status: reservationStatus });
      if (path === "/notifications")
        return response({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          unread_count: 0,
        });
      if (path === "/analytics/overview")
        return response({
          total_facilities: 0,
          total_slots: 0,
          total_users: 1,
          total_reservations: 0,
          occupied_slots: 0,
          reserved_slots: 0,
          maintenance_slots: 0,
          available_slots: 0,
          occupancy_percent: 0,
          cancellation_rate: 0,
          cancellations: 0,
          average_duration_hours: 0,
          reserved_utilization_percent: 0,
          daily: [],
          vehicle_types: [],
          facility_performance: [],
          peak_hours: [],
        });
      return response({ items: [], total: 0, page: 1, page_size: 20 });
    }),
  );
});
function view(route: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={[route]}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Public navigation and portal identity", () => {
  it("navigates from landing to portal selection without private navigation", async () => {
    view("/");
    expect(
      screen.getByRole("heading", { name: /Your spot/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Audit trail")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Administrator login/i }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ["customer", "Welcome back."],
    ["operator", "Welcome to your operations workspace."],
    ["admin", "Administrator Access"],
  ])("renders the separate %s login", async (portal, title) => {
    view(`/login/${portal}`);
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    if (portal !== "customer")
      expect(
        screen.queryByRole("link", { name: "Create an account" }),
      ).not.toBeInTheDocument();
  });
  it("preserves login errors without redirecting", async () => {
    authFail = true;
    view("/login/customer");
    await userEvent.type(
      await screen.findByLabelText("Email address"),
      "wrong@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password",
    );
    expect(
      screen.getByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
  });
  it.each(["customer", "operator", "admin"])(
    "redirects a successful %s login to its workspace",
    async (portal) => {
      view(`/login/${portal}`);
      await userEvent.type(
        await screen.findByLabelText("Email address"),
        "driver@example.com",
      );
      await userEvent.type(
        screen.getByLabelText("Password"),
        "TestPassword123",
      );
      await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
      expect(
        await screen.findByRole("navigation", { name: "Workspace navigation" }),
      ).toBeInTheDocument();
      if (portal === "customer")
        expect(
          await screen.findByText("Good to see you, Test."),
        ).toBeInTheDocument();
      else
        expect(
          await screen.findByRole("heading", {
            name: "Your operations, at a glance.",
          }),
        ).toBeInTheDocument();
    },
  );
  it("registers a customer using the API", async () => {
    view("/register/customer");
    await userEvent.type(
      await screen.findByLabelText("Full name"),
      "Test Driver",
    );
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "driver@example.com",
    );
    await userEvent.type(
      screen.getByLabelText("Password", { exact: true }),
      "TestPassword123",
    );
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "TestPassword123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
  });
});
describe("Protected routes and themes", () => {
  it.each([
    ["/app/vehicles", "Welcome back."],
    ["/operator/slots", "Welcome to your operations workspace."],
    ["/admin/users", "Administrator Access"],
  ])("protects %s", async (route, title) => {
    view(route);
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" }),
    ).not.toBeInTheDocument();
  });
  it("redirects a customer away from admin pages", async () => {
    session = customer;
    view("/admin/users");
    expect(
      await screen.findByText("Good to see you, Test."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("The right access. For everyone."),
    ).not.toBeInTheDocument();
  });
  it("applies and persists all three themes", async () => {
    view("/");
    for (const theme of ["arctic", "emerald", "midnight"]) {
      await userEvent.selectOptions(screen.getByLabelText("Theme"), theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(localStorage.getItem("parkly-theme")).toBe(theme);
    }
  });
});
describe("Parking workflows and failures", () => {
  it("searches facilities through the API", async () => {
    view("/explore");
    await userEvent.type(
      screen.getByLabelText("Search destination"),
      "Bengaluru",
    );
    await userEvent.click(screen.getByRole("button", { name: "Find parking" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("q=Bengaluru"),
        expect.anything(),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Test Garage" }),
    ).toBeInTheDocument();
  });
  it("shows a recoverable API error", async () => {
    fetchFail = true;
    view("/explore");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service unavailable",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
  it("selects an eligible slot, recommends, and creates a reservation", async () => {
    session = customer;
    view("/app/parking/f1");
    await screen.findByRole("button", { name: "Space A-01, available" });
    await userEvent.click(
      screen.getByRole("button", { name: "Recommend a space" }),
    );
    expect(await screen.findByText("95/100 match")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Review reservation" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm reservation" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Your space is waiting." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No payment has been collected.", { exact: false }),
    ).toBeInTheDocument();
  });
  it("cancels a reservation after confirmation", async () => {
    session = customer;
    view("/app/reservations/r1");
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel reservation" }),
    );
    const dialog = screen.getByRole("dialog");
    const confirm = dialog.querySelector("button.button:not(.secondary)")!;
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(screen.getAllByText("CANCELLED").length).toBeGreaterThan(0),
    );
    expect(
      screen.queryByRole("button", { name: "Cancel reservation" }),
    ).not.toBeInTheDocument();
  });
});
