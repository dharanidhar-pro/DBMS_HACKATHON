import { test, expect } from "@playwright/test";
import path from "node:path";

const shots = path.resolve(import.meta.dirname, "../../.local/screenshots");
test("public pages, themes, responsive layout and role guards", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your spot/i })).toBeVisible();
  await page.getByLabel("Theme", { exact: true }).selectOption("midnight");
  await expect(
    page.getByRole("heading", { name: "The Exchange" }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shots, "landing-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Illustration space A-07" }).click();
  await expect(page.getByText("Space A-07", { exact: false })).toBeVisible();
  for (const theme of ["arctic", "emerald", "midnight"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({
      path: path.join(shots, `theme-${theme}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(shots, "landing-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goForward();
  await expect(page).toHaveURL("/login/customer");
  await page.goto("/access");
  await expect(page.locator('a[href="/login/admin"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(shots, "portals-mobile.png"),
    fullPage: true,
  });
  for (const [route, title] of [
    ["/app/vehicles", "Welcome back."],
    ["/operator/slots", "Welcome to your operations workspace."],
    ["/admin/users", "Administrator Access"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("customer registers, logs in, adds vehicle, books and cancels recommended space", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register/customer");
  await page.getByLabel("Full name").fill("Avery Driver");
  const customerEmail = `driver-${Date.now()}@e2e.example.com`;
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password", { exact: true }).fill("CustomerJourney42");
  await page.getByLabel("Confirm password").fill("CustomerJourney42");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/login/customer");
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password", { exact: true }).fill("CustomerJourney42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByText("Good to see you, Avery.")).toBeVisible();
  await page.getByRole("link", { name: "My vehicles", exact: true }).click();
  await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
  await page.getByLabel("Registration number").fill("KA01E2E4242");
  await page.getByLabel("Vehicle type", { exact: true }).selectOption("CAR");
  await page.getByLabel("Make", { exact: true }).fill("Tata");
  await page.getByLabel("Model", { exact: true }).fill("Nexon EV");
  await page.getByLabel("This is an electric vehicle").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add vehicle", exact: true })
    .click();
  await expect(page.getByText("KA01E2E4242", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Find parking", exact: true }).click();
  await page.getByLabel("Search destination").fill("Exchange");
  await page.getByRole("button", { name: "Find parking", exact: true }).click();
  await page
    .getByRole("heading", { name: "The Exchange", exact: true })
    .click();
  await page.getByLabel("EV charging required").check();
  await page.getByRole("button", { name: "Recommend a space" }).click();
  await expect(page.getByText("/100 match", { exact: false })).toBeVisible();
  await page.screenshot({
    path: path.join(shots, "booking-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(shots, "booking-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review reservation" }).click();
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(
    page.getByRole("heading", { name: "Your space is waiting." }),
  ).toBeVisible();
  await expect(
    page.getByText("CONFIRMED", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your space is waiting." }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shots, "reservation-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await expect(
    page.getByText("CANCELLED", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(shots, "customer-dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\/customer/);
  expect(errors).toEqual([]);
});

test("operator scopes inventory, changes maintenance, and sees reports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login/operator");
  await page.getByLabel("Email address").fill("operator@e2e.example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("E2eIsolatedPassword42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/operator\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Your operations, at a glance." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Parking spaces", exact: true }).click();
  await page
    .getByRole("button", { name: "Space A-05, available", exact: true })
    .click();
  await page.getByRole("button", { name: "Set maintenance status" }).click();
  await page.getByLabel("Inventory status").selectOption("MAINTENANCE");
  await page.getByRole("button", { name: "Save space" }).click();
  await expect(
    page.getByRole("button", { name: "Space A-05, maintenance", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The story behind your spaces." }),
  ).toBeVisible();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/operator\/dashboard/);
  await page.screenshot({
    path: path.join(shots, "operator-dashboard.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("administrator creates facilities and slots, audits and configures settings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login/admin");
  await page.getByLabel("Email address").fill("admin@e2e.example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("E2eIsolatedPassword42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.getByRole("link", { name: "Facilities", exact: true }).click();
  await page.getByRole("button", { name: "Create facility" }).click();
  await page.getByLabel("Facility name").fill("E2E Riverside");
  await page.getByLabel("Street address").fill("42 Riverside Road");
  await page.getByLabel("City", { exact: true }).fill("Bengaluru");
  await page.getByLabel("Hourly rate (paise)", { exact: false }).fill("5000");
  await page
    .getByLabel("Assigned operator")
    .selectOption({ label: "E2E Operator · operator@e2e.example.com" });
  await page.getByRole("button", { name: "Save facility" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E Riverside" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Parking spaces", exact: true }).click();
  await page
    .getByLabel("Facility", { exact: true })
    .selectOption({ label: "E2E Riverside" });
  await page.getByRole("button", { name: "Add space" }).click();
  await page
    .getByLabel("Zone", { exact: false })
    .selectOption({ label: "Zone A" });
  await page.getByLabel("Space identifier").fill("R-01");
  await page.getByRole("button", { name: "Save space" }).click();
  await expect(
    page.getByRole("button", { name: "Space R-01, available", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "System settings", exact: true })
    .click();
  await page.getByLabel("Distance weight").fill("30");
  const settingsSaved = page.waitForResponse(
    (r) =>
      r.url().includes("/admin/settings") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save platform settings" }).click();
  expect((await settingsSaved).status()).toBe(200);
  await expect(
    page.getByText("Changes saved.", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Audit trail", exact: true }).click();
  await page.getByLabel("Search audit actions").fill("settings.updated");
  await expect(
    page.getByText("settings.updated", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The story behind your spaces." }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shots, "admin-analytics.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
