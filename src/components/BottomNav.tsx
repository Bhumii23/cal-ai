"use client";

import Link from "next/link";
import { BarChart3, BookOpen, Home, Target, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/diary", label: "Diary", icon: BookOpen },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/auth") {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-950/70 shadow-[0_-12px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto grid h-20 max-w-md grid-cols-5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-90 ${
                isActive ? "text-green-500" : "text-neutral-500 hover:text-neutral-200"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-green-500 shadow-[0_0_14px_#22c55e]" />}
              <Icon className={`h-6 w-6 transition-transform duration-300 ${isActive ? "-translate-y-0.5" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-bold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
