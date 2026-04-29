"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/assessment/refresh", { method: "POST" });
    } finally {
      // router.refresh() re-runs the server component, picking up the new DB row
      router.refresh();
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs transition-colors"
      style={{
        color: loading ? "#CBD5E1" : "#94A3B8",
        cursor: loading ? "default" : "pointer",
      }}
    >
      {loading ? "Regenerating..." : "Regenerate ↻"}
    </button>
  );
}
