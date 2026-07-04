"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UserLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // If already logged in, redirect to home
    const token = localStorage.getItem("sfi_user_token");
    if (token) {
      router.push("/");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store user session in localStorage
      localStorage.setItem("sfi_user_token", data.token);
      localStorage.setItem("sfi_user_name", data.username);

      // Force update user setting name if John Doe
      const storedSettings = localStorage.getItem("fieldroute_user_settings");
      let currentSettings = { name: data.username, email: `${data.username.toLowerCase()}@sfi.com`, unitSystem: "metric", mapProvider: "openstreetmap" };
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          if (parsed) {
            currentSettings = {
              ...currentSettings,
              ...parsed,
              name: parsed.name && parsed.name !== "John Doe" ? parsed.name : data.username
            };
          }
        } catch {}
      }
      localStorage.setItem("fieldroute_user_settings", JSON.stringify(currentSettings));
      window.dispatchEvent(new Event("storage"));

      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/60 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">SFI Routing Assistant</h1>
          <p className="mt-2 text-xs text-slate-400">
            Please log in to plan trips, view routing schedules, or configure reports.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-400">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Username
            </label>
            <input
              type="text"
              required
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
