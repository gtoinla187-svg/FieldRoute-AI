"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserRecord = {
  username: string;
  email: string;
  createdAt: string;
};

type LogRecord = {
  username: string;
  timestamp: string;
  status: "success" | "failure";
  ip: string;
  userAgent: string;
};

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "users">("logs");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminUser, setAdminUser] = useState("");

  // Create user form states
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const handleLogout = () => {
    sessionStorage.removeItem("sfi_admin_token");
    sessionStorage.removeItem("sfi_admin_user");
    router.push("/admin/login");
  };

  const fetchConfig = async (token: string) => {
    try {
      const res = await fetch("/api/admin/config", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load admin configuration.");
      }

      const data = await res.json();
      setUsers(data.users || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem("sfi_admin_token");
    const user = sessionStorage.getItem("sfi_admin_user");

    if (!token || !user) {
      router.push("/admin/login");
      return;
    }

    setAdminUser(user);
    fetchConfig(token);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    const token = sessionStorage.getItem("sfi_admin_token");
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, email: newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create user.");
      }

      setFormSuccess(`User account "${newUsername}" created successfully.`);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      
      // Refresh list
      fetchConfig(token);
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit new user form.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualResetPassword = async (targetUsername: string) => {
    const newPass = window.prompt(`Enter new password for user "${targetUsername}" (minimum 6 characters):`);
    if (newPass === null) return; // Cancelled
    if (newPass.trim().length < 6) {
      alert("Error: Password must be at least 6 characters long.");
      return;
    }

    const token = sessionStorage.getItem("sfi_admin_token");
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reset_password",
          username: targetUsername,
          password: newPass.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      alert(`Password for user "${targetUsername}" reset successfully.`);
    } catch (err: any) {
      alert(err?.message || "Failed to reset password.");
    }
  };

  const handleSetResetEmail = async (targetUsername: string, currentEmail: string) => {
    const newEmailInput = window.prompt(`Enter password reset email for user "${targetUsername}":`, currentEmail || "");
    if (newEmailInput === null) return; // Cancelled
    if (!newEmailInput.trim().includes("@")) {
      alert("Error: Please enter a valid email address.");
      return;
    }

    const token = sessionStorage.getItem("sfi_admin_token");
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set_email",
          username: targetUsername,
          email: newEmailInput.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set recovery email.");
      }

      alert(`Password reset email for "${targetUsername}" updated to "${newEmailInput.trim()}".`);
      fetchConfig(token); // refresh table
    } catch (err: any) {
      alert(err?.message || "Failed to set reset email.");
    }
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user account "${usernameToDelete}"?`)) {
      return;
    }

    const token = sessionStorage.getItem("sfi_admin_token");
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const res = await fetch(`/api/admin/config?username=${encodeURIComponent(usernameToDelete)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user.");
      }

      // Refresh list
      fetchConfig(token);
    } catch (err: any) {
      alert(err?.message || "Failed to delete user.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-slate-400">Loading system admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Admin Area</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-400 font-mono">User: {adminUser}</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">SFI Control Panel</h1>
          </div>
          <button
            onClick={handleLogout}
            className="w-full md:w-auto rounded-xl border border-slate-800 bg-slate-950 px-5 py-2.5 text-xs font-semibold hover:bg-slate-900 transition cursor-pointer text-slate-300 hover:text-white"
          >
            Sign Out
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            ⚠ {error}
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-slate-800 pb-px mb-8">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2 outline-none cursor-pointer ${
              activeTab === "logs"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 User Login Logs
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2 outline-none cursor-pointer ${
              activeTab === "users"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            👥 User Control Panel
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "logs" ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-sm overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Login Audit Logs</h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitors system access attempts (maximum 1,000 logs retained).
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Browser/User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-transparent text-slate-300">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        No login events recorded.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-[11px] text-slate-450">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {log.username}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">
                          {log.ip}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              log.status === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {log.status === "success" ? "✓ Success" : "⚠ Failed"}
                          </span>
                        </td>
                        <td className="px-6 py-4 truncate max-w-[280px] text-slate-500" title={log.userAgent}>
                          {log.userAgent}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User List Panel */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-base font-bold text-white">Active System Accounts</h2>
                <p className="text-xs text-slate-400 mt-1">
                  List of authorized user accounts allowed to sign in.
                </p>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Created At</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-transparent text-slate-300">
                    {users.map((u, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        <td className="px-6 py-4 font-semibold text-white">
                          {u.username}
                          {u.username.toLowerCase() === "admin" && (
                            <span className="ml-2 text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                              System
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                          {u.email || "n/a"}
                        </td>
                        <td className="px-6 py-4 text-slate-450 font-mono text-[11px] whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleManualResetPassword(u.username)}
                            className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-2 py-1.5 text-[9px] font-bold text-indigo-400 hover:bg-indigo-500 hover:text-white transition cursor-pointer"
                            title="Manual Reset Password"
                          >
                            🔑 Reset PW
                          </button>
                          <button
                            onClick={() => handleSetResetEmail(u.username, u.email)}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-white transition cursor-pointer"
                            title="Set Password Reset Email"
                          >
                            📧 Set Email
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            disabled={u.username.toLowerCase() === "admin" || u.username.toLowerCase() === adminUser.toLowerCase()}
                            className="rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[9px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create User Form Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-sm p-6 self-start">
              <h2 className="text-base font-bold text-white mb-2">Create New Account</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Add an additional operator to the system configuration.
              </p>

              {formError && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400">
                  ⚠ {formError}
                </div>
              )}

              {formSuccess && (
                <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-400 font-semibold">
                  ✓ {formSuccess}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Alphanumeric, 3-20 chars"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. operator@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-center text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Creating user..." : "Create Account"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
