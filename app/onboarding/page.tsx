"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WellbeingVertical } from "@/types";

/* ─── Types ─── */
interface ProfileState {
  name: string;
  lifeStage: string;
  energizers: string[];
  drainers: string[];
  introvertExtrovert: string;
  decisionStyle: string;
  verticalRanking: WellbeingVertical[];
  oneGoal: string;
}

/* ─── Constants ─── */
const TOTAL_STEPS = 9;

const LIFE_STAGES = [
  "Student",
  "Early career",
  "Mid career",
  "Senior / executive",
  "Career transition",
  "Parent (primary focus)",
  "Retired",
  "Other",
];

const ENERGIZER_OPTIONS = [
  "Exercise",
  "Time alone",
  "Deep conversations",
  "Creative work",
  "Being in nature",
  "Learning something new",
  "Social gatherings",
  "Helping others",
  "Spiritual practice",
  "Travel",
  "Music",
  "Reading",
];

const DRAINER_OPTIONS = [
  "Back-to-back meetings",
  "Small talk",
  "Poor sleep",
  "No time to myself",
  "Feeling unproductive",
  "Conflict",
  "Commuting",
  "Screen overload",
  "Lack of exercise",
  "Feeling disconnected from people",
  "Uncertainty",
  "Routine / repetition",
];

const INTROVERT_OPTIONS = [
  { value: "introvert", label: "Be alone (introvert)" },
  { value: "extrovert", label: "Be with others (extrovert)" },
  { value: "depends", label: "It really depends" },
];

const DECISION_OPTIONS = [
  { value: "logic", label: "With logic and data" },
  { value: "gut", label: "With gut feeling and values" },
  { value: "mix", label: "A mix of both" },
];

const VERTICAL_LABELS: Record<WellbeingVertical, string> = {
  [WellbeingVertical.HEALTH]: "Health & Fitness",
  [WellbeingVertical.WORK_LIFE]: "Work-Life Balance",
  [WellbeingVertical.SOCIAL]: "Social Connection",
  [WellbeingVertical.PURPOSE]: "Sense of Purpose",
  [WellbeingVertical.SLEEP]: "Sleep & Energy",
};

const VERTICAL_ICONS: Record<WellbeingVertical, string> = {
  [WellbeingVertical.HEALTH]: "🏃",
  [WellbeingVertical.WORK_LIFE]: "⚖️",
  [WellbeingVertical.SOCIAL]: "🤝",
  [WellbeingVertical.PURPOSE]: "🧭",
  [WellbeingVertical.SLEEP]: "🌙",
};

const DEFAULT_RANKING: WellbeingVertical[] = [
  WellbeingVertical.HEALTH,
  WellbeingVertical.WORK_LIFE,
  WellbeingVertical.SOCIAL,
  WellbeingVertical.PURPOSE,
  WellbeingVertical.SLEEP,
];

/* ─── Shared sub-components ─── */
function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-[#0F172A] leading-snug">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-[#94A3B8]">{subtitle}</p>}
    </div>
  );
}

function SingleSelectGrid({
  options,
  value,
  onChange,
}: {
  options: string[] | { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const normalized = (options as Array<string | { value: string; label: string }>).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <div className="flex flex-col gap-2">
      {normalized.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all"
            style={{
              borderColor: selected ? "#1B4FD8" : "#E2E8F0",
              backgroundColor: selected ? "#EEF2FF" : "#ffffff",
              color: selected ? "#1B4FD8" : "#0F172A",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectGrid({
  options,
  values,
  max,
  onChange,
}: {
  options: string[];
  values: string[];
  max: number;
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else if (values.length < max) {
      onChange([...values, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = values.includes(opt);
        const disabled = !selected && values.length >= max;
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            disabled={disabled}
            className="px-3 py-2 rounded-full border text-sm font-medium transition-all"
            style={{
              borderColor: selected ? "#1B4FD8" : "#E2E8F0",
              backgroundColor: selected ? "#1B4FD8" : disabled ? "#F8FAFC" : "#ffffff",
              color: selected ? "#ffffff" : disabled ? "#CBD5E1" : "#0F172A",
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

/* ─── Main component ─── */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    lifeStage: "",
    energizers: [],
    drainers: [],
    introvertExtrovert: "",
    decisionStyle: "",
    verticalRanking: DEFAULT_RANKING,
    oneGoal: "",
  });

  const update = useCallback(
    <K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
      setProfile((p) => ({ ...p, [key]: value }));
    },
    []
  );

  /* Animated step transition */
  const goTo = useCallback((next: number) => {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 150);
  }, []);

  const goNext = useCallback(() => goTo(step + 1), [step, goTo]);
  const goBack = useCallback(() => goTo(step - 1), [step, goTo]);

  /* Step validity */
  const isValid = () => {
    switch (step) {
      case 1: return profile.name.trim().length > 0;
      case 2: return profile.lifeStage.length > 0;
      case 3: return profile.energizers.length >= 1;
      case 4: return profile.drainers.length >= 1;
      case 5: return profile.introvertExtrovert.length > 0;
      case 6: return profile.decisionStyle.length > 0;
      case 7: return true; // pre-populated
      case 8: return profile.oneGoal.trim().length > 0;
      case 9: return true;
      default: return false;
    }
  };

  /* Ranking helpers */
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...profile.verticalRanking];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    update("verticalRanking", next);
  };
  const moveDown = (index: number) => {
    if (index === profile.verticalRanking.length - 1) return;
    const next = [...profile.verticalRanking];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update("verticalRanking", next);
  };

  /* Submit */
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Save failed");
      router.push("/");
    } catch {
      setSaving(false);
      alert("Something went wrong. Please try again.");
    }
  };

  /* ─── Step renders ─── */
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <StepHeading title="What should Freedom call you?" />
            <input
              autoFocus
              type="text"
              value={profile.name}
              onChange={(e) => update("name", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isValid() && goNext()}
              placeholder="Your first name"
              className="w-full px-4 py-3 text-base border rounded-lg outline-none transition-all text-[#0F172A]"
              style={{
                borderColor: profile.name ? "#1B4FD8" : "#E2E8F0",
                boxShadow: profile.name ? "0 0 0 3px rgba(27,79,216,0.12)" : "none",
              }}
            />
          </>
        );

      case 2:
        return (
          <>
            <StepHeading title="Where are you in life right now?" />
            <SingleSelectGrid
              options={LIFE_STAGES}
              value={profile.lifeStage}
              onChange={(v) => update("lifeStage", v)}
            />
          </>
        );

      case 3:
        return (
          <>
            <StepHeading
              title="What genuinely gives you energy?"
              subtitle="Pick up to 4."
            />
            <MultiSelectGrid
              options={ENERGIZER_OPTIONS}
              values={profile.energizers}
              max={4}
              onChange={(v) => update("energizers", v)}
            />
          </>
        );

      case 4:
        return (
          <>
            <StepHeading
              title="What tends to drain you?"
              subtitle="Pick up to 4."
            />
            <MultiSelectGrid
              options={DRAINER_OPTIONS}
              values={profile.drainers}
              max={4}
              onChange={(v) => update("drainers", v)}
            />
          </>
        );

      case 5:
        return (
          <>
            <StepHeading title="When you need to recharge, you usually prefer to..." />
            <SingleSelectGrid
              options={INTROVERT_OPTIONS}
              value={profile.introvertExtrovert}
              onChange={(v) => update("introvertExtrovert", v)}
            />
          </>
        );

      case 6:
        return (
          <>
            <StepHeading title="How do you tend to make decisions?" />
            <SingleSelectGrid
              options={DECISION_OPTIONS}
              value={profile.decisionStyle}
              onChange={(v) => update("decisionStyle", v)}
            />
          </>
        );

      case 7:
        return (
          <>
            <StepHeading
              title="What matters most to your sense of wellbeing right now?"
              subtitle="Tap the arrows to reorder. Rank 1 = highest weight in your assessment."
            />
            <div className="flex flex-col gap-2">
              {profile.verticalRanking.map((vertical, i) => (
                <div
                  key={vertical}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                  style={{ borderColor: "#E2E8F0", backgroundColor: "#ffffff" }}
                >
                  <span
                    className="text-sm font-bold w-6 text-center"
                    style={{ color: "#1B4FD8" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg">{VERTICAL_ICONS[vertical]}</span>
                  <span className="flex-1 text-sm font-medium text-[#0F172A]">
                    {VERTICAL_LABELS[vertical]}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors"
                      style={{
                        color: i === 0 ? "#CBD5E1" : "#64748B",
                        backgroundColor: i === 0 ? "transparent" : "#F1F5F9",
                      }}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={i === profile.verticalRanking.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors"
                      style={{
                        color:
                          i === profile.verticalRanking.length - 1
                            ? "#CBD5E1"
                            : "#64748B",
                        backgroundColor:
                          i === profile.verticalRanking.length - 1
                            ? "transparent"
                            : "#F1F5F9",
                      }}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 8:
        return (
          <>
            <StepHeading title="What's one thing you'd most like to feel more of in your life right now?" />
            <input
              autoFocus
              type="text"
              value={profile.oneGoal}
              onChange={(e) => update("oneGoal", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isValid() && goNext()}
              placeholder="e.g. calm, energy, connection, focus..."
              className="w-full px-4 py-3 text-base border rounded-lg outline-none transition-all text-[#0F172A]"
              style={{
                borderColor: profile.oneGoal ? "#1B4FD8" : "#E2E8F0",
                boxShadow: profile.oneGoal
                  ? "0 0 0 3px rgba(27,79,216,0.12)"
                  : "none",
              }}
            />
          </>
        );

      case 9:
        return (
          <>
            <StepHeading
              title={`You're all set, ${profile.name}.`}
              subtitle="Here's what Freedom knows about you."
            />
            <div
              className="rounded-xl border p-5 text-sm space-y-4"
              style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
            >
              <SummaryRow label="Life stage" value={profile.lifeStage} />
              <SummaryRow
                label="Energized by"
                value={profile.energizers.join(", ") || "—"}
              />
              <SummaryRow
                label="Drained by"
                value={profile.drainers.join(", ") || "—"}
              />
              <SummaryRow
                label="Recharge style"
                value={
                  INTROVERT_OPTIONS.find(
                    (o) => o.value === profile.introvertExtrovert
                  )?.label ?? "—"
                }
              />
              <SummaryRow
                label="Decision style"
                value={
                  DECISION_OPTIONS.find((o) => o.value === profile.decisionStyle)
                    ?.label ?? "—"
                }
              />
              <SummaryRow
                label="Wellbeing priorities"
                value={profile.verticalRanking
                  .map((v, i) => `${i + 1}. ${VERTICAL_LABELS[v]}`)
                  .join(" · ")}
              />
              <SummaryRow label="One goal" value={profile.oneGoal} />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  /* ─── Layout ─── */
  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-10">
      {/* Progress bar */}
      <div className="w-full max-w-[560px] mb-10">
        <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(step / TOTAL_STEPS) * 100}%`,
              backgroundColor: "#1B4FD8",
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-[560px]">
        {/* Step content with fade */}
        <div
          style={{
            transition: "opacity 150ms ease",
            opacity: visible ? 1 : 0,
          }}
        >
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {step > 1 ? (
            <button
              onClick={goBack}
              className="text-sm text-[#94A3B8] hover:text-[#0F172A] transition-colors"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              disabled={!isValid()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
              style={{
                backgroundColor: isValid() ? "#1B4FD8" : "#CBD5E1",
                cursor: isValid() ? "pointer" : "default",
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
              style={{
                backgroundColor: saving ? "#CBD5E1" : "#1B4FD8",
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Build my profile →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-[#0F172A]">{label}: </span>
      <span className="text-[#475569]">{value}</span>
    </div>
  );
}
