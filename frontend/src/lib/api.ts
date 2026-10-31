export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const csrf = document.cookie
    .split("; ")
    .find((c) => c.startsWith("parkly_csrf="))
    ?.split("=")[1];
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Parkly-Request": "1",
      ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail
          .map((e: { msg: string }) => e.msg.replace("Value error, ", ""))
          .join(" ")
      : data.detail;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("parkly:session-expired"));
    throw new ApiError(
      response.status,
      message || "The request could not be completed. Please try again.",
    );
  }
  return data as T;
}
export const send = <T>(path: string, body?: unknown, method = "POST") =>
  api<T>(path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
export function params(
  values: Record<string, string | number | boolean | null | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  return query.toString();
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const dateOnly = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const home = (role: string) =>
  role === "CUSTOMER"
    ? "/app/dashboard"
    : role === "OPERATOR"
      ? "/operator/dashboard"
      : "/admin/dashboard";
