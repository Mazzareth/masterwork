"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { where } from "firebase/firestore";
import {
  createInvite,
  ensureOwnerMirrorsForUsedInvite,
  revokeInvite,
  unlinkLinkedUser,
  sendChatMessage,
  sendChatUpdate,
  type InviteDoc,
  type ClientLink,
} from "../../lib/linking";
import { ensurePushPermissionAndToken, disablePushForThisDevice, getCurrentFcmTokenIfSupported } from "../../lib/notifications";
import { reserveCommissionSlug, ensureOwnerCommissionClient } from "@/lib/commission";

type Client = {
  id: string;
  displayName: string;
  username?: string | null;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
  notificationsEnabled?: boolean | undefined;
};

type Project = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  completion: number;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
};

type Note = {
  id: string;
  text: string;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
};

type ClientDoc = Omit<Client, "id">;
type ProjectDoc = Omit<Project, "id">;
type NoteDoc = Omit<Note, "id">;

const cx = (...cls: (string | false | null | undefined)[]) =>
  cls.filter(Boolean).join(" ");

function parseNameUsername(raw: string) {
  const match = raw.match(/(?:^|[\s,])@([A-Za-z0-9._-]{2,32})\b/);
  const username = match ? `@${match[1]}` : null;
  const displayName = raw.replace(/\s*@([A-Za-z0-9._-]{2,32})\b/g, "").trim();
  return { displayName, username };
}

// Debounce hook for snappier inputs without re-render thrash
function useDebounced<T>(value: T, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Lightweight skeleton shimmer
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

// Status chip for projects
function StatusBadge({ status }: { status: Project["status"] }) {
  const label =
    status === "in_progress"
      ? "In Progress"
      : status[0].toUpperCase() + status.slice(1);
  const cls =
    status === "completed"
      ? "from-emerald-500/80 to-emerald-400/60 text-emerald-100"
      : status === "in_progress"
      ? "from-cyan-500/80 to-fuchsia-500/60 text-cyan-100"
      : "from-slate-600/80 to-slate-500/60 text-slate-200";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        "bg-gradient-to-r",
        cls,
        "ring-1 ring-white/10"
      )}
    >
      {label}
    </span>
  );
}

export default function ZZQPage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();
  const ownerUid = user?.uid ?? null;
  // Unified ghost button style for Client header actions
  const headerBtnBase =
    "px-3 py-1.5 rounded-md border text-xs md:text-sm transition hover:bg-white/[0.06] active:scale-[.98] focus-visible:ring-2 focus-visible:ring-cyan-400/60";

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 150);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "recent">("name");

  // Selection
  const [selected, setSelected] = useState<Client | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);

  // Client composer (promptless inline flow)
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const composeInputRef = useRef<HTMLInputElement | null>(null);
  const [flashClientId, setFlashClientId] = useState<string | null>(null);
  // Inline client editing/deletion
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const parsedClient = useMemo(() => parseNameUsername(composeText || ""), [composeText]);

  // Project composer (inside Client View)
  const [projectComposeOpen, setProjectComposeOpen] = useState(false);
  const [projectComposeText, setProjectComposeText] = useState("");
  const projectComposeInputRef = useRef<HTMLInputElement | null>(null);
  const [flashProjectId, setFlashProjectId] = useState<string | null>(null);

  // Linking/invite UI
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  type InviteItem = {
    token: string;
    status: "active" | "expired" | "used" | "revoked";
    expiresAt?: Timestamp | null;
    usedBy?: string | null;
    usedAt?: Timestamp | null;
    createdAt?: Timestamp | null;
  };
  const [invitesForClient, setInvitesForClient] = useState<InviteItem[]>([]);
  type LinkItem = {
    linkId: string;
    userId: string;
    createdAt?: Timestamp | null;
  };
  const [linksForClient, setLinksForClient] = useState<LinkItem[]>([]);

  // Client chat (owner ↔ linked user) state
  type ChatMsg = { id: string; senderId: string; text: string; createdAt?: Timestamp | undefined };
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const ensuredCommissionClientsRef = useRef<Set<string>>(new Set());

  // AI: ZZQ (DeepSeek) slide-up chat state
  type AIMessage = { role: "system" | "user" | "assistant" | string; content: string };
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      role: "system",
      content:
        "You are ZZQ — an assistant for the artist. You have access to the owner's clients and commission projects provided as context. Answer concisely and reference client/project ids when helpful.",
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiListRef = useRef<HTMLDivElement | null>(null);

  const buildAiContextSystemMessage = () => {
    // Build a concise context string with clients and known projects (selected client projects are included)
    const lines: string[] = [];
    lines.push(`Owner uid: ${user?.uid ?? "unknown"}`);
    lines.push("");
    lines.push("Clients:");
    if (clients.length === 0) {
      lines.push("- (no clients)");
    } else {
      clients.forEach((c) => {
        lines.push(`- ${c.displayName}${c.username ? ` (${c.username})` : ""} [id:${c.id}]`);
      });
    }
    lines.push("");
    if (selected) {
      lines.push(`Projects for selected client (${selected.displayName}):`);
      if (projects.length === 0) {
        lines.push("- (no projects)");
      } else {
        projects.forEach((p) => {
          lines.push(`- ${p.title} [id:${p.id}] status:${p.status} completion:${Math.round(p.completion ?? 0)}%`);
        });
      }
    } else {
      lines.push("No client selected; project details not included.");
    }
    lines.push("");
    lines.push("When answering, be helpful and reference the relevant client/project when appropriate.");
    return { role: "system", content: lines.join("\n") } as AIMessage;
  };

  const handleAiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = aiInput.trim();
    if (!q || aiLoading) return;
    const userMsg: AIMessage = { role: "user", content: q };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);
    try {
      const sys = buildAiContextSystemMessage();
      const sendMessages = [
        sys,
        ...aiMessages.map((m) => ({ role: m.role as string, content: m.content })),
        userMsg,
      ];
      const res = await fetch("/api/deepseek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-chat", messages: sendMessages, stream: false }),
      });
      const json = await res.json().catch(() => null);
      let reply = "";
      if (json && json.choices && Array.isArray(json.choices) && json.choices[0]?.message?.content) {
        reply = json.choices[0].message.content;
      } else if (json && typeof json.output === "string") {
        reply = json.output;
      } else if (json && json.data && json.data[0] && json.data[0].text) {
        reply = json.data[0].text;
      } else if (typeof json === "string") {
        reply = json;
      } else {
        reply = "Sorry, I couldn't get a response from DeepSeek.";
      }
      const assistantMsg: AIMessage = { role: "assistant", content: reply };
      setAiMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => {
        const el = aiListRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", content: "Error: failed to reach DeepSeek." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Projects

  // Owner-wide chat summaries (for notifications)
  type OwnerChatSummary = {
    chatId: string;
    userId: string;
    clientId: string;
    clientDisplayName: string;
    lastMessageAt?: Timestamp | null;
    lastReadAt?: Timestamp | null;
  };
  const [ownerChats, setOwnerChats] = useState<OwnerChatSummary[]>([]);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Push notifications (device-level toggle)
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Artist Settings (Commission link)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSlug, setSettingsSlug] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  
  const togglePush = async () => {
    if (!user || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushForThisDevice(user.uid);
        setPushEnabled(false);
      } else {
        const t = await ensurePushPermissionAndToken(user.uid);
        setPushEnabled(Boolean(t));
      }
    } finally {
      setPushBusy(false);
    }
  };


  // Project panel: derive open state from selectedProjectId AND projectLive
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectLive, setProjectLive] = useState<Project | null>(null);
  const projectPaneOpen = selectedProjectId != null && projectLive != null;

  // Inline notes (per project)
  const [projectNotes, setProjectNotes] = useState<Record<string, Note[]>>({});
  // Inline note editing state for Commission panel
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // UI focus/keyboard
  const clientCloseRef = useRef<HTMLButtonElement | null>(null);
  const projectCloseRef = useRef<HTMLButtonElement | null>(null);

  // Jump-to-note behavior when selecting from aggregated list
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);
  const [scrollTargetNoteId, setScrollTargetNoteId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (paneOpen) setTimeout(() => clientCloseRef.current?.focus(), 0);
  }, [paneOpen]);
  useEffect(() => {
    if (projectPaneOpen) setTimeout(() => projectCloseRef.current?.focus(), 0);
  }, [projectPaneOpen]);
  useEffect(() => {
    if (composeOpen) setTimeout(() => composeInputRef.current?.focus(), 0);
  }, [composeOpen]);
  useEffect(() => {
    if (projectComposeOpen)
      setTimeout(() => projectComposeInputRef.current?.focus(), 0);
  }, [projectComposeOpen]);
  // Extra helpers for right-click context menu flows
const renameProject = async (p: Project) => {
  if (!user || !selected) return;
  const next = prompt("Rename project", p.title);
  if (next == null) return; // cancel
  const title = next.trim();
  if (!title || title === p.title) return;

  // Optimistic UI
  setProjects((prev) => prev.map((it) => (it.id === p.id ? { ...it, title } : it)));
  setProjectLive((prev) => (prev && prev.id === p.id ? { ...prev, title } : prev));

  const ref = doc(
    db,
    "users",
    user.uid,
    "sites",
    "zzq",
    "clients",
    selected.id,
    "projects",
    p.id
  );
  await updateDoc(ref, { title, updatedAt: serverTimestamp() });
  await pushCommissionProjection();
};

const toggleNotificationsForSelectedClient = async () => {
  if (!user || !selected) return;
  const next = !Boolean(selected.notificationsEnabled);
  // Optimistic UI
  setSelected((prev) => (prev ? { ...prev, notificationsEnabled: next } : prev));
  setClients((prev) =>
    prev.map((it) => (it.id === selected.id ? { ...it, notificationsEnabled: next } : it))
  );
  const ref = doc(
    db,
    "users",
    user.uid,
    "sites",
    "zzq",
    "clients",
    selected.id
  );
  await updateDoc(ref, { notificationsEnabled: next, updatedAt: serverTimestamp() });
};

const editNoteViaPrompt = async (projectId: string, noteId: string, currentText: string) => {
  if (!user || !selected) return;
  const next = prompt("Edit note", currentText ?? "");
  if (next == null) return; // cancel
  await updateProjectNoteText(projectId, noteId, next);
};

// Rendered overlay for context menus (opened via onContextMenu handlers)
function ContextMenuOverlay() {
  if (!menu.open) return null;
  if (typeof document === "undefined") return null;

  // Actions
  const doOpenClient = () => {
    if (menu.client) {
      setSelectedProjectId(null);
      setSelected(menu.client);
      setPaneOpen(true);
    }
    closeContextMenu();
  };
  const doEditClient = () => {
    if (menu.client) startEditClient(menu.client);
    closeContextMenu();
  };
  const doDeleteClient = () => {
    if (menu.client) void requestDeleteClient(menu.client);
    closeContextMenu();
  };

  const doOpenProject = () => {
    if (menu.project) openProject(menu.project);
    closeContextMenu();
  };
  const doRenameProject = () => {
    if (menu.project) void renameProject(menu.project);
    closeContextMenu();
  };
  const doDeleteProject = () => {
    if (menu.project) void requestDeleteProject(menu.project);
    closeContextMenu();
  };

  const noteProjectId = menu.projectIdForNote ?? menu.note?.projectId ?? null;
  const doOpenNote = () => {
    if (menu.note && noteProjectId) {
      openProjectByIdAndFocusNote(noteProjectId, menu.note.id);
    }
    closeContextMenu();
  };
  const doEditNote = () => {
    if (menu.note && noteProjectId) {
      void editNoteViaPrompt(noteProjectId, menu.note.id, menu.note.text ?? "");
    }
    closeContextMenu();
  };
  const doDeleteNote = () => {
    if (menu.note && noteProjectId) {
      void requestDeleteNote(noteProjectId, menu.note.id);
    }
    closeContextMenu();
  };

  // Styles
  const itemCls =
    "w-full text-left px-3 py-2 text-sm hover:bg-white/10 focus:bg-white/10 outline-none";

  const node = (
    <div
      id="zzq-context-menu"
      className="fixed z-50"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => {
        // Prevent nested menus from re-opening native context menu
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="min-w-[220px] rounded-lg border border-white/15 bg-[#0b1020]/95 shadow-xl backdrop-blur-md text-slate-200">
        <ul className="py-1">
          {menu.kind === "client" && menu.client && (
            <>
              <li>
                <button className={itemCls} onClick={doOpenClient}>
                  Open
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doEditClient}>
                  Edit
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doDeleteClient}>
                  Delete
                </button>
              </li>
            </>
          )}
          {menu.kind === "project" && menu.project && (
            <>
              <li>
                <button className={itemCls} onClick={doOpenProject}>
                  Open
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doRenameProject}>
                  Rename
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doDeleteProject}>
                  Delete
                </button>
              </li>
            </>
          )}
          {menu.kind === "note" && menu.note && (
            <>
              <li>
                <button className={itemCls} onClick={doOpenNote}>
                  Open note
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doEditNote}>
                  Edit note
                </button>
              </li>
              <li>
                <button className={itemCls} onClick={doDeleteNote}>
                  Delete note
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
  return createPortal(node, document.body);
};
// Context menu: types, state, helpers
type MenuKind = "client" | "project" | "note";
type MenuState = {
  open: boolean;
  x: number;
  y: number;
  kind: MenuKind;
  client?: Client;
  project?: Project;
  note?: { id: string; text?: string; projectId?: string };
  // For notes rendered in multiple contexts, ensure we know which project it belongs to
  projectIdForNote?: string;
};

const [menu, setMenu] = useState<MenuState>({
  open: false,
  x: 0,
  y: 0,
  kind: "client",
});

function openContextMenu(
  e: React.MouseEvent,
  payload: Omit<MenuState, "open" | "x" | "y">
) {
  e.preventDefault();
  e.stopPropagation();
  // Estimate menu size to clamp within viewport
  const count = 3; // All menu types currently render 3 items (Open, Edit/Rename, Delete)
  const estW = 220;
  const itemH = 34;
  const estH = 10 + count * itemH;
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let x = e.clientX;
  let y = e.clientY;
  if (x + estW + pad > vw) x = Math.max(pad, vw - estW - pad);
  if (y + estH + pad > vh) y = Math.max(pad, vh - estH - pad);
  setMenu({ ...payload, open: true, x, y });
}

function closeContextMenu() {
  setMenu((m) => (m.open ? { ...m, open: false } : m));
}

// Global listeners to dismiss menu
useEffect(() => {
  if (!menu.open) return;
  const onDown = (e: MouseEvent) => {
    const el = document.getElementById("zzq-context-menu");
    if (el && el.contains(e.target as Node)) return; // click inside menu → don't close yet
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

// Project deletion (notes cascade)
const deleteProjectCascade = async (projectId: string) => {
  if (!user || !selected) return;
  const base = [
    "users",
    user.uid,
    "sites",
    "zzq",
    "clients",
    selected.id,
    "projects",
    projectId,
  ] as const;

  // Batch delete notes then delete project doc
  let batch = writeBatch(db);
  let count = 0;
  const commit = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  const notesSnap = await getDocs(collection(db, ...base, "notes"));
  notesSnap.forEach((n) => {
    batch.delete(n.ref);
    count++;
  });
  await commit();

  await deleteDoc(doc(db, ...base));
};

const requestDeleteProject = async (p: Project) => {
  const ok = window.confirm(
    `Delete project "${p.title}" and all notes? This cannot be undone.`
  );
  if (!ok) return;

  // Optimistic UI
  setProjects((prev) => prev.filter((it) => it.id !== p.id));
  setProjectNotes((prev) => {
    const next = { ...prev };
    delete next[p.id];
    return next;
  });
  if (selectedProjectId === p.id) {
    setSelectedProjectId(null);
    setProjectLive(null);
  }

  try {
    await deleteProjectCascade(p.id);
    await pushCommissionProjection();
  } finally {
    // no-op; live listeners will reconcile if needed
  }
};

// Note deletion
const deleteProjectNote = async (projectId: string, noteId: string) => {
  if (!user || !selected) return;
  await deleteDoc(
    doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      projectId,
      "notes",
      noteId
    )
  );
};

const requestDeleteNote = async (projectId: string, noteId: string) => {
  const ok = window.confirm("Delete this note? This cannot be undone.");
  if (!ok) return;

  // Optimistic UI
  setProjectNotes((prev) => ({
    ...prev,
    [projectId]: (prev[projectId] ?? []).filter((n) => n.id !== noteId),
  }));

  try {
    await deleteProjectNote(projectId, noteId);
  } finally {
    // no-op
  }
};
  // Keyboard UX:
  // - Ctrl/Cmd+K: focus search
  // - Ctrl/Cmd+N: open Client Quick Add
  // - Ctrl/Cmd+Shift+N: open Project Quick Add (when a client is open)
  // - Ctrl/Cmd+Shift+M: open Project Note Quick Add (when a project is open)
  // - Esc: close composers (Note → Project → Client); or deselect Project/Client
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const k = e.key;
      const isModK = (k === "k" || k === "K") && isMod;
      const isModN = (k === "n" || k === "N") && isMod && !e.shiftKey;
      const isModShiftN = (k === "n" || k === "N") && isMod && e.shiftKey;
      const isModShiftM = (k === "m" || k === "M") && isMod && e.shiftKey;

      if (isModK) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (isModN) {
        e.preventDefault();
        setComposeOpen(true);
        setTimeout(() => composeInputRef.current?.focus(), 0);
        return;
      }
      if (isModShiftN && paneOpen && selected) {
        e.preventDefault();
        setProjectComposeOpen(true);
        setTimeout(() => projectComposeInputRef.current?.focus(), 0);
        return;
      }
      if (isModShiftM && selected && selectedProjectId) {
        e.preventDefault();
        void createAndEditCommissionNote();
        return;
      }
      if (e.key === "Escape") {
        if (projectComposeOpen) {
          setProjectComposeOpen(false);
          return;
        }
        if (composeOpen) {
          setComposeOpen(false);
          return;
        }
        if (projectPaneOpen) {
          setSelectedProjectId(null);
          return;
        }
        if (paneOpen) setPaneOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paneOpen, projectPaneOpen, composeOpen, projectComposeOpen, selected, selectedProjectId, projects, createAndEditCommissionNote]);

  // Live clients
  useEffect(() => {
    if (!user) return;
    setClientsLoading(true);
    const col = collection(db, "users", user.uid, "sites", "zzq", "clients");
    const unsub = onSnapshot(query(col, orderBy("displayName")), (snap) => {
      const arr: Client[] = [];
      snap.forEach((d) => {
        const data = d.data() as ClientDoc;
        arr.push({ id: d.id, ...data });
      });
      setClients(arr);
      setClientsLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Observe invites and ensure owner-side mirrors are created when an invite is used
  useEffect(() => {
    if (!user) return;
    const col = collection(db, "users", user.uid, "sites", "zzq", "invites");
    const unsub = onSnapshot(col, (snap) => {
      snap.forEach((d) => {
        const data = d.data() as Partial<InviteDoc>;
        if (data?.status === "used" && data?.usedBy && data.clientId) {
          const ownerIdVal = data.ownerId ?? user.uid;
          const clientRefVal =
            data.clientRef ?? `/users/${ownerIdVal}/sites/zzq/clients/${data.clientId}`;
          const full: InviteDoc = {
            token: data.token ?? d.id,
            ownerId: ownerIdVal,
            clientId: data.clientId,
            clientRef: clientRefVal,
            clientDisplayName: data.clientDisplayName ?? "Client",
            createdAt: data.createdAt,
            expiresAt: data.expiresAt ?? null,
            usedAt: data.usedAt ?? null,
            usedBy: data.usedBy,
            status: data.status,
          };
          try {
            ensureOwnerMirrorsForUsedInvite(full);
          } catch {
            // best-effort; mirrors are idempotent
          }
        }
      });
    });
    return () => unsub();
  }, [user]);

  // Live list of invites for the selected client
  useEffect(() => {
    if (!user || !selected) {
      setInvitesForClient([]);
      return;
    }
    const invCol = collection(db, "users", user.uid, "sites", "zzq", "invites");
    const qInv = query(invCol, where("clientId", "==", selected.id));
    const unsub = onSnapshot(qInv, (snap) => {
      const arr: InviteItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<InviteDoc>;
        arr.push({
          token: data.token || d.id,
          status: data.status ?? "active",
          expiresAt: data.expiresAt ?? null,
          usedBy: data.usedBy ?? null,
          usedAt: data.usedAt ?? null,
          createdAt: data.createdAt ?? null,
        });
      });
      // show most recent first
      arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setInvitesForClient(arr);
    });
    return () => unsub();
  }, [user, selected]);

  // Subscribe to owner's per-user chat summaries for notifications panel
  useEffect(() => {
    if (!user) {
      setOwnerChats([]);
      setNotifError(null);
      return;
    }
    const col = collection(db, "users", user.uid, "sites", "cc", "chats");
    const qy = query(col, orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr: OwnerChatSummary[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<OwnerChatSummary> & { clientDisplayName?: string; clientId?: string; userId?: string };
          arr.push({
            chatId: d.id,
            userId: data.userId ?? "",
            clientId: data.clientId ?? "",
            clientDisplayName: data.clientDisplayName ?? "Client",
            lastMessageAt: data.lastMessageAt ?? null,
            lastReadAt: data.lastReadAt ?? null,
          });
        });
        setOwnerChats(arr);
        setNotifError(null);
      },
      (err) => {
        // Likely Firestore rules missing 'list' on /users/{ownerId}/sites/cc/chats
        console.error(
          "ZZQ notifications subscription error (owner cc chats). Check Firestore rules for 'list' on /users/{uid}/sites/cc/chats:",
          err
        );
        setOwnerChats([]);
        setNotifError("Notifications blocked by Firestore rules (list denied on /users/{uid}/sites/cc/chats).");
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    ensuredCommissionClientsRef.current = new Set();
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    if (ownerChats.length === 0) return;

    const ensure = async () => {
      for (const chat of ownerChats) {
        if (!chat.clientId || !chat.userId) continue;
        if (!chat.clientId.startsWith("u:")) continue;
        const key = `${chat.clientId}|${chat.userId}`;
        if (ensuredCommissionClientsRef.current.has(key)) continue;
        try {
          await ensureOwnerCommissionClient({
            ownerId: ownerUid,
            userId: chat.userId,
            clientId: chat.clientId,
            clientDisplayName: chat.clientDisplayName,
          });
          ensuredCommissionClientsRef.current.add(key);
        } catch (err) {
          console.error("ZZQ notifications ensure commission client failed:", err);
        }
      }
    };

    void ensure();
  }, [ownerUid, ownerChats]);

  // Live list of linked users for the selected client
  useEffect(() => {
    if (!user || !selected) {
      setLinksForClient([]);
      return;
    }
    const linksCol = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "links"
    );
    const unsub = onSnapshot(linksCol, (snap) => {
      const arr: LinkItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<ClientLink>;
        if (data.userId) {
          arr.push({
            linkId: data.linkId || d.id,
            userId: data.userId,
            createdAt: data.createdAt ?? null,
          });
        }
      });
      setLinksForClient(arr);
    });
    return () => unsub();
  }, [user, selected]);

  // Client chat messages subscription for the selected chat
  useEffect(() => {
    if (!user || !selectedChatId) {
      setChatMessages([]);
      return;
    }
    const col = collection(db, "chats", selectedChatId, "messages");
    const qy = query(col, orderBy("createdAt"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: ChatMsg[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<ChatMsg, "id">;
        arr.push({ id: d.id, ...data });
      });
      setChatMessages(arr);
      // autoscroll to latest
      setTimeout(() => {
        const el = chatListRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      // Mark messages as read for the owner on this chat
      if (user && selectedChatId) {
        void setDoc(
          doc(db, "users", user.uid, "sites", "cc", "chats", selectedChatId),
          { lastReadAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {
          // ignore
        });
      }
    });
    return () => unsub();
  }, [user, selectedChatId]);

  // Reset project panel when client changes
  useEffect(() => {
    setSelectedProjectId(null);
    setProjectLive(null);
  }, [selected?.id]);

  // Live projects for selected client
  useEffect(() => {
    if (!user || !selected) return;
    setProjectsLoading(true);
    const projCol = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects"
    );
    const unsub = onSnapshot(query(projCol, orderBy("createdAt")), (snap) => {
      const arr: Project[] = [];
      snap.forEach((d) => {
        const data = d.data() as ProjectDoc;
        arr.push({ id: d.id, ...data });
      });
      setProjects(arr);
      setProjectsLoading(false);
    });
    return () => unsub();
  }, [user, selected]);

  // Live subscribe to selected project
  useEffect(() => {
    if (!user || !selected || !selectedProjectId) return;
    const ref = doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      selectedProjectId
    );
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ProjectDoc;
        setProjectLive({ id: snap.id, ...data });
      } else {
        setProjectLive(null);
      }
    });
    return () => unsub();
  }, [user, selected, selectedProjectId]);

  // Per-project notes subscriptions + map
  useEffect(() => {
    if (!user || !selected) return;
    const unsubs: Array<() => void> = [];
    projects.forEach((p) => {
      const colRef = collection(
        db,
        "users",
        user.uid,
        "sites",
        "zzq",
        "clients",
        selected.id,
        "projects",
        p.id,
        "notes"
      );
      const unsub = onSnapshot(query(colRef, orderBy("createdAt", "desc")), (snap) => {
        const arr: Note[] = [];
        snap.forEach((d) => {
          const data = d.data() as NoteDoc;
          arr.push({ id: d.id, ...data });
        });
        setProjectNotes((prev) => ({ ...prev, [p.id]: arr }));
      });
      unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, selected, projects]);

  // After opening a project with a scroll target, scroll to the note and flash it
  useEffect(() => {
    if (!projectPaneOpen || !scrollTargetNoteId) return;
    const id = `note-${scrollTargetNoteId}`;
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashNoteId(scrollTargetNoteId);
      // clear flash after 1.2s
      setTimeout(() => setFlashNoteId((cur) => (cur === scrollTargetNoteId ? null : cur)), 1200);
      setScrollTargetNoteId(null);
    }, 350); // wait for panel transition
    return () => clearTimeout(t);
  }, [projectPaneOpen, scrollTargetNoteId]);

  // Memos

  const avgCompletion = useMemo(() => {
    if (projects.length === 0) return null;
    const sum = projects.reduce((acc, p) => acc + (p.completion ?? 0), 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  // Commission panel helpers (naturalized UI)
  const statusLabel = (s: Project["status"]) =>
    s === "in_progress" ? "In Progress" : s[0].toUpperCase() + s.slice(1);

  const cycleStatus = () => {
    if (!projectLive) return;
    const order: Project["status"][] = ["pending", "in_progress", "completed"];
    const idx = order.indexOf(projectLive.status);
    const next = order[(idx + 1) % order.length];
    void updateProject({ status: next });
  };

  const cycleCompletion = () => {
    if (!projectLive) return;
    const cur = Math.round(projectLive.completion ?? 0);
    const steps = [0, 25, 50, 75, 100];
    let idx = steps.findIndex((v) => cur < v);
    if (idx === -1) idx = 0;
    const next = steps[idx];
    void updateProject({ completion: next });
  };

  function escapeHtml(str: string) {
    return str
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
  }

  function inlineMarkdown(text: string) {
    let t = escapeHtml(text);
    t = t.replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-white/10 text-slate-200">$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>');
    t = t.replace(/_([^_]+)_/g, '<em class="italic text-slate-300">$1</em>');
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
        parts.push('<hr class="my-3 border-white/10" />');
        continue;
      }
      const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        const txt = inlineMarkdown(h[2]);
        const size =
          level === 1 ? "text-lg md:text-xl" : level === 2 ? "text-base md:text-lg" : "text-sm md:text-base";
        parts.push(`<h${level} class="font-semibold text-slate-100 ${size}">${txt}</h${level}>`);
        continue;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        if (!inList) {
          inList = true;
          parts.push('<ul class="list-disc pl-5 space-y-1 text-sm text-slate-200/90">');
        }
        const li = inlineMarkdown(trimmed.replace(/^[-*]\s+/, ""));
        parts.push(`<li>${li}</li>`);
        continue;
      }
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<p class="text-sm text-slate-200/90">${inlineMarkdown(trimmed)}</p>`);
    }
    if (inList) parts.push("</ul>");
    return parts.join("");
  }

  function MarkdownView({ text }: { text?: string }) {
    const html = useMemo(() => renderMarkdownToHtml(text || ""), [text]);
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const startEditNote = (id: string, initial: string) => {
    setEditingNoteId(id);
    setNoteDrafts((prev) => ({ ...prev, [id]: initial || "" }));
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>(`#note-${id} textarea`);
      if (ta) {
        ta.focus();
        autoResize(ta);
      }
    }, 0);
  };

  async function createAndEditCommissionNote() {
    if (!user || !selected || !selectedProjectId) return;
    const colRef = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      selectedProjectId,
      "notes"
    );
    const docRef = await addDoc(colRef, {
      text: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setEditingNoteId(docRef.id);
    setScrollTargetNoteId(docRef.id);
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>(`#note-${docRef.id} textarea`);
      ta?.focus();
    }, 0);
  }

  const filtered = useMemo(() => {
    const t = dq.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(t) ||
        (c.username || "").toLowerCase().includes(t)
    );
  }, [dq, clients]);

  const filteredSorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "recent") {
      arr.sort(
        (a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0)
      );
    } else {
      arr.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: "base",
        })
      );
    }
    return arr;
  }, [filtered, sortBy]);

  // Actions
  const submitCompose = async () => {
    if (!user) return;
    const displayName = parsedClient.displayName.trim();
    const username = parsedClient.username;
    if (!displayName) return;
    const col = collection(db, "users", user.uid, "sites", "zzq", "clients");
    const docRef = await addDoc(col, {
      displayName,
      username,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Optimistic select + open panel with a subtle flash highlight
    const newClient: Client = {
      id: docRef.id,
      displayName,
      username,
      createdAt: undefined,
      updatedAt: undefined,
    };
    setSelected(newClient);
    setPaneOpen(true);
    setComposeOpen(false);
    setComposeText("");
    setFlashClientId(docRef.id);
    setTimeout(
      () => setFlashClientId((cur) => (cur === docRef.id ? null : cur)),
      1200
    );
  };

  // Editing clients
  const startEditClient = (c: Client) => {
    setEditingClientId(c.id);
    setEditText(`${c.displayName}${c.username ? ` ${c.username}` : ""}`);
  };
  const cancelEditClient = () => {
    setEditingClientId(null);
    setEditText("");
  };
  const saveEditClient = async () => {
    if (!user || !editingClientId) return;
    const { displayName, username } = parseNameUsername(editText || "");
    if (!displayName) return;
    // optimistic updates
    setClients((prev) =>
      prev.map((it) =>
        it.id === editingClientId ? { ...it, displayName, username } : it
      )
    );
    setSelected((prev) =>
      prev && prev.id === editingClientId ? { ...prev, displayName, username } : prev
    );
    const ref = doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      editingClientId
    );
    await updateDoc(ref, { displayName, username, updatedAt: serverTimestamp() });
    setEditingClientId(null);
    setEditText("");
  };

  // Delete client (cascade subcollections)
  const deleteClientCascade = async (clientId: string) => {
    if (!user) return;
    const base = ["users", user.uid, "sites", "zzq", "clients", clientId] as const;

    // Batched deletes to stay under limits
    let batch = writeBatch(db);
    let count = 0;
    const commit = async () => {
      if (count > 0) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    };
    const commitIfNeeded = async () => {
      if (count >= 400) {
        await commit();
      }
    };

    // links
    const linksSnap = await getDocs(collection(db, ...base, "links"));
    linksSnap.forEach((d) => {
      batch.delete(d.ref);
      count++;
    });
    await commitIfNeeded();

    // projects and notes
    const projSnap = await getDocs(collection(db, ...base, "projects"));
    for (const p of projSnap.docs) {
      const notesSnap = await getDocs(collection(db, ...base, "projects", p.id, "notes"));
      notesSnap.forEach((n) => {
        batch.delete(n.ref);
        count++;
      });
      await commitIfNeeded();
      batch.delete(p.ref);
      count++;
      await commitIfNeeded();
    }

    // invites referencing this client
    const invCol = collection(db, "users", user.uid, "sites", "zzq", "invites");
    const invSnap = await getDocs(query(invCol, where("clientId", "==", clientId)));
    invSnap.forEach((i) => {
      batch.delete(i.ref);
      count++;
    });
    await commit();

    // finally, client doc
    await deleteDoc(doc(db, ...base));
  };

  const requestDeleteClient = async (c: Client) => {
    if (!user) return;
    const ok = window.confirm(
      `Delete "${c.displayName}" and all their projects, notes, links, and invites? This cannot be undone.`
    );
    if (!ok) return;
    setDeleteBusyId(c.id);
    try {
      // optimistic UI
      setClients((prev) => prev.filter((it) => it.id !== c.id));
      if (selected?.id === c.id) {
        setPaneOpen(false);
        setSelected(null);
        setSelectedProjectId(null);
        setProjectLive(null);
      }
      await deleteClientCascade(c.id);
    } finally {
      setDeleteBusyId(null);
    }
  };
  
  const submitProjectCompose = async () => {
    if (!user || !selected) return;
    const title = projectComposeText.trim();
    if (!title) return;
    const col = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects"
    );
    const docRef = await addDoc(col, {
      title,
      status: "pending",
      completion: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await pushCommissionProjection();
    // Open commission panel for the new project and flash the list row
    setSelectedProjectId(docRef.id);
    setProjectComposeOpen(false);
    setProjectComposeText("");
    setFlashProjectId(docRef.id);
    setTimeout(
      () => setFlashProjectId((cur) => (cur === docRef.id ? null : cur)),
      1200
    );
  };
  
  
  

  const openProject = (p: Project) => {
    setSelectedProjectId(p.id);
  };

  const openProjectByIdAndFocusNote = (projectId: string, noteId: string) => {
    setSelectedProjectId(projectId);
    setScrollTargetNoteId(noteId);
  };

  const updateProject = async (patch: Partial<Project>) => {
    if (!user || !selected || !selectedProjectId) return;
  
    // Optimistic update
    setProjectLive((prev) => (prev ? { ...prev, ...patch } : prev));
    setProjects((prev) =>
      prev.map((it) => (it.id === selectedProjectId ? { ...it, ...patch } : it))
    );
  
    const ref = doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      selectedProjectId
    );
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
    await pushCommissionProjection();
  };
  
  /**
   * Mirror current projects to the shared chat doc(s) for linked users so clients can see progress.
   */
  const pushCommissionProjection = async () => {
    if (!user || !selected) return;
    // Build a minimal projection array
    const projection = projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      completion: p.completion,
      updatedAt: serverTimestamp(),
    }));
    // Write to each chat for this client (one per linked user)
    for (const lnk of linksForClient) {
      try {
        const chatRef = doc(db, "chats", lnk.linkId);
        await setDoc(
          chatRef,
          {
            commissionProjects: projection,
            lastUpdateAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // best-effort mirror
      }
    }
  };

  const updateProjectNoteText = async (
    projectId: string,
    noteId: string,
    text: string
  ) => {
    if (!user || !selected) return;

    // Optimistic local update for embedded notes list
    setProjectNotes((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((n) =>
        n.id === noteId ? { ...n, text } : n
      ),
    }));

    const ref = doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      projectId,
      "notes",
      noteId
    );
    await updateDoc(ref, { text, updatedAt: serverTimestamp() });
  };

  const toggleProject = async (p: Project) => {
    if (!user || !selected) return;
    const newStatus = p.status === "completed" ? "pending" : "completed";
    const newCompletion = newStatus === "completed" ? 100 : 0;
  
    // Optimistic updates
    setProjects((prev) =>
      prev.map((it) =>
        it.id === p.id
          ? { ...it, status: newStatus, completion: newCompletion }
          : it
      )
    );
    setProjectLive((prev) =>
      prev && prev.id === p.id
        ? { ...prev, status: newStatus, completion: newCompletion }
        : prev
    );
  
    const ref = doc(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      p.id
    );
    await updateDoc(ref, {
      status: newStatus,
      completion: newCompletion,
      updatedAt: serverTimestamp(),
    });
    await pushCommissionProjection();
  };


  const addProjectNote = async (projectId: string) => {
    if (!user || !selected) return;
    const text = prompt("New note for this project");
    if (!text) return;
    const colRef = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      projectId,
      "notes"
    );
    await addDoc(colRef, {
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  // Push notifications: initialize device state
  useEffect(() => {
    (async () => {
      const t = await getCurrentFcmTokenIfSupported();
      setPushEnabled(Boolean(t));
    })();
  }, []);

  // Load artist commission settings (slug)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const ref = doc(db, "users", user.uid, "sites", "zzq", "config", "settings");
        const snap = await getDoc(ref);
        const slug = (snap.data() as { commissionSlug?: string } | undefined)?.commissionSlug || "";
        setSettingsSlug(slug);
        setCurrentSlug(slug || null);
      } catch {
        // ignore
      }
    })();
  }, [user]);


  // Gates
  if (loading) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-sm text-slate-400">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300">
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-2xl font-semibold">
            <span className="text-gradient">ZZQ</span>
          </h1>
          <p className="text-slate-400">Please sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98] transition"
            title="Login with Google"
          >
            Login with Google
          </button>
          <Link
            href="/"
            className="text-sm text-cyan-400 hover:underline active:opacity-80 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!permissions?.zzq) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-slate-400">You do not have access to ZZQ.</p>
          <Link
            href="/"
            className="text-sm text-cyan-400 hover:underline active:opacity-80 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen zzq-bg text-slate-200 overflow-hidden">
      <div className="flex zzq-viewport">
        {/* Clients panel */}
        <aside className="w-[320px] shrink-0 border-r border-white/10 bg-white/[0.04] backdrop-blur-md h-full flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                <span className="text-gradient">Clients</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={cx(
                    "px-2.5 py-1.5 rounded-md border text-sm transition",
                    settingsOpen ? "border-cyan-500/60 text-cyan-200 bg-white/[0.06]" : "border-white/10 text-slate-200 hover:bg-white/[0.06]"
                  )}
                  title={settingsOpen ? "Hide Settings" : "Artist Settings"}
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    setComposeOpen((v) => !v);
                    if (!composeOpen) setTimeout(() => composeInputRef.current?.focus(), 0);
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm hover:opacity-95 active:scale-[.98] transition"
                  title={composeOpen ? "Cancel adding client" : "Add client"}
                >
                  {composeOpen ? "Cancel" : "+ Add"}
                </button>
              </div>
            </div>
            <div className="mt-3 relative">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clients… (Ctrl/Cmd+K)"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                aria-label="Search clients"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
                <button
                  onClick={() => setSortBy("name")}
                  className={cx(
                    "px-2.5 py-1.5 text-xs",
                    sortBy === "name" ? "bg-white/[0.08] text-slate-200" : "hover:bg-white/[0.06] text-slate-400"
                  )}
                  aria-pressed={sortBy === "name"}
                  title="Sort by name (A–Z)"
                >
                  Name
                </button>
                <button
                  onClick={() => setSortBy("recent")}
                  className={cx(
                    "px-2.5 py-1.5 text-xs border-l border-white/10",
                    sortBy === "recent" ? "bg-white/[0.08] text-slate-200" : "hover:bg-white/[0.06] text-slate-400"
                  )}
                  aria-pressed={sortBy === "recent"}
                  title="Sort by most recently updated"
                >
                  Recent
                </button>
              </div>
            </div>

            {settingsOpen && (
              <div className="mt-3 rounded-lg border border-cyan-500/40 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Commission Link</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 shrink-0">/commission/</span>
                      <input
                        value={settingsSlug}
                        onChange={(e) => setSettingsSlug(e.target.value.toLowerCase())}
                        placeholder="your-name"
                        className="flex-1 min-w-0 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                        aria-label="Commission link slug"
                      />
                      <button
                        onClick={async () => {
                          if (!user) return;
                          const s = (settingsSlug || "").trim();
                          if (!s) return;
                          setSettingsSaving(true);
                          setSettingsMessage(null);
                          try {
                            await reserveCommissionSlug({ ownerId: user.uid, slug: s, previousSlug: currentSlug || undefined });
                            setCurrentSlug(s);
                            setSettingsMessage("Saved");
                          } catch {
                            setSettingsMessage("Failed to save slug");
                          } finally {
                            setSettingsSaving(false);
                          }
                        }}
                        disabled={!settingsSlug.trim() || settingsSaving}
                        className="shrink-0 px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm disabled:opacity-60"
                        title="Save slug"
                      >
                        {settingsSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {currentSlug ? (
                      <div className="mt-2 flex items-center gap-2 min-w-0">
                        <input
                          readOnly
                          value={`${typeof window !== "undefined" ? window.location.origin : "https://app.masterwork.app"}/commission/${currentSlug}`}
                          className="flex-1 min-w-0 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs"
                        />
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}/commission/${currentSlug}`);
                              setSettingsMessage("Link copied");
                            } catch {}
                          }}
                          className="shrink-0 px-3 py-2 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                          title="Copy link"
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500">
                        Choose a unique slug to share your commission page.
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {settingsMessage && <div className="text-xs text-slate-400">{settingsMessage}</div>}
                  </div>
                </div>
              </div>
            )}

            {composeOpen && (
              <div className="mt-3 rounded-lg border border-cyan-500/40 bg-white/[0.03] p-3">
                <div className="text-[11px] text-slate-400 mb-1">Quick add client</div>
                <div className="flex items-center gap-2">
                  <input
                    ref={composeInputRef}
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCompose();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setComposeOpen(false);
                      }
                    }}
                    placeholder="Type: Name @username (optional)"
                    className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                    aria-label="New client quick add"
                  />
                  <button
                    onClick={submitCompose}
                    disabled={!parsedClient.displayName}
                    className={cx(
                      "px-3 py-2 rounded-md text-sm transition",
                      parsedClient.displayName
                        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98]"
                        : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                    )}
                    title="Create client"
                  >
                    Create
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {parsedClient.displayName ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-white/[0.06] border border-white/10 mr-2">
                        Name: <span className="text-slate-200">{parsedClient.displayName}</span>
                      </span>
                      {parsedClient.username && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-white/[0.06] border border-white/10">
                          {parsedClient.username}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>Hint: “Mazzy @mazzy”</span>
                  )}
                </div>
              </div>
            )}
            
            {/* Notifications / New Messages */}
            <div className="mt-3 rounded-lg border border-cyan-500/40 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Notifications</div>
                <button
                  onClick={togglePush}
                  className={cx(
                    "px-2 py-1 rounded-md border text-xs transition",
                    pushEnabled
                      ? "border-rose-400/40 text-rose-200 hover:bg-white/[0.06]"
                      : "border-white/10 text-slate-200 hover:bg-white/[0.06]"
                  )}
                  disabled={pushBusy}
                  title={pushEnabled ? "Disable push notifications on this device" : "Enable push notifications on this device"}
                >
                  {pushEnabled ? (pushBusy ? "Disabling…" : "Disable Push") : (pushBusy ? "Enabling…" : "Enable Push")}
                </button>
              </div>
              {notifError && (
                <div className="mt-2 text-xs text-rose-400">{notifError}</div>
              )}
              <ul className="mt-2 space-y-2">
                {ownerChats.filter((c) => {
                  const lm = c.lastMessageAt?.toMillis?.() ?? 0;
                  const lr = c.lastReadAt?.toMillis?.() ?? 0;
                  return lm > 0 && lm > lr;
                }).slice(0, 5).map((c) => (
                  <li key={`owner-notif-${c.chatId}`} className="flex items-center justify-between text-sm">
                    <div className="truncate">
                      <span className="font-medium">{c.clientDisplayName}</span>
                      <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white align-middle">New</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (!user || !c.clientId) return;
                        if (c.clientId.startsWith("u:") && c.userId) {
                          try {
                            await ensureOwnerCommissionClient({
                              ownerId: user.uid,
                              userId: c.userId,
                              clientId: c.clientId,
                              clientDisplayName: c.clientDisplayName,
                            });
                          } catch (err) {
                            console.error("ZZQ notifications ensure commission client failed:", err);
                          }
                        }
                        const existing = clients.find((cl) => cl.id === c.clientId);
                        const fallback: Client = {
                          id: c.clientId,
                          displayName: c.clientDisplayName ?? "Client",
                          username: null,
                          notificationsEnabled: false,
                        };
                        const nextClient = existing ?? fallback;
                        setSelected(nextClient);
                        setPaneOpen(true);
                        setLinkPanelOpen(true);
                        setSelectedProjectId(null);
                      }}
                      className="ml-2 px-2 py-1 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                    >
                      Open
                    </button>
                  </li>
                ))}
                {ownerChats.filter((c) => {
                  const lm = c.lastMessageAt?.toMillis?.() ?? 0;
                  const lr = c.lastReadAt?.toMillis?.() ?? 0;
                  return lm > 0 && lm > lr;
                }).length === 0 && (
                  <li className="text-sm text-slate-500">No new messages.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2 scroll-shadow-y">
            {clientsLoading ? (
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-14 rounded-lg bg-white/[0.06]"
                  />
                ))}
              </>
            ) : (
              <>
                {filteredSorted.map((c) => {
                  const isSelected = selected?.id === c.id;
                  const isFlashing = flashClientId === c.id;
                  const isEditing = editingClientId === c.id;
                  const isDeleting = deleteBusyId === c.id;
                  return (
                    <div
                      key={c.id}
                       onContextMenu={(e) => openContextMenu(e, { kind: "client", client: c })}
                       className={cx(
                        "w-full rounded-lg border border-white/10 bg-white/[0.03] hover:border-cyan-400/50 hover:bg-white/[0.05] transition",
                        isSelected &&
                          "border-cyan-500/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]",
                        isFlashing &&
                          "ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]"
                      )}
                    >
                      {isEditing ? (
                        <div className="p-2 flex items-center gap-2">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveEditClient();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditClient();
                              }
                            }}
                            placeholder="Name @username"
                            className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                            aria-label="Edit client"
                          />
                          <button
                            onClick={saveEditClient}
                            disabled={!parseNameUsername(editText).displayName}
                            className={cx(
                              "px-2.5 py-1.5 rounded-md text-xs transition",
                              parseNameUsername(editText).displayName
                                ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98]"
                                : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                            )}
                            title="Save"
                            aria-label="Save"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditClient}
                            className="px-2.5 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div onContextMenu={(e) => openContextMenu(e, { kind: "client", client: c })} className="p-2 flex items-center">
                          <div className="mr-2 size-8 rounded-full bg-gradient-to-br from-cyan-500/60 to-fuchsia-500/60 text-white grid place-items-center text-sm font-semibold">
                            {(c.displayName || "").trim().charAt(0).toUpperCase() || "C"}
                          </div>
                          <button
                            onClick={() => {
                              // Ensure commission panel is closed when selecting a client
                              setSelectedProjectId(null);
                              setSelected(c);
                              setPaneOpen(true);
                            }}
                            className="flex-1 text-left group active:scale-[.99] transition"
                            title={`Open ${c.displayName}`}
                            aria-pressed={isSelected}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium group-hover:underline decoration-cyan-400 truncate">
                                {c.displayName}
                              </div>
                              <div className="shrink-0 text-[11px] text-slate-500">
                                {c.updatedAt?.toDate?.()
                                  ? c.updatedAt.toDate().toLocaleDateString([], { month: "short", day: "numeric" })
                                  : ""}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                              {c.username || "\u00A0"}
                            </div>
                          </button>
                          <div className="ml-2 flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditClient(c);
                              }}
                              className="p-1.5 rounded-md border border-white/10 hover:bg-white/[0.06]"
                              title="Edit name/username"
                              aria-label="Edit client"
                            >
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-slate-300">
                                <path d="M14.69 2.86a2 2 0 0 1 2.83 2.83l-8.8 8.8-4.1 1.03 1.03-4.1 8.8-8.8zM12.57 4.98l2.45 2.45" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void requestDeleteClient(c);
                              }}
                              disabled={isDeleting}
                              className={cx(
                                "p-1.5 rounded-md border border-white/10 hover:bg-white/[0.06]",
                                isDeleting && "opacity-60 cursor-not-allowed"
                              )}
                              title={isDeleting ? "Deleting…" : "Delete client"}
                              aria-label="Delete client"
                            >
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-slate-300">
                                <path d="M7 2h6l1 2h3v2H3V4h3l1-2zm1 6h2v8H8V8zm4 0h2v8h-2V8z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && !clientsLoading && (
                  <div className="text-sm text-slate-500 px-2">
                    No clients found.
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Detail area with slide-in Client panel */}
        <main className="flex-1 relative overflow-hidden">
            <ContextMenuOverlay />
          <div className="h-full flex">
            {/* Middle panel: Projects for selected client */}
            <aside className="w-[380px] shrink-0 border-r border-white/10 bg-white/[0.04] backdrop-blur-md h-full flex flex-col">
              {selected ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="mr-1 size-8 rounded-full bg-gradient-to-br from-cyan-500/60 to-fuchsia-500/60 text-white grid place-items-center text-sm font-semibold">
                            {(selected.displayName || "C").trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-base md:text-lg font-semibold truncate">
                              {selected.displayName}
                            </div>
                            {selected.username ? (
                              <div className="text-xs italic text-slate-400 truncate">
                                {selected.username}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 whitespace-nowrap">
                            <svg viewBox="0 0 20 20" className="w-3 h-3 text-slate-300" aria-hidden="true">
                              <path d="M3 4h14v2H3V4zm0 4h10v2H3V8zm0 4h14v2H3v-2z" />
                            </svg>
                            {projects.length} projects
                          </span>
                          {avgCompletion !== null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 whitespace-nowrap">
                              <svg viewBox="0 0 20 20" className="w-3 h-3 text-slate-300" aria-hidden="true">
                                <path d="M3 16h14v-2H3v2zm2-3h3V6H5v7zm5 0h3V3h-3v10zm5 0h3V9h-3v4z" />
                              </svg>
                              {avgCompletion}% avg
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="w-full md:w-auto flex items-center gap-1.5 shrink-0 justify-end md:justify-start mt-2 md:mt-0">
                        <button
                          onClick={() => {
                            setLinkPanelOpen((v) => !v);
                            setInviteUrl(null);
                            setInviteError(null);
                          }}
                          className={cx(
                            headerBtnBase,
                            "h-8 px-2.5",
                            linkPanelOpen
                              ? "border-cyan-500/50 text-cyan-200 bg-white/[0.04]"
                              : "border-white/10 text-slate-200"
                          )}
                          aria-pressed={linkPanelOpen}
                          title={linkPanelOpen ? "Hide linking tools" : "Link client to CC"}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
                              <path fill="currentColor" d="M7.05 11.95a3 3 0 0 1 0-4.24l2.83-2.83a3 3 0 0 1 4.24 0l.71.71-1.41 1.41-.71-.71a1 1 0 0 0-1.41 0L8.47 9.12a1 1 0 0 0 0 1.41l.71.71-1.41 1.41-.72-.7zm5.9-3.9a3 3 0 0 1 0 4.24l-2.83 2.83a3 3 0 0 1-4.24 0l-.71-.71 1.41-1.41.71.71a1 1 0 0 0 1.41 0l2.83-2.83a1 1 0 0 0 0-1.41l-.71-.71 1.41-1.41.72.7z"/>
                            </svg>
                            <span className="hidden md:inline">
                              {linkPanelOpen ? "Hide Link" : "Link Client"}
                            </span>
                            <span className="md:hidden">
                              {linkPanelOpen ? "Hide" : "Link"}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => { void toggleNotificationsForSelectedClient(); }}
                          className={cx(
                            headerBtnBase,
                            "h-8 px-2.5",
                            selected?.notificationsEnabled
                              ? "border-cyan-500/50 text-cyan-200 bg-white/[0.04]"
                              : "border-white/10 text-slate-200"
                          )}
                          aria-pressed={!!selected?.notificationsEnabled}
                          title="Toggle push notifications for this client"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
                              <path fill="currentColor" d="M10 18a2 2 0 0 0 2-2H8a2 2 0 0 0 2 2zm6-6V9a6 6 0 1 0-12 0v3L2 14v1h16v-1l-2-2z"/>
                            </svg>
                            <span>{selected?.notificationsEnabled ? "Notify: On" : "Notify: Off"}</span>
                          </span>
                        </button>
                        <button
                          ref={clientCloseRef}
                          onClick={() => {
                            setPaneOpen(false);
                            setSelected(null);
                            setSelectedProjectId(null);
                            setLinkPanelOpen(false);
                          }}
                          className={cx(headerBtnBase, "h-8 px-2.5 border-white/10 text-slate-200")}
                          title="Deselect client"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
                              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            <span className="hidden md:inline">Deselect</span>
                            <span className="md:hidden">Close</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {linkPanelOpen && (
                      <div className="mb-4 rounded-lg border border-cyan-500/40 bg-white/[0.03] p-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Link this client to CC</div>
                          <button
                            onClick={async () => {
                              if (!user || !selected || inviteBusy) return;
                              setInviteBusy(true);
                              setInviteError(null);
                              setInviteUrl(null);
                              try {
                                const res = await createInvite({
                                  ownerId: user.uid,
                                  clientId: selected.id,
                                  clientDisplayName: selected.displayName,
                                });
                                setInviteUrl(res.url);
                              } catch {
                                setInviteError("Failed to create invite");
                              } finally {
                                setInviteBusy(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs hover:opacity-95 active:scale-[.98] disabled:opacity-60"
                            disabled={inviteBusy}
                            title="Generate invite link"
                          >
                            {inviteBusy ? "Generating…" : "Generate Link"}
                          </button>
                        </div>

                        {inviteError ? <div className="text-sm text-rose-400">{inviteError}</div> : null}
                        {inviteUrl ? (
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={inviteUrl}
                              className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs"
                            />
                            <button
                              onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); } catch {} }}
                              className="px-3 py-2 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                              title="Copy link"
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            Generate a link and share it with the client. When they accept, they can chat with you in CC.
                          </div>
                        )}

                        <div className="pt-2 border-t border-white/10">
                          <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-2">Active Invites</div>
                          <ul className="space-y-2">
                            {invitesForClient.length > 0 ? (
                              invitesForClient.map((inv) => (
                                <li key={inv.token} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[11px]">
                                      {inv.token.slice(0, 6)}…
                                    </span>
                                    <span className="text-slate-400">{inv.status}</span>
                                    {inv.expiresAt ? (
                                      <span className="text-slate-500 text-xs">
                                        • expires {new Date(inv.expiresAt.toMillis()).toLocaleDateString()}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {inv.status === "active" ? (
                                      <button
                                        onClick={async () => {
                                          if (!user) return;
                                          try {
                                            await revokeInvite({ ownerId: user.uid, token: inv.token });
                                          } catch {}
                                        }}
                                        className="px-2 py-1 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                                        title="Revoke invite"
                                      >
                                        Revoke
                                      </button>
                                    ) : null}
                                  </div>
                                </li>
                              ))
                            ) : (
                              <li className="text-sm text-slate-500">No invites yet.</li>
                            )}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-white/10">
                          <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-2">Linked Users</div>
                          <ul className="space-y-2">
                            {linksForClient.length > 0 ? (
                              linksForClient.map((lnk) => (
                                <li key={lnk.linkId} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[11px]">
                                      {lnk.userId.slice(0, 6)}…
                                    </span>
                                    <span className="text-slate-400">chat: {lnk.linkId.slice(0, 6)}…</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setSelectedChatId(lnk.linkId)}
                                      className="px-2 py-1 rounded-md border border-cyan-400/40 text-cyan-200 hover:bg-white/[0.06] text-xs"
                                      title="Open chat with this user"
                                    >
                                      Chat
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!user || !selected) return;
                                        try {
                                          await unlinkLinkedUser({
                                            ownerId: user.uid,
                                            clientId: selected.id,
                                            userId: lnk.userId,
                                          });
                                        } catch {}
                                      }}
                                      className="px-2 py-1 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                                      title="Unlink user"
                                    >
                                      Unlink
                                    </button>
                                  </div>
                                </li>
                              ))
                            ) : (
                              <li className="text-sm text-slate-500">No linked users yet.</li>
                            )}
                          </ul>
                        </div>

                        {selectedChatId && (
                          <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[12px] uppercase tracking-wide text-slate-400">Client Chat</div>
                              <button
                                onClick={() => setSelectedChatId(null)}
                                className="px-2 py-1 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                                title="Close chat"
                              >
                                Close
                              </button>
                            </div>
                            <div
                              ref={chatListRef}
                              className="h-64 overflow-y-auto rounded-md border border-white/10 bg-white/[0.03] p-3 space-y-2 scroll-shadow-y"
                            >
                              {chatMessages.map((m) => {
                                const mine = m.senderId === user?.uid;
                                const t = m.createdAt?.toDate();
                                const time = t
                                  ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : "";
                                return (
                                  <div
                                    key={m.id}
                                    className={[
                                      "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow",
                                      mine ? "ml-auto bg-cyan-600/80 text-white" : "mr-auto bg-white/[0.06] text-slate-100",
                                    ].join(" ")}
                                  >
                                    <div>{m.text || "(empty)"}</div>
                                    <div className={["mt-1 text-[11px]", mine ? "text-cyan-100/80" : "text-slate-400"].join(" ")}>
                                      {time}
                                    </div>
                                  </div>
                                );
                              })}
                              {chatMessages.length === 0 && (
                                <div className="text-sm text-slate-500">No messages yet.</div>
                              )}
                            </div>
                            <div className="mt-2">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!user || !selectedChatId || !chatText.trim()) return;
                                  (async () => {
                                    try {
                                      setChatBusy(true);
                                      const t = chatText;
                                      setChatText("");
                                      await sendChatMessage({ chatId: selectedChatId, senderId: user.uid, text: t });
                                    } finally {
                                      setChatBusy(false);
                                    }
                                  })();
                                }}
                                className="flex items-center gap-2"
                              >
                                <input
                                  value={chatText}
                                  onChange={(e) => setChatText(e.target.value)}
                                  placeholder="Type a message…"
                                  className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled={!chatText.trim() || chatBusy}
                                    className="px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs hover:opacity-95 disabled:opacity-60"
                                    type="submit"
                                    title="Send"
                                  >
                                    Send
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!chatText.trim() || chatBusy}
                                    onClick={() => {
                                      if (!user || !selectedChatId || !chatText.trim()) return;
                                      (async () => {
                                        try {
                                          setChatBusy(true);
                                          const t = chatText;
                                          setChatText("");
                                          await sendChatUpdate({ chatId: selectedChatId, senderId: user.uid, text: t });
                                        } finally {
                                          setChatBusy(false);
                                        }
                                      })();
                                    }}
                                    className="px-3 py-2 rounded-md border border-cyan-400/40 text-cyan-200 hover:bg-white/[0.06] text-xs disabled:opacity-60"
                                    title="Send Update (alert)"
                                  >
                                    Send Update
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Projects */}
                    <section className="rounded-lg border border-white/10 bg-white/[0.03] h-full flex flex-col">
                      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                        <h3 className="font-medium">Projects</h3>
                        <button
                          onClick={() => {
                            setProjectComposeOpen((v) => !v);
                            if (!projectComposeOpen)
                              setTimeout(() => projectComposeInputRef.current?.focus(), 0);
                          }}
                          className="px-2 py-1 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm hover:opacity-95 active:scale-[.98] transition"
                          title={projectComposeOpen ? "Cancel adding project" : "Add project"}
                        >
                          {projectComposeOpen ? "Cancel" : "+ Add"}
                        </button>
                      </div>
                      {projectComposeOpen && (
                        <div className="px-3 pt-3">
                          <div className="flex items-center gap-2">
                            <input
                              ref={projectComposeInputRef}
                              value={projectComposeText}
                              onChange={(e) => setProjectComposeText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitProjectCompose();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setProjectComposeOpen(false);
                                }
                              }}
                              placeholder="Project title"
                              className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                              aria-label="New project title"
                            />
                            <button
                              onClick={submitProjectCompose}
                              disabled={!projectComposeText.trim()}
                              className={cx(
                                "px-3 py-2 rounded-md text-sm transition",
                                projectComposeText.trim()
                                  ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98]"
                                  : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                              )}
                              title="Create project"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      )}
                      <ul className="divide-y-2 divide-white/20 flex-1 min-h-0 overflow-y-auto scroll-shadow-y pr-1">
                        {projectsLoading && projects.length === 0 ? (
                          <>
                            {Array.from({ length: 3 }).map((_, i) => (
                              <li key={i} className="p-3">
                                <Skeleton className="h-8 bg-white/[0.06]" />
                              </li>
                            ))}
                          </>
                        ) : projects.length > 0 ? (
                          projects.map((p) => (
                            <li
                              key={p.id}
                              onContextMenu={(e) => openContextMenu(e, { kind: "project", project: p })} className={cx(
                                "p-3 flex items-center gap-3 rounded-md",
                                flashProjectId === p.id && "ring-1 ring-cyan-400/60 bg-white/[0.04]"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={p.status === "completed"}
                                onChange={() => toggleProject(p)}
                                className="size-4 accent-cyan-400"
                                aria-label={`Mark ${p.title} complete`}
                              />
                              <button
                                onClick={() => openProject(p)}
                                className="flex-1 text-left group active:scale-[.99] transition"
                                title="Open commission details"
                              >
                                <div className="font-medium group-hover:underline decoration-cyan-400">
                                  {p.title}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                  <StatusBadge status={p.status} />
                                  <span>
                                    •{" "}
                                    {typeof p.completion === "number"
                                      ? `${p.completion}%`
                                      : "0%"}
                                  </span>
                                </div>
                              </button>
                              <button
                                onClick={() => addProjectNote(p.id)}
                                className="px-2 py-1 text-xs rounded-md border border-white/10 hover:bg-white/[0.06] active:scale-[.98] transition"
                                title="Add note to this project"
                              >
                                + Note
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="p-3 text-sm text-slate-500">
                            No projects yet.
                          </li>
                        )}
                      </ul>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="h-full grid place-items-center text-slate-500">
                  <div className="text-center px-6">
                    <h1 className="text-2xl font-semibold mb-2">
                      <span className="text-gradient">ZZQ</span>
                    </h1>
                    <p className="max-w-sm mx-auto">
                      Select a client from the left to manage projects.
                    </p>
                  </div>
                </div>
              )}
            </aside>

            {/* Right panel: Project View + Notes for the Opened Project */}
            <section className="flex-1 h-full bg-white/[0.04] backdrop-blur-md">
              {selected && selectedProjectId ? (
                projectLive ? (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-white/10 bg-gradient-to-l from-cyan-500/10 to-transparent">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-lg md:text-xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-cyan-400/60 rounded"
                            contentEditable
                            suppressContentEditableWarning
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).blur();
                              }
                            }}
                            onBlur={(e) => {
                              const v = e.currentTarget.innerText.trim();
                              const current = projectLive?.title ?? "";
                              if (v && v !== current) {
                                void updateProject({ title: v });
                              } else if (!v && current) {
                                void updateProject({ title: "" });
                              }
                            }}
                            title="Click to edit title. Press Enter to save."
                          >
                            {projectLive.title || "Untitled Commission"}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <button
                              onClick={cycleStatus}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition"
                              title={`Click to change status (now: ${statusLabel(projectLive.status)})`}
                            >
                              <StatusBadge status={projectLive.status} />
                            </button>
                            <button
                              onClick={cycleCompletion}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition"
                              title="Click to cycle completion (0→25→50→75→100)"
                            >
                              {Math.round(projectLive.completion ?? 0)}% complete
                            </button>
                          </div>
                          <div className="mt-2 h-1 rounded bg-white/[0.06] overflow-hidden">
                            <div
                              style={{ width: `${Math.round(projectLive.completion ?? 0)}%` }}
                              className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-[width] duration-300"
                            />
                          </div>
                        </div>
                        <div className="shrink-0">
                          <button
                            ref={projectCloseRef}
                            onClick={() => setSelectedProjectId(null)}
                            className="px-2.5 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.06] active:scale-[.98] transition focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                            title="Deselect project"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
                                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              <span className="hidden md:inline">Close</span>
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
                      {/* Project Notes (naturalized) */}
                      {selectedProjectId ? (
                        <div className="mt-2 flex-1 min-h-0 flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">Notes</div>
                            <button
                              onClick={createAndEditCommissionNote}
                              className="px-2 py-1 rounded-md border border-white/10 hover:bg-white/[0.06] text-xs"
                              title="New note"
                            >
                              New
                            </button>
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                            {(projectNotes[selectedProjectId] ?? []).map((n) => {
                              const flash = n.id === flashNoteId;
                              const isEditing = editingNoteId === n.id;
                              const draft = noteDrafts[n.id] ?? n.text ?? "";
                              return (
                                <div
                                  key={n.id}
                                  id={`note-${n.id}`}
                                  onContextMenu={(e) =>
                                    openContextMenu(e, {
                                      kind: "note",
                                      note: { id: n.id, text: n.text, projectId: selectedProjectId ?? undefined },
                                      projectIdForNote: selectedProjectId ?? undefined,
                                    })
                                  }
                                  className={cx(
                                    "border border-white/10 rounded-md bg-white/[0.04] transition-shadow",
                                    flash && "ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]"
                                  )}
                                >
                                  {isEditing ? (
                                    <textarea
                                      value={draft}
                                      onChange={(e) =>
                                        setNoteDrafts((prev) => ({ ...prev, [n.id]: e.target.value }))
                                      }
                                      onInput={(e) => autoResize(e.currentTarget)}
                                      onFocus={(e) => autoResize(e.currentTarget)}
                                      onBlur={(e) => {
                                        void updateProjectNoteText(selectedProjectId, n.id, e.target.value);
                                        setEditingNoteId((cur) => (cur === n.id ? null : cur));
                                      }}
                                      className="w-full resize-none p-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 bg-transparent"
                                      rows={3}
                                      placeholder="Write in Markdown… (--- for a page break)"
                                    />
                                  ) : draft.trim() ? (
                                    <div
                                      className="p-2 text-sm cursor-text hover:bg-white/[0.02] transition"
                                      onClick={() => startEditNote(n.id, n.text ?? "")}
                                    >
                                      <MarkdownView text={draft} />
                                    </div>
                                  ) : (
                                    <div
                                      className="p-2 text-sm italic text-slate-500 cursor-text hover:bg-white/[0.02] transition"
                                      onClick={() => startEditNote(n.id, n.text ?? "")}
                                    >
                                      Click to write…
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {(projectNotes[selectedProjectId] ?? []).length === 0 && (
                              <div className="text-sm text-slate-500">No notes yet.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="h-full grid place-items-center text-slate-500 p-6">
                    <div className="text-sm">Loading project…</div>
                  </div>
                )
              ) : (
                <div className="h-full grid place-items-center text-slate-500 p-6">
                  <div className="text-center">
                    <div className="text-xl font-medium mb-1">No project selected</div>
                    <p className="text-sm text-slate-400">
                      {selected ? "Choose a project from the middle panel to view details and notes." : "Select a client to get started."}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>


        </main>
{/* AI Slide-Up Panel (ZZQ — DeepSeek) */}
<div
  aria-hidden={!aiPanelOpen}
  className={cx(
    "fixed inset-0 z-50 transition-opacity duration-200",
    aiPanelOpen ? "pointer-events-auto" : "pointer-events-none"
  )}
>
  {/* backdrop */}
  <div
    onClick={() => setAiPanelOpen(false)}
    className={cx(
      "fixed inset-0 bg-black/50 transition-opacity duration-200",
      aiPanelOpen ? "opacity-100" : "opacity-0"
    )}
  />

  {/* panel */}
  <div
    role="dialog"
    aria-modal="true"
    aria-label="ZZQ AI chat panel"
    className={cx(
      "fixed left-0 right-0 bottom-0 mx-auto w-full max-w-3xl transform transition-transform duration-300",
      aiPanelOpen ? "translate-y-0" : "translate-y-full"
    )}
  >
    <div className="rounded-t-xl border border-neutral-800 bg-black/90 p-4 backdrop-blur-md text-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-neutral-400">Chat</div>
          <div className="font-medium">ZZQ — DeepSeek</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiPanelOpen(false)}
            className="px-3 py-1 rounded-md border border-white/10 text-sm"
            title="Close AI panel"
          >
            Close
          </button>
        </div>
      </div>

      <div
        ref={aiListRef}
        className="h-56 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-2"
      >
        {aiMessages.map((m, idx) => (
          <div
            key={idx}
            className={cx(
              "rounded-md px-3 py-2 text-sm",
              m.role === "user"
                ? "bg-neutral-800 text-neutral-100 ml-auto"
                : m.role === "assistant"
                ? "bg-cyan-700/80 text-white"
                : "bg-white/[0.04] text-slate-200"
            )}
          >
            <div className="text-[11px] text-neutral-300 mb-1">
              {m.role === "system" ? "Context" : m.role === "assistant" ? "ZZQ" : "You"}
            </div>
            <div>{m.content}</div>
          </div>
        ))}
        {aiMessages.length === 0 && (
          <div className="text-sm text-neutral-500">Ask ZZQ about your clients and projects.</div>
        )}
      </div>

      <form onSubmit={handleAiSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder="Ask ZZQ about your clients and projects…"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            disabled={!aiInput.trim() || aiLoading}
            className="px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white disabled:opacity-60"
            type="submit"
          >
            {aiLoading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

{/* Floating toggle */}
<button
  onClick={() => setAiPanelOpen((v) => !v)}
  className="fixed right-6 bottom-6 z-50 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-lg hover:scale-[.98] active:scale-[.96]"
  title="Open ZZQ AI"
>
  ZZQ AI
</button>
      </div>
    </div>
  );
}