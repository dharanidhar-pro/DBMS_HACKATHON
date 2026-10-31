import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import { api, ApiError, send } from "./api";
import type { User } from "../types";

type Theme = "midnight" | "arctic" | "emerald";
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "midnight", setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("parkly-theme");
    return ["midnight", "arctic", "emerald"].includes(saved || "")
      ? (saved as Theme)
      : window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "arctic"
        : "midnight";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const setTheme = (value: Theme) => {
    updateTheme(value);
    localStorage.setItem("parkly-theme", value);
  };
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const auth = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    const expired = () => {
      cache.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      cache.setQueryData(["session"], null);
    };
    window.addEventListener("parkly:session-expired", expired);
    return () => window.removeEventListener("parkly:session-expired", expired);
  }, [cache]);
  async function logout() {
    await send("/auth/logout");
    cache.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    cache.setQueryData(["session"], null);
  }
  return (
    <AuthContext.Provider
      value={{
        user: auth.data ?? null,
        loading: auth.isPending,
        error: auth.error,
        refresh: () => auth.refetch(),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<
    { id: number; message: string; error: boolean }[]
  >([]);
  const toast = (message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, error }]);
    window.setTimeout(
      () => setToasts((items) => items.filter((t) => t.id !== id)),
      6000,
    );
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              className={`toast ${t.error ? "error" : ""}`}
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {t.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
              <span>{t.message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() =>
                  setToasts((items) => items.filter((i) => i.id !== t.id))
                }
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
