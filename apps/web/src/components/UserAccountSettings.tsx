"use client";

import { useEffect, useRef, useState } from "react";

type UserSettings = {
  name: string;
  email: string;
  unitSystem: "metric" | "imperial";
  mapProvider: "openstreetmap" | "google" | "mapbox";
  prepBufferMinutes?: number;
  theme?: "light" | "dark" | "system";
};

const DEFAULT_SETTINGS: UserSettings = {
  name: "John Doe",
  email: "john.doe@example.com",
  unitSystem: "metric",
  mapProvider: "openstreetmap",
  prepBufferMinutes: 3,
  theme: "system",
};

const applyTheme = (theme: "light" | "dark" | "system") => {
  if (typeof window === "undefined") return;
  const root = window.document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (systemDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
};

type SavedLocation = {
  id: string;
  name: string;
  address: string;
  isDefault?: boolean;
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

export default function UserAccountSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  
  // Modal form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUnit, setFormUnit] = useState<"metric" | "imperial">("metric");
  const [formMap, setFormMap] = useState<"openstreetmap" | "google" | "mapbox">("openstreetmap");
  const [formPrepBuffer, setFormPrepBuffer] = useState<number>(3);
  const [formTheme, setFormTheme] = useState<"light" | "dark" | "system">("system");

  // Address book states
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(DEFAULT_LOCATIONS);
  const [newAddrName, setNewAddrName] = useState("");
  const [newAddrVal, setNewAddrVal] = useState("");
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState("");
  const [editLocAddr, setEditLocAddr] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("fieldroute_user_settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserSettings;
        setTimeout(() => {
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }, 0);
      } catch (e) {
        console.error("Failed to parse user settings", e);
      }
    }
  }, []);

  useEffect(() => {
    const loadAndApplyTheme = () => {
      const stored = localStorage.getItem("fieldroute_user_settings");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserSettings;
          if (parsed.theme) {
            applyTheme(parsed.theme);
          } else {
            applyTheme("system");
          }
        } catch (e) {
          applyTheme("system");
        }
      } else {
        applyTheme("system");
      }
    };

    loadAndApplyTheme();
    window.addEventListener("storage", loadAndApplyTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const stored = localStorage.getItem("fieldroute_user_settings");
      let activeTheme = "system";
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserSettings;
          if (parsed.theme) {
            activeTheme = parsed.theme;
          }
        } catch (e) {}
      }
      if (activeTheme === "system") {
        applyTheme("system");
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      window.removeEventListener("storage", loadAndApplyTheme);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, []);

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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openSettingsModal = () => {
    // Reload saved locations from localStorage on modal open
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
        setSavedLocations(parsed);
      } catch (e) {
        console.error("Failed to parse stored locations", e);
      }
    } else {
      localStorage.setItem("fieldroute_saved_locations", JSON.stringify(DEFAULT_LOCATIONS));
      localStorage.setItem("fieldroute_locations_migrated_v2", "true");
      setSavedLocations(DEFAULT_LOCATIONS);
    }

    setFormName(settings.name);
    setFormEmail(settings.email);
    setFormUnit(settings.unitSystem);
    setFormMap(settings.mapProvider);
    setFormPrepBuffer(settings.prepBufferMinutes ?? 3);
    setFormTheme(settings.theme ?? "system");
    
    setShowModal(true);
    setIsOpen(false); // Close dropdown
  };

  const startEditing = (loc: SavedLocation) => {
    setEditingLocId(loc.id);
    setEditLocName(loc.name);
    setEditLocAddr(loc.address);
  };

  const cancelEditing = () => {
    setEditingLocId(null);
    setEditLocName("");
    setEditLocAddr("");
  };

  const handleSaveEdit = (id: string) => {
    if (!editLocAddr.trim()) return;

    const updated = savedLocations.map((loc) => {
      if (loc.id === id) {
        return {
          ...loc,
          name: loc.isDefault ? loc.name : (editLocName.trim() || loc.name),
          address: editLocAddr.trim(),
        };
      }
      return loc;
    });

    setSavedLocations(updated);
    localStorage.setItem("fieldroute_saved_locations", JSON.stringify(updated));
    cancelEditing();

    // Dispatch storage event to notify other components (e.g. new/page.tsx)
    window.dispatchEvent(new Event("storage"));
  };

  const handleAddNewAddress = () => {
    if (!newAddrName.trim() || !newAddrVal.trim()) {
      return;
    }

    const newLoc: SavedLocation = {
      id: crypto.randomUUID(),
      name: newAddrName.trim(),
      address: newAddrVal.trim(),
    };

    const updated = [...savedLocations, newLoc];
    setSavedLocations(updated);

    localStorage.setItem("fieldroute_saved_locations", JSON.stringify(updated));

    setNewAddrName("");
    setNewAddrVal("");

    // Dispatch storage event to notify other components (e.g. new/page.tsx)
    window.dispatchEvent(new Event("storage"));
  };

  const handleDeleteLocation = (id: string) => {
    const loc = savedLocations.find((l) => l.id === id);
    const locName = loc ? loc.name : "this address";
    if (!window.confirm(`Are you sure you want to delete "${locName}" from your saved locations?`)) {
      return;
    }

    const updated = savedLocations.filter((l) => l.id !== id);
    setSavedLocations(updated);

    localStorage.setItem("fieldroute_saved_locations", JSON.stringify(updated));

    // Dispatch storage event to notify other components (e.g. new/page.tsx)
    window.dispatchEvent(new Event("storage"));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserSettings = {
      name: formName.trim() || "John Doe",
      email: formEmail.trim() || "john.doe@example.com",
      unitSystem: formUnit,
      mapProvider: formMap,
      prepBufferMinutes: formPrepBuffer,
      theme: formTheme,
    };
    setSettings(updated);
    localStorage.setItem("fieldroute_user_settings", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
    setShowModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("sfi_user_token");
    localStorage.removeItem("sfi_user_name");
    sessionStorage.removeItem("sfi_admin_token");
    sessionStorage.removeItem("sfi_admin_user");
    setIsOpen(false);
    window.location.href = "/login";
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Settings Gear Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 transition hover:border-slate-700 hover:text-white focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Account Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5 animate-[spin_10s_linear_infinite] hover:animate-[spin_2s_linear_infinite]"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2.5 w-64 origin-top-right rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white uppercase">
              {settings.name.charAt(0) || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{settings.name}</p>
              <p className="text-xs text-slate-400 truncate">{settings.email}</p>
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={openSettingsModal}
              className="flex w-full items-center px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left"
            >
              Account Settings
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 text-left"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">User Account Settings</h3>
            <p className="mt-1 text-xs text-slate-400">
              Customize your profile preferences and system configurations.
            </p>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Unit System
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value as "metric" | "imperial")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="metric">Metric (kilometers, km/h)</option>
                  <option value="imperial">Imperial (miles, mph)</option>
                </select>
              </div>



              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Theme Appearance
                </label>
                <select
                  value={formTheme}
                  onChange={(e) => {
                    const newTheme = e.target.value as "light" | "dark" | "system";
                    setFormTheme(newTheme);
                    applyTheme(newTheme);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="system">System (follows OS appearance)</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Prep Buffer Time
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={formPrepBuffer}
                    onChange={(e) => setFormPrepBuffer(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-4 pr-20 py-2.5 text-sm text-white outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans"
                  />
                  <span className="absolute right-4 text-xs font-semibold text-slate-500 select-none">
                    minutes
                  </span>
                </div>
              </div>

              {/* Address Book Section */}
              <div className="border-t border-slate-800 pt-4">
                <h4 className="text-xs font-bold text-white mb-2">Address Book</h4>
                <div className="max-h-36 overflow-y-auto space-y-2 mb-3 pr-1">
                  {savedLocations.map((loc) => {
                    const isEditing = editingLocId === loc.id;
                    return (
                      <div key={loc.id} className="rounded-xl bg-slate-950 px-3 py-2 text-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-400 uppercase text-[9px] tracking-wider">
                                Editing {loc.name}
                              </span>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(loc.id)}
                                  className="text-green-400 hover:text-green-300 font-semibold"
                                  title="Save"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  className="text-slate-400 hover:text-slate-350"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            
                            {!loc.isDefault && (
                              <input
                                type="text"
                                value={editLocName}
                                onChange={(e) => setEditLocName(e.target.value)}
                                placeholder="Location Name"
                                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-550"
                              />
                            )}
                            
                            <input
                              type="text"
                              value={editLocAddr}
                              onChange={(e) => setEditLocAddr(e.target.value)}
                              placeholder="Street Address"
                              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-550"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="overflow-hidden mr-2">
                              <p className="font-semibold text-slate-300 truncate">{loc.name}</p>
                              <p className="text-slate-500 truncate text-[10px]">{loc.address}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-500">
                              <button
                                type="button"
                                onClick={() => startEditing(loc)}
                                className="text-indigo-400 hover:text-indigo-300 transition"
                                title="Edit Address"
                              >
                                Edit
                              </button>
                              <span className="text-[10px] text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="text-slate-550 hover:text-red-400 font-semibold transition"
                                title="Delete Address"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline form to add address */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">+ Add Saved Address</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name (e.g. HQ)"
                      value={newAddrName}
                      onChange={(e) => setNewAddrName(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={newAddrVal}
                      onChange={(e) => setNewAddrVal(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewAddress}
                    className="w-full rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition py-1.5 text-xs font-semibold"
                  >
                    Add to Address Book
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    applyTheme(settings.theme ?? "system");
                  }}
                  className="rounded-xl border border-slate-700 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
