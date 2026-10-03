"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Flame, Home, Target, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { getCurrentUserAsync } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/diary", label: "Diary", icon: BookOpen },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState({ name: "User", initials: "U" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUserAsync();
        if (cancelled || !user) return;

      const name = user.name?.trim() || "User";
      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      setProfile({ name, initials: initials || "U" });
      } catch (error) {
        console.error("Failed to read saved user", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/auth") {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/10 bg-neutral-950/80 px-4 py-6 shadow-[18px_0_48px_rgba(0,0,0,0.2)] backdrop-blur-2xl md:flex">
      <Link href="/" className="flex items-center gap-3 px-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-400/25 bg-green-500/15 shadow-[0_0_24px_rgba(34,197,94,0.2)]">
          <Flame className="h-6 w-6 fill-green-500 text-green-400" />
        </span>
        <span>
          <span className="gradient-heading block text-xl font-black">Cal AI</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Nutrition OS</span>
        </span>
      </Link>

      <nav className="mt-10 flex flex-col gap-1.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all duration-300 ${
                isActive
                  ? "bg-green-500/15 text-green-400 shadow-[inset_3px_0_0_#22c55e]"
                  : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-500/25 bg-green-500/15 text-xs font-black text-green-100">{profile.initials}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-100">{profile.name}</p>
          <p className="truncate text-xs font-medium text-neutral-500">Health journey</p>
        </div>
      </div>
    </aside>
  );
}
