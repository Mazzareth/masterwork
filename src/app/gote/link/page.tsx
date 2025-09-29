"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { acceptGoteInvite } from "../../../lib/gote";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type State =
  | { phase: "idle" }
  | { phase: "validating" }
  | { phase: "ready"; ownerId: string; token: string }
  | { phase: "accepting" }
  | { phase: "accepted"; chatId: string }
  | { phase: "error"; message: string };

function GoteLinkAcceptPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading, loginWithGoogle } = useAuth();

  const ownerId = params.get("ownerId") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>({ phase: "idle" });
  const validatedKeyRef = useRef<string | null>(null);

  const isParamsValid = useMemo(() => {
    return ownerId.length > 0 && token.length > 0;
  }, [ownerId, token]);

  useEffect(() => {
    if (!isParamsValid) {
      setState({ phase: "error", message: "Invalid or missing link parameters." });
      return;
    }
    if (loading) return; // wait for auth to resolve

    // Require sign-in before validation (rules require isSignedIn())
    if (!user) {
      // Prepare UI; validate after login
      setState({ phase: "ready", ownerId, token });
      return;
    }

    // De-dup validation for a given user+invite combo to prevent flicker
    const key = `${user.uid}:${ownerId}:${token}`;
    if (validatedKeyRef.current === key) {
      return;
    }

    setState({ phase: "validating" });
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", ownerId, "sites", "gote", "invites", token));
        if (!snap.exists()) {
          setState({ phase: "error", message: "Invite not found, used, or revoked." });
          return;
        }
        validatedKeyRef.current = key;
        setState({ phase: "ready", ownerId, token });
      } catch {
        setState({
          phase: "error",
          message: "Unable to read invite. Sign in and ensure the invite is active and not expired.",
        });
      }
    })();
  }, [isParamsValid, ownerId, token, user, loading]);

  const onAccept = async () => {
    if (!user) return;
    try {
      setState({ phase: "accepting" });
      const res = await acceptGoteInvite({ ownerId, token, userId: user.uid });
      setState({ phase: "accepted", chatId: res.chatId });
      // Redirect to BigGote home; access requires permissions.gote = true
      setTimeout(() => {
        router.replace("/gote");
      }, 900);
    } catch (err: unknown) {
      const code = String((err as Error)?.message || "");
      let friendly = "Failed to accept invite.";
      if (code === "PERM_INVITE_GET") {
        friendly =
          "Permission denied reading invite. Rules must allow GET on /users/{ownerId}/sites/gote/invites/{token} when active.";
      } else if (code === "PERM_CHAT_CREATE") {
        friendly =
          "Permission denied creating chat. Rules must allow CREATE/UPDATE on /goteChats/{chatId} for participants.";
      } else if (code === "PERM_SUMMARY_SET") {
        friendly =
          "Permission denied writing your BigGote summary: /users/{uid}/sites/gote/chats/{chatId}. Ensure owner-only write is allowed (self-owned path).";
      } else if (code === "PERM_INVITE_UPDATE") {
        friendly =
          "Permission denied updating invite to used. Rules must allow accepting user to set status='used' with usedBy=uid.";
      } else if (code === "INVITE_NOT_FOUND") {
        friendly = "Invite not found or revoked.";
      } else if (code === "INVITE_NOT_USABLE") {
        friendly = "Invite is not usable (expired or used).";
      }
      setState({ phase: "error", message: friendly });
    }
  };

  // Loading phases
  if (loading || state.phase === "idle" || state.phase === "validating") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-white/70">Preparing link…</div>
        </div>
      </div>
    );
  }

  // Require params
  if (!isParamsValid) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white p-6">
        <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.03] p-5">
          <h1 className="text-xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-white/70 mb-4">
            The link is missing required parameters.
          </p>
          <Link href="/" className="text-sm text-white/80 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Require sign-in first (rules require it to read the invite)
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white p-6">
        <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.03] p-5 flex flex-col items-center">
          <h1 className="text-xl font-semibold mb-2">Sign in to Accept Invite</h1>
          <p className="text-white/70 mb-4 text-center">
            You need to sign in to link this chat to your account.
          </p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded-md bg-white text-black hover:bg-white/90"
          >
            Login with Google
          </button>
          <Link href="/" className="mt-3 text-sm text-white/80 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Error after validation
  if (state.phase === "error") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white p-6">
        <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.03] p-5">
          <h1 className="text-xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-white/70 mb-4">
            {state.message}
          </p>
          <Link href="/" className="text-sm text-white/80 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Accepted
  if (state.phase === "accepted") {
    return (
      <div className="min-h-screen grid place-items-center bg-black text-white p-6">
        <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.03] p-5 text-center">
          <h1 className="text-xl font-semibold mb-2">Link Accepted</h1>
          <p className="text-white/70">
            Your BigGote chat is ready. Redirecting…
          </p>
          <div className="mt-4">
            <Link
              href="/gote"
              className="px-4 py-2 rounded-md border border-white/15 hover:bg-white/[0.06] inline-block"
            >
              Go to BigGote
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ready / Accepting
  return (
    <div className="min-h-screen grid place-items-center bg-black text-white p-6">
      <div className="w-full max-w-md rounded-lg border border-white/15 bg-white/[0.03] p-5">
        <h1 className="text-xl font-semibold mb-2">Accept BigGote Invite</h1>
        <p className="text-white/70 mb-4">
          By accepting, you will be able to chat in BigGote with the inviter. Helper modules (references, shared pin, enjoyment) are available inside the chat UI.
        </p>
        <div className="flex items-center gap-3">
          <button
            disabled={state.phase === "accepting"}
            onClick={onAccept}
            className="px-4 py-2 rounded-md bg-white text-black hover:bg-white/90 disabled:opacity-60"
          >
            {state.phase === "accepting" ? "Accepting…" : "Accept Link"}
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-md border border-white/15 hover:bg-white/[0.06]"
          >
            Cancel
          </Link>
        </div>
        <div className="mt-3 text-xs text-white/50">
          Owner: {ownerId.slice(0, 6)}… • Token: {token.slice(0, 6)}…
        </div>
      </div>
    </div>
  );
}

export default function GoteLinkAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-black text-white p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="spinner" aria-label="Loading" />
            <div className="text-white/70">Preparing link…</div>
          </div>
        </div>
      }
    >
      <GoteLinkAcceptPageInner />
    </Suspense>
  );
}