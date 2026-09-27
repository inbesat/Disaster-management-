"use client";
import { useState } from "react";
import { fieldLogin } from "@/app/actions/auth";

export default function FieldLoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
          const result = await fieldLogin(
            String(form.get("email")),
            String(form.get("password")),
          );
          setError(result.message);
        } catch {
          setError("Sign-in failed. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 p-3"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-white/20 bg-slate-800 p-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-cyan-400 p-3 font-bold text-slate-950 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
