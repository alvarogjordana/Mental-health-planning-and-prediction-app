"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

// These routes get a full-screen focused layout with no sidebar
const NO_SHELL = ["/login", "/onboarding", "/checkin"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = NO_SHELL.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
      <Sidebar />
      <main className="flex-1 min-w-0" style={{ marginLeft: 240 }}>
        {children}
      </main>
    </div>
  );
}
