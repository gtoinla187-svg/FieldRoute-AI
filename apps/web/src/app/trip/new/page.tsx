"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "@/lib/createTrip";
import Header from "@/components/Header";

type ProspectRow = {
  id: string;
  name: string;
  address: string;
  durationMinutes: string;
  phone: string;
  notes: string;
};

function makeProspectRow(): ProspectRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    address: "",
    durationMinutes: "30",
    phone: "",
    notes: "",
  };
}

type SavedLocation = {
  id: string;
  name: string;
  address: string;
  isDefault?: boolean;
};

type TripFormDraft = {
  startDate: string;
  startTime: string;
  startAddress: string;
  endAddress: string;
  notes: string;
  pasteInput: string;
  prospects: ProspectRow[];
};

const DEFAULT_LOCATIONS: SavedLocation[] = [
  {
    id: "default-office",
    name: "Office",
    address: "48521 Warm Springs Blvd., Fremont, CA 94538",
    isDefault: true,
  },
  {
    id: "default-home",
    name: "Home",
    address: "45401 Research Ave., Fremont, CA 94539",
    isDefault: true,
  },
];

// Client-side parser helpers removed in favor of backend AI parsing agent.


export default function NewTripPage() {
  const router = useRouter();

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(DEFAULT_LOCATIONS);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");

  useEffect(() => {
    const loadLocations = () => {
      const stored = localStorage.getItem("fieldroute_saved_locations");
      if (stored) {
        try {
          let parsed = JSON.parse(stored) as SavedLocation[];
          const migrated = localStorage.getItem("fieldroute_locations_migrated_v2");
          if (!migrated) {
            const merged = [...parsed];
            DEFAULT_LOCATIONS.forEach((defaultLoc) => {
              if (!merged.some((l) => l.id === defaultLoc.id)) {
                merged.unshift(defaultLoc);
              }
            });
            parsed = merged;
            localStorage.setItem("fieldroute_saved_locations", JSON.stringify(parsed));
            localStorage.setItem("fieldroute_locations_migrated_v2", "true");
          }
          setTimeout(() => {
            setSavedLocations(parsed);
          }, 0);
        } catch (e) {
          console.error("Failed to parse stored locations", e);
        }
      } else {
        localStorage.setItem("fieldroute_saved_locations", JSON.stringify(DEFAULT_LOCATIONS));
        localStorage.setItem("fieldroute_locations_migrated_v2", "true");
        setTimeout(() => {
          setSavedLocations(DEFAULT_LOCATIONS);
        }, 0);
      }
    };

    loadLocations();

    window.addEventListener("storage", loadLocations);
    return () => window.removeEventListener("storage", loadLocations);
  }, []);

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !newLocationAddress.trim()) {
      return;
    }

    const newLoc: SavedLocation = {
      id: crypto.randomUUID(),
      name: newLocationName.trim(),
      address: newLocationAddress.trim(),
    };

    const updated = [...savedLocations, newLoc];
    setSavedLocations(updated);

    localStorage.setItem("fieldroute_saved_locations", JSON.stringify(updated));

    setNewLocationName("");
    setNewLocationAddress("");
    setShowAddLocationModal(false);

    // Dispatch storage event to notify other components (e.g. UserAccountSettings dropdown/modal)
    window.dispatchEvent(new Event("storage"));
  };

  const handleDeleteLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const loc = savedLocations.find((l) => l.id === id);
    const locName = loc ? loc.name : "this address";
    if (!window.confirm(`Are you sure you want to delete "${locName}" from your saved locations?`)) {
      return;
    }
    const updated = savedLocations.filter((l) => l.id !== id);
    setSavedLocations(updated);
    localStorage.setItem("fieldroute_saved_locations", JSON.stringify(updated));

    // Dispatch storage event to notify other components (e.g. UserAccountSettings dropdown/modal)
    window.dispatchEvent(new Event("storage"));
  };

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");

  const [pasteInput, setPasteInput] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");

  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);
  const [pastedImagePreview, setPastedImagePreview] = useState("");
  const [imageMessage, setImageMessage] = useState("");

  const [prospects, setProspects] = useState<ProspectRow[]>([makeProspectRow()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [parsingText, setParsingText] = useState(false);
  const [parsedPreviewRows, setParsedPreviewRows] = useState<ProspectRow[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Record<string, boolean>>({});

  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  // Load form draft on mount
  useEffect(() => {
    const storedDraft = localStorage.getItem("fieldroute_new_trip_draft");
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft) as TripFormDraft;
        setTimeout(() => {
          setStartDate(draft.startDate || "");
          setStartTime(draft.startTime || "");
          setStartAddress(draft.startAddress || "");
          setEndAddress(draft.endAddress || "");
          setNotes(draft.notes || "");
          setPasteInput(draft.pasteInput || "");
          if (draft.prospects && draft.prospects.length > 0) {
            setProspects(draft.prospects);
          }
          setIsDraftLoaded(true);
        }, 0);
      } catch (e) {
        console.error("Failed to parse form draft", e);
        setTimeout(() => {
          setIsDraftLoaded(true);
        }, 0);
      }
    } else {
      setTimeout(() => {
        setIsDraftLoaded(true);
      }, 0);
    }
  }, []);

  // Save form draft to localStorage on change, but only AFTER initial draft is loaded
  useEffect(() => {
    if (!isDraftLoaded) return;

    const draft: TripFormDraft = {
      startDate,
      startTime,
      startAddress,
      endAddress,
      notes,
      pasteInput,
      prospects,
    };
    localStorage.setItem("fieldroute_new_trip_draft", JSON.stringify(draft));
  }, [startDate, startTime, startAddress, endAddress, notes, pasteInput, prospects, isDraftLoaded]);

  const totalProspects = useMemo(() => {
    return prospects.filter((p) => (p.name || "").trim() || (p.address || "").trim()).length;
  }, [prospects]);

  useEffect(() => {
    return () => {
      if (pastedImagePreview) {
        URL.revokeObjectURL(pastedImagePreview);
      }
    };
  }, [pastedImagePreview]);

  const updateProspect = (
    id: string,
    field: keyof ProspectRow,
    value: string
  ) => {
    setProspects((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addProspect = () => {
    setProspects((prev) => [...prev, makeProspectRow()]);
  };

  const removeProspect = (id: string) => {
    setProspects((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  };

  const handleParsePaste = async () => {
    setErrors([]);
    setPasteMessage("");

    if (!pasteInput.trim()) {
      setErrors(["Paste prospect content first before parsing."]);
      return;
    }

    try {
      setParsingText(true);
      setPasteMessage("AI agent is identifying prospect information...");

      const res = await fetch("/api/intake/parse-prospects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rawText: pasteInput }),
      });

      if (!res.ok) {
        throw new Error("Intake API request failed");
      }

      const data = await res.json();
      const prospectsList = data.prospects || [];

      if (prospectsList.length === 0) {
        setErrors(["No valid prospect stops could be identified from the input."]);
        setPasteMessage("");
        return;
      }

      const parsed: ProspectRow[] = prospectsList.map((p: {
        name?: string;
        address?: string;
        durationMinutes?: number;
        phone?: string | null;
        notes?: string | null;
      }) => ({
        id: crypto.randomUUID(),
        name: p.name || "",
        address: p.address || "",
        durationMinutes: String(p.durationMinutes ?? 30),
        phone: p.phone || "",
        notes: p.notes || "",
      }));

      setParsedPreviewRows(parsed);
      const initialSelected: Record<string, boolean> = {};
      parsed.forEach((row) => {
        initialSelected[row.id] = true;
      });
      setSelectedPreviewIds(initialSelected);
      setPasteMessage(
        `AI successfully identified ${parsed.length} stop${
          parsed.length === 1 ? "" : "s"
        } (source: ${data.source || "heuristics"}). Please review and filter them below.`
      );
    } catch (err) {
      console.error("Intake parsing failed:", err);
      setErrors(["An error occurred while calling the parsing agent. Please try again."]);
      setPasteMessage("");
    } finally {
      setParsingText(false);
    }
  };

  const runOcrFallback = async (file: File) => {
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data: { text } } = await Tesseract.recognize(file, "eng");

      if (text && text.trim()) {
        setPasteInput(text);
        setImageMessage("OCR complete. Running AI parsing agent on extracted text...");

        const res = await fetch("/api/intake/parse-prospects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rawText: text }),
        });

        if (!res.ok) {
          throw new Error("Intake API request failed");
        }

        const data = await res.json();
        const prospectsList = data.prospects || [];

        if (prospectsList.length > 0) {
          const parsed: ProspectRow[] = prospectsList.map((p: {
            name?: string;
            address?: string;
            durationMinutes?: number;
            phone?: string | null;
            notes?: string | null;
          }) => ({
            id: crypto.randomUUID(),
            name: p.name || "",
            address: p.address || "",
            durationMinutes: String(p.durationMinutes ?? 30),
            phone: p.phone || "",
            notes: p.notes || "",
          }));

          setParsedPreviewRows(parsed);
          const initialSelected: Record<string, boolean> = {};
          parsed.forEach((row) => {
            initialSelected[row.id] = true;
          });
          setSelectedPreviewIds(initialSelected);
          setImageMessage(`OCR & AI parsing complete (fallback). Extracted ${parsed.length} stop${parsed.length === 1 ? "" : "s"}. Please review and filter them below.`);
        } else {
          setImageMessage("OCR complete, but backend AI was unable to identify structured stops in the text.");
        }
      } else {
        setImageMessage("OCR complete, but no readable text was found in the pasted image.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setImageMessage("OCR failed. Please try typing the details or copy-pasting the text table.");
    } finally {
      setOcrProcessing(false);
    }
  };

  const handlePasteIntoProspects = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    // Prioritize text/html and text/plain (Excel / Sheets columns, email text, etc.)
    const textData = e.clipboardData.getData("text/plain");
    const htmlData = e.clipboardData.getData("text/html");
    const hasText = !!((textData && textData.trim()) || (htmlData && htmlData.trim()));

    if (hasText) {
      // Let standard browser paste event proceed so text goes into textarea
      return;
    }

    // Only if there is no text/HTML in the clipboard, look for pasted image files
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    setErrors([]);
    setPasteMessage("");
    setParsedPreviewRows([]);

    if (pastedImagePreview) {
      URL.revokeObjectURL(pastedImagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setPastedImageFile(file);
    setPastedImagePreview(previewUrl);
    setImageMessage("Sending image to multimodal AI parser...");
    setOcrProcessing(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultBase64 = reader.result as string;
        const base64Data = resultBase64.split(",")[1];
        
        try {
          const res = await fetch("/api/intake/parse-prospects", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image: base64Data,
              mimeType: file.type,
            }),
          });

          if (!res.ok) {
            throw new Error("Intake API request failed");
          }

          const data = await res.json();
          const prospectsList = data.prospects || [];

          if (prospectsList.length > 0) {
            const parsed: ProspectRow[] = prospectsList.map((p: {
              name?: string;
              address?: string;
              durationMinutes?: number;
              phone?: string | null;
              notes?: string | null;
            }) => ({
              id: crypto.randomUUID(),
              name: p.name || "",
              address: p.address || "",
              durationMinutes: String(p.durationMinutes ?? 30),
              phone: p.phone || "",
              notes: p.notes || "",
            }));

            setParsedPreviewRows(parsed);
            const initialSelected: Record<string, boolean> = {};
            parsed.forEach((row) => {
              initialSelected[row.id] = true;
            });
            setSelectedPreviewIds(initialSelected);
             setImageMessage(`AI multimodal parsing complete. Extracted ${parsed.length} stop${parsed.length === 1 ? "" : "s"}. Please review and filter them below.`);
            setOcrProcessing(false);
            return;
          }
        } catch (aiError) {
          console.error("Direct image AI parsing failed, falling back to local OCR:", aiError);
        }

        // Fallback to local OCR if direct AI image parsing fails
        setImageMessage("Direct image AI parsing failed. Running local OCR fallback...");
        runOcrFallback(file);
      };

      reader.onerror = () => {
        setImageMessage("Failed to read image file. Running local OCR fallback...");
        runOcrFallback(file);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image processing error:", err);
      setOcrProcessing(false);
    }
  };

  const clearPastedImage = () => {
    if (pastedImagePreview) {
      URL.revokeObjectURL(pastedImagePreview);
    }

    setPastedImageFile(null);
    setPastedImagePreview("");
    setImageMessage("");
  };

  const toggleSelectPreviewRow = (id: string) => {
    setSelectedPreviewIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSelectAllPreviewRows = () => {
    const allSelected = parsedPreviewRows.every((row) => selectedPreviewIds[row.id]);
    const nextSelected: Record<string, boolean> = {};
    parsedPreviewRows.forEach((row) => {
      nextSelected[row.id] = !allSelected;
    });
    setSelectedPreviewIds(nextSelected);
  };

  const addSelectedPreviewRows = () => {
    const selectedRows = parsedPreviewRows.filter((row) => selectedPreviewIds[row.id]);
    if (selectedRows.length === 0) return;

    setProspects((prev) => {
      const hasOnlyOneEmptyRow =
        prev.length === 1 &&
        !(prev[0].name || "").trim() &&
        !(prev[0].address || "").trim() &&
        !(prev[0].phone || "").trim() &&
        !(prev[0].notes || "").trim();

      if (hasOnlyOneEmptyRow) return selectedRows;
      return [...prev, ...selectedRows];
    });

    setParsedPreviewRows([]);
    setSelectedPreviewIds({});
    setPasteMessage("");
    setImageMessage("");
    setPasteInput("");
  };

  const clearParsedPreview = () => {
    setParsedPreviewRows([]);
    setSelectedPreviewIds({});
  };

  const validate = () => {
    const nextErrors: string[] = [];

    if (!startAddress.trim()) nextErrors.push("Start address is required.");
    if (!endAddress.trim()) nextErrors.push("End address is required.");
    if (!startDate) nextErrors.push("Trip start date is required.");
    if (!startTime) nextErrors.push("Trip start time is required.");

    const nonEmptyProspects = prospects.filter(
      (p) => (p.name || "").trim() || (p.address || "").trim()
    );

    if (nonEmptyProspects.length === 0) {
      nextErrors.push("At least one stop is required.");
    }

    nonEmptyProspects.forEach((p, index) => {
      if (!(p.name || "").trim()) {
        nextErrors.push(`Stop ${index + 1}: name is required.`);
      }
      if (!(p.address || "").trim()) {
        nextErrors.push(`Stop ${index + 1}: address is required.`);
      }
      if (!(p.durationMinutes || "").trim()) {
        nextErrors.push(`Stop ${index + 1}: duration is required.`);
      }
    });

    return nextErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors([]);
    setPasteMessage("");

    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSaving(true);

      const cleanedProspects = prospects
        .filter((p) => (p.name || "").trim() || (p.address || "").trim())
        .map((p) => ({
          name: (p.name || "").trim(),
          address: (p.address || "").trim(),
          durationMinutes: Number(p.durationMinutes || 30),
          phone: (p.phone || "").trim() || undefined,
          notes: (p.notes || "").trim() || undefined,
        }));

      const currentDate = new Date().toISOString().split('T')[0];
      const defaultTitle = `Trip on ${currentDate}`;
      const trip = await createTrip({
        title: defaultTitle,
        startAddress: startAddress.trim(),
        endAddress: endAddress.trim(),
        startDate,
        startTime,
        notes: notes.trim() || undefined,
        prospects: cleanedProspects,
      });

      // Clear draft from localStorage upon successful save
      localStorage.removeItem("fieldroute_new_trip_draft");

      router.push(`/trip/${trip.id}`);
    } catch (error) {
      console.error("Failed to save trip:", error);
      setErrors(["Failed to save trip. Please try again."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition group w-fit"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-0.5">←</span>
            Go Back Home
          </Link>
          <div className="mt-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Trip Setup
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
              Create New Outbound Trip
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Enter trip basics, paste or edit stops, then save to create a structured trip.
            </p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 p-5">
            <h2 className="text-sm font-bold text-red-800 dark:text-red-200">
              Please fix these issues:
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-100/90">
              {errors.map((err, idx) => (
                <li key={`${err}-${idx}`}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Trip Basics</h2>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">


              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    id="startDateInput"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-4 pr-20 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      setStartDate(todayStr);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-indigo-50 dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-slate-700 px-1.5 py-0.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-slate-750 transition cursor-pointer select-none whitespace-nowrap z-10"
                    title="Set to Today"
                  >
                    Today
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Start Time
                </label>
                <div className="relative">
                  <input
                    id="startTimeInput"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-4 pr-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                </div>
              </div>

               <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Start Address
                </label>
                <input
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                  placeholder="Start location"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {savedLocations.map((loc) => (
                    <div
                      key={`start-${loc.id}`}
                      onClick={() => setStartAddress(loc.address)}
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition hover:border-slate-300 dark:hover:border-slate-750 hover:bg-slate-200/50 dark:hover:bg-slate-900 hover:text-slate-850 dark:hover:text-slate-200"
                    >
                      <span>{loc.name}</span>
                      {!loc.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLocation(loc.id, e)}
                          className="text-slate-500 hover:text-red-400 transition font-bold"
                          title="Delete Location"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddLocationModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-550 dark:text-slate-400 transition hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-650 dark:hover:text-indigo-400"
                  >
                    <span>+ Location</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  End Address
                </label>
                <input
                  value={endAddress}
                  onChange={(e) => setEndAddress(e.target.value)}
                  placeholder="End location"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {savedLocations.map((loc) => (
                    <div
                      key={`end-${loc.id}`}
                      onClick={() => setEndAddress(loc.address)}
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition hover:border-slate-300 dark:hover:border-slate-750 hover:bg-slate-200/50 dark:hover:bg-slate-900 hover:text-slate-850 dark:hover:text-slate-200"
                    >
                      <span>{loc.name}</span>
                      {!loc.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLocation(loc.id, e)}
                          className="text-slate-500 hover:text-red-400 transition font-bold"
                          title="Delete Location"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddLocationModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-550 dark:text-slate-400 transition hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-650 dark:hover:text-indigo-400"
                  >
                    <span>+ Location</span>
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional trip notes"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Visit Intake</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Paste rows from email, Excel, Google Sheets, or paste a screenshot from your clipboard.
                </p>
              </div>

              <button
                type="button"
                onClick={handleParsePaste}
                disabled={parsingText || ocrProcessing}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {parsingText ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Identifying...</span>
                  </>
                ) : (
                  "Extract Info"
                )}
              </button>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Visit Intake Area
              </label>
              <textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                onPaste={handlePasteIntoProspects}
                placeholder="Paste spreadsheet rows, copied text, or screenshot clipboard content here..."
                rows={8}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
              />

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Text paste will stay in the box. Image paste will be captured below as a screenshot preview.
              </p>

              {pasteMessage ? (
                <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  {pasteMessage}
                </div>
              ) : null}

              {imageMessage ? (
                <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-200">
                  {imageMessage}
                </div>
              ) : null}

              {pastedImagePreview ? (
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-950/60 p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Pasted Screenshot
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {ocrProcessing ? "Running OCR analysis..." : "Extracted using client-side OCR."}
                      </p>
                      {ocrProcessing ? (
                        <div className="flex items-center gap-2 mt-2 text-xs text-indigo-650 dark:text-indigo-400">
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-555 dark:border-indigo-500 border-t-transparent"></div>
                          <span>Processing image columns...</span>
                        </div>
                      ) : null}
                      {pastedImageFile ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {pastedImageFile.name || "clipboard-image.png"} ·{" "}
                          {Math.round(pastedImageFile.size / 1024)} KB
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={clearPastedImage}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Clear Image
                    </button>
                  </div>

                  <img
                    src={pastedImagePreview}
                    alt="Pasted screenshot preview"
                    className={`max-h-[420px] w-full rounded-xl border border-slate-200 dark:border-slate-800 object-contain transition-opacity duration-300 ${
                      ocrProcessing ? "opacity-40" : "opacity-100"
                    }`}
                  />
                </div>
              ) : null}
            </div>
          </section>

          {parsedPreviewRows.length > 0 ? (
            <section className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">i</span>
                    Parsed Stops Preview & Filter
                  </h2>
                  <p className="mt-1 text-sm text-slate-650 dark:text-slate-400">
                    Review and verify the stops before adding them to your trip. Uncheck any noisy or incorrect rows.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addSelectedPreviewRows}
                    disabled={Object.values(selectedPreviewIds).filter(Boolean).length === 0}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add Selected ({Object.values(selectedPreviewIds).filter(Boolean).length})
                  </button>
                  <button
                    type="button"
                    onClick={clearParsedPreview}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Clear Preview
                  </button>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={parsedPreviewRows.length > 0 && parsedPreviewRows.every((row) => selectedPreviewIds[row.id])}
                          onChange={toggleSelectAllPreviewRows}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Address</th>
                      <th className="px-3 py-2 font-semibold w-24">Duration</th>
                      <th className="px-3 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreviewRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-200/60 dark:border-slate-900/60 transition hover:bg-slate-100/30 dark:hover:bg-slate-900/30 ${
                          !selectedPreviewIds[row.id] ? "opacity-40" : ""
                        }`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={!!selectedPreviewIds[row.id]}
                            onChange={() => toggleSelectPreviewRow(row.id)}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">
                          {row.name || <span className="text-slate-400 dark:text-slate-600 italic">No Name</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {row.address || <span className="text-slate-400 dark:text-slate-600 italic">No Address</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {row.durationMinutes ? `${row.durationMinutes}m` : "30m"}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                          {row.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Visits</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Add the stops you want to visit on this trip.
                </p>
              </div>

              <button
                type="button"
                onClick={addProspect}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Stop
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {prospects.map((prospect, index) => (
                <div
                  key={prospect.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/60 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Stop {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeProspect(prospect.id)}
                      disabled={prospects.length === 1}
                      className="text-sm text-slate-500 dark:text-slate-400 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Name
                      </label>
                      <input
                        value={prospect.name}
                        onChange={(e) =>
                          updateProspect(prospect.id, "name", e.target.value)
                        }
                        placeholder="Stop name"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Visit Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={prospect.durationMinutes}
                        onChange={(e) =>
                          updateProspect(
                            prospect.id,
                            "durationMinutes",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Address
                      </label>
                      <input
                        value={prospect.address}
                        onChange={(e) =>
                          updateProspect(prospect.id, "address", e.target.value)
                        }
                        placeholder="Street address"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Notes
                      </label>
                      <input
                        value={prospect.notes}
                        onChange={(e) =>
                          updateProspect(prospect.id, "notes", e.target.value)
                        }
                        placeholder="Optional notes"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {totalProspects} stop{totalProspects === 1 ? "" : "s"} ready
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Trip"}
            </button>

            <Link
              href="/trip"
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-3 text-sm font-semibold text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Back to Saved Trip List
            </Link>
          </div>
        </form>
      </main>

      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Save New Location</h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Create a custom saved address for quick access when creating trips.
            </p>
            <form onSubmit={handleAddLocation} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Location Name
                </label>
                <input
                  type="text"
                  required
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g. Headquarters, Store 5"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Address
                </label>
                <input
                  type="text"
                  required
                  value={newLocationAddress}
                  onChange={(e) => setNewLocationAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Fremont, CA"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewLocationName("");
                    setNewLocationAddress("");
                    setShowAddLocationModal(false);
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
