"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "firebase/firestore";

type Client = {
  id: string;
  displayName: string;
  username?: string | null;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
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

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 150);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Selection
  const [selected, setSelected] = useState<Client | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);

  // Client composer (promptless inline flow)
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const composeInputRef = useRef<HTMLInputElement | null>(null);
  const [flashClientId, setFlashClientId] = useState<string | null>(null);

  const parsedClient = useMemo(() => {
    const raw = composeText || "";
    // capture last @username token if present
    const match = raw.match(/(?:^|[\s,])@([A-Za-z0-9._-]{2,32})\b/);
    const username = match ? `@${match[1]}` : null;
    const displayName = raw.replace(/\s*@([A-Za-z0-9._-]{2,32})\b/g, "").trim();
    return { displayName, username };
  }, [composeText]);

  // Project composer (inside Client View)
  const [projectComposeOpen, setProjectComposeOpen] = useState(false);
  const [projectComposeText, setProjectComposeText] = useState("");
  const projectComposeInputRef = useRef<HTMLInputElement | null>(null);
  const [flashProjectId, setFlashProjectId] = useState<string | null>(null);

  // Note composer (inside Client View → Notes)
  const [noteComposeOpen, setNoteComposeOpen] = useState(false);
  const [noteComposeText, setNoteComposeText] = useState("");
  const [noteComposeProjectId, setNoteComposeProjectId] = useState<string | null>(null);
  const noteComposeInputRef = useRef<HTMLInputElement | null>(null);

  // Commission panel note composer (project-scoped)
  const [commissionNoteComposeOpen, setCommissionNoteComposeOpen] = useState(false);
  const [commissionNoteComposeText, setCommissionNoteComposeText] = useState("");
  const commissionNoteComposeInputRef = useRef<HTMLInputElement | null>(null);

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Project panel: derive open state from selectedProjectId AND projectLive
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectLive, setProjectLive] = useState<Project | null>(null);
  const projectPaneOpen = selectedProjectId != null && projectLive != null;

  // Inline notes (per project)
  const [projectNotes, setProjectNotes] = useState<Record<string, Note[]>>({});

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
  useEffect(() => {
    if (noteComposeOpen)
      setTimeout(() => noteComposeInputRef.current?.focus(), 0);
  }, [noteComposeOpen]);
  useEffect(() => {
    if (commissionNoteComposeOpen)
      setTimeout(() => commissionNoteComposeInputRef.current?.focus(), 0);
  }, [commissionNoteComposeOpen]);

  // Keyboard UX:
  // - Ctrl/Cmd+K: focus search
  // - Ctrl/Cmd+N: open Client Quick Add
  // - Ctrl/Cmd+Shift+N: open Project Quick Add (when a client is open)
  // - Ctrl/Cmd+Shift+M: open Note Quick Add (when a client is open)
  // - Esc: close Note Composer → Project Composer → Client Composer → Commission → Client
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
      if (isModShiftM && paneOpen && selected) {
        e.preventDefault();
        const defaultPid = selectedProjectId ?? (projects[0]?.id ?? null);
        setNoteComposeProjectId(defaultPid);
        setNoteComposeOpen(true);
        setTimeout(() => noteComposeInputRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Escape") {
        if (commissionNoteComposeOpen) {
          setCommissionNoteComposeOpen(false);
          return;
        }
        if (noteComposeOpen) {
          setNoteComposeOpen(false);
          return;
        }
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
  }, [paneOpen, projectPaneOpen, composeOpen, projectComposeOpen, noteComposeOpen, commissionNoteComposeOpen, selected, selectedProjectId, projects]);

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
      const unsub = onSnapshot(query(colRef, orderBy("createdAt")), (snap) => {
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
  const projectById = useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => (map[p.id] = p));
    return map;
  }, [projects]);

  type AggregatedNote = Note & { projectId: string };
  const aggregatedNotes: AggregatedNote[] = useMemo(() => {
    const all: AggregatedNote[] = [];
    Object.entries(projectNotes).forEach(([pid, list]) => {
      list?.forEach((n) => all.push({ ...n, projectId: pid }));
    });
    all.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    return all;
  }, [projectNotes]);

  const filtered = useMemo(() => {
    const t = dq.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(t) ||
        (c.username || "").toLowerCase().includes(t)
    );
  }, [dq, clients]);

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
  
  const submitNoteCompose = async () => {
    if (!user || !selected) return;
    const text = noteComposeText.trim();
    if (!text) return;
    let pid = noteComposeProjectId;
    if (!pid) {
      if (selectedProjectId) pid = selectedProjectId;
      else if (projects.length === 1) pid = projects[0].id;
      else if (projects.length > 1) pid = projects[0].id;
    }
    if (!pid) return;
    const colRef = collection(
      db,
      "users",
      user.uid,
      "sites",
      "zzq",
      "clients",
      selected.id,
      "projects",
      pid,
      "notes"
    );
    const docRef = await addDoc(colRef, {
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNoteComposeOpen(false);
    setNoteComposeText("");
    // Open the project and focus the created note
    openProjectByIdAndFocusNote(pid, docRef.id);
  };
  
  const submitCommissionNoteCompose = async () => {
    if (!user || !selected || !selectedProjectId) return;
    const text = commissionNoteComposeText.trim();
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
      selectedProjectId,
      "notes"
    );
    const docRef = await addDoc(colRef, {
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCommissionNoteComposeOpen(false);
    setCommissionNoteComposeText("");
    // Scroll to the newly created note in the open commission panel
    setScrollTargetNoteId(docRef.id);
  };
  
  const addProject = async () => {
    if (!user || !selected) return;
    const title = prompt("Project title");
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
    await addDoc(col, {
      title,
      status: "pending",
      completion: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
  };

  const addNote = async () => {
    if (!user || !selected) return;
    if (projects.length === 0) {
      alert("Create a project first to add notes.");
      return;
    }
    let projectId: string | null = null;
    if (projects.length === 1) {
      projectId = projects[0].id;
    } else {
      const choice = prompt(
        "Add note to which project?\n" +
          projects.map((p, i) => `${i + 1}. ${p.title}`).join("\n") +
          "\nEnter number:"
      );
      const idx = choice ? parseInt(choice, 10) - 1 : -1;
      projectId = idx >= 0 && idx < projects.length ? projects[idx].id : null;
    }
    if (!projectId) return;
    const text = prompt("New note");
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
      <div className="flex h-screen">
        {/* Clients panel */}
        <aside className="w-[320px] shrink-0 border-r border-white/10 bg-white/[0.04] backdrop-blur-md">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                <span className="text-gradient">Clients</span>
              </h2>
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
          </div>

          <div className="overflow-y-auto h-[calc(100vh-98px)] p-2 space-y-2">
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
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      // Ensure commission panel is closed when selecting a client
                      setSelectedProjectId(null);
                      setSelected(c);
                      setPaneOpen(true);
                    }}
                    className={cx(
                      "w-full text-left rounded-lg border border-white/10 bg-white/[0.03] hover:border-cyan-400/50 hover:bg-white/[0.05] active:scale-[.99] transition",
                      selected?.id === c.id &&
                        "border-cyan-500/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]",
                      flashClientId === c.id &&
                        "ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]"
                    )}
                    title={`Open ${c.displayName}`}
                    aria-pressed={selected?.id === c.id}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{c.displayName}</div>
                    </div>
                    {c.username ? (
                      <div className="text-xs italic text-slate-400 mt-0.5">
                        {c.username}
                      </div>
                    ) : null}
                  </button>
                ))}
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
          <div className="h-full grid place-items-center text-slate-500">
            <div className="text-center px-6">
              <h1 className="text-2xl font-semibold mb-2">
                <span className="text-gradient">ZZQ</span>
              </h1>
              <p className="max-w-md mx-auto">
                Select a client from the left to manage projects and notes.
              </p>
            </div>
          </div>

          <div
            className={cx(
              "absolute inset-0 bg-white/[0.04] backdrop-blur-xl border-l border-white/10 shadow-xl transition-transform duration-300 ease-[var(--ease-snap)] will-change-transform",
              paneOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
            )}
            aria-hidden={!paneOpen}
          >
            {selected && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-transparent">
                  <div>
                    <div className="text-lg font-semibold">
                      {selected.displayName}
                    </div>
                    {selected.username ? (
                      <div className="text-xs italic text-slate-400">
                        {selected.username}
                      </div>
                    ) : null}
                  </div>
                  <button
                    ref={clientCloseRef}
                    onClick={() => {
                      setPaneOpen(false);
                      // Also guarantee commission is closed when closing client pane
                      setSelectedProjectId(null);
                    }}
                    className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.06] active:scale-[.98] transition focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    title="Close"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Projects */}
                    <section className="rounded-lg border border-white/10 bg-white/[0.03]">
                      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
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
                      <ul className="divide-y divide-white/10">
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
                              className={cx(
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

                    {/* Notes (aggregated, navigates to project notes for editing) */}
                    <section className="rounded-lg border border-white/10 bg-white/[0.03]">
                      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                        <h3 className="font-medium">Notes</h3>
                        <button
                          onClick={() => {
                            setNoteComposeOpen((v) => !v);
                            if (!noteComposeOpen) {
                              const defaultPid = selectedProjectId ?? (projects[0]?.id ?? null);
                              setNoteComposeProjectId(defaultPid);
                              setTimeout(() => noteComposeInputRef.current?.focus(), 0);
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm hover:opacity-95 active:scale-[.98] transition"
                          title={noteComposeOpen ? "Cancel adding note" : "Add note"}
                        >
                          {noteComposeOpen ? "Cancel" : "+ Add"}
                        </button>
                      </div>
                      {noteComposeOpen && (
                        <div className="px-3 pt-3">
                          <div className="flex items-center gap-2">
                            {projects.length > 1 ? (
                              <select
                                value={noteComposeProjectId ?? ""}
                                onChange={(e) => setNoteComposeProjectId(e.target.value || null)}
                                className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60"
                                aria-label="Select project for new note"
                              >
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))}
                              </select>
                            ) : projects.length === 1 ? (
                              <div className="text-[11px] text-slate-400">
                                Project: <span className="text-slate-300">{projects[0].title}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">
                                Create a project first to add notes.
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              ref={noteComposeInputRef}
                              value={noteComposeText}
                              onChange={(e) => setNoteComposeText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitNoteCompose();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setNoteComposeOpen(false);
                                }
                              }}
                              placeholder="Note text"
                              className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                              aria-label="New note text"
                            />
                            <button
                              onClick={submitNoteCompose}
                              disabled={
                                !noteComposeText.trim() ||
                                (projects.length > 1 && !noteComposeProjectId)
                              }
                              className={cx(
                                "px-3 py-2 rounded-md text-sm transition",
                                noteComposeText.trim() && (projects.length === 1 || noteComposeProjectId)
                                  ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98]"
                                  : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                              )}
                              title="Create note"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      )}
                      <ul className="divide-y divide-white/10">
                        {projectsLoading && aggregatedNotes.length === 0 ? (
                          <>
                            {Array.from({ length: 4 }).map((_, i) => (
                              <li key={i} className="p-3">
                                <Skeleton className="h-10 bg-white/[0.06]" />
                              </li>
                            ))}
                          </>
                        ) : aggregatedNotes.length > 0 ? (
                          aggregatedNotes.map((n, idx) => (
                            <li key={`${n.projectId}:${n.id}`} className="p-3">
                              <button
                                onClick={() =>
                                  openProjectByIdAndFocusNote(n.projectId, n.id)
                                }
                                className="w-full text-left group active:scale-[.99] transition"
                                title={`Go to note (Project: ${
                                  projectById[n.projectId]?.title ?? n.projectId
                                })`}
                              >
                                <div className="text-sm group-hover:underline decoration-cyan-400">
                                  {n.text || "(empty)"}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                  {projectById[n.projectId]?.title ?? "Project"}
                                  {" • "}#{idx + 1}
                                </div>
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="p-3 text-sm text-slate-500">
                            No notes yet.
                          </li>
                        )}
                      </ul>
                    </section>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Commission slide-out panel (notes editing inline here) - Only shows when project is actually loaded */}
          {projectPaneOpen && (
            <div
              className={cx(
                "absolute top-0 right-0 h-full w-[420px] bg-white/[0.05] backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform duration-300 ease-[var(--ease-snap)] will-change-transform flex flex-col",
                projectPaneOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
              )}
              aria-hidden={!projectPaneOpen}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-l from-cyan-500/10 to-transparent">
                <div>
                  <div className="text-lg font-semibold">Commission</div>
                  <div className="text-xs text-slate-400">
                    {projectLive ? projectLive.status.replace("_", " ") : ""}
                  </div>
                </div>
                <button
                  ref={projectCloseRef}
                  onClick={() => setSelectedProjectId(null)}
                  className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.06] active:scale-[.98] transition"
                  title="Close commission"
                >
                  Close
                </button>
              </div>

              {projectLive ? (
                <div className="flex-1 min-h-0 p-4 flex flex-col gap-5">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title
                    </label>
                    <input
                      className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60"
                      value={projectLive.title ?? ""}
                      onChange={(e) => updateProject({ title: e.target.value })}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Status
                    </label>
                    <div className="inline-flex rounded-md border border-white/10 overflow-hidden bg-white/[0.04]">
                      {(["pending", "in_progress", "completed"] as const).map(
                        (s) => (
                          <button
                            key={s}
                            onClick={() => updateProject({ status: s })}
                            className={cx(
                              "px-3 py-1.5 text-sm transition-colors",
                              projectLive.status === s
                                ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white"
                                : "bg-transparent hover:bg-white/[0.06]"
                            )}
                          >
                            {s === "in_progress"
                              ? "In Progress"
                              : s[0].toUpperCase() + s.slice(1)}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Completion */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Completion: {Math.round(projectLive.completion ?? 0)}%
                    </label>
                    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={projectLive.completion ?? 0}
                        onChange={(e) =>
                          updateProject({ completion: Number(e.target.value) })
                        }
                        className="w-full accent-cyan-400"
                        aria-label="Completion"
                      />
                      <div className="mt-2 h-2 rounded bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-[width] duration-300 ease-[var(--ease-snap)]"
                          style={{
                            width: `${Math.round(projectLive.completion ?? 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project Notes: now the sole place to edit notes */}
                  {selectedProjectId ? (
                    <div className="mt-4 flex-1 min-h-0 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Notes</label>
                        <button
                          onClick={() => {
                            setCommissionNoteComposeOpen((v) => !v);
                            if (!commissionNoteComposeOpen) {
                              setTimeout(() => commissionNoteComposeInputRef.current?.focus(), 0);
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs hover:opacity-95 active:scale-[.98] transition"
                          title={commissionNoteComposeOpen ? "Cancel adding note" : "Add note"}
                        >
                          {commissionNoteComposeOpen ? "Cancel" : "+ Add"}
                        </button>
                      </div>
                      {commissionNoteComposeOpen && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              ref={commissionNoteComposeInputRef}
                              value={commissionNoteComposeText}
                              onChange={(e) => setCommissionNoteComposeText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitCommissionNoteCompose();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setCommissionNoteComposeOpen(false);
                                }
                              }}
                              placeholder="Note text"
                              className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
                              aria-label="New note text (commission)"
                            />
                            <button
                              onClick={submitCommissionNoteCompose}
                              disabled={!commissionNoteComposeText.trim()}
                              className={cx(
                                "px-3 py-2 rounded-md text-xs transition",
                                commissionNoteComposeText.trim()
                                  ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98]"
                                  : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                              )}
                              title="Create note"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                        {(projectNotes[selectedProjectId] ?? []).map((n) => {
                          const flash = n.id === flashNoteId;
                          return (
                            <div
                              key={n.id}
                              id={`note-${n.id}`}
                              className={cx(
                                "border border-white/10 rounded-md bg-white/[0.04] transition-shadow",
                                flash &&
                                  "ring-1 ring-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,.35)_inset]"
                              )}
                            >
                              <textarea
                                defaultValue={n.text ?? ""}
                                onBlur={(e) =>
                                  updateProjectNoteText(
                                    selectedProjectId,
                                    n.id,
                                    e.target.value
                                  )
                                }
                                className="w-full resize-none p-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 bg-transparent"
                                rows={3}
                                placeholder="Note..."
                              />
                            </div>
                          );
                        })}
                        {(projectNotes[selectedProjectId] ?? []).length === 0 && (
                          <div className="text-sm text-slate-500">
                            No notes yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 text-sm text-slate-500">
                  Loading commission...
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}