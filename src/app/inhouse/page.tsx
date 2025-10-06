"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function InHousePage() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/teach");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && !permissions?.inhouse) {
      router.replace("/teach");
    }
  }, [loading, user, permissions?.inhouse, router]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">InHouse</h1>
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

  if (!permissions?.inhouse) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-neutral-600">You do not have access to InHouse.</p>
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
        <h1 className="text-2xl font-semibold">InHouse</h1>
        <p className="text-neutral-600">Placeholder content for InHouse.</p>
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