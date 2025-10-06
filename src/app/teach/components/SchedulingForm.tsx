// src/app/teach/components/SchedulingForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import InstrumentCards from "./InstrumentCards";
import {
  CONCEPTS,
  INSTRUMENTS,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_STEP,
  SLIDER_SCALE_LABELS,
  type InstrumentKey,
  type SliderConcept,
} from "@/config/instrumentinfo";

type Role = "STUDENT" | "PARENT";

type ConceptsState = Record<InstrumentKey, Record<string, number>>;

type FormState = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  studentName?: string;
  preferredContact: "PHONE" | "EMAIL";
  availabilityNotes: string; // preferred days/times, timezone, etc
  goalsNotes: string; // goals/styles
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizePhone(p: string) {
  const digits = (p || "").replace(/\D+/g, "");
  return digits.startsWith("1") && digits.length === 11 ? `+${digits}` : digits ? `+1${digits}` : "";
}

function NotchedSlider({
  id,
  value,
  onChange,
  min = SLIDER_MIN,
  max = SLIDER_MAX,
  step = SLIDER_STEP,
  labels = SLIDER_SCALE_LABELS as readonly string[],
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  labels?: readonly string[];
}) {
  const count = max - min;
  const notches = Array.from({ length: count + 1 }, (_, i) => i + min);
  const pct = (v: number) => (v - min) / (max - min);

  return (
    <div className="w-full">
      <div className="relative h-7">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full appearance-none h-2 rounded-md bg-neutral-200 dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-cyan-400/60"
        />
        {/* Notches overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className="relative w-full h-2">
            {notches.map((n) => (
              <span
                key={n}
                className="absolute top-1/2 -translate-y-1/2 w-px h-2 bg-neutral-400/60 dark:bg-white/30"
                style={{ left: `${pct(n) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Scale labels */}
      <div className="mt-1 flex justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
        {labels.map((l, i) => (
          <span
            key={i}
            className={classNames(
              "tabular-nums",
              i === value ? "font-semibold text-neutral-900 dark:text-neutral-100" : ""
            )}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConceptBlock({
  instrument,
  concepts,
  values,
  onSet,
}: {
  instrument: InstrumentKey;
  concepts: SliderConcept[];
  values: Record<string, number>;
  onSet: (conceptId: string, v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-4">
      <div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
        {INSTRUMENTS.find((i) => i.key === instrument)?.label} — Understanding
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {concepts.map((c) => (
          <label key={c.id} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {c.label}
            </span>
            {c.description ? (
              <span className="text-xs text-neutral-600 dark:text-neutral-300">
                {c.description}
              </span>
            ) : null}
            <NotchedSlider
              id={`${instrument}-${c.id}`}
              value={values[c.id] ?? SLIDER_MIN}
              onChange={(v) => onSet(c.id, v)}
            />
            <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>{c.minLabel ?? "Less"}</span>
              <span>{c.maxLabel ?? "More"}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SchedulingForm() {
  const { user, profile } = useAuth();

  const [selected, setSelected] = useState<InstrumentKey[]>([]);
  const [concepts, setConcepts] = useState<ConceptsState>({
    PIANO: {},
    GUITAR: {},
    BASS: {},
  });

  const [saving, setSaving] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  const [form, setForm] = useState<FormState>({
    name: profile?.displayName || "",
    email: profile?.email || "",
    phone: "",
    role: "STUDENT",
    studentName: "",
    preferredContact: "PHONE",
    availabilityNotes: "",
    goalsNotes: "",
  });

  useEffect(() => {
    // keep profile fields in sync on initial mount
    setForm((f) => ({
      ...f,
      name: f.name || profile?.displayName || "",
      email: f.email || profile?.email || "",
    }));
  }, [profile?.displayName, profile?.email]);

  const toggleInstrument = (k: InstrumentKey) => {
    setSelected((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]
    );
  };

  const setConceptValue = (inst: InstrumentKey, conceptId: string, v: number) =>
    setConcepts((prev) => ({
      ...prev,
      [inst]: { ...(prev[inst] || {}), [conceptId]: v },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSubmittedId(null);

    try {
      if (!user) {
        throw new Error("Sign in required to schedule.");
      }
      if (selected.length === 0) {
        throw new Error("Please select at least one instrument.");
      }
      if (!form.name.trim()) throw new Error("Please enter your name.");
      if (!form.email.trim() && !form.phone.trim())
        throw new Error("Provide at least an email or phone number.");

      const phoneNormalized = normalizePhone(form.phone);
      const conceptsByInstrument: Record<
        InstrumentKey,
        Record<string, number>
      > = {} as any;

      for (const inst of selected) {
        const list = CONCEPTS[inst];
        const current = concepts[inst] || {};
        // ensure a value is set for each concept (default mid-scale)
        const values: Record<string, number> = {};
        for (const c of list) {
          values[c.id] =
            typeof current[c.id] === "number" ? current[c.id] : Math.round((SLIDER_MAX - SLIDER_MIN) / 2);
        }
        conceptsByInstrument[inst] = values;
      }

      const introCol = collection(db, "teachIntros");
      const payload = {
        userId: user.uid,
        status: "requested" as const,
        createdAt: serverTimestamp() as unknown as Timestamp,
        profileSnapshot: {
          uid: user.uid,
          email: profile?.email ?? null,
          displayName: profile?.displayName ?? null,
          photoURL: profile?.photoURL ?? null,
        },
        contact: {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          phoneNormalized: phoneNormalized || null,
          preferredContact: form.preferredContact,
          role: form.role,
          studentName: form.role === "PARENT" && form.studentName?.trim() ? form.studentName.trim() : null,
          timezone: tz,
        },
        instruments: selected,
        conceptsByInstrument,
        notes: {
          availability: form.availabilityNotes.trim() || null,
          goals: form.goalsNotes.trim() || null,
        },
        clientMeta: {
          ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
          lang: typeof navigator !== "undefined" ? navigator.language : null,
        },
      };

      const ref = await addDoc(introCol, payload);
      setSubmittedId(ref.id);
      // reset a few fields but keep instruments to allow quick follow-up edits
      setForm((f) => ({
        ...f,
        goalsNotes: "",
        availabilityNotes: "",
      }));
    } catch (err: any) {
      const msg =
        typeof err?.message === "string" ? err.message : "Failed to submit. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Instrument selection */}
      <section className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Instruments
        </div>
        <InstrumentCards selected={selected} onToggle={toggleInstrument} />
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          Select one or more. Click cards to flip and learn more.
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-4 space-y-4">
        <div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Contact
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
              placeholder="Your name"
              required
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:col-span-1">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Phone</span>
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                placeholder="(555) 555‑5555"
              />
            </label>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <fieldset className="flex flex-col gap-2">
            <span className="text-sm font-medium">I am a…</span>
            <div className="flex flex-wrap gap-3 text-sm">
              {(["STUDENT", "PARENT"] as Role[]).map((r) => (
                <label key={r} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={form.role === r}
                    onChange={() => setForm((f) => ({ ...f, role: r }))}
                  />
                  <span>{r === "STUDENT" ? "Student" : "Parent/Guardian"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.role === "PARENT" && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium">Student Name (optional)</span>
              <input
                type="text"
                value={form.studentName}
                onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                placeholder="If scheduling for someone else"
              />
            </label>
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <span className="text-sm font-medium">Preferred Contact</span>
          <div className="flex flex-wrap gap-3 text-sm">
            {(["PHONE", "EMAIL"] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="preferredContact"
                  checked={form.preferredContact === c}
                  onChange={() => setForm((f) => ({ ...f, preferredContact: c }))}
                />
                <span>{c === "PHONE" ? "Phone" : "Email"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Understanding by instrument */}
      {selected.length > 0 && (
        <section className="space-y-3">
          {selected.map((inst) => (
            <ConceptBlock
              key={inst}
              instrument={inst}
              concepts={CONCEPTS[inst]}
              values={concepts[inst] || {}}
              onSet={(cid, v) => setConceptValue(inst, cid, v)}
            />
          ))}
        </section>
      )}

      {/* Notes */}
      <section className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Goals / Styles (optional)</span>
          <textarea
            rows={6}
            value={form.goalsNotes}
            onChange={(e) => setForm((f) => ({ ...f, goalsNotes: e.target.value }))}
            className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
            placeholder="What do you want to learn? Songs, skills, styles…"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Preferred Days/Times (15‑min intro)
          </span>
          <textarea
            rows={6}
            value={form.availabilityNotes}
            onChange={(e) => setForm((f) => ({ ...f, availabilityNotes: e.target.value }))}
            className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
            placeholder={`e.g., Tue/Thu after 4pm; ${tz}`}
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Your timezone: {tz}
          </span>
        </label>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          Free 15‑minute intro call. We’ll confirm time by{" "}
          {form.preferredContact === "PHONE" ? "phone" : "email"}.
        </div>
        <button
          type="submit"
          disabled={disabled}
          aria-disabled={disabled}
          aria-busy={saving}
          className={classNames(
            "inline-flex items-center justify-center px-4 py-2 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
            disabled
              ? "bg-neutral-300 text-neutral-600 cursor-not-allowed dark:bg-white/10 dark:text-neutral-400"
              : "bg-black text-white hover:bg-neutral-800 active:bg-neutral-900"
          )}
        >
          {saving ? "Sending…" : "Request 15‑min Intro"}
        </button>
      </div>

      {/* Accessible status messages */}
      {error ? (
        <div role="alert" aria-live="assertive" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {submittedId ? (
        <div role="status" aria-live="polite" className="text-sm text-green-700 dark:text-green-400">
          Request sent. I’ll reach out to confirm. Ref: {submittedId.slice(0, 8)}
        </div>
      ) : null}
    </form>
  );
}