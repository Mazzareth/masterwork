"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import type { ChatSummary } from "../../lib/linking";
import { ensurePushPermissionAndToken } from "../../lib/notifications";

export default function CCPage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();
  const router = useRouter();
  // Linked-access probe for users without cc permission
  const [linkCheck, setLinkCheck] = useState<"idle" | "checking" | "has" | "none">("idle");
  // Live chat summaries for dashboard when allowed
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // Redirects to /teach when unauthenticated or no CC access and no linked chats
  useEffect(() => {
    if (!loading && !user) router.replace("/teach");
  }, [loading, user, router]);
  const allowed = Boolean(permissions?.cc) || linkCheck === "has";
  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/teach");
  }, [loading, user, allowed, router]);
  // Derived: only chats where user is still a participant (filters revoked links)
  const [displayChats, setDisplayChats] = useState<ChatSummary[]>([]);
  // Commission progress mirror from chat doc
  const [progressByChat, setProgressByChat] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setLinkCheck("idle");
      return;
    }
    if (permissions?.cc) {
      setLinkCheck("has"); // explicit permission grants access
      return;
    }
    let canceled = false;
    const run = async () => {
      setLinkCheck("checking");
      try {
        const col = collection(db, "users", user.uid, "sites", "cc", "chats");
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
  }, [user, permissions?.cc]);

  // Subscribe to chat summaries when user is allowed
  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }
    const allowed = Boolean(permissions?.cc) || linkCheck === "has";
    if (!allowed) {
      setChats([]);
      return;
    }
    const col = collection(db, "users", user.uid, "sites", "cc", "chats");
    const q = query(col, orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: ChatSummary[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<ChatSummary, "chatId">;
        arr.push({ chatId: d.id, ...data });
      });
      setChats(arr);
    });
    return () => unsub();
  }, [user, permissions?.cc, linkCheck]);

    // Validate access to each chatId; hide any chats where user is no longer a participant
    useEffect(() => {
      let canceled = false;
      const validate = async () => {
        if (!user) {
          setDisplayChats([]);
          setProgressByChat({});
          return;
        }
        const arr: ChatSummary[] = [];
        const prog: Record<string, number> = {};
        for (const c of chats) {
          try {
            const snap = await getDoc(doc(db, "chats", c.chatId));
            if (snap.exists()) {
              arr.push(c);
              const data = snap.data() as { commissionProjects?: Array<{ completion?: number }> } | undefined;
              const list = data?.commissionProjects || [];
              if (list.length > 0) {
                const vals = list
                  .map((p) => (typeof p.completion === "number" ? p.completion : 0))
                  .filter((n) => Number.isFinite(n));
                if (vals.length > 0) {
                  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                  prog[c.chatId] = avg;
                }
              }
            }
          } catch {
            // permission denied or missing chat → filtered out
          }
        }
        if (!canceled) {
          setDisplayChats(arr);
          setProgressByChat(prog);
        }
      };
      validate();
      return () => {
        canceled = true;
      };
    }, [user, chats]);

  const isCheckingLinkedAccess =
    !!user && !permissions?.cc && (linkCheck === "idle" || linkCheck === "checking");

  if (loading || isCheckingLinkedAccess) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">CC</h1>
          <p className="text-neutral-600">Please sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded bg-black text-white hover:bg-neutral-800"
          >
            Login with Google
          </button>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-neutral-600">
            You do not have access to CC. Ask the artist to share a link or accept an invitation.
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen zzq-bg">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 flex flex-col gap-6 zzq-viewport">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gradient">Client Console</h1>
            <p className="text-sm text-neutral-400 mt-1">Chats, updates, and commission progress</p>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-md border border-neutral-700 hover:bg-neutral-900 text-sm"
          >
            Home
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <input
            placeholder="Search chats…"
            className="flex-1 rounded-md border border-neutral-700 bg-black/20 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            onClick={() => { if (user) void ensurePushPermissionAndToken(user.uid); }}
            className="px-3 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm shadow hover:opacity-90"
            title="Enable push notifications"
          >
            Enable Push
          </button>
        </div>

        <section className="rounded-xl border border-neutral-800 bg-black/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <div className="font-medium text-neutral-200">Inbox</div>
          </div>
          <ul className="divide-y divide-neutral-900">
            {displayChats.length > 0 ? (
              displayChats.map((c) => {
                const name = c.clientDisplayName || "Client";
                const initial = name.trim().charAt(0).toUpperCase();
                const lm = c.lastMessageAt?.toMillis?.() ?? 0;
                const lr = c.lastReadAt?.toMillis?.() ?? 0;
                const unread = lm > 0 && lm > lr;
                const lastDate = c.lastMessageAt?.toDate?.();
                const lastStr = lastDate
                  ? lastDate.toLocaleDateString([], { month: "short", day: "numeric" })
                  : "";
                const progress = progressByChat[c.chatId];
                return (
                  <li key={c.chatId}>
                    <Link
                      href={`/cc/chat/${encodeURIComponent(c.chatId)}`}
                      className="group flex items-center gap-3 p-4 hover:bg-white/5 transition"
                    >
                      <div className="size-10 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-white grid place-items-center font-semibold">
                        {initial || "C"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-medium text-neutral-100">
                            {name}
                          </div>
                          <div className="shrink-0 text-xs text-neutral-500">
                            {lastStr}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-neutral-400 truncate">
                          Chat ID: {c.chatId.slice(0, 8)}…
                          {typeof progress === "number" && (
                            <span className="ml-2 inline-flex items-center rounded-full border border-neutral-700 text-neutral-300 px-2 py-0.5">
                              {progress}% done
                            </span>
                          )}
                          {unread && (
                            <span className="ml-2 inline-block rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-[10px] align-middle">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-neutral-600 group-hover:text-neutral-300 transition">→</span>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="p-6 text-sm text-neutral-400">No linked chats yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}