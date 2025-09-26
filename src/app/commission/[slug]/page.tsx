"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { openOrEnsureCommissionChat } from "@/lib/commission";
import { sendChatMessage } from "@/lib/linking";

type State =
  | { phase: "loading" }
  | { phase: "ready"; ownerId: string }
  | { phase: "not_found" }
  | { phase: "submitting"; ownerId: string }
  | { phase: "error"; message: string };

export default function CommissionPage() {
  const params = useParams() as { slug?: string };
  const slug = (params?.slug || "").toString().toLowerCase();
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<State>({ phase: "loading" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setState({ phase: "loading" });
      try {
        const snap = await getDoc(doc(db, "commissionSlugs", slug));
        if (!snap.exists()) {
          if (!cancelled) setState({ phase: "not_found" });
          return;
        }
        const ownerId = (snap.data() as { ownerId?: string }).ownerId || "";
        if (!ownerId) {
          if (!cancelled) setState({ phase: "not_found" });
          return;
        }
        if (!cancelled) setState({ phase: "ready", ownerId });
      } catch {
        if (!cancelled) setState({ phase: "error", message: "Unable to load commission page." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canSubmit = useMemo(() => {
    return Boolean(user) && state.phase === "ready" && !loading;
  }, [user, state.phase, loading]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (state.phase !== "ready") return;
    const ownerId = state.ownerId;
    try {
      setState({ phase: "submitting", ownerId });
      const res = await openOrEnsureCommissionChat({
        ownerId,
        userId: user.uid,
        clientDisplayName: user.displayName,
        slug,
      });
      const text = message.trim();
      if (text) {
        try {
          await sendChatMessage({ chatId: res.chatId, senderId: user.uid, text });
        } catch {
          // ignore send error; chat is created
        }
      }
      router.replace(`/cc/chat/${res.chatId}`);
    } catch {
      setState({ phase: "error", message: "Failed to start chat." });
    }
  };

  // Loading or resolving
  if (state.phase === "loading" || loading) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-sm text-slate-400">Preparing commission page…</div>
        </div>
      </div>
    );
  }

  if (state.phase === "not_found") {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300 p-6">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 text-center">
          <h1 className="text-xl font-semibold mb-2">
            <span className="text-gradient">Commission</span>
          </h1>
          <p className="text-slate-400">This commission page is not available.</p>
          <div className="mt-4">
            <Link href="/" className="text-sm text-cyan-400 hover:underline">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen zzq-bg grid place-items-center text-slate-300 p-6">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 text-center">
          <h1 className="text-xl font-semibold mb-2">
            <span className="text-gradient">Commission</span>
          </h1>
          <p className="text-slate-400 mb-4">Sign in to continue.</p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 active:scale-[.98] transition"
          >
            Continue with Google
          </button>
          <div className="mt-4">
            <Link href="/" className="text-sm text-cyan-400 hover:underline">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ready or submitting
  return (
    <div className="min-h-screen zzq-bg text-slate-200">
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-lg">
          <div className="p-5 border-b border-white/10">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Commission</div>
            <h1 className="text-lg font-semibold">Start a Commission</h1>
            <div className="mt-1 text-xs text-slate-500">Slug: /commission/{slug}</div>
          </div>

          <form onSubmit={onSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm mb-1">Message to the artist</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Briefly describe your commission request (optional)"
                rows={5}
                className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-slate-500"
              />
            </div>

            <div className="text-xs text-slate-500">Attachments: coming soon</div>

            <div className="flex items-center gap-3">
              <button
                disabled={!canSubmit || state.phase === "submitting"}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-95 disabled:opacity-60"
                type="submit"
              >
                {state.phase === "submitting" ? "Starting…" : "Start Chat"}
              </button>
              <Link href="/cc" className="text-sm text-cyan-400 hover:underline">
                Go to CC
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}