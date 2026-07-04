"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import Header from "@/components/Header";

function renderMarkdownToJSX(text: string) {
  if (!text) return null;

  // Split into blocks by double newlines
  const blocks = text.split("\n\n");

  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Horizontal rules
        if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
          return <hr key={idx} className="border-t border-slate-200 dark:border-slate-800 my-6" />;
        }

        // Headers
        if (trimmed.startsWith("##### ")) {
          return <h5 key={idx} className="text-sm font-bold mt-4">{trimmed.replace("##### ", "")}</h5>;
        }
        if (trimmed.startsWith("#### ")) {
          return <h4 key={idx} className="text-base font-bold mt-4">{trimmed.replace("#### ", "")}</h4>;
        }
        if (trimmed.startsWith("### ")) {
          return <h3 key={idx} className="text-lg font-bold mt-6 border-b border-slate-200 dark:border-slate-800 pb-1">{trimmed.replace("### ", "")}</h3>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={idx} className="text-xl font-extrabold mt-8 border-b border-slate-200 dark:border-slate-800 pb-2">{trimmed.replace("## ", "")}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={idx} className="text-2xl font-black mt-10 border-b-2 border-slate-300 dark:border-slate-700 pb-2">{trimmed.replace("# ", "")}</h1>;
        }

        // Unordered lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n[\-*]\s+/);
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1.5 my-2">
              {items.map((item, itemIdx) => {
                const cleanItem = itemIdx === 0 ? item.replace(/^[\-*]\s+/, "") : item;
                return <li key={itemIdx}>{cleanItem}</li>;
              })}
            </ul>
          );
        }

        // Ordered lists
        if (/^\d+\.\s+/.test(trimmed)) {
          const items = trimmed.split(/\n\d+\.\s+/);
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1.5 my-2">
              {items.map((item, itemIdx) => {
                const cleanItem = itemIdx === 0 ? item.replace(/^\d+\.\s+/, "") : item;
                return <li key={itemIdx}>{cleanItem}</li>;
              })}
            </ol>
          );
        }

        // Tables
        if (trimmed.startsWith("|") && (trimmed.includes("\n|") || trimmed.includes("\r\n|"))) {
          const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const headerLine = lines[0];
            const dataLines = lines.slice(2);

            const getCells = (line: string, limit?: number) => {
              const rawCells = line
                .split("|")
                .slice(1, -1) // remove empty first and last elements from outer pipes
                .map(c => c.trim());
              if (limit && rawCells.length > limit) {
                const result = rawCells.slice(0, limit - 1);
                result.push(rawCells.slice(limit - 1).join(" | "));
                return result;
              }
              return rawCells;
            };

            const headers = getCells(headerLine);

            return (
              <div key={idx} className="my-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-950/30 overflow-hidden">
                <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-slate-800 text-xs text-left">
                  <thead className="bg-slate-150/60 dark:bg-slate-950/60 font-bold uppercase tracking-wider text-slate-850 dark:text-slate-150">
                    <tr>
                      {headers.map((h, hIdx) => {
                        let widthClass = "";
                        if (headers.length === 2) {
                          if (hIdx === 0) widthClass = "w-[25%]";
                          else if (hIdx === 1) widthClass = "w-[75%]";
                        } else if (headers.length === 3) {
                          if (hIdx === 0) widthClass = "w-[25%]";
                          else if (hIdx === 1) widthClass = "w-[35%]";
                          else if (hIdx === 2) widthClass = "w-[40%]";
                        } else if (headers.length === 4) {
                          if (hIdx === 0) widthClass = "w-[15%]";
                          else if (hIdx === 1) widthClass = "w-[25%]";
                          else if (hIdx === 2) widthClass = "w-[30%]";
                          else if (hIdx === 3) widthClass = "w-[30%]";
                        }
                        return (
                          <th key={hIdx} className={`px-4 py-3 ${widthClass} break-words`}>{h.replace(/\*\*/g, "")}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-transparent text-slate-700 dark:text-slate-200">
                    {dataLines.map((rowLine, rIdx) => {
                      const cells = getCells(rowLine, headers.length);
                      return (
                        <tr key={rIdx} className="hover:bg-slate-150/40 dark:hover:bg-slate-900/40">
                          {cells.map((cell, cIdx) => (
                            <td key={cIdx} className="px-4 py-3 align-top whitespace-normal break-words">
                              {(() => {
                                const cleanText = cell.replace(/\*\*/g, "");
                                if (!cleanText.includes("<br>") && !cleanText.includes("•")) {
                                  return <span>{cleanText}</span>;
                                }
                                const parts = cleanText.split(/<br\s*\/?>/i);
                                return (
                                  <div className="space-y-1 py-0.5">
                                    {parts.map((p, pIdx) => {
                                      const t = p.trim();
                                      if (!t) return null;
                                      if (t.startsWith("•") || t.startsWith("-") || t.startsWith("*")) {
                                        const label = t.replace(/^(?:•|[-*])\s*/, "");
                                        return (
                                          <div key={pIdx} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                                            <span className="text-indigo-500 dark:text-blue-400 font-bold">•</span>
                                            <span>{label}</span>
                                          </div>
                                        );
                                      }
                                      return <div key={pIdx} className="text-slate-700 dark:text-slate-200">{t}</div>;
                                    })}
                                  </div>
                                );
                              })()}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Default paragraph
        return <p key={idx} className="leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}

type ReportTab = {
  label: string;
  sectionNumber: number;
  content: string;
};

function parseMarkdownToTabs(text: string): ReportTab[] {
  if (!text) return [];

  const DEFAULT_LABELS = [
    "Summary",
    "Requirements",
    "Services",
    "Pain Points",
    "Solutions",
    "Email",
    "Script",
    "Questions",
    "Strategy"
  ];

  // Truncate text before section 10 if it exists to avoid duplicate sections from "10. Markdown Output"
  const section10Regex = /(?:^|\n)(?:\s*|#+\s*|\*+\s*)\b10\.\s+/i;
  const section10Match = text.match(section10Regex);
  let cleanText = text;
  if (section10Match && typeof section10Match.index === "number") {
    cleanText = text.substring(0, section10Match.index).trim();
  }

  // Match headers starting with "1. " to "9. " optionally prefixed by headers (#) or bolds (*)
  const regex = /(?:^|\n)(?:\s*|#+\s*|\*+\s*)\b([1-9])\.\s*(.*?)(?:\n|$)/gi;
  const matches: { index: number; text: string; sectionNum: number; heading: string }[] = [];
  let match;

  regex.lastIndex = 0;
  while ((match = regex.exec(cleanText)) !== null) {
    const headingCleaned = match[2].replace(/[\*#_]/g, "").trim();
    matches.push({
      index: match.index,
      text: match[0],
      sectionNum: parseInt(match[1], 10),
      heading: headingCleaned
    });
  }

  if (matches.length === 0) {
    return [{
      label: "Full Report",
      sectionNumber: 1,
      content: cleanText
    }];
  }

  matches.sort((a, b) => a.index - b.index);

  // Group sections by section number to merge duplicates (like subheadings or strategies)
  const groupedSections: Record<number, { heading: string; contents: string[] }> = {};

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    const contentStart = currentMatch.index + currentMatch.text.length;
    const contentEnd = nextMatch ? nextMatch.index : cleanText.length;

    let content = cleanText.substring(contentStart, contentEnd).trim();
    content = content.replace(/^[\r\n]+/, "").trim();

    const num = currentMatch.sectionNum;
    if (!groupedSections[num]) {
      groupedSections[num] = {
        heading: currentMatch.heading,
        contents: []
      };
    }
    groupedSections[num].contents.push(content);
  }

  const tabs: ReportTab[] = [];
  for (const numStr in groupedSections) {
    const num = parseInt(numStr, 10);
    const group = groupedSections[num];
    const mergedContent = group.contents.join("\n\n---\n\n");

    // Use the actual agenda heading from the report, falling back to DEFAULT_LABELS if empty
    const label = group.heading || (DEFAULT_LABELS[num - 1] || "Section");

    tabs.push({
      label: `${num}. ${label}`,
      sectionNumber: num,
      content: mergedContent
    });
  }

  tabs.sort((a, b) => a.sectionNumber - b.sectionNumber);
  return tabs;
}

export default function BDConsultantReportPage() {
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [tabs, setTabs] = useState<ReportTab[]>([]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem("fieldroute_report_company_name") || "";
    const website = localStorage.getItem("fieldroute_report_company_website") || "";
    const markdown = localStorage.getItem("fieldroute_report_markdown") || "";

    setCompanyName(name);
    setCompanyWebsite(website);
    setReportMarkdown(markdown);

    const parsedTabs = parseMarkdownToTabs(markdown);
    setTabs(parsedTabs);
    setActiveTabIdx(0);

    setLoading(false);
  }, []);

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!reportMarkdown) return;
    async function checkSaved() {
      try {
        const token = localStorage.getItem("sfi_user_token");
        const res = await fetch("/api/bd-consultant/reports", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          const savedList = data.reports || [];
          const exists = savedList.some(
            (r: any) =>
              r.companyName === companyName &&
              r.companyWebsite === companyWebsite &&
              r.markdown === reportMarkdown
          );
          setIsSaved(exists);
        } else {
          throw new Error("API check failed");
        }
      } catch (e) {
        console.error("Failed to check saved reports on server:", e);
        const savedListRaw = localStorage.getItem("fieldroute_saved_reports") || "[]";
        try {
          const savedList = JSON.parse(savedListRaw);
          const exists = savedList.some(
            (r: any) =>
              r.companyName === companyName &&
              r.companyWebsite === companyWebsite &&
              r.markdown === reportMarkdown
          );
          setIsSaved(exists);
        } catch (localErr) {
          console.error(localErr);
        }
      }
    }
    checkSaved();
  }, [companyName, companyWebsite, reportMarkdown]);

  const handleSaveReport = async () => {
    if (!reportMarkdown) return;

    const reportPayload = {
      name: `${companyName || companyWebsite || "Unnamed"} Report`,
      companyName,
      companyWebsite,
      markdown: reportMarkdown,
    };

    try {
      const token = localStorage.getItem("sfi_user_token");
      const res = await fetch("/api/bd-consultant/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(reportPayload),
      });
      if (res.ok) {
        setIsSaved(true);
      } else {
        console.error("Failed to save report to database");
      }
    } catch (e) {
      console.error("Error saving report to server:", e);
    }

    const savedListRaw = localStorage.getItem("fieldroute_saved_reports") || "[]";
    try {
      const savedList = JSON.parse(savedListRaw);
      const exists = savedList.some(
        (r: any) =>
          r.companyName === companyName &&
          r.companyWebsite === companyWebsite &&
          r.markdown === reportMarkdown
      );
      if (!exists) {
        const newReport = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
          ...reportPayload,
          createdAt: new Date().toISOString(),
        };
        const newList = [newReport, ...savedList];
        localStorage.setItem("fieldroute_saved_reports", JSON.stringify(newList));
        setIsSaved(true);
      }
    } catch (localErr) {
      console.error(localErr);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    const emailContent = tabs[activeTabIdx]?.content || "";
    if (!emailContent) return;
    navigator.clipboard.writeText(emailContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy email content:", err);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading analysis report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
      <Header />

      <main className="mx-auto flex max-w-6xl w-full flex-col px-6 py-12 flex-1">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition group w-fit"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">←</span>
            Back to Home
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 font-bold text-xl">
              💼
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-450 dark:text-slate-500">AI Sales Agent</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">SFI Business Development Consultant</h2>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Account Analysis: {companyName || "Unknown Company"}
              </h2>
              {companyWebsite && (
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                  Website: <a href={companyWebsite.startsWith("http") ? companyWebsite : `https://${companyWebsite}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-650 dark:text-indigo-400">{companyWebsite}</a>
                </p>
              )}
            </div>

            {/* Tab navigation buttons */}
            {tabs.length > 1 && (
              <div className="flex flex-wrap gap-x-2 gap-y-3.5 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4 select-none justify-start">
                {tabs.map((tab, idx) => {
                  const isActive = idx === activeTabIdx;
                  return (
                    <button
                      key={`${tab.sectionNumber}-${idx}`}
                      type="button"
                      onClick={() => setActiveTabIdx(idx)}
                      className={`flex-shrink-0 px-2 py-1 rounded-md text-[9px] font-bold transition-all duration-200 ease-in-out transform hover:scale-110 hover:z-10 origin-center whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-indigo-600 dark:bg-indigo-600 text-white shadow-md scale-110 z-10"
                          : "border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-6 md:p-8 shadow-inner relative">
              {tabs[activeTabIdx]?.sectionNumber === 6 && (
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="absolute top-4 right-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition cursor-pointer flex items-center gap-1.5 z-10"
                >
                  {copied ? (
                    <>
                      <span>✓</span> Copied
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Email
                    </>
                  )}
                </button>
              )}

              {tabs.length > 0 ? (
                renderMarkdownToJSX(tabs[activeTabIdx]?.content || "")
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">No report content found. Please go back to the homepage to generate a report.</p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end items-center gap-4">
            <button
              type="button"
              onClick={handleSaveReport}
              disabled={isSaved || !reportMarkdown}
              className={`rounded-xl px-5 py-3 text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                isSaved
                  ? "bg-emerald-600/20 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/30 cursor-default"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:shadow-lg"
              }`}
            >
              {isSaved ? "✓ Report Saved" : "Save Report"}
            </button>

            <Link
              href="/"
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-3 text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-450 dark:hover:border-slate-600 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
