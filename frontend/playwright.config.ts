import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(import.meta.dirname, "..");
const venv = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const python =
  process.env.PYTHON_BIN || (fs.existsSync(venv) ? venv : "python");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: `"${python}" "${path.join(root, "backend/scripts/serve_e2e.py")}"`,
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      env: { API_PROXY_TARGET: "http://127.0.0.1:8001" },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
