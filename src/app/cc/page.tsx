"use client";

import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import type { ChatSummary } from "../../lib/linking";
import { ensurePushPermissionAndToken } from "../../lib/notifications";

export default function CCPage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();
  // Linked-access probe for users without cc permission
  const [linkCheck, setLinkCheck] = useState<"idle" | "checking" | "has" | "none">("idle");
  // Live chat summaries for dashboard when allowed
  const [chats, setChats] = useState<ChatSummary[]>([]);
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

  const allowed = Boolean(permissions?.cc) || linkCheck === "has";
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
    <div className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">CC</h1>
          <Link
            href="/"
            className="px-3 py-2 rounded border border-neutral-300 hover:bg-neutral-100 text-sm"
          >
            Back to Home
          </Link>
        </div>

        {/* Notifications / New Messages */}
        <section className="rounded-lg border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="font-medium">Notifications</div>
            <button
              onClick={() => { if (user) void ensurePushPermissionAndToken(user.uid); }}
              className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100"
              title="Enable push notifications"
            >
              Enable Push
            </button>
          </div>
          <ul className="divide-y divide-neutral-200">
            {displayChats.filter((c) => {
              const lm = c.lastMessageAt?.toMillis?.() ?? 0;
              const lr = c.lastReadAt?.toMillis?.() ?? 0;
              return lm > 0 && lm > lr;
            }).map((c) => (
              <li key={`notif-${c.chatId}`} className="p-4">
                <Link href={`/cc/chat/${encodeURIComponent(c.chatId)}`} className="flex items-center justify-between group">
                  <div>
                    <div className="font-medium group-hover:underline">{c.clientDisplayName || "Client"}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {c.chatId.slice(0, 8)}… • New messages
                    </div>
                  </div>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white">
                    New
                  </span>
                </Link>
              </li>
            ))}
            {displayChats.filter((c) => {
              const lm = c.lastMessageAt?.toMillis?.() ?? 0;
              const lr = c.lastReadAt?.toMillis?.() ?? 0;
              return lm > 0 && lm > lr;
            }).length === 0 && (
              <li className="p-6 text-sm text-neutral-500">No new messages.</li>
            )}
          </ul>
        </section>

        {/* Chats */}
        <section className="rounded-lg border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <div className="font-medium">Chats</div>
          </div>
          <ul className="divide-y divide-neutral-200">
            {displayChats.length > 0 ? (
              displayChats.map((c) => (
                <li key={c.chatId} className="p-4">
                  <Link
                    href={`/cc/chat/${encodeURIComponent(c.chatId)}`}
                    className="flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium group-hover:underline">
                        {c.clientDisplayName || "Client"}{" "}
                        {(c.lastMessageAt && (!c.lastReadAt || ((c.lastReadAt.toMillis?.() ?? 0) < (c.lastMessageAt.toMillis?.() ?? 0)))) ? (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white align-middle">New</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {typeof progressByChat[c.chatId] === "number" ? (
                          <>
                            Progress: {progressByChat[c.chatId]}% •{" "}
                          </>
                        ) : null}
                        Chat ID: {c.chatId.slice(0, 8)}…
                      </div>
                    </div>
                    <span className="text-neutral-400 group-hover:text-neutral-600 transition">
                      →
                    </span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="p-6 text-sm text-neutral-500">No linked chats yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}