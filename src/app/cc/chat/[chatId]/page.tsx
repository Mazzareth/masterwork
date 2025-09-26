"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../contexts/AuthContext";
import { db } from "../../../../lib/firebase";
import { collection, onSnapshot, orderBy, query, Timestamp, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { sendChatMessage } from "../../../../lib/linking";

type Msg = {
  id: string;
  senderId: string;
  text: string;
  kind?: "message" | "update";
  createdAt?: Timestamp;
};

export default function CCChatPage() {
  const params = useParams() as { chatId: string };
  const chatId = params.chatId;
  const { user, loading, loginWithGoogle } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Commission progress mirror from chat doc
  const [commissionProjects, setCommissionProjects] = useState<
    Array<{ id: string; title?: string; status?: string; completion?: number }>
  >([]);

  // Subscribe to commission mirror on chat doc
  useEffect(() => {
    if (!user || !chatId) return;
    const ref = doc(db, "chats", chatId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setCommissionProjects([]);
        return;
      }
      const data = snap.data() as { commissionProjects?: Array<{ id: string; title?: string; status?: string; completion?: number }> };
      setCommissionProjects(Array.isArray(data.commissionProjects) ? data.commissionProjects : []);
    });
    return () => unsub();
  }, [user, chatId]);

  // Subscribe to messages
  useEffect(() => {
    if (!user || !chatId) return;
    const col = collection(db, "chats", chatId, "messages");
    const q = query(col, orderBy("createdAt"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Msg[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Msg, "id">;
        arr.push({ id: d.id, ...data });
      });
      setMessages(arr);
      // scroll to bottom on new messages
      setTimeout(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
      // Mark messages as read for this user (updates per-user chat summary)
      if (user) {
        void setDoc(
          doc(db, "users", user.uid, "sites", "cc", "chats", chatId),
          { lastReadAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {
          // ignore permission/latency errors; will retry on next snapshot
        });
      }
    });
    return () => unsub();
  }, [user, chatId]);

  const canSend = useMemo(() => !!user && !!text.trim() && !busy, [user, text, busy]);

  const onSend = async () => {
    if (!user || !text.trim()) return;
    try {
      setBusy(true);
      const t = text;
      setText("");
      await sendChatMessage({ chatId, senderId: user.uid, text: t });
    } catch {
      // Optionally surface error
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">CC Chat</h1>
          <p className="text-neutral-600">Please sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded bg-black text-white hover:bg-neutral-800"
          >
            Login with Google
          </button>
          <Link href="/cc" className="text-sm text-blue-600 hover:underline">
            Back to CC
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-2xl h-[90vh] flex flex-col border border-neutral-200 rounded-lg">
        <div className="p-3 border-b border-neutral-200 flex items-center justify-between">
          <div className="text-sm text-neutral-600">Chat</div>
          <Link href="/cc" className="text-sm text-blue-600 hover:underline">
            Back to CC
          </Link>
        </div>

        {/* Commission Progress */}
        {commissionProjects.length > 0 && (
          <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50">
            <div className="text-xs font-medium text-neutral-700 mb-2">Commission Progress</div>
            <ul className="space-y-2">
              {commissionProjects.map((p) => (
                <li key={p.id}>
                  <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
                    <span className="font-medium">{p.title ?? "Project"}</span>
                    <span>{typeof p.completion === "number" ? `${Math.round(p.completion)}%` : "0%"}</span>
                  </div>
                  <div className="h-2 rounded bg-neutral-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500"
                      style={{ width: `${Math.round(p.completion ?? 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-white">
          {messages.map((m) => {
            const mine = m.senderId === user.uid;
            const t = m.createdAt?.toDate();
            const time = t ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
            const isUpdate = m.kind === "update";
            return isUpdate ? (
              <div
                key={m.id}
                className="mr-auto max-w-[90%] rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-amber-200 text-amber-900">
                    Update
                  </span>
                  <span className="text-[11px] text-amber-800">{time}</span>
                </div>
                <div>{m.text || "(empty update)"}</div>
              </div>
            ) : (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow ${
                  mine ? "ml-auto bg-blue-600 text-white" : "mr-auto bg-neutral-100 text-neutral-900"
                }`}
              >
                <div>{m.text || "(empty)"}</div>
                <div className={`mt-1 text-[11px] ${mine ? "text-blue-100" : "text-neutral-500"}`}>
                  {time}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="grid place-items-center h-full text-neutral-400">No messages yet.</div>
          )}
        </div>

        <div className="p-3 border-t border-neutral-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              disabled={!canSend}
              className="px-3 py-2 rounded-md bg-black text-white hover:bg-neutral-800 disabled:opacity-60"
              type="submit"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}