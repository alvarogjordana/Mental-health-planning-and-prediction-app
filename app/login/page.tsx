"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRIMARY = "#1B4FD8";
const TEXT    = "#0F172A";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8F0";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#F8FAFC" }}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl bg-white px-8 py-10"
        style={{ border: `1px solid ${BORDER}` }}
      >
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Freedom
          </span>
          <h1 className="mt-2 text-xl font-bold" style={{ color: TEXT }}>
            Sign in
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: MUTED }}>
              Username
            </label>
            <input
              autoFocus
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{
                border: `1px solid ${username ? PRIMARY : BORDER}`,
                boxShadow: username ? "0 0 0 3px rgba(27,79,216,0.10)" : "none",
                color: TEXT,
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: MUTED }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{
                border: `1px solid ${password ? PRIMARY : BORDER}`,
                boxShadow: password ? "0 0 0 3px rgba(27,79,216,0.10)" : "none",
                color: TEXT,
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors"
            style={{
              backgroundColor:
                loading || !username || !password ? "#CBD5E1" : PRIMARY,
              cursor: loading || !username || !password ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>
      </div>
    </div>
  );
}
