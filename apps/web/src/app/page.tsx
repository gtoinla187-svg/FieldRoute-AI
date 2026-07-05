"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

function cleanReportMarkdown(text: string): string {
  if (!text) return "";
  const regex = /(?:^|\n)(?:\s*|#+\s*|\*+\s*)\b1\.\s+Company\s+Background\s+Summary\b/i;
  const match = text.match(regex);
  if (match && typeof match.index === "number") {
    return text.substring(match.index).trim();
  }
  return text.trim();
}

export default function HomePage() {
  const router = useRouter();
  const [companyInput, setCompanyInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedReports, setSavedReports] = useState<{ id: string; name: string; companyName: string; companyWebsite: string; markdown: string }[]>([]);
  const [isViewSavedModalOpen, setIsViewSavedModalOpen] = useState(false);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("sfi_user_token");
      const res = await fetch("/api/bd-consultant/reports", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedReports(data.reports || []);
        localStorage.setItem("fieldroute_saved_reports", JSON.stringify(data.reports || []));
      } else {
        throw new Error("Failed to fetch reports");
      }
    } catch (e) {
      console.error("Failed to load reports from database, using local cache:", e);
      const listRaw = localStorage.getItem("fieldroute_saved_reports") || "[]";
      try {
        setSavedReports(JSON.parse(listRaw));
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleLoadReport = (report: { companyName: string; companyWebsite: string; markdown: string }) => {
    localStorage.setItem("fieldroute_report_company_name", report.companyName);
    localStorage.setItem("fieldroute_report_company_website", report.companyWebsite);
    localStorage.setItem("fieldroute_report_markdown", report.markdown);
    router.push("/bd-consultant");
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent, reportName: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Are you sure you want to delete the saved report "${reportName}"?`);
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("sfi_user_token");
      const res = await fetch(`/api/bd-consultant/reports?id=${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        console.error("Failed to delete report from database");
      }
    } catch (e) {
      console.error("Error deleting report from server:", e);
    }

    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem("fieldroute_saved_reports", JSON.stringify(updated));
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyInput.trim()) return;

    setIsGenerating(true);
    setErrorMessage("");

    const trimmedInput = companyInput.trim();
    let parsedName = "";
    let parsedWebsite = "";

    // Detect if input contains a dot or looks like a URL
    const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(trimmedInput) || trimmedInput.includes(".");
    if (isUrl) {
      parsedWebsite = trimmedInput;
      // Format a default name from the domain (e.g., tesla.com -> Tesla)
      const domain = trimmedInput.replace(/^(https?:\/\/)?(www\.)?/i, "").split("/")[0].split(".")[0];
      parsedName = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : trimmedInput;
    } else {
      parsedName = trimmedInput;
    }

    try {
      const res = await fetch("/api/bd-consultant/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: parsedName,
          companyWebsite: parsedWebsite,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Failed to generate report.");
      }

      const data = await res.json();
      const cleaned = cleanReportMarkdown(data?.markdown || "");
      localStorage.setItem("fieldroute_report_company_name", parsedName);
      localStorage.setItem("fieldroute_report_company_website", parsedWebsite);
      localStorage.setItem("fieldroute_report_markdown", cleaned);
      router.push("/bd-consultant");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "An unexpected error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      <Header />

      <main className="mx-auto flex max-w-6xl flex-col px-6 py-16">
        {/* Sales Routing Workspace Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 font-bold text-xl">
              🗺️
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-450 dark:text-slate-500">
                Sales Routing Workspace
              </p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Plan smarter field routes with a clean workflow.
              </h1>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Create trips, organize prospect stops, and review saved routes in one
            focused workspace built for field sales teams.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/trip/new"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              Create New Trip
            </Link>

            <Link
              href="/trip"
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-3 text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-450 dark:hover:border-slate-600 transition"
            >
              View Saved Trips
            </Link>
          </div>
        </div>

        {/* Business Development Consultant Section */}
        <div className="mt-14 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 font-bold text-xl">
              💼
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-450 dark:text-slate-500">AI Sales Agent</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">SFI Business Development Consultant</h2>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Input a prospect&apos;s company details to generate a comprehensive international logistics business development analysis, custom outreach emails, cold calling scripts, and qualifying meeting discovery questions.
          </p>

          <form onSubmit={handleGenerateReport} className="mt-6 space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="bd-company-input">
                Prospect Company Name or Website URL
              </label>
              <input
                id="bd-company-input"
                type="text"
                placeholder="e.g. Acme Corp or www.acmecorp.com"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating || !companyInput.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed px-5 py-3 text-sm font-semibold text-white transition cursor-pointer flex items-center gap-2 w-fit"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Generating B2B logistics report...
                  </>
                ) : (
                  "Generate Consultant Report"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchReports();
                  setIsViewSavedModalOpen(true);
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-2"
              >
                📂 View Saved Reports ({savedReports.length})
              </button>
            </div>
          </form>
        </div>

        {/* Saved Reports Modal Overlay */}
        {isViewSavedModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur overlay */}
            <div 
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
              onClick={() => setIsViewSavedModalOpen(false)}
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <span>📂</span> Saved Consultant Reports
                </h3>
                <button
                  type="button"
                  onClick={() => setIsViewSavedModalOpen(false)}
                  className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto py-6 flex-1 pr-1 space-y-4">
                {savedReports.length === 0 ? (
                  <div className="text-center py-12 text-slate-450 dark:text-slate-500 text-sm">
                    No saved reports found. Please generate a report first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {savedReports.map((report) => (
                      <div
                        key={report.id}
                        className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-md transition duration-200 cursor-pointer"
                        onClick={() => {
                          setIsViewSavedModalOpen(false);
                          handleLoadReport(report);
                        }}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 truncate">
                            {report.name}
                          </p>
                          {report.companyWebsite && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-mono">
                              {report.companyWebsite}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteReport(report.id, e, report.name)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition flex-shrink-0 cursor-pointer"
                          title="Delete saved report"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsViewSavedModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
