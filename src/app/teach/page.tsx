"use client";

import { useAuth } from "../../contexts/AuthContext";
import SchedulingForm from "./components/SchedulingForm";

export default function TeachLandingPage() {
  const { user, loading, loginWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen teach-scene grid place-items-center">
        <div
          className="flex flex-col items-center gap-2 text-neutral-700 dark:text-neutral-300"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="spinner" aria-hidden="true" />
          <div>Loading…</div>
        </div>
      </div>
    );
  }

  const email = "briancwilliams@protonmail.com";
  const phone = "+1-785-215-7942";
  const tel = phone.replace(/[^+\d]/g, "");
  const introMailto =
    `mailto:${email}` +
    `?subject=${encodeURIComponent("Free 15 Minute Intro — Music Lessons (Topeka)")}` +
    `&body=${encodeURIComponent(
      [
        "Hi Brian,",
        "",
        "I’d like to schedule a free 15-minute intro call about lessons.",
        "",
        "Name:",
        "Instrument (Piano/Guitar/Bass):",
        "Experience level (Absolute Beginner / Beginner / Intermediate):",
        "Location (your home / my home / online):",
        "Approx. address (to confirm travel time):",
        "Preferred days/times (2–3 options):",
        "Phone (for quick scheduling):",
        "",
        "Goals or styles you’re interested in:",
        "",
        "Thanks!",
      ].join("\n")
    )}`;

  return (
    <div className="min-h-screen teach-scene">
      <div className="teach-stars" aria-hidden="true" />
      <main id="main" className="relative mx-auto max-w-5xl px-4 py-14">
        {/* Hero */}
        <header className="mb-10">
          <p className="text-sm uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            Topeka • In‑Person & Online
          </p>
          <h1 className="text-balance text-4xl md:text-5xl font-semibold tracking-tight text-gradient">
            In‑Person Piano, Guitar, and Bass Lessons — Topeka, KS
          </h1>
          <p className="mt-3 text-neutral-800 dark:text-neutral-200 max-w-prose">
            Beginner to intermediate. Within 25 minutes of Downtown Topeka.
            Patient, practical, and goal‑oriented instruction.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <a
              href={introMailto}
              aria-label="Book a free 15‑minute intro call by email"
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition w-full sm:w-auto"
            >
              Book a free 15‑minute intro
            </a>
            <a
              href={`tel:${tel}`}
              aria-label="Call or text to schedule"
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition w-full sm:w-auto"
            >
              Call or text
            </a>
          </div>
        </header>

        {/* Snapshot */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
            Snapshot
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-neutral-800 dark:text-neutral-200">
            <li>Beginner–Intermediate friendly</li>
            <li>Piano • Guitar • Bass</li>
            <li>Your home, or mine</li>
            <li>Who I teach: Teens 16+ and Adults</li>
            <li>Where: Within 25 minutes of Downtown Topeka, KS</li>
            <li>Online available (if you have the instrument)</li>
            <li>Free 15 minute intro call to set goals and availability</li>
          </ul>
        </section>

        {/* Credibility */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-1">Credibility</h3>
          <p className="text-neutral-800 dark:text-neutral-200">
            Former KODA Piano teacher for kids; patient, practical approach
            focused on clear steps and steady progress.
          </p>
        </section>

        {/* Where */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-3">Where</h3>
          <ul className="grid sm:grid-cols-2 gap-3 text-neutral-800 dark:text-neutral-200">
            <li>
              <span className="font-medium">In My Home</span> — Full‑sized
              piano available.
            </li>
            <li>
              <span className="font-medium">Your Home</span> — I can bring a
              keyboard, electric bass, and guitar.
            </li>
            <li>
              <span className="font-medium">Online</span> — If you have the
              instrument available.
            </li>
            <li>
              <span className="font-medium">Travel</span> — Included within 25
              minutes of downtown Topeka; outside that: +$10 or online.
            </li>
          </ul>
        </section>

        {/* Who I teach */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-2">Who I teach</h3>
          <p className="text-neutral-800 dark:text-neutral-200">
            Teens 16+ and Adults. A parent/guardian should be present for anyone
            under 18 during in‑home lessons.
          </p>
        </section>

        {/* How it works */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-3">How it works</h3>
          <ol className="list-decimal pl-5 space-y-2 text-neutral-800 dark:text-neutral-200">
            <li>
              <span className="font-medium">Free 15 minute intro call</span> —
              align on goals and availability.
            </li>
            <li>
              <span className="font-medium">First lesson + practice plan</span>{" "}
              — clear next steps tailored to you.
            </li>
            <li>
              <span className="font-medium">Weekly lessons</span> — or one‑off
              sessions if preferred.
            </li>
          </ol>
          <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            Levels: Absolute Beginner → Intermediate. Formats: In‑home (mine or
            yours) or online.
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-3">Prices</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                30 Minutes
              </div>
              <div className="text-2xl font-semibold">$30</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                45 Minutes
              </div>
              <div className="text-2xl font-semibold">$45</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                60 Minutes
              </div>
              <div className="text-2xl font-semibold">$60</div>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-neutral-800 dark:text-neutral-200">
            <li>
              <span className="font-medium">First lesson:</span> 50% off
            </li>
            <li>
              <span className="font-medium">Packages:</span> 4 lessons 5% off →
              8 lessons 10% off (prepaid)
            </li>
            <li>
              <span className="font-medium">Referral:</span> $20 credit when a
              friend completes their first lesson
            </li>
            <li>
              <span className="font-medium">Travel:</span> Included within 25
              minutes of downtown Topeka; outside that: +$10 or online
            </li>
            <li>
              <span className="font-medium">Launch offer:</span> 50% off first
              lesson, honored 6 months for early sign‑ups
            </li>
          </ul>
        </section>

        {/* Instruments / Do I need one? */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-2">Do I need an instrument?</h3>
          <p className="text-neutral-800 dark:text-neutral-200">
            I can provide a full‑sized piano at my home, or bring a keyboard,
            electric bass, and guitar to your home. You may also use your own
            instrument.
          </p>
        </section>

        {/* Beginner Boot Camp */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-2">
            Beginner Boot Camp — 6 Week Track
          </h3>
          <p className="text-neutral-800 dark:text-neutral-200 mb-2">
            Focused fundamentals for Piano, Guitar, or Bass. Technique, rhythm,
            reading basics, and a song by week 6.
          </p>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            Lesson lengths: 30 min (kids/absolute beginners), 45 min (most
            teens/adults), 60 min (motivated learners).
          </div>
        </section>

        {/* FAQ & Policies */}
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-5 shadow-lg shadow-cyan-500/5">
          <h3 className="text-lg font-medium mb-2">FAQ & Policies</h3>
          <div className="space-y-3 text-neutral-800 dark:text-neutral-200">
            <div>
              <div className="font-medium">Cancellation</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                24+ hours notice to reschedule. Inside 24 hours = charged. One
                emergency waiver per student per quarter.
              </div>
            </div>
            <div>
              <div className="font-medium">Payment & Packages</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                Card, Cash, or Cash App due at booking or same‑day. Packages are
                prepaid and nonrefundable, but transferable for 6 months.
              </div>
            </div>
            <div>
              <div className="font-medium">Scheduling</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                Weekly standing time preferred; one‑off sessions also available.
              </div>
            </div>
            <div>
              <div className="font-medium">Lateness</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                I’ll wait 15 minutes; the lesson ends at the scheduled time.
              </div>
            </div>
            <div>
              <div className="font-medium">Safety</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                A parent/guardian should be present for anyone under 18 during
                in‑home lessons. Lessons happen in common areas.
              </div>
            </div>
            <div>
              <div className="font-medium">Photo/Video</div>
              <div className="text-sm text-neutral-700 dark:text-neutral-300">
                Opt‑in only for photos or short progress clips.
              </div>
            </div>
          </div>
        </section>

        {/* Scheduling (auth-gated) */}
        {user ? (
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
            <h3 className="text-lg font-medium mb-3">
              Schedule your free 15‑minute intro
            </h3>
            <SchedulingForm />
          </section>
        ) : (
          <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 backdrop-blur p-5 mb-6 shadow-lg shadow-cyan-500/5">
            <h3 className="text-lg font-medium mb-2">
              Schedule your free 15‑minute intro
            </h3>
            <p className="text-neutral-700 dark:text-neutral-300 mb-3">
              Sign in to unlock scheduling and save your info.
            </p>
            <button
              onClick={loginWithGoogle}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition"
            >
              Sign in to schedule
            </button>
          </section>
        )}

        {/* Final CTA */}
        <section className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-neutral-700 dark:text-neutral-300">
            Have questions? Book your free intro call.
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={introMailto}
              aria-label="Book a free 15‑minute intro call by email"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition"
            >
              Free 15‑min intro
            </a>
            <a
              href={`tel:${tel}`}
              aria-label="Call or text to schedule"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition"
            >
              Call or text
            </a>
            {!user && (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition"
              >
                Sign in (optional)
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}