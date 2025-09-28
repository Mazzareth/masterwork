"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

type FirestoreTimestamp = Timestamp | ReturnType<typeof serverTimestamp> | null;

type Task = {
  id: string;
  title: string;
  status?: "open" | "in_progress" | "done";
  assignedTo?: string | null;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  createdBy?: string | null;
};

type AllowlistEntry = {
  uid: string;
  email?: string | null;
  grantedBy?: string | null;
  createdAt?: FirestoreTimestamp;
};

type TaskDoc = Omit<Task, "id">;
type AllowlistDoc = Omit<AllowlistEntry, "uid">;

export default function ClaimedPage() {
  const { user, loading, loginWithGoogle } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Allowlist (admin-managed)
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [grantEmail, setGrantEmail] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAllowed(false);
      setIsAdmin(false);
      return;
    }
    const email = (user.email || "").toLowerCase();
    if (email === "mercysquadrant@gmail.com") {
      setAllowed(true);
      setIsAdmin(true);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const ref = doc(db, "masterwork", "claimed", "allowlist", user.uid);
        const snap = await getDoc(ref);
        if (!mounted) return;
        setAllowed(Boolean(snap.exists()));
      } catch (err) {
        console.error("allowlist check failed", err);
        if (!mounted) return;
        setAllowed(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, loading]);

  // Subscribe to tasks when allowed
  useEffect(() => {
    if (!allowed) {
      setTasks([]);
      return;
    }
    const col = collection(db, "masterwork", "claimed", "tasks");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() as TaskDoc;
        return { id: d.id, ...data };
      });
      setTasks(arr);
    });
    return () => unsub();
  }, [allowed]);

  // Admin: subscribe to allowlist
  useEffect(() => {
    if (!isAdmin) {
      setAllowlist([]);
      return;
    }
    const col = collection(db, "masterwork", "claimed", "allowlist");
    const unsub = onSnapshot(col, (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() as AllowlistDoc;
        return { uid: d.id, ...data };
      });
      setAllowlist(arr);
    });
    return () => unsub();
  }, [isAdmin]);

  const createTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTitle.trim() || !user) return;
    try {
      await addDoc(collection(db, "masterwork", "claimed", "tasks"), {
        title: newTitle.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setNewTitle("");
    } catch (err) {
      console.error("create task failed", err);
      setMessage("Failed to create task");
    }
  };

  const toggleTaskDone = async (t: Task) => {
    try {
      const next = t.status === "done" ? "open" : "done";
      await updateDoc(doc(db, "masterwork", "claimed", "tasks", t.id), {
        status: next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("toggle failed", err);
    }
  };

  const deleteTask = async (t: Task) => {
    try {
      await deleteDoc(doc(db, "masterwork", "claimed", "tasks", t.id));
    } catch (err) {
      console.error("delete failed", err);
    }
  };

  // Admin: grant access by email (user must have a /users/{uid} doc)
  const grantAccessByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    try {
      // find user doc by profile.email
      const q = query(collection(db, "users"), where("profile.email", "==", email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setMessage("No account found for that email. Ask the user to sign in first.");
        return;
      }
      const uid = snap.docs[0].id;
      await setDoc(doc(db, "masterwork", "claimed", "allowlist", uid), {
        email,
        grantedBy: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });
      setGrantEmail("");
      setMessage(`Granted access to ${email}`);
    } catch (err) {
      console.error("grant failed", err);
      setMessage("Grant failed");
    }
  };

  const revokeAccess = async (uid: string) => {
    try {
      await deleteDoc(doc(db, "masterwork", "claimed", "allowlist", uid));
    } catch (err) {
      console.error("revoke failed", err);
    }
  };

  if (loading || allowed === null) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-sm text-slate-400">Checking access…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300 p-6">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold">Masterwork — Claimed</h1>
          <p className="text-neutral-400">This page is invite-only. Please sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white"
          >
            Sign in
          </button>
          <Link href="/" className="text-sm text-cyan-400 hover:underline mt-2">Back Home</Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300 p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-2">Invite only</h1>
          <p className="text-neutral-400 mb-4">
            Access to this page is restricted. If you should have access, please contact the project owner.
          </p>
          <div className="text-sm text-slate-400">Signed in as: {user.email}</div>
        </div>
      </div>
    );
  }

  // Render main claimed tasks UI
  return (
    <div className="min-h-screen zzq-bg text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Masterwork — Claimed</h1>
          <div className="text-sm text-slate-400">Signed in as: {user.email}</div>
        </div>

        {isAdmin && (
          <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="font-medium mb-2">Allowlist (admin)</div>
            <form onSubmit={grantAccessByEmail} className="flex gap-2 mb-3">
              <input
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none"
              />
              <button className="px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white">
                Grant
              </button>
            </form>
            {message && <div className="text-sm text-slate-300 mb-2">{message}</div>}
            <div>
              <div className="text-xs text-slate-400 mb-2">Current allowlist</div>
              <ul className="space-y-2">
                {allowlist.map((a) => (
                  <li key={a.uid} className="flex items-center justify-between">
                    <div className="text-sm">{a.email || a.uid}</div>
                    <div>
                      <button
                        onClick={() => revokeAccess(a.uid)}
                        className="px-2 py-1 rounded-md border border-white/10 text-sm"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
                {allowlist.length === 0 && <li className="text-sm text-slate-500">No entries</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 mb-6">
          <form onSubmit={createTask} className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New task title"
              className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none"
            />
            <button className="px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white">
              Add
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-md border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-slate-400">{t.status || "open"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleTaskDone(t)} className="px-2 py-1 rounded-md border border-white/10 text-sm">
                  {t.status === "done" ? "Reopen" : "Complete"}
                </button>
                <button onClick={() => deleteTask(t)} className="px-2 py-1 rounded-md border border-white/10 text-sm">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <div className="text-sm text-slate-500">No tasks yet.</div>}
        </div>
      </div>
    </div>
  );
}