"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PageRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={() => { setBusy(true); router.refresh(); }}
      disabled={busy}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        border: "1px solid #E2E8F0",
        backgroundColor: busy ? "#F1F5F9" : "#fff",
        color: busy ? "#CBD5E1" : "#475569",
        cursor: busy ? "default" : "pointer",
      }}
    >
      {busy ? "Refreshing…" : "↻ Refresh all"}
    </button>
  );
}
