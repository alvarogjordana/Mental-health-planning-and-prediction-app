"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    href: "/report",
    icon: "📊",
    label: "Weekly Report",
    description: "AI-powered weekly analysis",
  },
  {
    href: "/trends",
    icon: "📈",
    label: "Projections",
    description: "Trends & 7-day forecast",
  },
  {
    href: "/data",
    icon: "🗄️",
    label: "Data",
    description: "Inputs & score history",
  },
  {
    href: "/history",
    icon: "📋",
    label: "History",
    description: "Daily check-in log",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; initials: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const name = d.name ?? "";
        const initials = name
          .split(" ")
          .slice(0, 2)
          .map((w: string) => w[0] ?? "")
          .join("")
          .toUpperCase();
        setUser({ name: name.split(" ")[0], initials });
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div
      className="fixed left-0 top-0 h-screen w-[240px] flex flex-col z-20"
      style={{ backgroundColor: "#fff", borderRight: "1px solid #E2E8F0" }}
    >
      {/* Wordmark */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid #E2E8F0" }}>
        <Link href="/">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
            Freedom
          </span>
          <p className="mt-0.5 text-[11px]" style={{ color: "#CBD5E1" }}>
            Wellbeing tracker
          </p>
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
              style={{ backgroundColor: active ? "#EEF2FF" : "transparent" }}
            >
              <span className="mt-0.5 text-base leading-none">{item.icon}</span>
              <div>
                <p
                  className="text-sm font-medium leading-snug"
                  style={{ color: active ? "#1B4FD8" : "#0F172A" }}
                >
                  {item.label}
                </p>
                <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#94A3B8" }}>
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}

        {/* Divider + Dashboard */}
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid #E2E8F0" }}>
          <Link
            href="/"
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
            style={{ backgroundColor: pathname === "/" ? "#EEF2FF" : "transparent" }}
          >
            <span className="mt-0.5 text-base leading-none">🏠</span>
            <div>
              <p
                className="text-sm font-medium leading-snug"
                style={{ color: pathname === "/" ? "#1B4FD8" : "#0F172A" }}
              >
                Dashboard
              </p>
              <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#94A3B8" }}>
                Your wellbeing overview
              </p>
            </div>
          </Link>
        </div>
      </nav>

      {/* Check-in CTA */}
      <div className="px-4 pb-3">
        <Link
          href="/checkin"
          className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1B4FD8" }}
        >
          ✅ Log check-in
        </Link>
      </div>

      {/* User row */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid #E2E8F0" }}
      >
        <Link href="/profile" className="flex items-center gap-2.5 min-w-0">
          {user?.initials ? (
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: "#1B4FD8" }}
            >
              {user.initials}
            </div>
          ) : (
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "#F1F5F9" }}
            />
          )}
          <span className="text-sm font-medium truncate" style={{ color: "#0F172A" }}>
            {user?.name ?? ""}
          </span>
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="shrink-0 transition-opacity hover:opacity-60"
          style={{ color: "#94A3B8" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
