"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { PAGE_LABELS, pageVisibility } from "../config/pages";

type Entry = {
  key: keyof typeof pageVisibility;
  href: string;
  label: string;
};

const entries: Entry[] = [
  { key: "teach", href: "/teach", label: PAGE_LABELS.teach },
  { key: "zzq", href: "/zzq", label: PAGE_LABELS.zzq },
  { key: "cc", href: "/cc", label: PAGE_LABELS.cc },
  { key: "inhouse", href: "/inhouse", label: PAGE_LABELS.inhouse },
];

export default function Home() {
  const { user, permissions, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/teach");
      return;
    }
    if (permissions) {
      const other = Boolean(permissions.zzq || permissions.cc || permissions.inhouse || permissions.gote);
      if (!other && permissions.teach) {
        router.replace("/teach");
      }
    }
  }, [user, permissions, loading, router]);

  const visibleEntries =
    user && permissions
      ? entries.filter((e) => pageVisibility[e.key] && Boolean(permissions[e.key]))
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-black">

      <main className="mx-auto max-w-5xl px-4 py-16">
        {loading ? (
          <div className="grid place-items-center py-20 text-neutral-600">Loading…</div>
        ) : !user ? (
          <section className="mx-auto max-w-xl text-center py-20">
            <h2 className="text-3xl font-semibold tracking-tight mb-2">Welcome</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Sign in to view your available destinations.
            </p>
            <button
              onClick={loginWithGoogle}
              className="px-5 py-2.5 rounded-md bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 transition"
            >
              Login with Google
            </button>
          </section>
        ) : (
          <>
            {visibleEntries.length === 0 ? (
              <div className="grid place-items-center py-24 text-neutral-600">No accessible pages.</div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {visibleEntries.map((e) => (
                  <li key={e.key}>
                    <Link
                      href={e.href}
                      className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 backdrop-blur p-4 hover:shadow-md hover:-translate-y-0.5 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium">{e.label}</span>
                        <span className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition">
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}