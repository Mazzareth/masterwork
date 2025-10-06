"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_LABELS, pageVisibility } from "@/config/pages";

const ADMIN_EMAIL = "mercysquadrant@gmail.com";

type Entry = { key: keyof typeof pageVisibility; href: string; label: string };

export default function Header() {
  const { user, profile, permissions, loginWithGoogle, logout } = useAuth();
  const pathname = usePathname();
  const isTeach = pathname === "/teach" || pathname?.startsWith("/teach/");
  const isAdmin = !!user && (user.email === ADMIN_EMAIL || profile?.email === ADMIN_EMAIL);

  const entries: Entry[] = useMemo(() => {
    if (!user || !permissions) return [];
    const base: Entry[] = [
      { key: "teach", href: "/teach", label: PAGE_LABELS.teach },
      { key: "gote", href: "/gote", label: PAGE_LABELS.gote },
      { key: "zzq", href: "/zzq", label: PAGE_LABELS.zzq },
      { key: "cc", href: "/cc", label: PAGE_LABELS.cc },
      { key: "inhouse", href: "/inhouse", label: PAGE_LABELS.inhouse },
    ];
    return base.filter((e) => pageVisibility[e.key] && Boolean(permissions[e.key]));
  }, [user, permissions]);

  return (
    <header
      className={[
        "sticky top-0 z-40 backdrop-blur",
        isTeach
          ? "border-transparent bg-gradient-to-b from-white/60 to-transparent dark:from-black/20 supports-[backdrop-filter]:from-white/30 dark:supports-[backdrop-filter]:from-black/10"
          : "border-b border-neutral-200/60 dark:border-white/10 bg-white/70 dark:bg-[#0b1020]/70 supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-[#0b1020]/60",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          {isTeach ? (
            <span className="shrink-0 select-none text-sm font-semibold tracking-wide text-neutral-900 dark:text-slate-200">
              <span className="text-gradient">Lessons</span>
            </span>
          ) : (
            <Link href="/" className="shrink-0 select-none">
              <span className="text-sm font-semibold tracking-wide text-neutral-900 dark:text-slate-200">
                <span className="text-gradient">Masterwork</span>
              </span>
            </Link>
          )}
          {!isTeach && entries.length > 0 && (
            <nav className="hidden sm:flex items-center gap-1">
              {entries.map((e) => {
                const active = pathname === e.href || pathname?.startsWith(e.href + "/");
                return (
                  <Link
                    key={e.key}
                    href={e.href}
                    className={[
                      "px-2.5 py-1.5 rounded-md text-sm transition",
                      active
                        ? "text-neutral-900 dark:text-slate-100 bg-neutral-900/[0.04] dark:bg-white/10 border border-neutral-200/60 dark:border-white/10"
                        : "text-neutral-700 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-neutral-900/[0.03] dark:hover:bg-white/5 border border-transparent",
                    ].join(" ")}
                  >
                    {e.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <button
              onClick={loginWithGoogle}
              className="px-3 py-1.5 rounded-md bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition text-sm"
            >
              Login
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
              <span className="hidden sm:inline text-sm text-neutral-700 dark:text-slate-300 truncate max-w-[14ch]">
                {profile?.displayName ?? profile?.email ?? user.uid}
              </span>
              {isAdmin && (
                <Link
                  href="/clients"
                  className="px-2.5 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 transition text-sm"
                >
                  Clients
                </Link>
              )}
              <button
                onClick={logout}
                className="px-2.5 py-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/10 transition text-sm"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}