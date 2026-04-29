"use client";

import { useState } from "react";

export interface HelpItem {
  title: string;
  description: string;
}

export function HelpBubble({ items }: { items: HelpItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {open && (
        <div
          className="mb-3 w-[300px] rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid #E2E8F0" }}
          >
            <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
              About this page
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: "#94A3B8" }}
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-3 flex flex-col gap-4 max-h-[400px] overflow-y-auto">
            {items.map((item, i) => (
              <div key={i}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#0F172A" }}>
                  {item.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white transition-all hover:scale-105 shadow-lg"
        style={{ backgroundColor: "#1B4FD8", fontSize: 18 }}
        aria-label="Page guide"
      >
        ?
      </button>
    </div>
  );
}
