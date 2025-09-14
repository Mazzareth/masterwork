"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { acceptInvite } from "../../../lib/linking";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type State =
  | { phase: "idle" }
  | { phase: "validating" }
  | { phase: "ready"; ownerId: string; token: string }
  | { phase: "accepting" }
  | { phase: "accepted"; chatId: string; clientId: string; clientDisplayName: string }
  | { phase: "error"; message: string };

function CCLinkAcceptPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading, loginWithGoogle } = useAuth();

  const ownerId = params.get("ownerId") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>({ phase: "idle" });

  const isParamsValid = useMemo(() => {
    return ownerId.length > 0 && token.length > 0;
  }, [ownerId, token]);

  useEffect(() => {
    if (state.phase !== "idle") return;
    if (!isParamsValid) {
      setState({ phase: "error", message: "Invalid or missing link parameters." });
      return;
    }
    setState({ phase: "validating" });

    // Preflight read to surface rules issues early (must be allowed by rules)
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", ownerId, "sites", "zzq", "invites", token));
        if (!snap.exists()) {
          setState({ phase: "error", message: "Invite not found or revoked." });
          return;
        }
        setState({ phase: "ready", ownerId, token });
      } catch {
        setState({
          phase: "error",
          message:
            "Unable to read invite (permissions). Ensure Firestore rules allow GET on /users/{ownerId}/sites/zzq/invites/{token} for signed-in users when active.",
        });
      }
    })();
  }, [state.phase, isParamsValid, ownerId, token]);

  const onAccept = async () => {
    if (!user) return;
    const u = user;
    try {
      setState({ phase: "accepting" });
      const res = await acceptInvite({ ownerId, token, userId: u.uid });
      setState({ phase: "accepted", chatId: res.chatId, clientId: res.clientId, clientDisplayName: res.clientDisplayName });
      setTimeout(() => {
        router.replace("/cc");
      }, 900);
    } catch (err: unknown) {
      const code = String((err as Error)?.message || "");
      let friendly = "Failed to accept invite.";
      if (code === "PERM_INVITE_GET") {
        friendly =
          "Permission denied reading invite. Rules must allow GET on /users/{ownerId}/sites/zzq/invites/{token} when active.";
      } else if (code === "PERM_CHAT_CREATE") {
        friendly =
          "Permission denied creating chat. Rules must allow CREATE on /chats/{chatId} for participants.";
      } else if (code === "PERM_SUMMARY_SET") {
        friendly =
          "Permission denied writing your CC summary: /users/{uid}/sites/cc/chats/{chatId}. Ensure owner-only write is allowed.";
      } else if (code === "PERM_LINK_SET") {
        friendly =
          "Permission denied writing your CC link: /users/{uid}/sites/cc/links/{chatId}. Ensure owner-only write is allowed.";
      } else if (code === "PERM_INVITE_UPDATE") {
        friendly =
          "Permission denied updating invite to used. Rules must allow accepting user to set status to 'used' with usedBy=uid.";
      } else if (code === "INVITE_NOT_FOUND") {
        friendly = "Invite not found or revoked.";
      } else if (code === "INVITE_NOT_USABLE") {
        friendly = "Invite is not usable (expired or used).";
      }
      setState({ phase: "error", message: friendly });
    }
  };

  if (loading || state.phase === "idle" || state.phase === "validating") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-label="Loading" />
          <div className="text-neutral-600">Preparing link…</div>
        </div>
      </div>
    );
  }

  if (!isParamsValid || state.phase === "error") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 p-5">
          <h1 className="text-xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-neutral-600 mb-4">
            {state.phase === "error" ? state.message : "The link is missing required parameters."}
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 p-5 flex flex-col items-center">
          <h1 className="text-xl font-semibold mb-2">Sign in to Accept Invite</h1>
          <p className="text-neutral-600 mb-4 text-center">
            You need to sign in to link this client to your account.
          </p>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 rounded bg-black text-white hover:bg-neutral-800"
          >
            Login with Google
          </button>
          <Link href="/" className="mt-3 text-sm text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === "accepted") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 p-5 text-center">
          <h1 className="text-xl font-semibold mb-2">Link Accepted</h1>
          <p className="text-neutral-600">
            You can now chat about <span className="font-medium">{state.clientDisplayName}</span> in CC.
          </p>
          <div className="mt-4">
            <Link
              href="/cc"
              className="px-4 py-2 rounded border border-neutral-300 hover:bg-neutral-100 inline-block"
            >
              Go to CC
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ready or Accepting
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 p-5">
        <h1 className="text-xl font-semibold mb-2">Accept Client Link</h1>
        <p className="text-neutral-700 mb-4">
          By accepting, you will be linked to the artist&#39;s client in CC and can exchange messages. Their internal ZZQ notes and projects remain private.
        </p>
        <div className="flex items-center gap-3">
          <button
            disabled={state.phase === "accepting"}
            onClick={onAccept}
            className="px-4 py-2 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {state.phase === "accepting" ? "Accepting…" : "Accept Link"}
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded border border-neutral-300 hover:bg-neutral-100"
          >
            Cancel
          </Link>
        </div>
        <div className="mt-3 text-xs text-neutral-500">
          Owner: {ownerId.slice(0, 6)}… • Token: {token.slice(0, 6)}…
        </div>
      </div>
    </div>
  );
}

export default function CCLinkAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="spinner" aria-label="Loading" />
            <div className="text-neutral-600">Preparing link…</div>
          </div>
        </div>
      }
    >
      <CCLinkAcceptPageInner />
    </Suspense>
  );
}