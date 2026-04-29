/**
 * Shared app header — used by all pages.
 *
 * Dashboard variant (no backHref): shows "Freedom" wordmark on the left,
 * user name + avatar on the right.
 *
 * Sub-page variant (backHref provided): shows "← Back to dashboard" on the left,
 * page label centered, nav icons + profile icon on the right.
 */
import Link from "next/link";
import { ClipboardList, TrendingUp, FileText, Database, User } from "lucide-react";

const MUTED    = "#94A3B8";
const PRIMARY  = "#1B4FD8";
const BORDER   = "#E2E8F0";

interface HeaderProps {
  /** If set, renders a back link on the left. Otherwise shows "Freedom" wordmark. */
  backHref?: string;
  /** Center label shown on sub-pages (e.g. "History", "Trends"). */
  pageLabel?: string;
  /** First name displayed on the dashboard header (optional). */
  userName?: string;
  /** Avatar initials shown as a filled circle (dashboard only). Links to /profile. */
  initials?: string;
}

export function Header({ backHref, pageLabel, userName, initials }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
      {/*
        Three-column grid so the center label is always truly centered
        regardless of the width of the left/right items.
      */}
      <div className="mx-auto grid max-w-[680px] grid-cols-3 items-center px-6 py-3">

        {/* ── Left ── */}
        <div>
          {backHref ? (
            <Link href={backHref} className="text-sm" style={{ color: MUTED }}>
              ← Back to dashboard
            </Link>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
              Freedom
            </span>
          )}
        </div>

        {/* ── Center ── */}
        <div className="text-center">
          {pageLabel && (
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
              {pageLabel}
            </span>
          )}
        </div>

        {/* ── Right: nav icons + optional user info ── */}
        <div className="flex items-center justify-end gap-2.5">
          <Link href="/history" aria-label="Check-in history" className="transition-opacity hover:opacity-70">
            <ClipboardList size={18} style={{ color: MUTED }} />
          </Link>
          <Link href="/trends" aria-label="Trends & Forecast" className="transition-opacity hover:opacity-70">
            <TrendingUp size={18} style={{ color: MUTED }} />
          </Link>
          <Link href="/report" aria-label="Weekly report" className="transition-opacity hover:opacity-70">
            <FileText size={18} style={{ color: MUTED }} />
          </Link>
          <Link href="/data" aria-label="Data sources" className="transition-opacity hover:opacity-70">
            <Database size={18} style={{ color: MUTED }} />
          </Link>

          {userName && (
            <span className="text-sm" style={{ color: "#475569" }}>
              {userName}
            </span>
          )}

          {initials ? (
            <Link href="/profile" aria-label="Edit profile">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: PRIMARY }}
              >
                {initials}
              </div>
            </Link>
          ) : (
            <Link href="/profile" aria-label="Edit profile" className="transition-opacity hover:opacity-70">
              <User size={18} style={{ color: MUTED }} />
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
