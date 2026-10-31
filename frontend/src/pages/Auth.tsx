import { BackButton } from "../components/BackButton";
import { useToast } from "../lib/providers";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { home, send } from "../lib/api";
import { Logo, ThemeSwitch } from "../components/ui";
import { ParkingIllustration } from "../components/ParkingIllustration";
import type { User } from "../types";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include a letter.")
      .regex(/[0-9]/, "Include a number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Your passwords do not match.",
  });

function LoginForm({ portal }: { portal: "customer" | "operator" | "admin" }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof loginSchema>) =>
      send<User>(`/auth/login/${portal}`, data),
    onSuccess: (user) => {
      cache.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      cache.setQueryData(["session"], user);
      navigate(home(user.role), { replace: true });
    },
  });
  return (
    <form
      className="form-stack auth-form"
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      noValidate
    >
      <label className="field">
        <span>Email address</span>
        <input
          type="email"
          aria-label="Email address"
          autoComplete="username"
          placeholder="you@example.com"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <small className="form-error">{errors.email.message}</small>
        )}
      </label>
      <label className="field">
        <span>Password</span>
        <div className="password-input">
          <input
            type={show ? "text" : "password"}
            aria-label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <small className="form-error">{errors.password.message}</small>
        )}
      </label>
      {mutation.error && (
        <p className="form-error error-box" role="alert">
          {mutation.error.message}
        </p>
      )}
      <button className="button full" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 size={18} className="spin" /> : null}Sign
        in <ArrowRight size={17} />
      </button>
      {portal === "customer" && (
        <p className="auth-switch">
          New to PARKLY? <Link to="/register/customer">Create an account</Link>
        </p>
      )}
    </form>
  );
}
function AuthTop() {
  return (
    <div className="auth-top">
      <Logo />
      <ThemeSwitch />
    </div>
  );
}
function Back() {
  return <BackButton fallback="/" />;
}
export function CustomerLogin() {
  return (
    <div className="auth-page customer-auth">
      <AuthTop />
      <main className="auth-split">
        <section className="auth-story">
          <div className="eyebrow">MORE JOURNEY. LESS PARKING.</div>
          <h2>
            Your next stop.
            <br />
            <span className="accent-text">Already sorted.</span>
          </h2>
          <ParkingIllustration compact />
          <p>Find your space. Move smarter.</p>
        </section>
        <section className="auth-form-panel">
          <Back />
          <div className="portal-label">
            <CarFront size={17} />
            CUSTOMER PORTAL
          </div>
          <h1>Welcome back.</h1>
          <p>Sign in to discover parking and manage your reservations.</p>
          <LoginForm portal="customer" />
          <Link className="subtle-link" to="/login/operator">
            Parking operator? Sign in here
          </Link>
          <div className="auth-security">
            <ShieldCheck size={15} />
            Your journey starts with secure access.
          </div>
        </section>
      </main>
    </div>
  );
}
export function OperatorLogin() {
  return (
    <div className="auth-page operator-auth">
      <AuthTop />
      <main className="operator-login-layout">
        <section className="auth-form-panel">
          <Back />
          <div className="portal-label">
            <Route size={17} />
            OPERATIONS PORTAL
          </div>
          <h1>
            Welcome to your <br />
            operations workspace.
          </h1>
          <p>Sign in to manage your assigned parking facilities.</p>
          <LoginForm portal="operator" />
          <div className="auth-security">
            <KeyRound size={15} />
            Account access is provided by your administrator.
          </div>
        </section>
        <section className="operations-story">
          <span className="eyebrow">EVERY ARRIVAL, ACCOUNTED FOR.</span>
          <h2>
            Keep your facility
            <br />
            moving forward.
          </h2>
          <div className="ops-visual">
            <div className="ops-visual-head">
              <Route />
              YOUR OPERATIONS, CONNECTED
            </div>
            {[
              "Facility inventory",
              "Space availability",
              "Reservation management",
            ].map((t, i) => (
              <div className="ops-visual-row" key={t}>
                <span>0{i + 1}</span>
                <strong>{t}</strong>
                <ArrowRight size={18} />
              </div>
            ))}
          </div>
          <p>A focused workspace for the people behind every smooth arrival.</p>
        </section>
      </main>
    </div>
  );
}
export function AdminLogin() {
  return (
    <div className="auth-page admin-auth">
      <AuthTop />
      <main className="admin-login-layout">
        <div className="admin-emblem">
          <ShieldCheck size={38} />
        </div>
        <section className="auth-form-panel">
          <div className="portal-label">PARKLY CONTROL CENTRE</div>
          <h1>Administrator Access</h1>
          <p>Sign in to securely manage the PARKLY platform.</p>
          <LoginForm portal="admin" />
          <div className="auth-security">
            <KeyRound size={15} />
            Authorized administrators only
          </div>
          <Back />
        </section>
        <div className="admin-grid-bg" />
      </main>
    </div>
  );
}
export function Register() {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  const mutation = useMutation({
    mutationFn: ({ confirm: _, ...data }: z.infer<typeof registerSchema>) =>
      send<User>("/auth/register", data),
    onSuccess: () => {
      cache.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      cache.setQueryData(["session"], null);
      toast("Account created. Sign in to start your journey.");
      navigate("/login/customer", { replace: true });
    },
  });
  return (
    <div className="auth-page customer-auth">
      <AuthTop />
      <main className="auth-split register-layout">
        <section className="auth-story">
          <div className="eyebrow">MAKE ROOM FOR BETTER ARRIVALS</div>
          <h2>
            A little planning.
            <br />
            <span className="accent-text">A smoother day.</span>
          </h2>
          <ParkingIllustration compact />
          <div className="register-benefit">
            <Sparkles />
            Your vehicle. Your preferences. Your perfect space.
          </div>
        </section>
        <section className="auth-form-panel">
          <Back />
          <h1>Let’s find your space.</h1>
          <p>Create your customer account. Your next arrival starts here.</p>
          <form
            className="form-stack"
            noValidate
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
          >
            {(["name", "email", "password", "confirm"] as const).map((name) => (
              <label className="field" key={name}>
                <span>
                  {
                    {
                      name: "Full name",
                      email: "Email address",
                      password: "Password",
                      confirm: "Confirm password",
                    }[name]
                  }
                </span>
                <div className={name === "password" ? "password-input" : ""}>
                  <input
                    type={
                      name === "email"
                        ? "email"
                        : name === "password"
                          ? show
                            ? "text"
                            : "password"
                          : name === "confirm"
                            ? "password"
                            : "text"
                    }
                    autoComplete={
                      name === "name"
                        ? "name"
                        : name === "email"
                          ? "email"
                          : "new-password"
                    }
                    {...register(name)}
                    aria-invalid={!!errors[name]}
                    aria-label={
                      {
                        name: "Full name",
                        email: "Email address",
                        password: "Password",
                        confirm: "Confirm password",
                      }[name]
                    }
                  />
                  {name === "password" && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
                {name === "password" && (
                  <small>
                    At least 12 characters, including a letter and a number.
                  </small>
                )}
                {errors[name] && (
                  <small className="form-error">{errors[name]?.message}</small>
                )}
              </label>
            ))}
            {mutation.error && (
              <p className="form-error" role="alert">
                {mutation.error.message}
              </p>
            )}
            <p className="form-legal">
              By creating an account, you agree to our{" "}
              <Link to="/terms">Terms</Link> and acknowledge our{" "}
              <Link to="/privacy">Privacy information</Link>.
            </p>
            <button className="button full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 size={17} className="spin" />}
              Create account <ArrowRight size={17} />
            </button>
            <p className="auth-switch">
              Already have an account? <Link to="/login/customer">Sign in</Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
