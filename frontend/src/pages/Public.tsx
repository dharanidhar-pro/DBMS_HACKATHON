import { BackButton } from "../components/BackButton";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Accessibility,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Ticket,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import {
  Badge,
  ErrorState,
  FacilityCard,
  Logo,
  ThemeSwitch,
} from "../components/ui";
import { ParkingIllustration } from "../components/ParkingIllustration";
import type { Facility, Page } from "../types";

export function PublicNav() {
  return (
    <header className="public-nav">
      <div className="container nav-inner">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="/#how-it-works">How it works</a>
          <Link to="/explore">
            Explore parking <ArrowUpRight size={13} />
          </Link>
        </nav>
        <div className="nav-actions">
          <ThemeSwitch />
          <Link className="sign-in-link" to="/login/customer">
            Sign in
          </Link>
          <Link className="button small" to="/register/customer">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="public-footer container">
      <div>
        <Logo />
        <p>Find your space. Move smarter.</p>
      </div>
      <span>Thoughtfully built for the way you move.</span>
      <nav aria-label="Footer">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
export function Landing() {
  const facilities = useQuery({
    queryKey: ["public-facilities"],
    queryFn: () => api<Page<Facility>>("/facilities?page_size=3"),
  });
  return (
    <>
      <PublicNav />
      <main>
        <section className="hero container">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="eyebrow">
              <span className="eyebrow-line" />A BETTER WAY TO ARRIVE
            </div>
            <h1>
              Your spot.
              <br />
              Before you{" "}
              <span className="accent-text">
                arrive<span className="headline-dot">.</span>
              </span>
            </h1>
            <p>
              Find available parking, get an intelligent slot recommendation,
              and reserve your space in seconds.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/app/find-parking">
                Find parking <ArrowUpRight size={19} />
              </Link>
              <a className="text-link" href="#how-it-works">
                <span className="play-icon">▸</span>See how it works
              </a>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={14} />A space that fits
              </span>
              <span>
                <Check size={14} />
                No last-minute circling
              </span>
            </div>
          </motion.div>
          <ParkingIllustration />
        </section>
        <div className="promise-bar container">
          <div>
            <Sparkles />
            <span>
              Smart by design<strong>Matched to your journey</strong>
            </span>
          </div>
          <div>
            <CarFront />
            <span>
              Made for your vehicle<strong>The right space, every time</strong>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              Arrive with confidence
              <strong>Your reservation, in your hands</strong>
            </span>
          </div>
          <span className="promise-note">
            A little less friction.
            <br />
            <strong>A lot more freedom.</strong>
          </span>
        </div>
        <section className="section container" id="how-it-works">
          <div className="section-heading">
            <div>
              <div className="eyebrow">FROM HERE TO PARKED</div>
              <h2>Three steps. Zero guesswork.</h2>
            </div>
            <p>
              Your plans deserve a smoother start.
              <br />
              We’ll take care of the parking part.
            </p>
          </div>
          <div className="steps">
            {[
              {
                icon: MapPin,
                title: "Choose your destination.",
                text: "Find a facility, pick your vehicle, and tell us when you’re arriving.",
              },
              {
                icon: Sparkles,
                title: "Meet your perfect space.",
                text: "Get a recommendation that considers your vehicle, access needs, and preferences.",
              },
              {
                icon: Route,
                title: "Reserve. Arrive. Relax.",
                text: "Confirm your space and keep every booking detail close at hand.",
              },
            ].map((step, i) => (
              <article className="step" key={step.title}>
                <div className="step-top">
                  <div className="step-icon">
                    <step.icon size={25} />
                  </div>
                  <span>0{i + 1}</span>
                  {i < 2 && <span className="step-connector" />}
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="explore-section">
          <div className="container section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">A SPACE FOR YOUR NEXT STOP</div>
                <h2>Good places to park.</h2>
              </div>
              <Link to="/explore" className="text-link">
                Explore all parking <ArrowRight size={17} />
              </Link>
            </div>
            {facilities.isPending ? (
              <div className="facility-grid">
                {[1, 2, 3].map((i) => (
                  <div className="skeleton facility-skeleton" key={i} />
                ))}
              </div>
            ) : facilities.error ? (
              <ErrorState error={facilities.error} retry={facilities.refetch} />
            ) : facilities.data?.items.length ? (
              <>
                <div className="facility-grid">
                  {facilities.data.items.map((f, i) => (
                    <FacilityCard key={f.id} facility={f} index={i} />
                  ))}
                </div>
                {facilities.data.items.some((f) => f.demo) && (
                  <p className="inventory-note">
                    Demonstration facilities are clearly labelled. Availability
                    reflects stored parking inventory.
                  </p>
                )}
              </>
            ) : (
              <div className="empty">
                <Compass />
                <p>
                  New destinations are on the way. Create an account to get
                  ready for your next arrival.
                </p>
                <Link className="text-link" to="/register/customer">
                  Create your account <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>
        <section className="benefits-section container section">
          <div className="benefit-intro">
            <div className="eyebrow">IT’S THE LITTLE THINGS</div>
            <h2>
              Parking that
              <br />
              gets <span className="accent-text">you.</span>
            </h2>
            <p>
              Different vehicles. Different needs.
              <br />
              One thoughtfully simple experience.
            </p>
            <Link className="text-link" to="/register/customer">
              Make your next move <ArrowRight size={17} />
            </Link>
          </div>
          <div className="benefit-grid">
            {[
              {
                icon: Sparkles,
                title: "A smarter match",
                text: "Clear recommendations, with the reasons behind every choice.",
              },
              {
                icon: Accessibility,
                title: "Room for your needs",
                text: "Find accessible spaces where available, with access built into your search.",
              },
              {
                icon: Zap,
                title: "A place to recharge",
                text: "Choose EV-ready spaces when charging is part of your journey.",
              },
              {
                icon: Ticket,
                title: "You’re in control",
                text: "Transparent cost estimates and bookings you can manage in one place.",
              },
            ].map((b) => (
              <article key={b.title}>
                <b.icon size={24} />
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="final-cta container">
          <div className="cta-road" />
          <div>
            <span className="eyebrow">LESS CIRCLING. MORE LIVING.</span>
            <h2>Your next stop starts here.</h2>
            <p>Make a little space for a better journey.</p>
          </div>
          <Link className="button" to="/app/find-parking">
            Find your space <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function Access() {
  return (
    <>
      <PublicNav />
      <main className="container access-page">
        <BackButton fallback="/" />
        <div className="center-intro">
          <div className="eyebrow">YOUR SPACE STARTS HERE</div>
          <h1>One platform. Your portal.</h1>
          <p>Choose where you’d like to go.</p>
        </div>
        <div className="portal-grid public-portals">
          {[
            {
              id: "customer",
              icon: CarFront,
              name: "Customer",
              tag: "FOR THE JOURNEY",
              text: "Discover parking, reserve your spot, and manage your bookings.",
              cta: "Customer login",
            },
            {
              id: "operator",
              icon: Route,
              name: "Parking operator",
              tag: "BEHIND EVERY ARRIVAL",
              text: "Manage assigned parking facilities, monitor occupancy, and oversee reservations.",
              cta: "Operator login",
            },
          ].map((p) => (
            <article className={`portal-card portal-${p.id}`} key={p.id}>
              <div className="portal-symbol">
                <p.icon size={35} />
                <span />
                <span />
              </div>
              <span className="eyebrow">{p.tag}</span>
              <h2>{p.name}</h2>
              <p>{p.text}</p>
              <Link className="button secondary" to={`/login/${p.id}`}>
                {p.cta}
                <ChevronRight size={17} />
              </Link>
              {p.id === "customer" && (
                <Link className="subtle-link" to="/register/customer">
                  Create customer account <ArrowUpRight size={13} />
                </Link>
              )}
            </article>
          ))}
        </div>
        <div className="secure-note">
          <ShieldCheck size={16} />
          Secure access. A workspace made for you.
        </div>
      </main>
      <Footer />
    </>
  );
}
export function Legal({ type }: { type: "privacy" | "terms" }) {
  return (
    <>
      <PublicNav />
      <main className="container legal-page">
        <Badge>PLATFORM INFORMATION</Badge>
        <h1>
          {type === "privacy" ? "Your privacy matters." : "A clearer journey."}
        </h1>
        {type === "privacy" ? (
          <>
            <h2>Information used by PARKLY</h2>
            <p>
              PARKLY stores account names and email addresses, hashed passwords,
              vehicle registrations, reservations, session records, and
              operational audit events. These records support your account,
              parking allocation, and facility operations.
            </p>
            <h2>Access and preferences</h2>
            <p>
              Customers access their own bookings and vehicles. Assigned
              operators access facility reservations, and administrators manage
              the platform. Session cookies authenticate requests; a separate
              security cookie protects changes. Your selected theme is stored in
              your browser.
            </p>
            <h2>External services</h2>
            <p>
              This installation does not send email or SMS, collect payments, or
              track GPS location. To request account data or deletion, contact
              the organization operating this PARKLY installation through its
              established support channel. A production operator must provide
              its contact details and retention policy before public launch.
            </p>
          </>
        ) : (
          <>
            <h2>Reservations and availability</h2>
            <p>
              A reservation is confirmed only when it is saved by the service.
              Recommendations do not hold a space. Availability can change
              before confirmation. Check the facility, vehicle, and times
              carefully.
            </p>
            <h2>Estimates and cancellations</h2>
            <p>
              Displayed prices are estimates in INR, calculated from the
              facility’s hourly rate. No payment is collected. Your reservation
              shows the cancellation deadline. Facility staff handle check-in,
              completion, and operational changes.
            </p>
            <h2>Demonstration inventory</h2>
            <p>
              Facilities marked “Demo facility” are demonstration records, not
              verified physical parking services. Do not travel to a
              demonstration address expecting a reserved space.
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
