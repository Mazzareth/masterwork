/**
 * src/app/clients/page.tsx
 * Admin-only Clients dashboard with Requests + Day Planner tabs.
 */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
  addDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import type { InstrumentKey } from "@/config/instrumentinfo";

/* -------------------------- Shared types and helpers -------------------------- */

type Role = "STUDENT" | "PARENT";
type ProgressStatus = "requested" | "contacted" | "scheduled" | "active" | "closed";

type TeachIntroDoc = {
  id: string;
  userId: string;
  status: string;
  createdAt?: Timestamp;
  profileSnapshot?: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
    phoneNormalized: string | null;
    preferredContact: "PHONE" | "EMAIL";
    role: Role;
    studentName: string | null;
    timezone: string | null;
  };
  instruments: InstrumentKey[];
  conceptsByInstrument?: Record<string, Record<string, number>>;
  notes?: {
    availability: string | null;
    goals: string | null;
  };
  clientMeta?: {
    ua: string | null;
    lang: string | null;
  };
  adminNotes?: string | null;
  progressStatus?: ProgressStatus;
  adminUpdatedAt?: Timestamp;
  scheduled?: {
    dayId: string;
    startMin: number;
    endMin: number;
    tz: string;
    plannerItemId?: string | null;
    createdAt?: Timestamp;
  };
};

const ADMIN_EMAIL = "mercysquadrant@gmail.com";

function fmt(ts?: Timestamp) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "";
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/* ----------------------------- Day Planner types ------------------------------ */

type PlannerItemType = "APPOINTMENT" | "CHECKIN" | "TASK" | "ADVERTIME" | "BREAK";

type PlannerDay = {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  tz: string;
  notes?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type PlannerItem = {
  id: string;
  dayId: string; // YYYY-MM-DD
  type: PlannerItemType;
  title: string;
  clientIntroId?: string | null;
  startMin: number; // minutes from midnight
  endMin: number;   // minutes from midnight
  location?: string | null;
  details?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const TYPE_META: Record<
  PlannerItemType,
  { label: string; badge: string; card: string }
> = {
  APPOINTMENT: {
    label: "Client Appointment",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
    card:
      "border-cyan-400/50 bg-cyan-400/10 hover:bg-cyan-400/15 focus-visible:ring-cyan-400/40",
  },
  CHECKIN: {
    label: "Client Check In",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    card:
      "border-indigo-400/50 bg-indigo-400/10 hover:bg-indigo-400/15 focus-visible:ring-indigo-400/40",
  },
  TASK: {
    label: "Task",
    badge: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
    card:
      "border-neutral-400/40 bg-neutral-400/10 hover:bg-neutral-400/15 focus-visible:ring-neutral-400/40",
  },
  ADVERTIME: {
    label: "Advertime",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    card:
      "border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/15 focus-visible:ring-amber-400/40",
  },
  BREAK: {
    label: "Break",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    card:
      "border-emerald-400/50 bg-emerald-400/10 hover:bg-emerald-400/15 focus-visible:ring-emerald-400/40",
  },
};

const HOURS_START = 6;  // 6am
const HOURS_END = 22;   // 10pm
const SLOT_MIN = 15;    // 15-minute slots
const SLOT_PX = 16;     // 16px per 15 min

function toDayId(d: Date) {
  // en-CA yields YYYY-MM-DD
  return d.toLocaleDateString("en-CA");
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function parseHHMM(s: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  if (!m) return 9 * 60;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
}
function toHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function humanTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ------------------------------- DayPlanner UI ------------------------------- */

function DayPlanner() {
  const [tz] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  });
  const [dateStr, setDateStr] = useState<string>(() => toDayId(new Date()));
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [intros, setIntros] = useState<TeachIntroDoc[]>([]);
  const [editing, setEditing] = useState<PlannerItem | null>(null);

  // Quick-add
  const [qa, setQA] = useState<{
    type: PlannerItemType;
    title: string;
    start: string; // "HH:MM"
    duration: number; // minutes
    clientIntroId: string; // "" | id
  }>({
    type: "APPOINTMENT",
    title: "",
    start: "09:00",
    duration: 60,
    clientIntroId: "",
  });

  // Context menu state for planner items
  type PlannerMenuState = {
    open: boolean;
    x: number;
    y: number;
    item: PlannerItem | null;
    typeOpen: boolean;
  };
  const [menu, setMenu] = useState<PlannerMenuState>({
    open: false,
    x: 0,
    y: 0,
    item: null,
    typeOpen: false,
  });

  function openContextMenu(e: React.MouseEvent, item: PlannerItem) {
    e.preventDefault();
    e.stopPropagation();
    // Estimate menu size and clamp within viewport
    const estW = 240;
    const estH = 260;
    const pad = 8;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    let x = e.clientX;
    let y = e.clientY;
    if (x + estW + pad > vw) x = Math.max(pad, vw - estW - pad);
    if (y + estH + pad > vh) y = Math.max(pad, vh - estH - pad);
    setMenu({ open: true, x, y, item, typeOpen: false });
  }

  function closeContextMenu() {
    setMenu((m) => (m.open ? { ...m, open: false } : m));
  }

  useEffect(() => {
    if (!menu.open) return;
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById("clients-context-menu");
      if (el && el.contains(e.target as Node)) return;
      closeContextMenu();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeContextMenu();
      }
    };
    const onScroll = () => closeContextMenu();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onEsc);
    };
  }, [menu.open]);

  async function shiftMenuItem(deltaMin: number) {
    const it = menu.item;
    if (!it) return;
    const duration = Math.max(15, (it.endMin ?? 0) - (it.startMin ?? 0));
    let start = clamp((it.startMin ?? 0) + deltaMin, 0, 24 * 60 - 15);
    let end = start + duration;
    if (end > 24 * 60) {
      end = 24 * 60;
      start = Math.max(0, end - duration);
    }
    const ref = doc(db, "plannerDays", it.dayId, "items", it.id);
    await updateDoc(ref, { startMin: start, endMin: end, updatedAt: serverTimestamp() });
    closeContextMenu();
  }

  async function setMenuItemType(t: PlannerItemType) {
    const it = menu.item;
    if (!it) return;
    const ref = doc(db, "plannerDays", it.dayId, "items", it.id);
    await updateDoc(ref, { type: t, updatedAt: serverTimestamp() });
    closeContextMenu();
  }

  async function deleteMenuItem() {
    const it = menu.item;
    if (!it) return;
    await deleteDoc(doc(db, "plannerDays", it.dayId, "items", it.id));
    closeContextMenu();
  }

  // Subscribe to planner day items
  useEffect(() => {
    const dayId = dateStr;
    const col = collection(db, "plannerDays", dayId, "items");
    const q = query(col, orderBy("startMin", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: PlannerItem[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlannerItem));
      setItems(list);
    });
    return () => unsub();
  }, [dateStr]);

  // Subscribe to teach intros for client linking
  useEffect(() => {
    const q = query(collection(db, "teachIntros"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TeachIntroDoc[];
      setIntros(list);
    });
    return () => unsub();
  }, []);

  const introsById = useMemo(() => {
    const m = new Map<string, TeachIntroDoc>();
    for (const it of intros) m.set(it.id, it);
    return m;
  }, [intros]);

  const totalSlots = (HOURS_END - HOURS_START) * (60 / SLOT_MIN);
  const trackHeight = totalSlots * SLOT_PX;

  const isToday = React.useMemo(() => dateStr === toDayId(new Date()), [dateStr]);
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) {
      setNowMin(null);
      return;
    }
    const update = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [isToday]);

  const addQuickItem = async () => {
    const dayId = dateStr;
    const start = clamp(parseHHMM(qa.start), 0, 24 * 60 - 1);
    const end = clamp(start + qa.duration, start + 15, 24 * 60);
    const payload: Omit<PlannerItem, "id"> = {
      dayId,
      type: qa.type,
      title:
        qa.title.trim() ||
        (qa.type === "APPOINTMENT"
          ? TYPE_META.APPOINTMENT.label
          : qa.type === "CHECKIN"
          ? TYPE_META.CHECKIN.label
          : qa.type === "ADVERTIME"
          ? TYPE_META.ADVERTIME.label
          : qa.type === "BREAK"
          ? TYPE_META.BREAK.label
          : TYPE_META.TASK.label),
      clientIntroId: qa.clientIntroId || null,
      startMin: start,
      endMin: end,
      location: null,
      details: null,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };
    // Ensure day doc exists
    await setDoc(
      doc(db, "plannerDays", dayId),
      {
        id: dayId,
        date: dayId,
        tz,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      } as PlannerDay,
      { merge: true }
    );
    await addDoc(collection(db, "plannerDays", dayId, "items"), payload);
    setQA((s) => ({ ...s, title: "" }));
  };

  const selectItem = (it: PlannerItem) => {
    setEditing(it);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const dayId = editing.dayId;
    const ref = doc(db, "plannerDays", dayId, "items", editing.id);
    await updateDoc(ref, { ...editing, updatedAt: serverTimestamp() });
    setEditing(null);
  };

  const deleteEdit = async () => {
    if (!editing) return;
    const dayId = editing.dayId;
    await deleteDoc(doc(db, "plannerDays", dayId, "items", editing.id));
    setEditing(null);
  };

  const changeDate = (deltaDays: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + deltaDays);
    setDateStr(toDayId(d));
  };

  // Rendered overlay for planner item context menus
  function ContextMenuOverlay() {
    if (!menu.open || !menu.item) return null;
    if (typeof document === "undefined") return null;

    const itemCls =
      "w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-white/10 outline-none";

    const node = (
      <div
        id="clients-context-menu"
        className="fixed z-50"
        style={{ left: menu.x, top: menu.y }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="min-w-[240px] rounded-lg border border-neutral-300 dark:border-white/15 bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-md text-neutral-800 dark:text-neutral-100">
          <ul className="py-1">
            <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Move
            </li>
            <li><button className={itemCls} onClick={() => shiftMenuItem(-60)}>Earlier 60 min</button></li>
            <li><button className={itemCls} onClick={() => shiftMenuItem(-30)}>Earlier 30 min</button></li>
            <li><button className={itemCls} onClick={() => shiftMenuItem(30)}>Later 30 min</button></li>
            <li><button className={itemCls} onClick={() => shiftMenuItem(60)}>Later 60 min</button></li>
            <li><hr className="my-1 border-neutral-200 dark:border-white/10" /></li>
            <li>
              <button
                className={itemCls}
                onClick={() => setMenu((m) => ({ ...m, typeOpen: !m.typeOpen }))}
              >
                Edit Type {menu.typeOpen ? "▾" : "▸"}
              </button>
            </li>
            {menu.typeOpen ? (
              <>
                {(Object.keys(TYPE_META) as PlannerItemType[]).map((t) => (
                  <li key={`type-${t}`}>
                    <button className={itemCls} onClick={() => setMenuItemType(t)}>
                      {TYPE_META[t].label}
                    </button>
                  </li>
                ))}
              </>
            ) : null}
            <li><hr className="my-1 border-neutral-200 dark:border-white/10" /></li>
            <li>
              <button className={`${itemCls} text-red-600 dark:text-red-400`} onClick={deleteMenuItem}>
                Delete appointment
              </button>
            </li>
          </ul>
        </div>
      </div>
    );
    return createPortal(node, document.body);
  }

  return (
    <div className="space-y-4">
      <ContextMenuOverlay />
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Day Planner</h2>
          <Badge>{tz}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/10"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
          >
            ‹
          </button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
          />
          <button
            className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/10"
            onClick={() => setDateStr(toDayId(new Date()))}
          >
            Today
          </button>
          <button
            className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/10"
            onClick={() => changeDate(1)}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </div>

      {/* Quick add */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 p-3">
        <div className="grid lg:grid-cols-[180px_120px_120px_1fr_200px_auto] gap-2">
          <select
            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
            value={qa.type}
            onChange={(e) => setQA((s) => ({ ...s, type: e.target.value as PlannerItemType }))}
          >
            {Object.keys(TYPE_META).map((k) => (
              <option key={k} value={k}>
                {TYPE_META[k as PlannerItemType].label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={qa.start}
            onChange={(e) => setQA((s) => ({ ...s, start: e.target.value }))}
            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
            step={SLOT_MIN * 60}
          />
          <select
            value={qa.duration}
            onChange={(e) => setQA((s) => ({ ...s, duration: Number(e.target.value) }))}
            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Title (optional)"
            value={qa.title}
            onChange={(e) => setQA((s) => ({ ...s, title: e.target.value }))}
            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
          />
          <select
            value={qa.clientIntroId}
            onChange={(e) => setQA((s) => ({ ...s, clientIntroId: e.target.value }))}
            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
          >
            <option value="">Link client (optional)</option>
            {intros.map((it) => (
              <option key={it.id} value={it.id}>
                {it.contact?.name || "Unknown"} · {it.progressStatus ?? it.status}
              </option>
            ))}
          </select>
          <button
            onClick={addQuickItem}
            aria-label="Add planner item"
            className="px-3 py-2 rounded-md bg-black text-white hover:bg-neutral-800 active:bg-neutral-900"
          >
            Add
          </button>
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {(["APPOINTMENT","CHECKIN","TASK","ADVERTIME","BREAK"] as PlannerItemType[]).map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 px-2 py-1 rounded ${TYPE_META[t].badge}`}>
              {TYPE_META[t].label}
            </span>
          ))}
        </div>
      </div>

      {/* Day grid */}
      <div className="hidden md:grid grid-cols-[64px_1fr] gap-2">
        {/* Time axis */}
        <div className="text-xs text-neutral-500 select-none">
          {Array.from({ length: HOURS_END - HOURS_START + 1 }, (_, i) => HOURS_START + i).map(
            (h) => (
              <div
                key={h}
                style={{ height: SLOT_PX * (60 / SLOT_MIN) }}
                className="flex items-start justify-end pr-2"
              >
                <span className="translate-y-[-6px]">
                  {((h + 11) % 12) + 1} {h >= 12 ? "PM" : "AM"}
                </span>
              </div>
            )
          )}
        </div>

        {/* Track */}
        <div
          className="relative rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 overflow-hidden"
          style={{ height: trackHeight }}
        >
          {/* slot lines */}
          {Array.from({ length: totalSlots + 1 }, (_, i) => i).map((i) => {
            const top = i * SLOT_PX;
            const isHour = i % (60 / SLOT_MIN) === 0;
            return (
              <div
                key={i}
                className={isHour ? "absolute left-0 right-0 border-t border-neutral-300/60 dark:border-white/10" : "absolute left-0 right-0 border-t border-neutral-200/40 dark:border-white/5"}
                style={{ top }}
              />
            );
          })}
          {/* now line */}
          {nowMin != null && nowMin >= HOURS_START * 60 && nowMin <= HOURS_END * 60 ? (
            <div
              className="absolute left-0 right-0 border-t-2 border-red-500/70"
              style={{ top: clamp(((nowMin - HOURS_START * 60) / SLOT_MIN) * SLOT_PX, 0, trackHeight - 1) }}
              aria-hidden="true"
            />
          ) : null}

          {/* items */}
          {items.map((it) => {
            const top = ((it.startMin - HOURS_START * 60) / SLOT_MIN) * SLOT_PX;
            const height = ((it.endMin - it.startMin) / SLOT_MIN) * SLOT_PX;
            const meta = TYPE_META[it.type];
            const client = it.clientIntroId ? introsById.get(it.clientIntroId) : null;
            return (
              <button
                key={it.id}
                className={`absolute left-1 right-1 rounded-md border p-2 text-xs text-left outline-none focus-visible:ring-2 ${meta.card}`}
                style={{
                  top: clamp(top, 0, trackHeight - 8),
                  height: Math.max(24, height),
                }}
                onClick={() => selectItem(it)}
                onContextMenu={(e) => openContextMenu(e, it)}
                aria-label={`${meta.label}: ${it.title || ""}. ${humanTime(it.startMin)} to ${humanTime(it.endMin)}`}
                title={`${meta.label} • ${humanTime(it.startMin)}–${humanTime(it.endMin)}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="font-medium truncate">{it.title}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                  {humanTime(it.startMin)} – {humanTime(it.endMin)}
                  {client ? (
                    <>
                      {" • "}
                      <span className="font-medium">{client.contact?.name || "Unknown"}</span>
                      {client.contact?.email ? (
                        <>
                          {" "}
                          <a
                            className="text-cyan-700 dark:text-cyan-300 hover:underline"
                            href={`mailto:${client.contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {client.contact.email}
                          </a>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile list (small screens) */}
      <div className="md:hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 p-3">
        <div className="space-y-2">
          {items.slice().sort((a, b) => a.startMin - b.startMin).map((it) => {
            const meta = TYPE_META[it.type];
            const client = it.clientIntroId ? introsById.get(it.clientIntroId) : null;
            return (
              <button
                key={it.id}
                className="w-full text-left rounded-md border border-neutral-200 dark:border-white/10 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                onClick={() => selectItem(it)}
                onContextMenu={(e) => openContextMenu(e, it)}
                aria-label={`${meta.label}: ${it.title || ""}. ${humanTime(it.startMin)} to ${humanTime(it.endMin)}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="font-medium truncate">{it.title}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                  {humanTime(it.startMin)} – {humanTime(it.endMin)}
                  {client ? <> • <span className="font-medium">{client.contact?.name || "Unknown"}</span></> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit panel */}
      {editing ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Edit Item</div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-white/10"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700"
                onClick={deleteEdit}
              >
                Delete
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-black text-white hover:bg-neutral-800"
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Type</span>
              <select
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as PlannerItemType })}
              >
                {Object.keys(TYPE_META).map((k) => (
                  <option key={k} value={k}>
                    {TYPE_META[k as PlannerItemType].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Title</span>
              <input
                type="text"
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Start</span>
              <input
                type="time"
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                step={SLOT_MIN * 60}
                value={toHHMM(editing.startMin)}
                onChange={(e) => {
                  const start = parseHHMM(e.target.value);
                  const end = Math.max(start + 15, editing.endMin);
                  setEditing({ ...editing, startMin: start, endMin: clamp(end, 0, 24 * 60) });
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Duration</span>
              <select
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                value={editing.endMin - editing.startMin}
                onChange={(e) => {
                  const dur = Number(e.target.value);
                  setEditing({
                    ...editing,
                    endMin: clamp(editing.startMin + dur, editing.startMin + 15, 24 * 60),
                  });
                }}
              >
                {[15, 30, 45, 60, 75, 90, 120, 150].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Link Client</span>
              <select
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                value={editing.clientIntroId || ""}
                onChange={(e) => setEditing({ ...editing, clientIntroId: e.target.value || null })}
              >
                <option value="">None</option>
                {intros.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.contact?.name || "Unknown"} · {it.progressStatus ?? it.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm font-medium">Details</span>
              <textarea
                rows={3}
                className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                value={editing.details || ""}
                onChange={(e) => setEditing({ ...editing, details: e.target.value })}
                placeholder="Notes, agenda, prep…"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- Main page wrapper ----------------------------- */

export default function ClientsPage() {
  const { user, profile, loading } = useAuth();
  const isAdmin = useMemo(
    () => !!user && (user.email === ADMIN_EMAIL || profile?.email === ADMIN_EMAIL),
    [user, profile]
  );

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  // Requests tab state
  const [items, setItems] = useState<TeachIntroDoc[]>([]);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<Record<string, ProgressStatus>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Schedule drafts per intro
  const [sched, setSched] = useState<Record<string, { date: string; time: string; duration: number; title: string }>>({});

  // Tab
  const [tab, setTab] = useState<"planner" | "requests">("planner");

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "teachIntros"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TeachIntroDoc[];
      setItems(list);
      setDraftNotes((prev) => {
        const next = { ...prev };
        for (const it of list) if (next[it.id] === undefined) next[it.id] = it.adminNotes ?? "";
        return next;
      });
      setDraftStatus((prev) => {
        const next = { ...prev };
        for (const it of list)
          if (next[it.id] === undefined)
            next[it.id] = (it.progressStatus as ProgressStatus) ?? "requested";
        return next;
      });
      setSched((prev) => {
        const next = { ...prev };
        const today = toDayId(new Date());
        for (const it of list) {
          if (next[it.id] === undefined) {
            next[it.id] = {
              date: today,
              time: "09:00",
              duration: 60,
              title: `Intro with ${it.contact?.name || "Client"}`,
            };
          }
        }
        return next;
      });
    });
    return () => unsub();
  }, [isAdmin]);

  const updateItem = async (id: string) => {
    try {
      setSaving((s) => ({ ...s, [id]: true }));
      const notes = draftNotes[id] ?? "";
      const status = draftStatus[id] ?? "requested";
      await updateDoc(doc(db, "teachIntros", id), {
        adminNotes: notes,
        progressStatus: status,
        adminUpdatedAt: serverTimestamp(),
      });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const scheduleAppointment = async (id: string) => {
    try {
      setSaving((s) => ({ ...s, [id]: true }));
      const it = items.find((x) => x.id === id);
      if (!it) return;

      const d = sched[id] || {
        date: toDayId(new Date()),
        time: "09:00",
        duration: 60,
        title: `Intro with ${it.contact?.name || "Client"}`,
      };

      const dayId = d.date;
      const start = clamp(parseHHMM(d.time), 0, 24 * 60 - 1);
      const end = clamp(start + d.duration, start + 15, 24 * 60);
      const title = d.title.trim() || `Intro with ${it.contact?.name || "Client"}`;

      await setDoc(
        doc(db, "plannerDays", dayId),
        {
          id: dayId,
          date: dayId,
          tz,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        } as PlannerDay,
        { merge: true }
      );

      const payload: Omit<PlannerItem, "id"> = {
        dayId,
        type: "APPOINTMENT",
        title,
        clientIntroId: it.id,
        startMin: start,
        endMin: end,
        location: null,
        details: null,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };

      const ref = await addDoc(collection(db, "plannerDays", dayId, "items"), payload);

      await updateDoc(doc(db, "teachIntros", id), {
        progressStatus: "scheduled",
        adminUpdatedAt: serverTimestamp(),
        scheduled: {
          dayId,
          startMin: start,
          endMin: end,
          tz,
          plannerItemId: ref.id,
          createdAt: serverTimestamp(),
        },
      });

      setDraftStatus((m) => ({ ...m, [id]: "scheduled" }));
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (!isAdmin) return <div className="p-4">Unauthorized</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <div className="text-xs text-neutral-500">Admin-only</div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-2">
        {(["planner", "requests"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md border text-sm ${
              tab === t
                ? "bg-black text-white border-black"
                : "bg-white/70 text-neutral-800 border-neutral-300 hover:bg-neutral-100 dark:bg-neutral-900/40 dark:text-neutral-100 dark:border-white/10"
            }`}
          >
            {t === "planner" ? "Planner" : "Requests"}
          </button>
        ))}
      </div>

      {tab === "planner" ? (
        <DayPlanner />
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-600 dark:text-neutral-400">No contact requests yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const c = it.contact;
            const created = fmt(it.createdAt);
            const status = draftStatus[it.id] ?? "requested";
            const concepts = it.conceptsByInstrument || {};

            return (
              <div
                key={it.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{status}</Badge>
                    <div className="font-medium">{c?.name || "Unknown"}</div>
                    {c?.email ? (
                      <a
                        className="text-cyan-700 dark:text-cyan-400 hover:underline text-sm"
                        href={`mailto:${c.email}`}
                      >
                        {c.email}
                      </a>
                    ) : null}
                    {c?.phone ? (
                      <a
                        className="text-cyan-700 dark:text-cyan-400 hover:underline text-sm"
                        href={`tel:${c.phoneNormalized || c.phone}`}
                      >
                        {c.phone}
                      </a>
                    ) : null}
                  </div>
                  <div className="text-xs text-neutral-500">{created}</div>
                </div>

                <div className="mt-3 grid md:grid-cols-3 gap-4">
                  <Section title="Contact">
                    <div className="space-y-1">
                      <div>Preferred: {c?.preferredContact}</div>
                      <div>
                        Role: {c?.role}
                        {c?.studentName ? ` (${c.studentName})` : ""}
                      </div>
                      <div>TZ: {c?.timezone || "n/a"}</div>
                    </div>
                  </Section>

                  <Section title="Instruments">
                    <div className="flex flex-wrap gap-2">
                      {(it.instruments || []).map((k) => (
                        <Badge key={k}>{k}</Badge>
                      ))}
                    </div>
                  </Section>

                  <Section title="Client Notes">
                    <div className="space-y-2 text-sm">
                      {it.notes?.goals ? (
                        <div>
                          <span className="font-medium">Goals:</span> {it.notes.goals}
                        </div>
                      ) : null}
                      {it.notes?.availability ? (
                        <div>
                          <span className="font-medium">Availability:</span>{" "}
                          {it.notes.availability}
                        </div>
                      ) : null}
                    </div>
                  </Section>
                </div>

                {Object.keys(concepts).length > 0 ? (
                  <div className="mt-3">
                    <Section title="Understanding">
                      <div className="flex flex-col gap-1 text-xs">
                        {Object.entries(concepts).map(([inst, scores]) => {
                          const vals = (Object.values(scores || {}) as number[]) || [];
                          const avg = vals.length
                            ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
                            : "—";
                          return (
                            <div key={inst}>
                              {inst}: avg {avg} ({vals.length} items)
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  </div>
                ) : null}

                <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-3 items-start">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Notes</label>
                    <textarea
                      rows={4}
                      value={draftNotes[it.id] ?? ""}
                      onChange={(e) =>
                        setDraftNotes((m) => ({ ...m, [it.id]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                      placeholder="Internal notes, progress, next steps…"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setDraftStatus((m) => ({
                          ...m,
                          [it.id]: e.target.value as ProgressStatus,
                        }))
                      }
                      className="px-3 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                    >
                      {(
                        ["requested", "contacted", "scheduled", "active", "closed"] as ProgressStatus[]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateItem(it.id)}
                      disabled={!!saving[it.id]}
                      className={`inline-flex items-center justify-center px-4 py-2 rounded-md ${
                        saving[it.id]
                          ? "bg-neutral-300 text-neutral-600 dark:bg-white/10 dark:text-neutral-400"
                          : "bg-black text-white hover:bg-neutral-800 active:bg-neutral-900"
                      }`}
                    >
                      {saving[it.id] ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <Section title="Appointment">
                    {it.scheduled ? (
                      <div className="text-sm">
                        Scheduled: {it.scheduled.dayId} • {humanTime(it.scheduled.startMin)} – {humanTime(it.scheduled.endMin)}{" "}
                        <span className="ml-2"><Badge>{it.scheduled.tz}</Badge></span>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-[140px_140px_120px_1fr_auto] gap-2 items-end">
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium">Date</span>
                          <input
                            type="date"
                            value={sched[it.id]?.date || toDayId(new Date())}
                            onChange={(e) =>
                              setSched((m) => ({
                                ...m,
                                [it.id]: {
                                  ...(m[it.id] || {
                                    date: toDayId(new Date()),
                                    time: "09:00",
                                    duration: 60,
                                    title: `Intro with ${it.contact?.name || "Client"}`,
                                  }),
                                  date: e.target.value,
                                },
                              }))
                            }
                            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium">Time</span>
                          <input
                            type="time"
                            step={SLOT_MIN * 60}
                            value={sched[it.id]?.time || "09:00"}
                            onChange={(e) =>
                              setSched((m) => ({
                                ...m,
                                [it.id]: {
                                  ...(m[it.id] || {
                                    date: toDayId(new Date()),
                                    time: "09:00",
                                    duration: 60,
                                    title: `Intro with ${it.contact?.name || "Client"}`,
                                  }),
                                  time: e.target.value,
                                },
                              }))
                            }
                            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium">Duration</span>
                          <select
                            value={sched[it.id]?.duration || 60}
                            onChange={(e) =>
                              setSched((m) => ({
                                ...m,
                                [it.id]: {
                                  ...(m[it.id] || {
                                    date: toDayId(new Date()),
                                    time: "09:00",
                                    duration: 60,
                                    title: `Intro with ${it.contact?.name || "Client"}`,
                                  }),
                                  duration: Number(e.target.value),
                                },
                              }))
                            }
                            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                          >
                            {[15, 30, 45, 60, 90, 120].map((m) => (
                              <option key={m} value={m}>
                                {m} min
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm font-medium">Title</span>
                          <input
                            type="text"
                            value={sched[it.id]?.title || `Intro with ${it.contact?.name || "Client"}`}
                            onChange={(e) =>
                              setSched((m) => ({
                                ...m,
                                [it.id]: {
                                  ...(m[it.id] || {
                                    date: toDayId(new Date()),
                                    time: "09:00",
                                    duration: 60,
                                    title: `Intro with ${it.contact?.name || "Client"}`,
                                  }),
                                  title: e.target.value,
                                },
                              }))
                            }
                            className="px-2 py-2 rounded-md border border-neutral-300 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50"
                            placeholder="Intro title"
                          />
                        </label>
                        <button
                          onClick={() => scheduleAppointment(it.id)}
                          disabled={!!saving[it.id]}
                          className={`px-3 py-2 rounded-md ${
                            saving[it.id]
                              ? "bg-neutral-300 text-neutral-600 dark:bg-white/10 dark:text-neutral-400"
                              : "bg-black text-white hover:bg-neutral-800 active:bg-neutral-900"
                          }`}
                        >
                          {saving[it.id] ? "Scheduling…" : "Schedule"}
                        </button>
                      </div>
                    )}
                  </Section>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}