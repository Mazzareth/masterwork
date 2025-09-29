"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, orderBy, query, doc, setDoc, serverTimestamp, getDocs, getDoc, limit } from "firebase/firestore";
import { createGoteInvite, sendGoteChatMessage, patchGoteInventory, patchGoteCharacterState, setGoteCharacterProfile, GOTE_BUILD_OPTIONS, GOTE_HUNGER_LEVELS, GOTE_THIRST_LEVELS, GOTE_OXYGEN_LEVELS } from "../../lib/gote";
import type { GoteCharacterProfileDoc, GoteCharacterStateDoc, GoteInventoryOps, GoteStateOps, GoteChatDoc } from "../../lib/gote";
import { DEFAULT_NARRATOR_RULES } from "../../config/gote-ai";

type Msg = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: Date | null;
};

type ChatListItem = {
  chatId: string;
  title: string;
  lastMessageAt?: Date | null;
};

type PositionType = "top" | "bottom";
type RoleType = "dominant" | "submissive";

const cx = (...cls: Array<string | false | null | undefined>) =>
  cls.filter(Boolean).join(" ");

// Minimal inline Markdown renderer (safe-ish: escapes HTML first, then formats)
function escapeHtml(str: string) {
  // Properly escape HTML entities before lightweight markdown formatting
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}
function inlineMarkdown(text: string) {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-white/10">$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/_([^_]+)_/g, "<em>$1</em>");
  return t;
}
function renderMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const parts: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push('<div class="h-3"></div>');
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push('<hr class="my-3 border-white/20" />');
      continue;
    }
    const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const txt = inlineMarkdown(h[2]);
      const size =
        level === 1 ? "text-lg md:text-xl" : level === 2 ? "text-base md:text-lg" : "text-sm md:text-base";
      parts.push(`<h${level} class="font-semibold ${size}">${txt}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        inList = true;
        parts.push('<ul class="list-disc pl-5 space-y-1 text-sm">');
      }
      const li = inlineMarkdown(trimmed.replace(/^[-*]\s+/, ""));
      parts.push(`<li>${li}</li>`);
      continue;
    }
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
    parts.push(`<p class="text-sm">${inlineMarkdown(trimmed)}</p>`);
  }
  if (inList) parts.push("</ul>");
  return parts.join("");
}
 
// Type helpers
function isStringArray(u: unknown): u is string[] {
  return Array.isArray(u) && u.every((s) => typeof s === "string");
}
function toStringList(u: unknown): string[] | undefined {
  return Array.isArray(u) ? u.filter((s): s is string => typeof s === "string") : undefined;
}
function isGoteBuild(v: unknown): v is typeof GOTE_BUILD_OPTIONS[number] {
  return typeof v === "string" && (GOTE_BUILD_OPTIONS as readonly string[]).includes(v);
}
// Inventory helpers
function toInvAddList(u: unknown): Array<{ name: string; qty?: number; notes?: string | null }> | undefined {
  if (!Array.isArray(u)) return undefined;
  const out: Array<{ name: string; qty?: number; notes?: string | null }> = [];
  for (const it of u) {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      if (typeof o.name === "string") {
        const e: { name: string; qty?: number; notes?: string | null } = { name: o.name };
        if (typeof o.qty === "number") e.qty = o.qty;
        if (typeof o.notes === "string" || o.notes === null) e.notes = (o.notes as string) ?? null;
        out.push(e);
      }
    }
  }
  return out;
}
function toInvRemoveList(u: unknown): Array<{ name: string; qty?: number }> | undefined {
  if (!Array.isArray(u)) return undefined;
  const out: Array<{ name: string; qty?: number }> = [];
  for (const it of u) {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      if (typeof o.name === "string") {
        const e: { name: string; qty?: number } = { name: o.name };
        if (typeof o.qty === "number") e.qty = o.qty;
        out.push(e);
      }
    }
  }
  return out;
}
function toInvSetList(u: unknown): Array<{ name: string; qty?: number; notes?: string | null }> | undefined {
  return toInvAddList(u);
}
function pickStateSet(u: unknown): Partial<{ hunger: typeof GOTE_HUNGER_LEVELS[number]; thirst: typeof GOTE_THIRST_LEVELS[number]; oxygen: typeof GOTE_OXYGEN_LEVELS[number]; }> | undefined {
  if (!u || typeof u !== "object") return undefined;
  const o = u as Record<string, unknown>;
  const out: Partial<{ hunger: typeof GOTE_HUNGER_LEVELS[number]; thirst: typeof GOTE_THIRST_LEVELS[number]; oxygen: typeof GOTE_OXYGEN_LEVELS[number]; }> = {};
  if (typeof o.hunger === "string" && (GOTE_HUNGER_LEVELS as readonly string[]).includes(o.hunger)) out.hunger = o.hunger as typeof GOTE_HUNGER_LEVELS[number];
  if (typeof o.thirst === "string" && (GOTE_THIRST_LEVELS as readonly string[]).includes(o.thirst)) out.thirst = o.thirst as typeof GOTE_THIRST_LEVELS[number];
  if (typeof o.oxygen === "string" && (GOTE_OXYGEN_LEVELS as readonly string[]).includes(o.oxygen)) out.oxygen = o.oxygen as typeof GOTE_OXYGEN_LEVELS[number];
  return Object.keys(out).length ? out : undefined;
}
 
function MarkdownView({ text }: { text?: string }) {
  const html = useMemo(() => renderMarkdownToHtml(text || ""), [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function LevelBar({ label, levels, value }: { label: string; levels: string[]; value?: string }) {
  const idx = Math.max(0, levels.findIndex((l) => l === value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="text-white/70">{value || "—"}</span>
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1">
        {levels.map((lv, i) => (
          <div key={lv} className={"h-1.5 rounded " + (i <= idx ? "bg-white" : "bg-white/20")} />
        ))}
      </div>
    </div>
  );
}

export default function BigGotePage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();

  // Pane widths (px) with bounds and persistence
  const MIN_LEFT = 220;
  const MAX_LEFT = 560;
  const MIN_RIGHT = 260;
  const MAX_RIGHT = 640;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const [leftW, setLeftW] = useState<number>(() => {
    if (typeof window === "undefined") return 320;
    const raw = Number.parseInt(typeof window !== "undefined" ? window.localStorage.getItem("gote:leftW") || "" : "", 10);
    return Number.isFinite(raw) ? clamp(raw, MIN_LEFT, MAX_LEFT) : 320;
  });
  const [rightW, setRightW] = useState<number>(() => {
    if (typeof window === "undefined") return 360;
    const raw = Number.parseInt(typeof window !== "undefined" ? window.localStorage.getItem("gote:rightW") || "" : "", 10);
    return Number.isFinite(raw) ? clamp(raw, MIN_RIGHT, MAX_RIGHT) : 360;
  });

  useEffect(() => {
    try { window.localStorage.setItem("gote:leftW", String(leftW)); } catch {}
  }, [leftW]);
  useEffect(() => {
    try { window.localStorage.setItem("gote:rightW", String(rightW)); } catch {}
  }, [rightW]);

  type DragSide = "left" | "right" | null;
  const [dragging, setDragging] = useState<DragSide>(null);
  const dragX = useRef<number | null>(null);

  const onMouseDownResizer = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
    dragX.current = e.clientX;
  };
  const onTouchStartResizer = (side: "left" | "right") => (e: React.TouchEvent) => {
    setDragging(side);
    dragX.current = e.touches[0]?.clientX ?? null;
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      if (dragX.current == null) { dragX.current = x; return; }
      const dx = x - dragX.current;
      dragX.current = x;
      if (dragging === "left") {
        setLeftW((w) => clamp(w + dx, MIN_LEFT, MAX_LEFT));
      } else {
        setRightW((w) => clamp(w - dx, MIN_RIGHT, MAX_RIGHT));
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? null;
      if (x == null) return;
      if (dragX.current == null) { dragX.current = x; return; }
      const dx = x - dragX.current;
      dragX.current = x;
      if (dragging === "left") {
        setLeftW((w) => clamp(w + dx, MIN_LEFT, MAX_LEFT));
      } else {
        setRightW((w) => clamp(w - dx, MIN_RIGHT, MAX_RIGHT));
      }
    };
    const end = () => { setDragging(null); dragX.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [dragging]);

  // Left: chat browser (Firestore)
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Linked-access probe: allow BigGote when a chat summary exists even if permissions.gote is false
  const [linkCheck, setLinkCheck] = useState<"idle" | "checking" | "has" | "none">("idle");

  // Linked-access probe: check for chat summaries when permission is absent
  useEffect(() => {
    if (!user) {
      setLinkCheck("idle");
      return;
    }
    if (permissions?.gote) {
      setLinkCheck("has");
      return;
    }
    let canceled = false;
    const run = async () => {
      setLinkCheck("checking");
      try {
        const col = collection(db, "users", user.uid, "sites", "gote", "chats");
        const snap = await getDocs(query(col, limit(1)));
        if (!canceled) setLinkCheck(snap.size > 0 ? "has" : "none");
      } catch {
        if (!canceled) setLinkCheck("none");
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [user, permissions?.gote]);

  // Middle: chat messages
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Right: Helper UIs (self + partner profiles, shared pin, DnD toggle)
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState<boolean>(false);
  const [aiDndEnabled, setAiDndEnabled] = useState<boolean>(false);
  const [sharedPin, setSharedPin] = useState<string>("");
  const [aiBehavior, setAiBehavior] = useState<string>("");
  const [scene, setScene] = useState<string>("");
  const [aiBusy, setAiBusy] = useState<boolean>(false);

  type ProfileState = {
    name: string;
    avatarUrl: string;
    charInfo: string;
    position: PositionType;
    role: RoleType;
  };
  const [charA, setCharA] = useState<ProfileState>({
    name: "",
    avatarUrl: "",
    charInfo: "",
    position: "top",
    role: "dominant",
  });
  const [charB, setCharB] = useState<ProfileState>({
    name: "",
    avatarUrl: "",
    charInfo: "",
    position: "top",
    role: "dominant",
  });

  const [charProfileA, setCharProfileA] = useState<GoteCharacterProfileDoc | null>(null);
  const [charProfileB, setCharProfileB] = useState<GoteCharacterProfileDoc | null>(null);
  const defaultCharState: GoteCharacterStateDoc = { statusTags: [], hunger: "Sated", thirst: "Quenched", oxygen: "Steady", clothing: [], accessories: [], updatedAt: null };
  const [charStateA, setCharStateA] = useState<GoteCharacterStateDoc>(defaultCharState);
  const [charStateB, setCharStateB] = useState<GoteCharacterStateDoc>(defaultCharState);

  // Invite tools (owner creates an invite under /users/{ownerId}/sites/gote/invites/{token})
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);
  const [inviteBusy, setInviteBusy] = useState<boolean>(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // New Chat dialog
  const [newOpen, setNewOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newAi, setNewAi] = useState<boolean>(false);
  const [newScene, setNewScene] = useState<string>("");
  const [newBusy, setNewBusy] = useState<boolean>(false);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);

  const [charSetupOpen, setCharSetupOpen] = useState<boolean>(false);
  const [charSaving, setCharSaving] = useState<boolean>(false);
  const [charDraft, setCharDraft] = useState<{ name: string; height: string; weight: string; dickFlaccid: string; dickErect: string; build: string; weaknesses: string; kinksText: string }>({
    name: "",
    height: "",
    weight: "",
    dickFlaccid: "",
    dickErect: "",
    build: "Average",
    weaknesses: "",
    kinksText: "",
  });

  // Live: subscribe to user's BigGote chat summaries
  useEffect(() => {
    if (!user) {
      setChats([]);
      setSelectedChatId(null);
      return;
    }
    const col = collection(db, "users", user.uid, "sites", "gote", "chats");
    const qy = query(col, orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: ChatListItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as { title?: string; lastMessageAt?: { toDate?: () => Date } };
        arr.push({
          chatId: d.id,
          title: data?.title || "Chat",
          lastMessageAt: data?.lastMessageAt?.toDate?.() ?? null,
        });
      });
      setChats(arr);
      if (!selectedChatId && arr.length > 0) {
        setSelectedChatId(arr[0].chatId);
      }
    }, () => {
      // ignore permission issues here (self-owned path should pass)
    });
    return () => unsub();
  }, [user, selectedChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }, [messages]);

  // Live: selected chat messages (only when chat is ready)
  useEffect(() => {
    if (!user || !selectedChatId || !chatReady) {
      setMessages([]);
      return;
    }
    const col = collection(db, "goteChats", selectedChatId, "messages");
    const qy = query(col, orderBy("createdAt"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Msg[] = [];
      snap.forEach((d) => {
        const data = d.data() as { senderId?: string; text?: string; createdAt?: { toDate?: () => Date } };
        arr.push({
          id: d.id,
          senderId: data?.senderId || "",
          text: data?.text || "",
          createdAt: data?.createdAt?.toDate?.() ?? null,
        });
      });
      setMessages(arr);
      // mark read
      void setDoc(
        doc(db, "users", user.uid, "sites", "gote", "chats", selectedChatId),
        { lastReadAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    });
    return () => unsub();
  }, [user, selectedChatId, chatReady]);

  // Live: chat doc meta and participants (subscribe only when ready)
  useEffect(() => {
    if (!user || !selectedChatId) {
      setPartnerUid(null);
      setChatReady(false);
      return;
    }
    if (!chatReady) {
      // waiting for invite acceptance; don't attach a live listener yet
      return;
    }
    const ref = doc(db, "goteChats", selectedChatId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Partial<GoteChatDoc> | undefined;
      const parts: string[] = Array.isArray(data?.participants) ? (data?.participants as string[]) : [];
      const partner = parts.find((p) => p !== user.uid) || null;
      setPartnerUid(partner || null);
      setAiDndEnabled(Boolean(data?.aiDndEnabled));
      setSharedPin(typeof data?.sharedPin === "string" ? data.sharedPin : "");
      setAiBehavior(typeof data?.aiBehavior === "string" ? data.aiBehavior : "");
      setScene(typeof data?.scene === "string" ? data.scene : "");
    });
    return () => unsub();
  }, [user, selectedChatId, chatReady]);

  // Probe for acceptance to flip chatReady when canonical chat becomes readable
  useEffect(() => {
    if (!user || !selectedChatId) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const probe = async () => {
      try {
        const s = await getDoc(doc(db, "goteChats", selectedChatId));
        if (canceled) return;
        if (s.exists()) {
          const d = s.data() as Partial<GoteChatDoc> | undefined;
          const parts: string[] = Array.isArray(d?.participants) ? (d?.participants as string[]) : [];
          if (parts.includes(user.uid)) {
            setChatReady(true);
            return; // stop probing
          }
        }
      } catch {
        // ignore
      }
      if (!canceled) {
        timer = setTimeout(probe, 2500);
      }
    };
    if (!chatReady) {
      probe();
    }
    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, selectedChatId, chatReady]);

  // Live: per‑chat profiles (self + partner) — subscribe only when chat is ready
  useEffect(() => {
    if (!user || !selectedChatId || !chatReady) {
      setCharA({ name: "", avatarUrl: "", charInfo: "", position: "top", role: "dominant" });
      setCharB({ name: "", avatarUrl: "", charInfo: "", position: "top", role: "dominant" });
      return;
    }
    const selfRef = doc(db, "goteChats", selectedChatId, "profiles", user.uid);
    const unsubSelf = onSnapshot(selfRef, (snap) => {
      const d = snap.data() as { displayName?: string; avatarUrl?: string; charInfo?: string; position?: PositionType; role?: RoleType } | undefined;
      setCharA({
        name: d?.displayName || "",
        avatarUrl: d?.avatarUrl || "",
        charInfo: d?.charInfo || "",
        position: (d?.position === "bottom" ? "bottom" : "top"),
        role: (d?.role === "submissive" ? "submissive" : "dominant"),
      });
    }, () => {
      // This can error if rules for /profiles are not deployed yet — prevent console noise
    });

    let unsubPartner = () => {};
    if (partnerUid) {
      const pRef = doc(db, "goteChats", selectedChatId, "profiles", partnerUid);
      unsubPartner = onSnapshot(pRef, (snap) => {
        const d = snap.data() as { displayName?: string; avatarUrl?: string; charInfo?: string; position?: PositionType; role?: RoleType } | undefined;
        setCharB({
          name: d?.displayName || "",
          avatarUrl: d?.avatarUrl || "",
          charInfo: d?.charInfo || "",
          position: (d?.position === "bottom" ? "bottom" : "top"),
          role: (d?.role === "submissive" ? "submissive" : "dominant"),
        });
      }, () => {
        // Same — ignore permission issues until rules are deployed
      });
    }

    return () => {
      try { unsubSelf(); } catch {}
      try { unsubPartner(); } catch {}
    };
  }, [user, selectedChatId, partnerUid, chatReady]);

  // Live: Character Profiles and States (per chat per player)
  useEffect(() => {
    if (!user || !selectedChatId || !chatReady) {
      setCharProfileA(null);
      setCharProfileB(null);
      setCharStateA(defaultCharState);
      setCharStateB(defaultCharState);
      return;
    }
    const cSelfRef = doc(db, "goteChats", selectedChatId, "characters", user.uid);
    const unsubCSelf = onSnapshot(cSelfRef, (snap) => {
      if (!snap.exists()) { setCharProfileA(null); return; }
      const d = snap.data() as Partial<GoteCharacterProfileDoc> | undefined;
      setCharProfileA({
        name: d?.name ?? "",
        height: d?.height ?? "",
        weight: d?.weight ?? "",
        dickFlaccid: d?.dickFlaccid ?? null,
        dickErect: d?.dickErect ?? null,
        build: (d?.build ?? "Average"),
        weaknesses: d?.weaknesses ?? null,
        kinks: Array.isArray(d?.kinks) ? d.kinks.filter((s): s is string => typeof s === "string") : [],
        createdAt: d?.createdAt ?? null,
        updatedAt: d?.updatedAt ?? null,
      } as GoteCharacterProfileDoc);
    }, () => {});

    let unsubCPartner = () => {};
    if (partnerUid) {
      const cPRef = doc(db, "goteChats", selectedChatId, "characters", partnerUid);
      unsubCPartner = onSnapshot(cPRef, (snap) => {
        if (!snap.exists()) { setCharProfileB(null); return; }
        const d = snap.data() as Partial<GoteCharacterProfileDoc> | undefined;
        setCharProfileB({
          name: d?.name ?? "",
          height: d?.height ?? "",
          weight: d?.weight ?? "",
          dickFlaccid: d?.dickFlaccid ?? null,
          dickErect: d?.dickErect ?? null,
          build: (d?.build ?? "Average"),
          weaknesses: d?.weaknesses ?? null,
          kinks: Array.isArray(d?.kinks) ? d.kinks.filter((s): s is string => typeof s === "string") : [],
          createdAt: d?.createdAt ?? null,
          updatedAt: d?.updatedAt ?? null,
        } as GoteCharacterProfileDoc);
      }, () => {});
    }

    const sSelfRef = doc(db, "goteChats", selectedChatId, "states", user.uid);
    const unsubSSelf = onSnapshot(sSelfRef, (snap) => {
      if (!snap.exists()) { setCharStateA(defaultCharState); return; }
      const d = snap.data() as Partial<GoteCharacterStateDoc> | undefined;
      setCharStateA({
        statusTags: Array.isArray(d?.statusTags) ? d.statusTags.filter((s): s is string => typeof s === "string") : [],
        hunger: d?.hunger ?? "Sated",
        thirst: d?.thirst ?? "Quenched",
        oxygen: d?.oxygen ?? "Steady",
        clothing: Array.isArray(d?.clothing) ? d.clothing.filter((s): s is string => typeof s === "string") : [],
        accessories: Array.isArray(d?.accessories) ? d.accessories.filter((s): s is string => typeof s === "string") : [],
        updatedAt: d?.updatedAt ?? null,
      } as GoteCharacterStateDoc);
    }, () => {});

    let unsubSPartner = () => {};
    if (partnerUid) {
      const sPRef = doc(db, "goteChats", selectedChatId, "states", partnerUid);
      unsubSPartner = onSnapshot(sPRef, (snap) => {
        if (!snap.exists()) { setCharStateB(defaultCharState); return; }
        const d = snap.data() as Partial<GoteCharacterStateDoc> | undefined;
        setCharStateB({
          statusTags: Array.isArray(d?.statusTags) ? d.statusTags.filter((s): s is string => typeof s === "string") : [],
          hunger: d?.hunger ?? "Sated",
          thirst: d?.thirst ?? "Quenched",
          oxygen: d?.oxygen ?? "Steady",
          clothing: Array.isArray(d?.clothing) ? d.clothing.filter((s): s is string => typeof s === "string") : [],
          accessories: Array.isArray(d?.accessories) ? d.accessories.filter((s): s is string => typeof s === "string") : [],
          updatedAt: d?.updatedAt ?? null,
        } as GoteCharacterStateDoc);
      }, () => {});
    }

    return () => {
      try { unsubCSelf(); } catch {}
      try { unsubCPartner(); } catch {}
      try { unsubSSelf(); } catch {}
      try { unsubSPartner(); } catch {}
    };
  }, [user, selectedChatId, partnerUid, chatReady, defaultCharState]);

  // Prompt for character setup if missing (setup happens when players join/create; not editable thereafter)
  useEffect(() => {
    if (!user || !selectedChatId || !chatReady) return;
    setCharSetupOpen(charProfileA === null);
    if (charProfileA === null) {
      setCharDraft((d) => ({
        ...d,
        name: charA.name || d.name,
      }));
    }
  }, [user, selectedChatId, chatReady, charProfileA, charA.name]);

  const filteredChats = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(t));
  }, [q, chats]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !selectedChatId || !chatReady) return;
    const t = text;
    setText("");
    try {
      await sendGoteChatMessage({ chatId: selectedChatId, senderId: user.uid, text: t });
    } catch {
      // ignore send error
    }
  };

  // Finish Turn → Engage AI "Omnipotent Narrator"
  const handleFinishTurn = async () => {
    if (!user || !selectedChatId || !chatReady) return;
    if (!aiDndEnabled) return; // require DnD Mode
    try {
      setAiBusy(true);

      // Gather context
      const selfId = user.uid;
      const otherId = partnerUid;
      const recent = messages.slice(-25).map((m) => ({
        senderId: m.senderId,
        text: m.text,
        at: m.createdAt ? (new Date(m.createdAt)).toISOString() : null,
      }));

      // Read per-player inventories and states (best-effort)
      const invSelfRef = doc(db, "goteChats", selectedChatId, "inventories", selfId);
      const invPartnerRef = otherId ? doc(db, "goteChats", selectedChatId, "inventories", otherId) : null;
      const stSelfRef = doc(db, "goteChats", selectedChatId, "states", selfId);
      const stPartnerRef = otherId ? doc(db, "goteChats", selectedChatId, "states", otherId) : null;
      const [invSelfSnap, invPartnerSnap, stSelfSnap, stPartnerSnap] = await Promise.all([
        getDoc(invSelfRef).catch(() => null),
        invPartnerRef ? getDoc(invPartnerRef).catch(() => null) : Promise.resolve(null),
        getDoc(stSelfRef).catch(() => null),
        stPartnerRef ? getDoc(stPartnerRef).catch(() => null) : Promise.resolve(null),
      ]);
      const invSelf = invSelfSnap && invSelfSnap.exists() ? invSelfSnap.data() : { items: [] };
      const invPartner = invPartnerSnap && invPartnerSnap.exists() ? invPartnerSnap.data() : { items: [] };
      const stSelf = stSelfSnap && stSelfSnap.exists() ? stSelfSnap.data() : { statusTags: [], clothing: [], accessories: [], hunger: "Sated", thirst: "Quenched", oxygen: "Steady" };
      const stPartner = stPartnerSnap && stPartnerSnap.exists() ? stPartnerSnap.data() : { statusTags: [], clothing: [], accessories: [], hunger: "Sated", thirst: "Quenched", oxygen: "Steady" };

      const ctx = {
        chatId: selectedChatId,
        aiDndEnabled,
        sharedPin,
        scene,
        participants: {
          self: { uid: selfId, ...charA },
          partner: otherId ? { uid: otherId, ...charB } : null,
        },
        inventories: {
          [selfId]: invSelf,
          ...(otherId ? { [otherId]: invPartner } : {}),
        },
        states: {
          [selfId]: stSelf,
          ...(otherId ? { [otherId]: stPartner } : {}),
        },
        recentMessages: recent,
      };

      // System prompt with strict JSON response contract
      const baseBehavior = DEFAULT_NARRATOR_RULES.trim();
      const behaviorSections = ["Global Behavioral Rules:", baseBehavior];
      if (aiBehavior && aiBehavior.trim()) {
        behaviorSections.push(
          "Chat-Specific Guidance (overrides defaults on conflict):",
          aiBehavior.trim()
        );
      }
      const behavior = behaviorSections.join("\n");

      const system = [
        "You are the Omnipotent Narrator for a consensual, adult roleplay story.",
        "Behavioral Rules:",
        behavior,
        "",
        "Task when the user clicks 'Finish Turn':",
        "- Continue the story with objective, external narration (camera over the scene), 3–8 sentences.",
        "- Optionally apply actions to update per-chat profiles (/profiles) — displayName, avatarUrl, charInfo, position (top|bottom), role (dominant|submissive) — only when earned by the fiction.",
        "- Optionally modify per-player inventory or state when earned (see actions schema).",
        "Return STRICT JSON ONLY with the shape:",
        '{',
        '  "narratorMessage": "string, Markdown allowed",',
        '  "actions": {',
        '    "profiles": {',
        '      "<uid>": { "displayName?": "string", "avatarUrl?": "string", "charInfo?": "string", "position?": "top|bottom", "role?": "dominant|submissive" }',
        '    },',
        '    "inventories": {',
        '      "<uid>": {',
        '        "add?":    [ { "name": "string", "qty?": number, "notes?": "string" } ],',
        '        "remove?": [ { "name": "string", "qty?": number } ],',
        '        "set?":    [ { "name": "string", "qty?": number, "notes?": "string" } ]',
        '      }',
        '    },',
        '    "states": {',
        '      "<uid>": {',
        '        "set?": { "hunger?": "Famished|Hungry|Sated|Full|Engorged", "thirst?": "Parched|Thirsty|Quenched|Hydrated|Saturated", "oxygen?": "Suffocating|Winded|Steady|Oxygenated|Brimming" },',
        '        "setStatusTags?": [], "addStatusTags?": [], "removeStatusTags?": [],',
        '        "setClothing?": [], "addClothing?": [], "removeClothing?": [],',
        '        "setAccessories?": [], "addAccessories?": [], "removeAccessories?": []',
        '      }',
        '    }',
        '  }',
        '}',
        "No extra keys. No prose outside of JSON. Keep narratorMessage <= 500 tokens.",
      ].join("\n");

      // Call server proxy to DeepSeek
      const res = await fetch("/api/deepseek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(ctx) },
          ],
          stream: false,
        }),
      });

      let content = "";
      try {
        const json = await res.json();
        content = json?.choices?.[0]?.message?.content ?? "";
      } catch {
        // fall back to text
        content = await res.text();
      }

      // Extract JSON (handles fenced code blocks or raw)
      const extractJson = (t: string): unknown | null => {
        const fence = t.match(/```json\s*([\s\S]*?)\s*```/i) || t.match(/```\s*([\s\S]*?)\s*```/i);
        const raw = fence ? fence[1] : t;
        try { return JSON.parse(raw); } catch { return null; }
      };

      const parsed = extractJson(content) as {
        narratorMessage?: string;
        actions?: {
          profiles?: Record<string, Partial<{ displayName: string; avatarUrl: string; charInfo: string; position: PositionType; role: RoleType }>>;
          inventories?: Record<string, Partial<{ add: Array<{ name: string; qty?: number; notes?: string }>; remove: Array<{ name: string; qty?: number }>; set: Array<{ name: string; qty?: number; notes?: string }> }>>;
          states?: Record<string, Partial<{
            set: Partial<{ hunger: "Famished" | "Hungry" | "Sated" | "Full" | "Engorged"; thirst: "Parched" | "Thirsty" | "Quenched" | "Hydrated" | "Saturated"; oxygen: "Suffocating" | "Winded" | "Steady" | "Oxygenated" | "Brimming" }>;
            setStatusTags: string[]; addStatusTags: string[]; removeStatusTags: string[];
            setClothing: string[]; addClothing: string[]; removeClothing: string[];
            setAccessories: string[]; addAccessories: string[]; removeAccessories: string[];
          }>>;
        };
      } | null;

      // Apply updates
      if (parsed?.actions?.profiles) {
        const entries = Object.entries(parsed.actions.profiles);
        for (const [uid, patch] of entries) {
          const allowed: Record<string, unknown> = {};
          if (typeof patch.displayName === "string") allowed.displayName = patch.displayName;
          if (typeof patch.avatarUrl === "string") allowed.avatarUrl = patch.avatarUrl;
          if (typeof patch.charInfo === "string") allowed.charInfo = patch.charInfo;
          if (patch.position === "top" || patch.position === "bottom") allowed.position = patch.position;
          if (patch.role === "dominant" || patch.role === "submissive") allowed.role = patch.role;
          if (Object.keys(allowed).length > 0) {
            try { await setDoc(doc(db, "goteChats", selectedChatId, "profiles", uid), allowed, { merge: true }); } catch {}
          }
        }
      }

      if (parsed?.actions?.inventories) {
        const entries = Object.entries(parsed.actions.inventories);
        for (const [uid, raw] of entries) {
          const obj = raw as Record<string, unknown>;
          const ops: GoteInventoryOps = {
            add: toInvAddList(obj.add),
            remove: toInvRemoveList(obj.remove),
            set: toInvSetList(obj.set),
          };
          try {
            await patchGoteInventory({ chatId: selectedChatId, targetUid: uid, ops });
          } catch {
            // ignore inventory apply errors
          }
        }
      }

      if (parsed?.actions?.states) {
        const entries = Object.entries(parsed.actions.states as Record<string, unknown>);
        for (const [uid, rawOps] of entries) {
          const obj = rawOps as Record<string, unknown>;
          const ops: GoteStateOps = {
            set: pickStateSet(obj.set),
            setStatusTags: toStringList(obj.setStatusTags),
            addStatusTags: toStringList(obj.addStatusTags),
            removeStatusTags: toStringList(obj.removeStatusTags),
            setClothing: toStringList(obj.setClothing),
            addClothing: toStringList(obj.addClothing),
            removeClothing: toStringList(obj.removeClothing),
            setAccessories: toStringList(obj.setAccessories),
            addAccessories: toStringList(obj.addAccessories),
            removeAccessories: toStringList(obj.removeAccessories),
          };
          try {
            await patchGoteCharacterState({ chatId: selectedChatId, targetUid: uid, ops });
          } catch {
            // ignore state apply errors
          }
        }
      }

      let narratorText = "The Narrator advances the scene…";
      if (parsed && typeof parsed.narratorMessage === "string" && parsed.narratorMessage.trim()) {
        narratorText = parsed.narratorMessage.trim();
      } else if (typeof content === "string" && content.trim()) {
        narratorText = content.trim();
      }

      // Post narrator message as a special sender
      try {
        await sendGoteChatMessage({
          chatId: selectedChatId,
          senderId: "_narrator",
          text: narratorText,
        });
      } catch {
        // ignore
      }
    } finally {
      setAiBusy(false);
    }
  };

  // Persistence helpers for profile fields
  const saveSelfProfile = async (patch: Partial<{ displayName: string; avatarUrl: string; charInfo: string; position: PositionType; role: RoleType }>) => {
    if (!user || !selectedChatId || !chatReady) return;
    try {
      await setDoc(doc(db, "goteChats", selectedChatId, "profiles", user.uid), patch as Record<string, unknown>, { merge: true });
    } catch {
      // ignore until rules deployed client-side; should pass once /profiles rules are active
    }
  };


  // Gates
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-sm text-white/70">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-2xl font-semibold">BigGote</h1>
          <p className="text-white/70">Please sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded-md bg-white text-black hover:bg-white/90 active:scale-[.98] transition"
            title="Login with Google"
          >
            Login with Google
          </button>
          <Link
            href="/"
            className="text-sm text-white/80 hover:underline active:opacity-80 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const allowed = Boolean(permissions?.gote) || linkCheck === "has";
  const isCheckingLinkedAccess =
    !!user && !permissions?.gote && (linkCheck === "idle" || linkCheck === "checking");

  if (isCheckingLinkedAccess) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Preparing access…</h1>
          <p className="text-white/70">Checking your BigGote link.</p>
          <Link
            href="/"
            className="text-sm text-white/80 hover:underline active:opacity-80 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-white/70">You do not have access to BigGote.</p>
          <Link
            href="/"
            className="text-sm text-white/80 hover:underline active:opacity-80 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Main
  return (
    <div className={cx("min-h-screen bg-black text-white", dragging && "select-none")}>
      <div className="h-[calc(100vh-64px)] flex"> 
        {/* Left: Chat Browser */}
        <aside style={{ width: leftW }} className="shrink-0 border-r border-white/15 bg-white/[0.03] h-full flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Chats</h2>
              <button
                onClick={() => setNewOpen(true)}
                title="Open New Chat dialog"
                className="px-2.5 py-1.5 rounded-md border border-white/20 text-sm text-white/80 hover:bg-white/[0.06]"
              >
                + New
              </button>
            </div>
            <div className="mt-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 placeholder:text-white/40"
                aria-label="Search chats"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredChats.map((c) => {
              const active = c.chatId === selectedChatId;
              return (
                <button
                  key={c.chatId}
                  onClick={() => setSelectedChatId(c.chatId)}
                  className={cx(
                    "w-full text-left rounded-md border px-3 py-2 transition",
                    active
                      ? "border-white/40 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                  )}
                  title={`Open ${c.title}`}
                >
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-[11px] text-white/50">
                    {c.lastMessageAt ? c.lastMessageAt.toLocaleString() : "—"}
                  </div>
                </button>
              );
            })}
            {filteredChats.length === 0 && (
              <div className="text-sm text-white/50 px-2">No chats yet.</div>
            )}
          </div>
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDownResizer("left")}
          onTouchStart={onTouchStartResizer("left")}
          className="w-1 shrink-0 cursor-col-resize bg-white/10 hover:bg-white/20 active:bg-white/30"
          title="Drag to resize"
        />
        {/* Middle: Chat Window */}
        <main className="flex-1 min-w-0 h-full flex flex-col">
          <div className="p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <div className="text-xs text-white/60">Chat</div>
                <div className="font-medium">
                  {filteredChats.find((c) => c.chatId === selectedChatId)?.title || "Select a chat"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInviteOpen((v) => !v)}
                  className="px-2.5 py-1.5 rounded-md border border-white/20 text-sm text-white/80 hover:bg-white/[0.06]"
                  title={inviteOpen ? "Hide invite tools" : "Generate invite link"}
                >
                  Invite
                </button>
              </div>
            </div>
          </div>

          {inviteOpen && (
            <div className="border-b border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Invite a partner</div>
                <button
                  onClick={() => setInviteOpen(false)}
                  className="px-2 py-1 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!user || inviteBusy) return;
                    setInviteBusy(true);
                    setInviteError(null);
                    setInviteUrl(null);
                    try {
                      const res = await createGoteInvite({ ownerId: user.uid });
                      setInviteUrl(res.url);
                    } catch {
                      setInviteError("Failed to create invite");
                    } finally {
                      setInviteBusy(false);
                    }
                  }}
                  disabled={inviteBusy}
                  className="px-3 py-1.5 rounded-md bg-white text-black text-xs disabled:opacity-60"
                  title="Generate invite link"
                >
                  {inviteBusy ? "Generating…" : "Generate Link"}
                </button>
                {inviteUrl ? (
                  <>
                    <input
                      readOnly
                      value={inviteUrl}
                      className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-xs"
                    />
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); } catch {} }}
                      className="px-3 py-2 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
                      title="Copy link"
                    >
                      Copy
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-white/60">Create a single‑use link to start a chat.</div>
                )}
              </div>
              {inviteError && <div className="mt-2 text-xs text-rose-400">{inviteError}</div>}
            </div>
          )}

          {scene && scene.trim() ? (
            <div className="border-b border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-white/60 mb-1">Scene</div>
              <div className="prose prose-invert max-w-none text-sm">
                <MarkdownView text={scene} />
              </div>
            </div>
          ) : null}

          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => {
              const who = m.senderId === "_narrator" ? "Narrator" : (m.senderId === user?.uid ? "You" : "Partner");
              return (
                <div
                  key={m.id}
                  className={cx(
                    "rounded-md border px-3 py-2",
                    m.senderId === "_narrator"
                      ? "border-white/20 bg-white/[0.03]"
                      : m.senderId === user?.uid
                        ? "border-white/30 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                    <div>{who}</div>
                    <div>{m.createdAt ? m.createdAt.toLocaleString() : ""}</div>
                  </div>
                  <div className="prose prose-invert max-w-none text-sm">
                    <MarkdownView text={m.text} />
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="text-sm text-white/50">No messages yet.</div>
            )}
          </div>

          <form onSubmit={onSend} className="border-t border-white/10 p-3 bg-white/[0.02]">
            <div className="flex items-start gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={chatReady ? "Type a message…" : "Available after invite acceptance"}
                disabled={!chatReady || !selectedChatId}
                className="flex-1 min-h-16 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 placeholder:text-white/40 disabled:opacity-60"
              />
              <div className="flex flex-col items-stretch gap-2">
                <button
                  type="submit"
                  disabled={!chatReady || !selectedChatId || !text.trim()}
                  className="px-3 py-2 rounded-md bg-white text-black text-sm disabled:opacity-60"
                  title="Send message"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={handleFinishTurn}
                  disabled={!aiDndEnabled || aiBusy || !chatReady || !selectedChatId}
                  className="px-3 py-2 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs disabled:opacity-50"
                  title={aiDndEnabled ? "Finish Turn (AI Narrator)" : "Enable AI DnD Mode on this chat to use"}
                >
                  {aiBusy ? "Working…" : "Finish Turn"}
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-white/60">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-white"
                  checked={preview}
                  onChange={(e) => setPreview(e.target.checked)}
                />
                Preview
              </label>
              {!aiDndEnabled && <span>AI DnD Mode is off for this chat.</span>}
            </div>
            {preview && text.trim() && (
              <div className="mt-2 rounded-md border border-white/15 bg-black/40 p-3">
                <MarkdownView text={text} />
              </div>
            )}
          </form>
        </main>
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDownResizer("right")}
          onTouchStart={onTouchStartResizer("right")}
          className="w-1 shrink-0 cursor-col-resize bg-white/10 hover:bg-white/20 active:bg-white/30"
          title="Drag to resize"
        />
        <aside style={{ width: rightW }} className="shrink-0 border-l border-white/15 bg-white/[0.03] h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Characters (read-only) */}
            <section className="rounded-lg border border-white/15 bg-white/[0.02]">
              <div className="p-3 border-b border-white/10 font-medium">Characters</div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* You */}
                <div className="rounded-md border border-white/15 bg-black/30 p-3">
                  <div className="text-xs text-white/60 mb-1">You</div>
                  {charProfileA ? (
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">{charProfileA.name || "—"}</div>
                      <div className="grid grid-cols-2 gap-x-3">
                        <div className="text-white/60">Height</div><div>{charProfileA.height || "—"}</div>
                        <div className="text-white/60">Weight</div><div>{charProfileA.weight || "—"}</div>
                        <div className="text-white/60">Build</div><div>{charProfileA.build}</div>
                        {charProfileA.dickFlaccid ? (<><div className="text-white/60">Flaccid</div><div>{charProfileA.dickFlaccid}</div></>) : null}
                        {charProfileA.dickErect ? (<><div className="text-white/60">Erect</div><div>{charProfileA.dickErect}</div></>) : null}
                      </div>
                      {charProfileA.weaknesses ? (
                        <div><div className="text-white/60 text-xs">Weaknesses</div><div>{charProfileA.weaknesses}</div></div>
                      ) : null}
                      {Array.isArray(charProfileA.kinks) && charProfileA.kinks.length > 0 ? (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Kinks</div>
                          <div className="flex flex-wrap gap-1">
                            {charProfileA.kinks.map((k) => (
                              <span key={k} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{k}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="pt-2 grid grid-cols-1 gap-2">
                        <LevelBar label="Hunger" levels={GOTE_HUNGER_LEVELS} value={charStateA?.hunger} />
                        <LevelBar label="Thirst" levels={GOTE_THIRST_LEVELS} value={charStateA?.thirst} />
                        <LevelBar label="Oxygen" levels={GOTE_OXYGEN_LEVELS} value={charStateA?.oxygen} />
                      </div>
                      {Array.isArray(charStateA?.statusTags) && charStateA!.statusTags!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Status</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateA!.statusTags!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(charStateA?.clothing) && charStateA!.clothing!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Clothing</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateA!.clothing!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(charStateA?.accessories) && charStateA!.accessories!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Accessories</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateA!.accessories!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-white/60">No profile set up yet.</div>
                  )}
                </div>

                {/* Partner */}
                <div className="rounded-md border border-white/15 bg-black/30 p-3">
                  <div className="text-xs text-white/60 mb-1">Partner</div>
                  {charProfileB ? (
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">{charProfileB.name || "—"}</div>
                      <div className="grid grid-cols-2 gap-x-3">
                        <div className="text-white/60">Height</div><div>{charProfileB.height || "—"}</div>
                        <div className="text-white/60">Weight</div><div>{charProfileB.weight || "—"}</div>
                        <div className="text-white/60">Build</div><div>{charProfileB.build}</div>
                        {charProfileB.dickFlaccid ? (<><div className="text-white/60">Flaccid</div><div>{charProfileB.dickFlaccid}</div></>) : null}
                        {charProfileB.dickErect ? (<><div className="text-white/60">Erect</div><div>{charProfileB.dickErect}</div></>) : null}
                      </div>
                      {charProfileB.weaknesses ? (
                        <div><div className="text-white/60 text-xs">Weaknesses</div><div>{charProfileB.weaknesses}</div></div>
                      ) : null}
                      {Array.isArray(charProfileB.kinks) && charProfileB.kinks.length > 0 ? (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Kinks</div>
                          <div className="flex flex-wrap gap-1">
                            {charProfileB.kinks.map((k) => (
                              <span key={k} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{k}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="pt-2 grid grid-cols-1 gap-2">
                        <LevelBar label="Hunger" levels={GOTE_HUNGER_LEVELS} value={charStateB?.hunger} />
                        <LevelBar label="Thirst" levels={GOTE_THIRST_LEVELS} value={charStateB?.thirst} />
                        <LevelBar label="Oxygen" levels={GOTE_OXYGEN_LEVELS} value={charStateB?.oxygen} />
                      </div>
                      {Array.isArray(charStateB?.statusTags) && charStateB!.statusTags!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Status</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateB!.statusTags!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(charStateB?.clothing) && charStateB!.clothing!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Clothing</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateB!.clothing!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(charStateB?.accessories) && charStateB!.accessories!.length > 0 && (
                        <div>
                          <div className="text-white/60 text-xs mb-1">Accessories</div>
                          <div className="flex flex-wrap gap-1">
                            {charStateB!.accessories!.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md border border-white/15 text-[11px]">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-white/60">Waiting for partner setup.</div>
                  )}
                </div>

              </div>
            </section>

            {/* Shared Pin */}
            <section className="rounded-lg border border-white/15 bg-white/[0.02]">
              <div className="p-3 border-b border-white/10 font-medium">Shared Pin</div>
              <div className="p-3 space-y-2">
                <textarea
                  value={sharedPin}
                  onChange={(e) => setSharedPin(e.target.value)}
                  onBlur={async () => {
                    if (selectedChatId && chatReady) {
                      try { await setDoc(doc(db, "goteChats", selectedChatId), { sharedPin }, { merge: true }); } catch {}
                    }
                  }}
                  placeholder={chatReady ? "Add a shared pin or notes for both participants…" : "Available after invite acceptance"}
                  disabled={!chatReady}
                  className="w-full min-h-20 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 placeholder:text-white/40 disabled:opacity-60"
                />
                <div className="text-xs text-white/50">
                  Visible to both participants in this chat.
                </div>
              </div>
            </section>

            {/* Narrator Rules */}
            <section className="rounded-lg border border-white/15 bg-white/[0.02]">
              <div className="p-3 border-b border-white/10 font-medium">Narrator Rules</div>
              <div className="p-3 space-y-2">
                <textarea
                  value={aiBehavior}
                  onChange={(e) => setAiBehavior(e.target.value)}
                  onBlur={async () => {
                    if (selectedChatId && chatReady) {
                      try { await setDoc(doc(db, "goteChats", selectedChatId), { aiBehavior }, { merge: true }); } catch {}
                    }
                  }}
                  placeholder={chatReady ? "Guidelines for the Narrator’s behavior… e.g. Don’t readily change character info; narrate environment, weather, scene; avoid controlling players directly." : "Available after invite acceptance"}
                  disabled={!chatReady}
                  className="w-full min-h-24 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 placeholder:text-white/40 disabled:opacity-60"
                />
                <div className="text-xs text-white/50">
                  Used to steer the AI Narrator on Finish Turn. Stored per chat.
                </div>
              </div>
            </section>

          </div>
        </aside>
      </div>

      {charSetupOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-black/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-medium">Character Setup</div>
              <button
                onClick={() => setCharSetupOpen(false)}
                className="px-2 py-1 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Name</label>
                  <input
                    value={charDraft.name}
                    onChange={(e) => setCharDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Character name"
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Build</label>
                  <select
                    value={charDraft.build}
                    onChange={(e) => setCharDraft((d) => ({ ...d, build: e.target.value }))}
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm"
                  >
                    {GOTE_BUILD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Height</label>
                  <input
                    value={charDraft.height}
                    onChange={(e) => setCharDraft((d) => ({ ...d, height: e.target.value }))}
                    placeholder={'e.g., 6\'1" or 185 cm'}
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Weight</label>
                  <input
                    value={charDraft.weight}
                    onChange={(e) => setCharDraft((d) => ({ ...d, weight: e.target.value }))}
                    placeholder="e.g., 180 lbs or 82 kg"
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Dick (Flaccid)</label>
                  <input
                    value={charDraft.dickFlaccid}
                    onChange={(e) => setCharDraft((d) => ({ ...d, dickFlaccid: e.target.value }))}
                    placeholder="optional, e.g., 3.5 in"
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Dick (Erect)</label>
                  <input
                    value={charDraft.dickErect}
                    onChange={(e) => setCharDraft((d) => ({ ...d, dickErect: e.target.value }))}
                    placeholder="optional, e.g., 6.5 in"
                    className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Weaknesses</label>
                <input
                  value={charDraft.weaknesses}
                  onChange={(e) => setCharDraft((d) => ({ ...d, weaknesses: e.target.value }))}
                  placeholder="optional, e.g., Musk"
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Kinks (comma or newline separated)</label>
                <textarea
                  value={charDraft.kinksText}
                  onChange={(e) => setCharDraft((d) => ({ ...d, kinksText: e.target.value }))}
                  placeholder="e.g., Bondage, Breath play"
                  className="w-full min-h-20 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCharSetupOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
                >
                  Later
                </button>
                <button
                  onClick={async () => {
                    if (!user || !selectedChatId || !charDraft.name.trim() || !charDraft.height.trim() || !charDraft.weight.trim()) return;
                    setCharSaving(true);
                    try {
                      const k = charDraft.kinksText.split(/,|\r?\n/g).map((s) => s.trim()).filter(Boolean);
                      await setGoteCharacterProfile({
                        chatId: selectedChatId,
                        uid: user.uid,
                        profile: {
                          name: charDraft.name.trim(),
                          height: charDraft.height.trim(),
                          weight: charDraft.weight.trim(),
                          dickFlaccid: charDraft.dickFlaccid.trim() ? charDraft.dickFlaccid.trim() : null,
                          dickErect: charDraft.dickErect.trim() ? charDraft.dickErect.trim() : null,
                          build: (isGoteBuild(charDraft.build) ? charDraft.build : "Average"),
                          weaknesses: charDraft.weaknesses.trim() ? charDraft.weaknesses.trim() : null,
                          kinks: k,
                        },
                      });
                      setCharSetupOpen(false);
                    } catch {
                    } finally {
                      setCharSaving(false);
                    }
                  }}
                  disabled={charSaving || !charDraft.name.trim() || !charDraft.height.trim() || !charDraft.weight.trim()}
                  className="px-3 py-1.5 rounded-md bg-white text-black text-sm disabled:opacity-60"
                  title="Save character"
                >
                  {charSaving ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="text-[11px] text-white/50">
                Character Profiles are set during setup and remain immutable during play.
              </div>
            </div>
          </div>
        </div>
      )}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-black/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-medium">New Chat</div>
              <button
                onClick={() => setNewOpen(false)}
                className="px-2 py-1 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Chat name</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title for this chat"
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Scene (short description)</label>
                <textarea
                  value={newScene}
                  onChange={(e) => setNewScene(e.target.value)}
                  placeholder="Optional: Describe the opening scene…"
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                />
                <div className="text-xs text-white/50 mt-1">
                  Shown at the top of the chat and provided to the AI as context.
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  className="accent-white"
                  checked={newAi}
                  onChange={(e) => setNewAi(e.target.checked)}
                />
                Enable AI DnD Mode by default
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={newBusy || !newTitle.trim()}
                  onClick={async () => {
                    if (!user || newBusy || !newTitle.trim()) return;
                    setNewBusy(true);
                    setNewError(null);
                    setNewUrl(null);
                    try {
                      const res = await createGoteInvite({
                        ownerId: user.uid,
                        title: newTitle.trim(),
                        aiDndEnabled: newAi,
                        scene: newScene.trim() ? newScene.trim() : null,
                      });
                      setSelectedChatId(res.chatId);
                      setNewUrl(res.url);
                    } catch {
                      setNewError("Failed to create invite");
                    } finally {
                      setNewBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-md bg-white text-black text-sm disabled:opacity-60"
                  title="Generate invite link"
                >
                  {newBusy ? "Generating…" : "Generate Link"}
                </button>

                {newUrl ? (
                  <>
                    <input
                      readOnly
                      value={newUrl}
                      className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-xs"
                    />
                    <button
                      onClick={async () => { try { if (newUrl) await navigator.clipboard.writeText(newUrl); } catch {} }}
                      className="px-3 py-2 rounded-md border border-white/15 hover:bg-white/[0.06] text-xs"
                      title="Copy link"
                    >
                      Copy
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-white/60">
                    Set a name, optionally enable AI, then generate a single‑use link.
                  </div>
                )}
              </div>

              {newError && <div className="text-xs text-rose-400">{newError}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}