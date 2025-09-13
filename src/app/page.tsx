"use client";

import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { PAGE_LABELS, pageVisibility } from "../config/pages";

type Entry = {
  key: keyof typeof pageVisibility;
  href: string;
  label: string;
};

const entries: Entry[] = [
  { key: "zzq", href: "/zzq", label: PAGE_LABELS.zzq },
  { key: "cc", href: "/cc", label: PAGE_LABELS.cc },
  { key: "inhouse", href: "/inhouse", label: PAGE_LABELS.inhouse },
];

export default function Home() {
  const { user, profile, permissions, loading, loginWithGoogle, logout } = useAuth();

  const visibleEntries =
    user && permissions
      ? entries.filter((e) => pageVisibility[e.key] && Boolean(permissions[e.key]))
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-black">
      <nav className="sticky top-0 z-10 border-b border-neutral-200/60 dark:border-neutral-800/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-950/40">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-end gap-3">
          {!user ? (
            <button
              onClick={loginWithGoogle}
              className="px-4 py-2 rounded-md bg-black text-white hover:bg-neutral-800 active:bg-neutral-900 transition"
            >
              Login with Google
            </button>
          ) : (
            <>
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoURL}
                  alt="avatar"
                  className="w-8 h-8 rounded-full ring-1 ring-black/5"
                />
              ) : null}
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {profile?.displayName ?? profile?.email ?? user.uid}
              </span>
              <button
                onClick={logout}
                className="px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

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