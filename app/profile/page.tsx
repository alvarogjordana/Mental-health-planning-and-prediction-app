"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Header } from "@/components/Header";

/* ─── Types ─── */
interface ProfileData {
  name: string;
  location: string;
  lifeStage: string;
  energizers: string[];
  drainers: string[];
  introvertExtrovert: string;
  decisionStyle: string;
  verticalWeights: Record<string, number>;
  oneGoal: string;
  calendarsConnected?: { casa: boolean; outlook: boolean };
}

/* ─── Static options (mirrors onboarding) ─── */
const LIFE_STAGES = [
  "Student", "Early career", "Mid career", "Senior / executive",
  "Career transition", "Parent (primary focus)", "Retired", "Other",
];
const ENERGIZER_OPTIONS = [
  "Exercise", "Time alone", "Deep conversations", "Creative work",
  "Being in nature", "Learning something new", "Social gatherings",
  "Helping others", "Spiritual practice", "Travel", "Music", "Reading",
];
const DRAINER_OPTIONS = [
  "Back-to-back meetings", "Small talk", "Poor sleep", "No time to myself",
  "Feeling unproductive", "Conflict", "Commuting", "Screen overload",
  "Lack of exercise", "Feeling disconnected from people", "Uncertainty", "Routine / repetition",
];
const INTROVERT_OPTIONS = [
  { value: "introvert", label: "Be alone (introvert)" },
  { value: "extrovert", label: "Be with others (extrovert)" },
  { value: "depends",   label: "It really depends" },
];
const DECISION_OPTIONS = [
  { value: "logic", label: "With logic and data" },
  { value: "gut",   label: "With gut feeling and values" },
  { value: "mix",   label: "A mix of both" },
];
const VERTICAL_CONFIG: Record<string, { icon: string; name: string }> = {
  HEALTH:    { icon: "🏃", name: "Health & Fitness" },
  WORK_LIFE: { icon: "⚖️", name: "Work-Life Balance" },
  SOCIAL:    { icon: "🤝", name: "Social Connection" },
  PURPOSE:   { icon: "🧭", name: "Sense of Purpose" },
  SLEEP:     { icon: "🌙", name: "Sleep & Energy" },
};

/* ─── Design tokens ─── */
const PRIMARY = "#1B4FD8";
const TEXT    = "#0F172A";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8F0";

/* ─── Page ─── */
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [draft, setDraft]     = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (r.status === 404) { router.replace("/onboarding"); return null; }
        return r.json() as Promise<ProfileData>;
      })
      .then((data) => {
        if (!data) return;
        setProfile(data);
        setDraft(data);
      })
      .finally(() => setLoading(false));

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [router]);

  const isDirty =
    profile !== null &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(profile);

  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) =>
    setDraft((d) => d ? { ...d, [key]: value } : d);

  const startEdit = (field: string) => setActiveField(field);
  const stopEdit  = () => setActiveField(null);
  const isEditing = (field: string) => activeField === field;

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               draft.name,
          location:           draft.location,
          lifeStage:          draft.lifeStage,
          energizers:         draft.energizers,
          drainers:           draft.drainers,
          introvertExtrovert: draft.introvertExtrovert,
          decisionStyle:      draft.decisionStyle,
          oneGoal:            draft.oneGoal,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setProfile(draft);
      setSaveState("saved");
      saveTimer.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading / empty states ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        <Header backHref="/" pageLabel="Profile" />

        <main className="mx-auto max-w-[680px] px-6 pt-8">
          {/* Page title skeleton */}
          <div className="mb-6">
            <div className="h-7 w-48 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-slate-200" />
          </div>

          <div className="flex flex-col gap-4">
            {/* Personal card skeleton */}
            <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mb-4 h-3 w-16 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200" />
              <div className="my-4" style={{ borderTop: `1px solid ${BORDER}` }} />
              <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200" />
            </div>

            {/* What drives you card skeleton */}
            <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mb-4 h-3 w-28 animate-pulse rounded-md bg-slate-200" />
              <div className="flex flex-wrap gap-2">
                {[80, 96, 72, 88].map((w, i) => (
                  <div key={i} className="h-7 animate-pulse rounded-full bg-slate-200" style={{ width: w }} />
                ))}
              </div>
              <div className="my-4" style={{ borderTop: `1px solid ${BORDER}` }} />
              <div className="flex flex-wrap gap-2">
                {[72, 88, 64, 96].map((w, i) => (
                  <div key={i} className="h-7 animate-pulse rounded-full bg-slate-200" style={{ width: w }} />
                ))}
              </div>
            </div>

            {/* How you're wired card skeleton */}
            <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mb-4 h-3 w-24 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200" />
              <div className="my-4" style={{ borderTop: `1px solid ${BORDER}` }} />
              <div className="h-4 w-36 animate-pulse rounded-md bg-slate-200" />
            </div>

            {/* Priorities card skeleton */}
            <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mb-4 h-3 w-24 animate-pulse rounded-md bg-slate-200" />
              <div className="flex flex-col gap-3">
                {[65, 45, 78, 55, 40].map((pct, i) => (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200" />
                      <div className="h-4 w-8 animate-pulse rounded-md bg-slate-200" />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full animate-pulse rounded-full bg-slate-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save button skeleton */}
          <div className="mt-6 pb-10">
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
          </div>
        </main>
      </div>
    );
  }
  if (!draft) return null;

  /* ── Vertical weights (sorted by value) ── */
  const sortedWeights = Object.entries(draft.verticalWeights).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">

      <Header backHref="/" pageLabel="Profile" />

      <main className="mx-auto max-w-[680px] px-6 pt-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: TEXT }}>
            {draft.name}&apos;s Profile
          </h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Your preferences shape how Freedom assesses your wellbeing.
          </p>
        </div>

        <div className="flex flex-col gap-4">

          {/* ── Personal ── */}
          <SectionCard title="Personal">
            <FieldBlock label="Name">
              {isEditing("name") ? (
                <input
                  autoFocus
                  type="text"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={stopEdit}
                  onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                  className="w-full border-b bg-transparent pb-0.5 text-[15px] outline-none"
                  style={{ borderColor: PRIMARY, color: TEXT }}
                />
              ) : (
                <EditableValue value={draft.name || "—"} onEdit={() => startEdit("name")} />
              )}
            </FieldBlock>

            <Divider />

            <FieldBlock label="Life stage">
              {isEditing("lifeStage") ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {LIFE_STAGES.map((opt) => (
                    <OptionChip
                      key={opt}
                      label={opt}
                      selected={draft.lifeStage === opt}
                      onClick={() => { set("lifeStage", opt); stopEdit(); }}
                    />
                  ))}
                </div>
              ) : (
                <EditableValue
                  value={draft.lifeStage || "—"}
                  onEdit={() => startEdit("lifeStage")}
                />
              )}
            </FieldBlock>

            <Divider />

            <FieldBlock label="Your city">
              {isEditing("location") ? (
                <input
                  autoFocus
                  type="text"
                  value={draft.location}
                  onChange={(e) => set("location", e.target.value)}
                  onBlur={stopEdit}
                  onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                  placeholder="e.g. Boston, New York, London"
                  className="w-full border-b bg-transparent pb-0.5 text-[15px] outline-none"
                  style={{ borderColor: PRIMARY, color: TEXT }}
                />
              ) : (
                <div className="group flex items-center gap-2">
                  <span className="text-[15px]" style={{ color: TEXT }}>
                    {draft.location ? `📍 ${draft.location}` : "—"}
                  </span>
                  <button
                    onClick={() => startEdit("location")}
                    className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Edit city"
                  >
                    <Pencil size={14} style={{ color: MUTED }} />
                  </button>
                </div>
              )}
            </FieldBlock>
          </SectionCard>

          {/* ── What drives you ── */}
          <SectionCard title="What drives you">
            <FieldBlock label={`Energizers (${draft.energizers.length}/4)`}>
              <PillGrid
                options={ENERGIZER_OPTIONS}
                selected={draft.energizers}
                max={4}
                onChange={(v) => set("energizers", v)}
              />
            </FieldBlock>

            <Divider />

            <FieldBlock label={`Drainers (${draft.drainers.length}/4)`}>
              <PillGrid
                options={DRAINER_OPTIONS}
                selected={draft.drainers}
                max={4}
                onChange={(v) => set("drainers", v)}
              />
            </FieldBlock>
          </SectionCard>

          {/* ── How you're wired ── */}
          <SectionCard title="How you're wired">
            <FieldBlock label="Recharge style">
              {isEditing("introvertExtrovert") ? (
                <div className="mt-1 flex flex-col gap-2">
                  {INTROVERT_OPTIONS.map((opt) => (
                    <OptionChip
                      key={opt.value}
                      label={opt.label}
                      selected={draft.introvertExtrovert === opt.value}
                      onClick={() => { set("introvertExtrovert", opt.value); stopEdit(); }}
                    />
                  ))}
                </div>
              ) : (
                <EditableValue
                  value={
                    INTROVERT_OPTIONS.find((o) => o.value === draft.introvertExtrovert)?.label || "—"
                  }
                  onEdit={() => startEdit("introvertExtrovert")}
                />
              )}
            </FieldBlock>

            <Divider />

            <FieldBlock label="Decision style">
              {isEditing("decisionStyle") ? (
                <div className="mt-1 flex flex-col gap-2">
                  {DECISION_OPTIONS.map((opt) => (
                    <OptionChip
                      key={opt.value}
                      label={opt.label}
                      selected={draft.decisionStyle === opt.value}
                      onClick={() => { set("decisionStyle", opt.value); stopEdit(); }}
                    />
                  ))}
                </div>
              ) : (
                <EditableValue
                  value={
                    DECISION_OPTIONS.find((o) => o.value === draft.decisionStyle)?.label || "—"
                  }
                  onEdit={() => startEdit("decisionStyle")}
                />
              )}
            </FieldBlock>
          </SectionCard>

          {/* ── Your priorities (read-only) ── */}
          <SectionCard title="Your priorities">
            <div className="flex flex-col gap-3">
              {sortedWeights.map(([key, weight]) => {
                const cfg = VERTICAL_CONFIG[key];
                if (!cfg) return null;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm" style={{ color: TEXT }}>
                        {cfg.icon} {cfg.name}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: PRIMARY }}>
                        {Math.round(weight * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: BORDER }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${weight * 100}%`, backgroundColor: PRIMARY }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs" style={{ color: MUTED }}>
              Edit priorities by re-doing onboarding.{" "}
              <Link href="/onboarding" className="underline" style={{ color: PRIMARY }}>
                Redo onboarding →
              </Link>
            </p>
          </SectionCard>

          {/* ── Your goal ── */}
          <SectionCard title="Your goal">
            <FieldBlock label="What you most want to feel more of">
              {isEditing("oneGoal") ? (
                <input
                  autoFocus
                  type="text"
                  value={draft.oneGoal}
                  onChange={(e) => set("oneGoal", e.target.value)}
                  onBlur={stopEdit}
                  onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                  placeholder="e.g. calm, energy, connection…"
                  className="w-full border-b bg-transparent pb-0.5 text-[15px] outline-none"
                  style={{ borderColor: PRIMARY, color: TEXT }}
                />
              ) : (
                <EditableValue
                  value={draft.oneGoal || "—"}
                  onEdit={() => startEdit("oneGoal")}
                />
              )}
            </FieldBlock>
          </SectionCard>

          {/* ── Calendars (read-only) ── */}
          <SectionCard title="Calendars">
            <div className="flex flex-col gap-3">
              {(
                [
                  { key: "casa",    label: "Casa (iCloud)" },
                  { key: "outlook", label: "HBS Outlook"   },
                ] as const
              ).map(({ key, label }) => {
                const connected = draft.calendarsConnected?.[key] ?? false;
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: connected ? "#16A34A" : "#CBD5E1" }}
                    >
                      {connected ? "✓" : "—"}
                    </span>
                    <span className="text-sm" style={{ color: connected ? TEXT : MUTED }}>
                      {label}
                    </span>
                    {connected && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ backgroundColor: "#F0FDF4", color: "#16A34A" }}
                      >
                        Connected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs" style={{ color: MUTED }}>
              To update calendar connections, edit your{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">.env.local</code>{" "}
              file and restart the server.
            </p>
          </SectionCard>

        </div>

        {/* ── Save button ── */}
        <div className="mt-6 pb-10">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all"
            style={{
              backgroundColor: !isDirty || saving ? "#CBD5E1" : PRIMARY,
              cursor: !isDirty || saving ? "default" : "pointer",
            }}
          >
            {saving
              ? "Saving…"
              : saveState === "saved"
              ? "✓ Saved"
              : "Save changes"}
          </button>
          {saveState === "error" && (
            <p className="mt-2 text-center text-xs" style={{ color: "#DC2626" }}>
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
      <h3
        className="mb-4 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: MUTED }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13px]" style={{ color: MUTED }}>{label}</p>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-4" style={{ borderTop: `1px solid ${BORDER}` }} />;
}

function EditableValue({ value, onEdit }: { value: string; onEdit: () => void }) {
  return (
    <div className="group flex items-center gap-2">
      <span className="text-[15px]" style={{ color: TEXT }}>{value}</span>
      <button
        onClick={onEdit}
        className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Edit"
      >
        <Pencil size={14} style={{ color: MUTED }} />
      </button>
    </div>
  );
}

function OptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all"
      style={{
        border: `1.5px solid ${selected ? PRIMARY : BORDER}`,
        backgroundColor: selected ? PRIMARY : "#ffffff",
        color: selected ? "#ffffff" : "#475569",
      }}
    >
      {label}
    </button>
  );
}

function PillGrid({
  options,
  selected,
  max,
  onChange,
}: {
  options: string[];
  selected: string[];
  max: number;
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else if (selected.length < max) {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {options.map((opt) => {
        const sel = selected.includes(opt);
        const disabled = !sel && selected.length >= max;
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              border: `1.5px solid ${sel ? PRIMARY : BORDER}`,
              backgroundColor: sel ? PRIMARY : "#ffffff",
              color: sel ? "#ffffff" : disabled ? "#CBD5E1" : "#475569",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
