"use client";

import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";

export default function CCPage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();

  if (loading) {
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

  if (!permissions?.cc) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-neutral-600">You do not have access to CC.</p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-xl flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">CC</h1>
        <p className="text-neutral-600">Placeholder content for CC.</p>
        <Link
          href="/"
          className="px-4 py-2 rounded border border-neutral-300 hover:bg-neutral-100"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}