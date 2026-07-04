"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  optimizeStopSequence,
  calculateTimeline,
  TimelineEvent,
  RouteSummary,
  getMockLatLng,
  calculateDistance
} from "@/lib/routing";

type TripData = {
  id: string;
  title: string | null;
  start_address: string | null;
  end_address: string | null;
  start_time: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  user_id?: string | null;
};

type ProspectData = {
  id: string;
  name: string | null;
  address: string | null;
  duration_minutes: number | null;
  phone: string | null;
  notes: string | null;
  position: number | null;
};

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
          return <h5 key={idx} className="text-sm font-bold mt-4 text-slate-900 dark:text-white">{trimmed.replace("##### ", "")}</h5>;
        }
        if (trimmed.startsWith("#### ")) {
          return <h4 key={idx} className="text-base font-bold mt-4 text-slate-900 dark:text-white">{trimmed.replace("#### ", "")}</h4>;
        }
        if (trimmed.startsWith("### ")) {
          return <h3 key={idx} className="text-lg font-bold mt-6 border-b border-slate-200 dark:border-slate-800 pb-1 text-slate-900 dark:text-white">{trimmed.replace("### ", "")}</h3>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={idx} className="text-xl font-extrabold mt-8 border-b border-slate-200 dark:border-slate-800 pb-2 text-slate-900 dark:text-white">{trimmed.replace("## ", "")}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={idx} className="text-2xl font-black mt-10 border-b-2 border-slate-350 dark:border-slate-700 pb-2 text-slate-900 dark:text-white">{trimmed.replace("# ", "")}</h1>;
        }

        // Unordered lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n[\-*]\s+/);
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1.5 my-2">
              {items.map((item, itemIdx) => {
                const cleanItem = itemIdx === 0 ? item.replace(/^[\-*]\s+/, "") : item;
                if (cleanItem.startsWith("[ ] ")) {
                  return (
                    <li key={itemIdx} className="list-none flex items-start gap-2">
                      <input type="checkbox" readOnly className="mt-1 rounded border-slate-300 dark:border-slate-700 bg-transparent text-indigo-600 dark:text-blue-400" />
                      <span>{cleanItem.substring(4)}</span>
                    </li>
                  );
                }
                if (cleanItem.startsWith("[x] ") || cleanItem.startsWith("[X] ")) {
                  return (
                    <li key={itemIdx} className="list-none flex items-start gap-2 line-through text-slate-400 dark:text-slate-500">
                      <input type="checkbox" checked readOnly className="mt-1 rounded border-slate-300 dark:border-slate-700 bg-transparent text-indigo-600 dark:text-blue-400" />
                      <span>{cleanItem.substring(4)}</span>
                    </li>
                  );
                }
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
                        if (headers.length === 3) {
                          if (hIdx === 0) widthClass = "w-[20%]";
                          else if (hIdx === 1) widthClass = "w-[40%]";
                          else if (hIdx === 2) widthClass = "w-[40%]";
                        } else if (headers.length === 4) {
                          if (hIdx === 0) widthClass = "w-[12%]";
                          else if (hIdx === 1) widthClass = "w-[23%]";
                          else if (hIdx === 2) widthClass = "w-[32%]";
                          else if (hIdx === 3) widthClass = "w-[33%]";
                        } else if (headers.length === 5) {
                          if (hIdx === 0) widthClass = "w-[10%]";
                          else if (hIdx === 1) widthClass = "w-[20%]";
                          else if (hIdx === 2) widthClass = "w-[25%]";
                          else if (hIdx === 3) widthClass = "w-[25%]";
                          else if (hIdx === 4) widthClass = "w-[20%]";
                        }
                        return (
                          <th key={hIdx} className={`px-4 py-3 ${widthClass} break-words`}>{h.replace(/\*\*/g, "")}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-transparent text-slate-700 dark:text-white">
                    {dataLines.map((rowLine, rIdx) => {
                      const cells = getCells(rowLine, headers.length);
                      
                      const renderCell = (cellText: string) => {
                        const cleanText = cellText.replace(/\*\*/g, "");
                        if (!cleanText.includes("<br>") && !cleanText.includes("•") && !cleanText.includes("[ ]") && !cleanText.includes("[x]")) {
                          return <span className="break-words whitespace-normal block">{cleanText}</span>;
                        }
                        const parts = cleanText.split(/<br\s*\/?>/i);
                        return (
                          <div className="space-y-1 py-0.5 whitespace-normal break-words max-w-full">
                            {parts.map((p, pIdx) => {
                              const t = p.trim();
                              if (!t) return null;
                              
                              const isChecklistEmpty = t.startsWith("• [ ]") || t.startsWith("- [ ]") || t.startsWith("[ ]");
                              const isChecklistChecked = t.startsWith("• [x]") || t.startsWith("- [x]") || t.startsWith("[x]") || t.startsWith("• [X]") || t.startsWith("- [X]") || t.startsWith("[X]");
                              
                              if (isChecklistEmpty) {
                                const label = t.replace(/^(?:•\s*|[-*]\s*)?\[\s*\]\s*/, "");
                                return (
                                  <div key={pIdx} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-white">
                                    <input type="checkbox" readOnly className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-transparent text-indigo-600 dark:text-blue-400" />
                                    <span>{label}</span>
                                  </div>
                                );
                              }
                              if (isChecklistChecked) {
                                const label = t.replace(/^(?:•\s*|[-*]\s*)?\[x\]\s*/i, "");
                                return (
                                  <div key={pIdx} className="flex items-start gap-1.5 text-xs line-through text-slate-450 dark:text-slate-500">
                                    <input type="checkbox" checked readOnly className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-transparent text-indigo-600 dark:text-blue-400" />
                                    <span>{label}</span>
                                  </div>
                                );
                              }
                              if (t.startsWith("•") || t.startsWith("-") || t.startsWith("*")) {
                                const label = t.replace(/^(?:•|[-*])\s*/, "");
                                return (
                                  <div key={pIdx} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-white">
                                    <span className="text-indigo-500 dark:text-blue-400 font-bold">•</span>
                                    <span>{label}</span>
                                  </div>
                                );
                              }
                              return <div key={pIdx} className="text-slate-700 dark:text-white">{t}</div>;
                            })}
                          </div>
                        );
                      };

                      return (
                        <tr key={rIdx} className="hover:bg-slate-150/40 dark:hover:bg-slate-900/40">
                          {cells.map((cell, cIdx) => (
                            <td key={cIdx} className="px-4 py-3 align-top whitespace-normal break-words">{renderCell(cell)}</td>
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

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimeOnly(isoString: string) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} mins` : `${hrs} hr${hrs > 1 ? "s" : ""}`;
}


export type LunchOption = {
  id: string;
  name: string;
  address: string;
  description: string;
};

export function getStreetName(address: string): string {
  if (!address) return "Main St";
  const parts = address.split(",");
  if (parts.length > 0) {
    const streetPart = parts[0].trim();
    const words = streetPart.split(" ");
    if (words.length > 1 && /^\d+/.test(words[0])) {
      return words.slice(1).join(" ");
    }
    return streetPart;
  }
  return "Main St";
}

export function getLunchOptions(prevAddress: string, nextAddress: string): LunchOption[] {
  const decoded = decodeURIComponent(nextAddress || "450 Main St, Fremont, CA");
  
  // Parse parts of the next address
  const parts = decoded.split(",");
  const streetPart = parts[0] || "450 Main St";
  const cityPart = parts[1] ? parts[1].trim() : "Fremont";
  const stateZipPart = parts[2] ? parts[2].trim() : "CA 94539";
  
  // Clean unit numbers (e.g. Suite, Apt, #, Ste, Unit, Rd. 200, etc.) from streetPart
  const cleanStreet = streetPart.replace(/\b(ste|suite|apt|unit|room|rm|#|\.\s*\d+)\b.*$/i, "").trim();
  
  // Extract street number and street name
  const streetNumMatch = cleanStreet.match(/^(\d+)\s+(.+)$/);
  let streetName = cleanStreet;
  let originalNumber = "123";
  if (streetNumMatch) {
    originalNumber = streetNumMatch[1];
    streetName = streetNumMatch[2].trim();
  }
  
  // Helper to construct address with a modified number
  const makeAddress = (num: string) => {
    return `${num} ${streetName}, ${cityPart}, ${stateZipPart}`;
  };

  // Generate 3 alternative numbers that are on the same street
  const baseNumVal = parseInt(originalNumber, 10) || 100;
  const num1 = String(baseNumVal + 15);
  const num2 = String(Math.max(10, baseNumVal - 20));
  const num3 = String(baseNumVal + 40);

  return [
    {
      id: "cafe",
      name: "Panera Bread (Quick)",
      address: makeAddress(num1),
      description: "[Quick Type] Conveniently located along the forward route (no back traffic)"
    },
    {
      id: "salad",
      name: "Chipotle Mexican Grill (Healthy)",
      address: makeAddress(num2),
      description: "[Healthy Type] Directly along the forward route (no U-turn)"
    },
    {
      id: "deli",
      name: "Subway (Light)",
      address: makeAddress(num3),
      description: "[Light Type] Located along the forward route to next stop (no backtracking)"
    }
  ];
}


function stringToUUID(str: string): string {
  const clean = str.toLowerCase().trim();
  let hash1 = 5381;
  let hash2 = 89;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash1 * hash2).toString(16).padStart(8, '0');
  
  const fullHex = (hex1 + hex2 + hex3 + hex4).substring(0, 32).padEnd(32, '0');
  
  return `${fullHex.substring(0, 8)}-${fullHex.substring(8, 12)}-4${fullHex.substring(13, 16)}-a${fullHex.substring(17, 20)}-${fullHex.substring(20, 32)}`;
}

export default function TripDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [trip, setTrip] = useState<TripData | null>(null);
  const [prospects, setProspects] = useState<ProspectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Routing states
  const [timelineStops, setTimelineStops] = useState<TimelineEvent[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isOptimizedView, setIsOptimizedView] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFromApp, setIsFromApp] = useState(false);
  const [salesReportMarkdown, setSalesReportMarkdown] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const queryParams = new URLSearchParams(window.location.search);
      const source = queryParams.get("source");
      const app = queryParams.get("app");
      const hasAppParam = source === "app" || app === "true";
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsFromApp(hasAppParam || isMobileUA);
    }
  }, []);

  // New Strategy & Preferences states
  const [routeStrategy, setRouteStrategy] = useState<"closest" | "furthest" | "">("");
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [validationError, setValidationError] = useState("");
  const [selectedLunchOption, setSelectedLunchOption] = useState<string>("salad");
  const [prepBufferMinutes, setPrepBufferMinutes] = useState<number>(3);

  // Voice note and transcript states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playingSeconds, setPlayingSeconds] = useState<number>(0);
  const [viewingTranscript, setViewingTranscript] = useState<{ stopName: string; text: string } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playingAudioId) {
      interval = setInterval(() => {
        setPlayingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setPlayingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [playingAudioId]);

  const handlePlayToggle = (stopId: string, duration: number) => {
    if (playingAudioId === stopId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(stopId);
      setPlayingSeconds(0);
      
      // Auto-stop simulation after the note's duration
      const playTimer = setTimeout(() => {
        setPlayingAudioId(prev => prev === stopId ? null : prev);
      }, duration * 1000);
      
      return () => clearTimeout(playTimer);
    }
  };

  const parseVoiceNoteAndTranscript = (notesText: string | null) => {
    if (!notesText) return null;
    
    const micMatch = notesText.match(/🎙️ (?:Voice File|Voice Note):\s*(.*?)\s*\((\d+)s\)/i);
    const transcriptIdx = notesText.indexOf("📝 AI Transcript:");
    
    if (!micMatch && transcriptIdx === -1) return null;
    
    const audioName = micMatch ? micMatch[1] : null;
    const duration = micMatch ? parseInt(micMatch[2], 10) : 5;
    
    let transcriptText = "";
    if (transcriptIdx !== -1) {
      transcriptText = notesText.substring(transcriptIdx + "📝 AI Transcript:".length).trim();
    }
    
    const baseNotesIdx = notesText.indexOf("🎙️");
    const baseNotes = baseNotesIdx !== -1 ? notesText.substring(0, baseNotesIdx).trim() : notesText.trim();
    
    return {
      audioName,
      duration,
      transcriptText,
      baseNotes
    };
  };

  const isAudioExpired = (audioName: string | null) => {
    if (!audioName) return false;
    const dateMatch = audioName.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return false;
    
    try {
      const fileDate = new Date(dateMatch[1]);
      const now = new Date();
      const nowOnlyDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fileOnlyDate = new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate());
      
      const diffTime = nowOnlyDate.getTime() - fileOnlyDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 2;
    } catch (e) {
      console.error("Error parsing file date for expiration check:", e);
      return false;
    }
  };

  const updateLunchOption = async (optionId: string) => {
    setSelectedLunchOption(optionId);
    setIsSaved(false);
    
    if (trip && (trip.status?.startsWith("optimized") || trip.status?.startsWith("scheduled"))) {
      const cleanStatus = trip.status.split(":")[0];
      const newSerializedStatus = `${cleanStatus}:${optionId}`;
      
      // Update local state
      setTrip(prev => prev ? { ...prev, status: newSerializedStatus } : null);
      
      try {
        await supabase
          .from("trips")
          .update({ status: newSerializedStatus })
          .eq("id", id);
        setIsSaved(true);
      } catch (e) {
        console.error("Failed to sync lunch option to backend:", e);
      }
    }
  };

  const getActiveLunchOptions = () => {
    if (!trip) return [];
    const startAddr = trip.start_address || "";
    const endAddr = trip.end_address || "";
    const startTime = trip.start_time || "";
    
    const currentSequence = timelineStops
      .filter(event => event.stopId !== "lunch-break")
      .map(event => {
        const original = prospects.find(p => p.id === event.stopId);
        return {
          id: event.stopId,
          name: event.name,
          address: event.address,
          duration_minutes: original?.duration_minutes ?? 30,
          notes: event.notes,
          position: event.newPosition
        };
      });
      
    if (currentSequence.length === 0) {
      currentSequence.push(...prospects.map(p => ({
        id: p.id,
        name: p.name || "",
        address: p.address || "",
        duration_minutes: p.duration_minutes ?? 30,
        notes: p.notes || "",
        position: p.position ?? 0
      })));
    }
    
    const dryRun = calculateTimeline(startAddr, endAddr, startTime, currentSequence, prepBufferMinutes, false);
    const lunchIdx = dryRun.timeline.findIndex(e => e.stopId === "lunch-break");
    
    let prevStopAddr = startAddr;
    let nextStopAddr = endAddr;
    
    if (lunchIdx > 0) {
      const beforeStops = dryRun.timeline.slice(0, lunchIdx).filter(e => e.stopId !== "lunch-break");
      if (beforeStops.length > 0) prevStopAddr = beforeStops[beforeStops.length - 1].address;
    }
    if (lunchIdx >= 0 && lunchIdx < dryRun.timeline.length - 1) {
      const afterStops = dryRun.timeline.slice(lunchIdx + 1).filter(e => e.stopId !== "lunch-break");
      if (afterStops.length > 0) nextStopAddr = afterStops[0].address;
    }
    
    return getLunchOptions(prevStopAddr, nextStopAddr);
  };

  const formatDistanceVal = (distanceKm: number) => {
    if (unitSystem === "imperial") {
      const miles = Number((distanceKm * 0.621371).toFixed(2));
      return `${miles} miles`;
    }
    return `${distanceKm} km`;
  };

  const getMapEmbedUrl = () => {
    const start = trip?.start_address || "";
    const end = trip?.end_address || "";
    
    if (isOptimizedView && timelineStops.length > 0) {
      const lunchIdx = timelineStops.findIndex(e => e.stopId === "lunch-break");
      let prevStopAddr = start;
      let nextStopAddr = end;
      if (lunchIdx > 0) {
        const beforeStops = timelineStops.slice(0, lunchIdx).filter(e => e.stopId !== "lunch-break");
        if (beforeStops.length > 0) prevStopAddr = beforeStops[beforeStops.length - 1].address;
      }
      if (lunchIdx >= 0 && lunchIdx < timelineStops.length - 1) {
        const afterStops = timelineStops.slice(lunchIdx + 1).filter(e => e.stopId !== "lunch-break");
        if (afterStops.length > 0) nextStopAddr = afterStops[0].address;
      }
      const options = getLunchOptions(prevStopAddr, nextStopAddr);
      const chosenLunch = options.find(o => o.id === selectedLunchOption) || options[0];

      const allStops: string[] = [];
      timelineStops.forEach(event => {
        if (event.stopId === "lunch-break") {
          allStops.push(chosenLunch.address);
        } else {
          allStops.push(event.address);
        }
      });
      const daddrPart = [...allStops, end].map(encodeURIComponent).join("+to:");
      return `https://maps.google.com/maps?saddr=${encodeURIComponent(start)}&daddr=${daddrPart}&t=m&ie=UTF8&iwloc=&output=embed`;
    } else if (prospects.length > 0) {
      const addresses = prospects.map(p => p.address || "").filter(Boolean);
      const daddrPart = [...addresses, end].map(encodeURIComponent).join("+to:");
      return `https://maps.google.com/maps?saddr=${encodeURIComponent(start)}&daddr=${daddrPart}&t=m&ie=UTF8&iwloc=&output=embed`;
    }
    
    return `https://maps.google.com/maps?saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&t=m&ie=UTF8&iwloc=&output=embed`;
  };

  useEffect(() => {
    const loadSettings = () => {
      const stored = localStorage.getItem("fieldroute_user_settings");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.unitSystem) {
            setUnitSystem(parsed.unitSystem);
          }
          if (typeof parsed.prepBufferMinutes === "number") {
            setPrepBufferMinutes(parsed.prepBufferMinutes);
          }
        } catch (e) {
          console.error("Failed to parse user settings", e);
        }
      }
    };

    loadSettings();
    window.addEventListener("storage", loadSettings);
    return () => window.removeEventListener("storage", loadSettings);
  }, []);

  useEffect(() => {
    if (!trip || timelineStops.length === 0) return;
    if (!isOptimizedView) return;
    
    const currentSequence = timelineStops
      .filter(event => event.stopId !== "lunch-break")
      .map(event => {
        const original = prospects.find(p => p.id === event.stopId);
        return {
          id: event.stopId,
          name: event.name,
          address: event.address,
          duration_minutes: original?.duration_minutes ?? 30,
          notes: event.notes,
          position: event.newPosition
        };
      });
      
    const startAddr = trip.start_address || "";
    const endAddr = trip.end_address || "";
    const startTime = trip.start_time || "";
    
    const res = calculateTimeline(
      startAddr,
      endAddr,
      startTime,
      currentSequence,
      prepBufferMinutes,
      selectedLunchOption === "skip",
      selectedLunchOption
    );
    setTimelineStops(res.timeline);
    setRouteSummary(res.summary);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepBufferMinutes, selectedLunchOption, isOptimizedView, trip, prospects]);

  useEffect(() => {
    if (!id) return;

    async function loadTripDetails() {
      setLoading(true);
      setError("");

      try {
        const tripResult = await supabase
          .from("trips")
          .select("id, title, start_address, end_address, start_time, notes, status, created_at, user_id")
          .eq("id", id)
          .single();

        if (tripResult.error) {
          console.error("Error loading trip detail:", tripResult.error);
          setError(tripResult.error.message || "Failed to load trip details.");
          setLoading(false);
          return;
        }

        const tripData = tripResult.data as TripData;
        const username = typeof window !== "undefined" ? localStorage.getItem("sfi_user_name") : null;
        const userUUID = username ? stringToUUID(username) : null;
        if (tripData.user_id && tripData.user_id !== userUUID && username?.toLowerCase() !== "admin") {
          setError("You do not have permission to view this trip.");
          setLoading(false);
          return;
        }
        setTrip(tripData);

        const prospectsResult = await supabase
          .from("trip_prospects")
          .select("id, name, address, duration_minutes, phone, notes, position")
          .eq("trip_id", id)
          .order("position", { ascending: true });

        if (prospectsResult.error) {
          console.error("Error loading trip prospects:", prospectsResult.error);
          setError(prospectsResult.error.message || "Failed to load trip stops.");
          setLoading(false);
          return;
        }

        const loadedProspects = (prospectsResult.data as ProspectData[]) || [];
        setProspects(loadedProspects);

        const rawStatus = tripData.status || "draft";
        const statusParts = rawStatus.split(":");
        const cleanStatus = statusParts[0];
        const dbLunchOption = statusParts[1] || "salad";
        setSelectedLunchOption(dbLunchOption);

        if (cleanStatus === "optimized" || cleanStatus === "scheduled") {
          const startAddr = tripData.start_address || "";
          const endAddr = tripData.end_address || "";
          const startTime = tripData.start_time || "";
          
          const stopInputs = loadedProspects.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            duration_minutes: p.duration_minutes,
            notes: p.notes,
            position: p.position
          }));
          
          let storedPrep = 3;
          const stored = localStorage.getItem("fieldroute_user_settings");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (typeof parsed.prepBufferMinutes === "number") {
                storedPrep = parsed.prepBufferMinutes;
              }
            } catch (e) {
              console.error(e);
            }
          }
          
          const res = calculateTimeline(startAddr, endAddr, startTime, stopInputs, storedPrep, dbLunchOption === "skip", dbLunchOption);
          setTimelineStops(res.timeline);
          setRouteSummary(res.summary);
          setIsOptimizedView(true);
          setIsSaved(true);
        }
      } catch (err: unknown) {
        console.error("Unexpected error loading trip detail:", err);
        setError("An unexpected error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    }

    loadTripDetails();
  }, [id]);

  useEffect(() => {
    // Subscribes to PostgreSQL database changes in real-time
    const prospectsChannel = supabase
      .channel(`realtime-prospects-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_prospects",
          filter: `trip_id=eq.${id}`
        },
        async (payload) => {
          console.log("Realtime prospects update caught:", payload);
          const prospectsResult = await supabase
            .from("trip_prospects")
            .select("id, name, address, duration_minutes, phone, notes, position")
            .eq("trip_id", id)
            .order("position", { ascending: true });

          if (!prospectsResult.error) {
            const loaded = (prospectsResult.data as ProspectData[]) || [];
            setProspects(loaded);
            
            if (trip) {
              const rawStatus = trip.status || "draft";
              const statusParts = rawStatus.split(":");
              const cleanStatus = statusParts[0];
              const dbLunchOption = statusParts[1] || selectedLunchOption;
              
              if (cleanStatus === "optimized" || cleanStatus === "scheduled") {
                const startAddr = trip.start_address || "";
                const endAddr = trip.end_address || "";
                const startTime = trip.start_time || "";
                
                const stopInputs = loaded.map(p => ({
                  id: p.id,
                  name: p.name,
                  address: p.address,
                  duration_minutes: p.duration_minutes,
                  notes: p.notes,
                  position: p.position
                }));
                
                let storedPrep = 3;
                const stored = localStorage.getItem("fieldroute_user_settings");
                if (stored) {
                  try {
                    const parsed = JSON.parse(stored);
                    if (typeof parsed.prepBufferMinutes === "number") {
                      storedPrep = parsed.prepBufferMinutes;
                    }
                  } catch (e) {}
                }
                
                const res = calculateTimeline(startAddr, endAddr, startTime, stopInputs, storedPrep, dbLunchOption === "skip", dbLunchOption);
                setTimelineStops(res.timeline);
                setRouteSummary(res.summary);
              }
            }
          }
        }
      )
      .subscribe();

    const tripsChannel = supabase
      .channel(`realtime-trips-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${id}`
        },
        async (payload) => {
          console.log("Realtime trip header update caught:", payload);
          const tripData = payload.new as TripData;
          setTrip(tripData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(prospectsChannel);
      supabase.removeChannel(tripsChannel);
    };
  }, [id, trip?.status, selectedLunchOption]);

  const handleEndOfTripWeb = async () => {
    if (!trip) return;
    
    if (trip.status?.startsWith("completed") && trip.notes && trip.notes.includes("Daily Outbound Sales Field Report")) {
      setSalesReportMarkdown(trip.notes);
      return;
    }
    
    setIsGeneratingReport(true);
    try {
      const cleanChoice = trip.status ? trip.status.split(":")[1] || "salad" : "salad";
      const newStatus = `completed:${cleanChoice}`;
      
      if (!trip.status?.startsWith("completed")) {
        const { error } = await supabase
          .from("trips")
          .update({ status: newStatus })
          .eq("id", id);
          
        if (error) throw error;
        
        setTrip(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      const reportRes = await fetch("/api/sales-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: id })
      });
      
      if (!reportRes.ok) throw new Error("Failed to generate report.");
      
      const reportData = await reportRes.json();
      setSalesReportMarkdown(reportData.markdown);
      setTrip(prev => prev ? { ...prev, notes: reportData.markdown } : null);
    } catch (e) {
      console.error(e);
      alert("Failed to complete trip or generate sales report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleEmailReportWeb = async () => {
    if (!salesReportMarkdown) return;
    const email = window.prompt("Enter email address to send the report to:", "sales-ops@company.com");
    if (!email) return;
    
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, report: salesReportMarkdown })
      });
      if (res.ok) {
        alert(`Report successfully emailed to ${email}!`);
      } else {
        throw new Error("Failed to email report.");
      }
    } catch (e) {
      alert("Failed to send email. Please try again.");
    }
  };

  const optimizeAndPreviewRoute = (strategy: "closest" | "furthest" | "") => {
    if (!trip || prospects.length === 0) return;
    if (strategy === "") return;
    
    // Address Verification Check
    const invalidStops = prospects.filter(p => !p.address || p.address.trim().length < 5);
    if (invalidStops.length > 0) {
      setValidationError(`The address for "${invalidStops[0].name || 'Unnamed Stop'}" is empty or invalid. Please edit it in the trip settings before optimizing.`);
      return;
    }
    
    try {
      const startAddr = trip.start_address || "";
      const endAddr = trip.end_address || "";
      const startTime = trip.start_time || "";
      
      const stopInputs = prospects.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        duration_minutes: p.duration_minutes,
        notes: p.notes,
        position: p.position
      }));
      
      const optimizedStops = optimizeStopSequence(startAddr, endAddr, stopInputs, strategy);
      const res = calculateTimeline(
        startAddr,
        endAddr,
        startTime,
        optimizedStops,
        prepBufferMinutes,
        selectedLunchOption === "skip",
        selectedLunchOption
      );
      setTimelineStops(res.timeline);
      setRouteSummary(res.summary);
      setIsOptimizedView(true);
    } catch (err) {
      console.error("Failed to generate route:", err);
    }
  };

  const handleGenerateRoute = async () => {
    if (!trip || prospects.length === 0) return;
    
    setValidationError("");
    setIsOptimizing(true);
    setIsSaved(false);
    
    // Address Verification Check
    const invalidStops = prospects.filter(p => !p.address || p.address.trim().length < 5);
    if (invalidStops.length > 0) {
      setValidationError(`The address for "${invalidStops[0].name || 'Unnamed Stop'}" is empty or invalid. Please edit it in the trip settings before optimizing.`);
      setIsOptimizing(false);
      return;
    }
    
    // Simulate AI routing engine calculation delay
    await new Promise((resolve) => setTimeout(resolve, 1200));
    
    try {
      const startAddr = trip.start_address || "";
      const endAddr = trip.end_address || "";
      const startTime = trip.start_time || "";
      
      const stopInputs = prospects.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        duration_minutes: p.duration_minutes,
        notes: p.notes,
        position: p.position
      }));
      
       const optimizedStops = optimizeStopSequence(startAddr, endAddr, stopInputs, routeStrategy || "closest");
      const res = calculateTimeline(
        startAddr,
        endAddr,
        startTime,
        optimizedStops,
        prepBufferMinutes,
        selectedLunchOption === "skip",
        selectedLunchOption
      );
      setTimelineStops(res.timeline);
      setRouteSummary(res.summary);
      setIsOptimizedView(true);
    } catch (err) {
      console.error("Failed to generate route:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!trip || timelineStops.length === 0) return;
    
    setIsSaving(true);
    setIsSaved(false);
    
    try {
      const serializedStatus = `optimized:${selectedLunchOption}`;
      const { error: tripError } = await supabase
        .from("trips")
        .update({ status: serializedStatus })
        .eq("id", id);
        
      if (tripError) throw tripError;
      
      // Save stop positions, excluding the dynamically injected lunch break
      const promises = timelineStops
        .filter(stop => stop.stopId !== "lunch-break")
        .map((stop, idx) => 
          supabase
            .from("trip_prospects")
            .update({ position: idx })
            .eq("id", stop.stopId)
        );
      
      await Promise.all(promises);
      
      setTrip(prev => prev ? { ...prev, status: serializedStatus } : null);
      
      const orderedProspects = timelineStops
        .filter(event => event.stopId !== "lunch-break")
        .map((event, idx) => {
          const original = prospects.find(p => p.id === event.stopId);
          return {
            id: event.stopId,
            name: event.name,
            address: event.address,
            duration_minutes: original?.duration_minutes ?? 30,
            phone: null,
            notes: event.notes,
            position: idx
          };
        });
      
      setProspects(orderedProspects);
      setIsSaved(true);
    } catch (err) {
      console.error("Error saving optimized route:", err);
      alert("Failed to save optimized route.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDraft = async () => {
    setIsOptimizing(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ status: "draft" })
        .eq("id", id);
        
      if (error) throw error;
      
      setTrip(prev => prev ? { ...prev, status: "draft" } : null);
      setIsOptimizedView(false);
      setSelectedLunchOption("skip");
      setRouteStrategy("");
      setIsSaved(false);
      setValidationError("");
    } catch (e) {
      console.error("Failed to reset draft status in database:", e);
      alert("Failed to reset draft status.");
    } finally {
      setIsOptimizing(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
            Error Loading Trip
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Trip Not Found</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {error || "We couldn't retrieve the details for this trip. It may have been deleted."}
          </p>
          <Link
            href="/trip"
            className="mt-6 inline-block rounded-xl bg-slate-200 dark:bg-slate-850 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-305 dark:hover:bg-slate-700"
          >
            Back to Saved Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition group w-fit"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">←</span>
            Back to Home
          </Link>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-550 dark:text-slate-500">
              Trip Details
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
              {trip.title?.trim() || "Untitled Trip"}
            </h1>
            <p className="mt-1 text-xs text-slate-550 dark:text-slate-400">
              Created: {formatDateTime(trip.created_at)}
            </p>
          </div>

          <div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] border ${
              trip.status?.startsWith("optimized")
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            }`}>
              {(trip.status || "Draft").split(":")[0]}
            </span>
          </div>
        </div>

        {/* Google Map real-time itinerary stops */}
        {(trip.start_address || trip.end_address) && (
          <div className="mb-8 w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100/40 dark:bg-slate-950/40 shadow-xl">
            <iframe
              title="Google Maps Itinerary Route"
              width="100%"
              height="380"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={getMapEmbedUrl()}
            ></iframe>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isOptimizedView ? "Optimized Visit Schedule" : "Trip Route (Draft Order)"}
                </h2>
                {isOptimizedView && (
                  <span className="text-xs text-indigo-650 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                    Deterministic AI Schedule
                  </span>
                )}
              </div>

              <div className="relative border-l-2 border-slate-200 dark:border-slate-800 pl-6 ml-3 space-y-6">
                
                {/* Start Location Node */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 border border-white dark:border-slate-950"></div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Start Address
                    </span>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {trip.start_address || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Departure: {formatDateTime(trip.start_time)}
                    </p>
                  </div>
                </div>

                {/* Timeline rendering if optimized view */}
                {isOptimizedView && timelineStops.length > 0 ? (() => {
                  let clientStopIndex = 0;
                  return timelineStops.map((event) => {
                    const isLunch = event.stopId === "lunch-break";
                    if (!isLunch) {
                      clientStopIndex++;
                    }
                    
                    return (
                      <React.Fragment key={event.stopId}>
                        {/* Travel to Stop section */}
                        {!isLunch && (
                          <div className="relative py-2 pl-2">
                            <div className="absolute -left-[33px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-900">
                              🚘
                            </div>
                            <div className="rounded-lg bg-slate-100/30 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900/50 p-2 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                              <span>Travel to Stop {clientStopIndex}</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {event.travelTimeMinutes} mins ({formatDistanceVal(event.travelDistanceKm)})
                              </span>
                            </div>
                          </div>
                        )}
                        
                               {isLunch ? (() => {
                          const lunchIdx = timelineStops.findIndex(e => e.stopId === "lunch-break");
                          let prevStopAddr = trip.start_address || "";
                          let nextStopAddr = trip.end_address || "";
                          if (lunchIdx > 0) {
                            const beforeStops = timelineStops.slice(0, lunchIdx).filter(e => e.stopId !== "lunch-break");
                            if (beforeStops.length > 0) prevStopAddr = beforeStops[beforeStops.length - 1].address;
                          }
                          if (lunchIdx >= 0 && lunchIdx < timelineStops.length - 1) {
                            const afterStops = timelineStops.slice(lunchIdx + 1).filter(e => e.stopId !== "lunch-break");
                            if (afterStops.length > 0) nextStopAddr = afterStops[0].address;
                          }
                          const options = getLunchOptions(prevStopAddr, nextStopAddr);
                          const chosenLunch = options.find(o => o.id === selectedLunchOption) || options[0];
                          
                          return (
                            <div className="relative">
                              <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 border border-white dark:border-slate-950 font-bold text-[8px] text-white">
                                🍔
                              </div>
                              
                              <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-4 transition hover:border-amber-300 dark:hover:border-amber-500/30 space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm font-bold text-amber-650 dark:text-amber-350">
                                    🍔 Lunch Break: {chosenLunch?.name}
                                  </p>
                                  <span className="self-start rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-350">
                                    60 mins
                                  </span>
                                </div>
                                <p className="text-xs text-slate-650 dark:text-slate-400">
                                  📍 {chosenLunch?.address}
                                </p>
                                <p className="text-xs text-amber-650/85 dark:text-amber-400/80 italic">
                                  {chosenLunch?.description}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-amber-500/10 pt-2 text-amber-700 dark:text-amber-400/70 sm:grid-cols-4">
                                  <div>
                                    <span className="block text-[10px] text-amber-500/55 uppercase tracking-wider">Break Start</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-300">{formatTimeOnly(event.visitStart)}</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500/55 uppercase tracking-wider">Duration</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-300">60 mins</span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-amber-500/55 uppercase tracking-wider">Break End</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-300">{formatTimeOnly(event.visitEnd)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                        : (
                          <div className="relative">
                            <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 border border-white dark:border-slate-950 font-bold text-[8px] text-white">
                              {clientStopIndex}
                            </div>
                            
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/40 p-4 transition hover:border-slate-350 dark:hover:border-slate-700">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  {event.name}
                                </p>
                                <span className="self-start rounded bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-650 dark:text-indigo-300">
                                  {event.visitEnd ? Math.round((new Date(event.visitEnd).getTime() - new Date(event.visitStart).getTime()) / 60000) : 30} mins visit
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                {event.address}
                              </p>

                              {/* Planned Schedule / Buffer Timings */}
                              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] border-t border-slate-200/60 dark:border-slate-900/60 pt-3 text-slate-600 dark:text-slate-400 sm:grid-cols-4">
                                <div>
                                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Arrival</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{formatTimeOnly(event.arrivalTime)}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Prep Buffer</span>
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">{prepBufferMinutes} mins</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Visit Window</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {formatTimeOnly(event.visitStart)} - {formatTimeOnly(event.visitEnd)}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Wrap-up & Depart</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{formatTimeOnly(event.departureTime)}</span>
                                </div>
                              </div>

                              {(() => {
                                if (!event.notes) return null;
                                const parsed = parseVoiceNoteAndTranscript(event.notes);
                                if (!parsed) {
                                  return (
                                    <div className="mt-3 rounded-lg bg-slate-200/50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300">
                                      <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Notes:</span>
                                      {event.notes}
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="mt-3 space-y-2">
                                    {parsed.baseNotes ? (
                                      <div className="rounded-lg bg-slate-200/50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Notes:</span>
                                        {parsed.baseNotes}
                                      </div>
                                    ) : null}
                                    
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      {!isAudioExpired(parsed.audioName) && (
                                        <button
                                          onClick={() => handlePlayToggle(event.stopId, parsed.duration)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/15 border border-indigo-500/20 transition-all shadow-sm cursor-pointer"
                                        >
                                          {playingAudioId === event.stopId 
                                            ? `⏸️ Pause Note (${playingSeconds}s / ${parsed.duration}s)` 
                                            : `▶️ Play Note (${parsed.duration}s)`
                                          }
                                        </button>
                                      )}
                                      
                                      {parsed.transcriptText ? (
                                        <button
                                          onClick={() => setViewingTranscript({ stopName: event.name, text: parsed.transcriptText })}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/15 border border-emerald-500/20 transition-all shadow-sm cursor-pointer"
                                        >
                                          📝 View Transcript
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })() : (
                  /* Draft Unoptimized List */
                  prospects.length === 0 ? (
                    <div className="relative">
                      <div className="absolute -left-[30px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-800 border border-white dark:border-slate-950"></div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">No stops added to this trip.</p>
                    </div>
                  ) : (
                    prospects.map((prospect, idx) => (
                      <div key={prospect.id} className="relative">
                        <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 border border-white dark:border-slate-950 font-bold text-[8px] text-slate-600 dark:text-slate-400">
                          {idx + 1}
                        </div>
                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/40 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {prospect.name || "Unnamed Stop"}
                            </p>
                            <span className="self-start rounded bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-650 dark:text-indigo-300">
                              {prospect.duration_minutes || 30} mins visit
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                            {prospect.address || "—"}
                          </p>

                          {(() => {
                            if (!prospect.notes) return null;
                            const parsed = parseVoiceNoteAndTranscript(prospect.notes);
                            if (!parsed) {
                              return (
                                <div className="mt-2 rounded-lg bg-slate-200/50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Notes:</span>
                                  {prospect.notes}
                                </div>
                              );
                            }
                            
                            return (
                              <div className="mt-2 space-y-2">
                                {parsed.baseNotes ? (
                                  <div className="rounded-lg bg-slate-200/50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Notes:</span>
                                    {parsed.baseNotes}
                                  </div>
                                ) : null}
                                
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {!isAudioExpired(parsed.audioName) && (
                                    <button
                                      onClick={() => handlePlayToggle(prospect.id, parsed.duration)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/15 border border-indigo-500/20 transition-all shadow-sm cursor-pointer"
                                    >
                                      {playingAudioId === prospect.id 
                                        ? `⏸️ Pause Note (${playingSeconds}s / ${parsed.duration}s)` 
                                        : `▶️ Play Note (${parsed.duration}s)`
                                      }
                                    </button>
                                  )}
                                  
                                  {parsed.transcriptText ? (
                                    <button
                                      onClick={() => setViewingTranscript({ stopName: prospect.name || "Unnamed Stop", text: parsed.transcriptText })}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/15 border border-emerald-500/20 transition-all shadow-sm cursor-pointer"
                                    >
                                      📝 View Transcript
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* Final End Location section for optimized view */}
                {isOptimizedView && routeSummary && timelineStops.length > 0 && (() => {
                  const lastClientStop = [...timelineStops].reverse().find(s => s.stopId !== "lunch-break");
                  const lastStopAddress = lastClientStop?.address || trip.start_address || "";
                  const endDist = calculateDistance(getMockLatLng(lastStopAddress), getMockLatLng(trip.end_address || ""));
                  return (
                    <div className="relative py-2 pl-2">
                      <div className="absolute -left-[33px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-900">
                        🚘
                      </div>
                      <div className="rounded-lg bg-slate-100/30 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900/50 p-2 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Travel to End Location</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {Math.max(2, Math.round(endDist * 0.573))} mins ({formatDistanceVal(endDist)})
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* End Location Node */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-900 border border-white dark:border-slate-950"></div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-650 dark:text-indigo-400">
                      End Address
                    </span>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {trip.end_address || "—"}
                    </p>
                    {isOptimizedView && routeSummary && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        Estimated Final Arrival: {formatTimeOnly(routeSummary.endArrival)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* End of Trip Button */}
              {trip && trip.status && (
                <div className="mt-6">
                  <button
                    onClick={handleEndOfTripWeb}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-600/20 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    {trip.status.startsWith("completed") ? "📊 View Report" : "🏁 End of Trip"}
                  </button>
                </div>
              )}
            </div>


          </section>

          <section className="space-y-6">
            {/* Sidebar Lunch Selector Panel */}
            {isOptimizedView && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  🍔 Lunch Break Choice
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Logical lunch break scheduled closest to 12:30 PM with the previous stop ends. Choose a restaurant along your route or skip lunch:
                </p>
                <div className="space-y-2">
                  {getActiveLunchOptions().map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                        isSaved || isFromApp
                          ? "cursor-not-allowed opacity-60 bg-slate-100/50 dark:bg-slate-900/20"
                          : "cursor-pointer"
                      } ${
                        selectedLunchOption === opt.id
                          ? "border-amber-500/50 bg-amber-500/10 text-slate-900 dark:text-white"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-slate-650 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sidebar-lunch-option"
                        checked={selectedLunchOption === opt.id}
                        onChange={() => !(isSaved || isFromApp) && updateLunchOption(opt.id)}
                        disabled={isSaved || isFromApp}
                        className="mt-1 h-3.5 w-3.5 border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500/30 disabled:opacity-50"
                      />
                      <div className="text-[11px] leading-tight">
                        <p className="font-bold text-slate-850 dark:text-slate-200">{opt.name}</p>
                        <p className="text-slate-500 mt-0.5">{opt.address}</p>
                        <p className="text-amber-605 dark:text-amber-500/80 mt-1 font-semibold">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                  
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                      isSaved || isFromApp
                        ? "cursor-not-allowed opacity-60 bg-slate-100/50 dark:bg-slate-900/20"
                        : "cursor-pointer"
                    } ${
                      selectedLunchOption === "skip"
                        ? "border-amber-500/50 bg-amber-500/10 text-slate-900 dark:text-white"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-slate-650 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sidebar-lunch-option"
                      checked={selectedLunchOption === "skip"}
                      onChange={() => !(isSaved || isFromApp) && updateLunchOption("skip")}
                      disabled={isSaved || isFromApp}
                      className="mt-1 h-3.5 w-3.5 border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500/30 disabled:opacity-50"
                    />
                    <div className="text-[11px] leading-tight">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Skip Lunch</p>
                      <p className="text-slate-500 mt-0.5">Do not schedule a lunch break, proceed to next stop directly</p>
                    </div>
                  </label>
                </div>
                
                {(isSaved || isFromApp) && (
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-center">
                    {isFromApp 
                      ? "✓ Lunch choice is managed by the mobile application."
                      : "✓ Lunch choice is locked on the saved route. Click \"Re-Calculate Route\" to modify."}
                  </p>
                )}
              </div>
            )}

            {/* Actions Panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Actions</h2>
              <div className="space-y-3">
                
                {/* First Stop Strategy Select Dropdown */}
                 {(!isOptimizedView || trip.status?.startsWith("optimized")) && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      First Stop Strategy
                    </label>
                    <select
                      value={routeStrategy}
                      onChange={(e) => {
                        const nextStrategy = e.target.value as "closest" | "furthest" | "";
                        setRouteStrategy(nextStrategy);
                        setIsSaved(false);
                        if (nextStrategy) {
                          optimizeAndPreviewRoute(nextStrategy);
                        }
                      }}
                      disabled={isOptimizing || isSaving}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-50 font-sans"
                    >
                      <option value="">Select Strategy...</option>
                      <option value="closest">Closest stop first (Recommended)</option>
                      <option value="furthest">Furthest stop first</option>
                    </select>
                  </div>
                )}

                {/* Validation Error Banner */}
                {validationError && (
                  <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400 mb-3">
                    <p className="font-semibold uppercase tracking-wider text-[10px] text-red-600 dark:text-red-300">
                      Address Verification Failed
                    </p>
                    <p className="mt-1">{validationError}</p>
                  </div>
                )}

                {isOptimizing ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600/40 px-4 py-3 text-sm font-semibold text-white">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Optimizing Route...
                  </div>
                ) : !isOptimizedView ? (
                  <button
                    type="button"
                    disabled={routeStrategy === "" || isOptimizing}
                    onClick={handleGenerateRoute}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    Generate Route
                  </button>
                ) : !isSaved ? (
                  <>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveRoute}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? "Saving..." : "Save Route"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-650 transition cursor-pointer"
                    >
                      Discard & Reset
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center text-xs font-semibold text-emerald-400">
                      ✓ Save Route
                    </div>
                    {isFromApp ? (
                      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-center text-xs font-semibold text-indigo-450 dark:text-indigo-300">
                        ✓ Managed by Mobile App
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleGenerateRoute}
                          className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-2.5 text-center text-xs font-semibold text-indigo-650 dark:text-indigo-300 hover:bg-indigo-500/10 transition cursor-pointer"
                        >
                          Re-Calculate Route
                        </button>
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-650 transition cursor-pointer"
                        >
                          Discard & Reset
                        </button>
                      </>
                    )}
                  </div>
                )}

                {isSaved && (
                  <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                    Saved successfully!
                  </p>
                )}

                <Link
                  href="/trip"
                  className="block w-full rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-450 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Back to Trip List
                </Link>
              </div>
            </div>

            {/* Stats / Summary Panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Summary</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Stops
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                    {prospects.length}
                  </p>
                </div>

                {isOptimizedView && routeSummary ? (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Estimated Distance
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        {formatDistanceVal(routeSummary.totalDistanceKm)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Driving Duration
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {formatDuration(routeSummary.totalTravelTimeMinutes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total &quot;Face-Time&quot; (Visits)
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {formatDuration(routeSummary.totalVisitTimeMinutes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Lunch Break & Buffers
                      </p>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        Lunch Break: {selectedLunchOption === "skip" ? "Skipped" : "1 hr"} <br/>
                        Prep & Wrap Buffers: {formatDuration(routeSummary.totalBufferTimeMinutes)}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total Route Time
                      </p>
                      <p className="mt-1 text-xl font-black text-indigo-650 dark:text-indigo-400">
                        {formatDuration(routeSummary.totalDurationMinutes)}
                      </p>
                    </div>
                  </>
                ) : null}

              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Transcript Overlay Modal */}
      {viewingTranscript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                📝 AI Transcript: {viewingTranscript.stopName}
              </h3>
              <button
                onClick={() => setViewingTranscript(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="max-h-[350px] overflow-y-auto rounded-xl border border-slate-250 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/50 p-4 font-mono text-xs text-slate-705 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {viewingTranscript.text}
            </div>

            {/* Footer */}
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setViewingTranscript(null)}
                className="rounded-xl border border-slate-300 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-750 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sales Report Loading Overlay */}
      {isGeneratingReport && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="flex flex-col items-center gap-4 bg-white dark:bg-slate-950 p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white mt-2">Generating Sales Field Report...</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Our B2B logistics agent is analyzing stop transcripts, compiling insights, and structuring action items.
            </p>
          </div>
        </div>
      )}

      {/* Sales Report Overlay Modal */}
      {salesReportMarkdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                📊 Daily Outbound Sales Field Report
              </h3>
              <button
                onClick={() => setSalesReportMarkdown(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-250 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/50 p-6">
              {renderMarkdownToJSX(salesReportMarkdown)}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={handleEmailReportWeb}
                className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 text-xs font-semibold hover:bg-indigo-750 transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
              >
                ✉️ E-Mail Report
              </button>
              <button
                onClick={() => setSalesReportMarkdown(null)}
                className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-md cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
