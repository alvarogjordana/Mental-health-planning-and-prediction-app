"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

/* ─── Types ─── */
type Step = "loading" | "already_done" | 1 | 2 | 3 | 4 | 5 | "saved";

interface Answers {
  mood: string;
  moodScore: number;
  sleepHours: number | null;
  exercised: boolean | null;
  primaryDriver: string;
  reflection: string;
}

/* ─── Constants ─── */
const PRIMARY = "#1B4FD8";
const TEXT = "#0F172A";
const MUTED = "#94A3B8";

const MOOD_OPTIONS = [
  { emoji: "😔", label: "Struggling", score: 1 },
  { emoji: "😕", label: "Low",        score: 2 },
  { emoji: "😐", label: "Okay",       score: 3 },
  { emoji: "🙂", label: "Good",       score: 4 },
  { emoji: "😄", label: "Great",      score: 5 },
];

const DRIVER_OPTIONS = [
  { emoji: "😴", label: "Sleep" },
  { emoji: "💪", label: "Exercise" },
  { emoji: "👥", label: "Social time" },
  { emoji: "📅", label: "Work / calendar" },
  { emoji: "🧠", label: "Mental load" },
  { emoji: "🌤️", label: "Weather & environment" },
  { emoji: "🎯", label: "Sense of progress" },
  { emoji: "❤️", label: "Relationships" },
];

/* ─── Helpers ─── */
function formatTodayDate(): string {
  const d = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function getEncouragement(moodScore: number): string {
  if (moodScore <= 2) return "Thanks for checking in. Small steps count.";
  if (moodScore === 3) return "Noted. Consistency is what builds clarity.";
  return "Great to hear. Keep doing what's working.";
}

/* ─── Progress dots ─── */
function ProgressDots({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const done = n < current;
        const active = n === current;
        return (
          <div
            key={n}
            className="rounded-full transition-all duration-300"
            style={{
              width: active ? 10 : 8,
              height: active ? 10 : 8,
              backgroundColor: done || active ? PRIMARY : "transparent",
              border: `2px solid ${done || active ? PRIMARY : "#CBD5E1"}`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ─── Page ─── */
export default function CheckInPage() {
  const [step, setStep] = useState<Step>("loading");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [todayString, setTodayString] = useState("");
  const [answers, setAnswers] = useState<Answers>({
    mood: "",
    moodScore: 0,
    sleepHours: null,
    exercised: null,
    primaryDriver: "",
    reflection: "",
  });
  // For the "already checked in" confirmation
  const [alreadyMood, setAlreadyMood] = useState("");
  const [alreadyMoodScore, setAlreadyMoodScore] = useState(0);

  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* On mount: set date string + check if already done today */
  useEffect(() => {
    setTodayString(formatTodayDate());

    fetch("/api/checkin")
      .then((r) => r.json())
      .then((data: { alreadyDone: boolean; mood?: string; moodScore?: number }) => {
        if (data.alreadyDone) {
          setAlreadyMood(data.mood ?? "");
          setAlreadyMoodScore(data.moodScore ?? 0);
          setStep("already_done");
        } else {
          setStep(1);
        }
      })
      .catch(() => setStep(1)); // fail open: let them check in

    return () => {
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    };
  }, []);

  /* Animated transition */
  const goTo = useCallback((next: Step) => {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 150);
  }, []);

  /* Q1 — tap a mood card → auto-advance */
  const selectMood = (mood: string, moodScore: number) => {
    setAnswers((prev) => ({ ...prev, mood, moodScore }));
    goTo(2);
  };

  /* Q2 — sleep hours input */
  const [sleepInput, setSleepInput] = useState("");

  /* Q3 — exercise yes/no → auto-advance */
  const selectExercise = (val: boolean) => {
    setAnswers((prev) => ({ ...prev, exercised: val }));
    goTo(4);
  };

  /* Q4 — tap a driver pill → show Continue button */
  const selectDriver = (driver: string) => {
    setAnswers((prev) => ({ ...prev, primaryDriver: driver }));
  };

  /* Q3 / final save */
  const handleSave = useCallback(
    async (skip = false) => {
      if (saving) return;
      setSaving(true);

      // Show "Saving..." label only if it takes more than 500ms
      spinnerTimer.current = setTimeout(() => setShowSpinner(true), 500);

      try {
        await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood: answers.mood,
            moodScore: answers.moodScore,
            sleepHours: answers.sleepHours,
            exercised: answers.exercised,
            primaryDriver: answers.primaryDriver,
            reflection: skip ? "" : answers.reflection,
          }),
        });
      } catch {
        /* fail silently — still show the confirmation */
      } finally {
        if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
        setShowSpinner(false);
        setSaving(false);
        goTo("saved");
      }
    },
    [saving, answers, goTo]
  );

  /* ─── Step renders ─── */
  const renderStep = () => {
    /* Loading */
    if (step === "loading") {
      return <div className="h-40" />;
    }

    /* Already checked in today */
    if (step === "already_done") {
      return (
        <div className="flex flex-col items-center text-center gap-5">
          <CheckMark />
          <div>
            <h2 className="text-2xl font-bold" style={{ color: TEXT }}>
              You&apos;ve already checked in today
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              {todayString}
            </p>
          </div>
          {alreadyMood && (
            <p className="text-sm" style={{ color: "#475569" }}>
              You logged:{" "}
              <span className="font-semibold" style={{ color: TEXT }}>
                {alreadyMood}
              </span>
            </p>
          )}
          <p className="text-sm" style={{ color: MUTED }}>
            {getEncouragement(alreadyMoodScore)}
          </p>
          <DashboardLink />
        </div>
      );
    }

    /* Saved confirmation */
    if (step === "saved") {
      return (
        <div className="flex flex-col items-center text-center gap-5">
          <CheckMark />
          <div>
            <h2 className="text-2xl font-bold" style={{ color: TEXT }}>
              Logged for {todayString}
            </h2>
            <p className="mt-2 text-sm" style={{ color: "#475569" }}>
              {getEncouragement(answers.moodScore)}
            </p>
          </div>
          <DashboardLink />
        </div>
      );
    }

    /* Q1 — Mood */
    if (step === 1) {
      return (
        <div className="flex flex-col items-center gap-10">
          <QuestionHeading>How are you feeling right now?</QuestionHeading>
          <div className="flex flex-wrap justify-center gap-3">
            {MOOD_OPTIONS.map((opt) => {
              const sel = answers.mood === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => selectMood(opt.label, opt.score)}
                  className="flex flex-col items-center justify-center rounded-xl transition-all duration-150 active:scale-95"
                  style={{
                    width: 110,
                    height: 96,
                    border: sel ? `2px solid ${PRIMARY}` : "2px solid #E2E8F0",
                    backgroundColor: sel ? "#EEF2FF" : "#ffffff",
                  }}
                >
                  <span className="text-3xl leading-none mb-2">{opt.emoji}</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: sel ? PRIMARY : "#475569" }}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    /* Q2 — Sleep hours */
    if (step === 2) {
      const parsed = parseFloat(sleepInput);
      const valid = !isNaN(parsed) && parsed > 0 && parsed <= 24;
      return (
        <div className="flex flex-col items-center gap-8 w-full">
          <QuestionHeading>How many hours did you sleep last night?</QuestionHeading>
          <div className="w-full max-w-[240px]">
            <input
              autoFocus
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={sleepInput}
              onChange={(e) => setSleepInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) {
                  setAnswers((prev) => ({ ...prev, sleepHours: parsed }));
                  goTo(3);
                }
              }}
              placeholder="e.g. 7.5"
              className="w-full outline-none rounded-lg text-center text-2xl font-semibold transition-all"
              style={{
                height: 64,
                padding: "0 16px",
                color: TEXT,
                border: sleepInput ? `1px solid ${PRIMARY}` : "1px solid #E2E8F0",
                boxShadow: sleepInput ? "0 0 0 3px rgba(27,79,216,0.10)" : "none",
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-4 w-full max-w-[240px]">
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, sleepHours: parsed }));
                goTo(3);
              }}
              disabled={!valid}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: valid ? PRIMARY : "#CBD5E1", cursor: valid ? "pointer" : "default" }}
            >
              Continue →
            </button>
            <button
              onClick={() => {
                setAnswers((prev) => ({ ...prev, sleepHours: null }));
                goTo(3);
              }}
              className="text-sm underline"
              style={{ color: MUTED }}
            >
              Skip
            </button>
          </div>
        </div>
      );
    }

    /* Q3 — Exercise */
    if (step === 3) {
      return (
        <div className="flex flex-col items-center gap-10 w-full">
          <QuestionHeading>Did you exercise today?</QuestionHeading>
          <div className="flex gap-4">
            {([{ label: "Yes 💪", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
              <button
                key={label}
                onClick={() => selectExercise(val)}
                className="flex items-center justify-center rounded-xl text-base font-semibold transition-all duration-150 active:scale-95"
                style={{
                  width: 140,
                  height: 80,
                  border: `2px solid ${answers.exercised === val ? PRIMARY : "#E2E8F0"}`,
                  backgroundColor: answers.exercised === val ? "#EEF2FF" : "#ffffff",
                  color: answers.exercised === val ? PRIMARY : "#475569",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    /* Q4 — Primary driver */
    if (step === 4) {
      return (
        <div className="flex flex-col items-center gap-8 w-full">
          <QuestionHeading>What&apos;s shaping your mood the most today?</QuestionHeading>
          <div className="flex flex-wrap justify-center gap-2.5 max-w-[480px]">
            {DRIVER_OPTIONS.map((opt) => {
              const sel = answers.primaryDriver === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => selectDriver(opt.label)}
                  className="flex items-center gap-2 text-sm font-medium transition-all duration-150 active:scale-95"
                  style={{
                    padding: "10px 16px",
                    borderRadius: 15,
                    border: sel ? `1.5px solid ${PRIMARY}` : "1.5px solid #E2E8F0",
                    backgroundColor: sel ? "#EEF2FF" : "#ffffff",
                    color: sel ? PRIMARY : "#475569",
                  }}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <div
            className="transition-all duration-200"
            style={{ opacity: answers.primaryDriver ? 1 : 0, pointerEvents: answers.primaryDriver ? "auto" : "none" }}
          >
            <button
              onClick={() => goTo(5)}
              className="px-8 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Continue →
            </button>
          </div>
        </div>
      );
    }

    /* Q5 — Reflection */
    if (step === 5) {
      return (
        <div className="flex flex-col items-center gap-8 w-full">
          <QuestionHeading>Anything you want to note about today?</QuestionHeading>
          <div className="w-full max-w-[480px]">
            <input
              autoFocus
              type="text"
              value={answers.reflection}
              onChange={(e) => setAnswers((prev) => ({ ...prev, reflection: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && !saving && handleSave()}
              placeholder="Optional — a word or sentence is enough"
              className="w-full outline-none rounded-lg text-base transition-all"
              style={{
                height: 48,
                padding: "0 16px",
                fontSize: 16,
                color: TEXT,
                border: answers.reflection ? `1px solid ${PRIMARY}` : "1px solid #E2E8F0",
                boxShadow: answers.reflection ? "0 0 0 3px rgba(27,79,216,0.10)" : "none",
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-4 w-full max-w-[480px]">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: saving ? "#CBD5E1" : PRIMARY, cursor: saving ? "default" : "pointer" }}
            >
              {showSpinner ? "Saving..." : "Save →"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="text-sm underline transition-colors"
              style={{ color: MUTED, cursor: saving ? "default" : "pointer" }}
            >
              Skip &amp; save
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const isQuestion = step === 1 || step === 2 || step === 3 || step === 4 || step === 5;

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed top bar: back link left, dots center */}
      <div
        className="fixed top-0 left-0 right-0 z-20 bg-white flex items-center justify-between px-6 py-4"
        style={{ borderBottom: isQuestion ? "none" : "none" }}
      >
        <Link href="/" className="text-sm transition-colors" style={{ color: MUTED }}>
          ← Back
        </Link>
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
          {isQuestion && <ProgressDots current={step as 1 | 2 | 3 | 4 | 5} />}
        </div>
        <span className="w-12" /> {/* spacer to balance the back link */}
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Content — centered in remaining viewport */}
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-10">
        <div
          className="w-full max-w-[560px]"
          style={{ transition: "opacity 150ms ease", opacity: visible ? 1 : 0 }}
        >
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

/* ─── Small reusable pieces ─── */

function QuestionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-center font-bold leading-tight max-w-[480px] mx-auto"
      style={{ fontSize: 28, color: "#0F172A" }}
    >
      {children}
    </h2>
  );
}

function CheckMark() {
  return (
    <div
      className="flex items-center justify-center rounded-full text-xl font-bold text-white"
      style={{ width: 64, height: 64, backgroundColor: "#1B4FD8", fontSize: 24 }}
    >
      ✓
    </div>
  );
}

function DashboardLink() {
  return (
    <Link
      href="/"
      className="mt-4 inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white"
      style={{ backgroundColor: "#1B4FD8" }}
    >
      Back to dashboard →
    </Link>
  );
}
