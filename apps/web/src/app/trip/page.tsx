"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type TripListItem = {
    id: string;
    title: string | null;
    start_address: string | null;
    end_address: string | null;
    start_time: string | null;
    created_at: string | null;
};

type TripProspectRow = {
    trip_id: string;
    name: string | null;
    address: string | null;
    position: number | null;
};

type TripListRow = TripListItem & {
    stopCount: number;
    itinerary: string[];
};

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

function getLocationLabel(name: string | null, address: string | null) {
    const trimmedName = name?.trim();
    if (trimmedName) return trimmedName;

    const trimmedAddress = address?.trim();
    if (trimmedAddress) return trimmedAddress;

    return "Unnamed Stop";
}

function isSameDay(dateA: Date, dateB: Date) {
    return (
        dateA.getFullYear() === dateB.getFullYear() &&
        dateA.getMonth() === dateB.getMonth() &&
        dateA.getDate() === dateB.getDate()
    );
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

export default function TripListPage() {
    const [trips, setTrips] = useState<TripListRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedTripIds, setExpandedTripIds] = useState<Record<string, boolean>>({});
    const [deletingTripId, setDeletingTripId] = useState<string | null>(null);

    useEffect(() => {
        async function loadTrips() {
            setLoading(true);
            setError("");

            const username = typeof window !== "undefined" ? localStorage.getItem("sfi_user_name") : null;
            let query = supabase
                .from("trips")
                .select("id, title, start_address, end_address, start_time, created_at, status, user_id")
                .order("created_at", { ascending: false });

            if (username) {
                const userUUID = stringToUUID(username);
                if (username.toLowerCase() === "admin") {
                    query = query.or(`user_id.eq.${userUUID},user_id.is.null`);
                } else {
                    query = query.eq("user_id", userUUID);
                }
            }

            const tripsResult = await query;

            if (tripsResult.error) {
                console.error("trip list load error raw:", tripsResult.error);
                console.error("trip list load error code:", tripsResult.error.code);
                console.error("trip list load error message:", tripsResult.error.message);
                console.error("trip list load error details:", tripsResult.error.details);
                console.error("trip list load error hint:", tripsResult.error.hint);

                setError(tripsResult.error.message || "Failed to load saved trips.");
                setLoading(false);
                return;
            }

            const rawTripRows = (tripsResult.data || []) as (TripListItem & { status: string | null })[];
            const tripRows = rawTripRows.filter((t) => t.status !== "consultant_report");

            const prospectsResult = await supabase
                .from("trip_prospects")
                .select("trip_id, name, address, position")
                .order("trip_id", { ascending: true })
                .order("position", { ascending: true });

            if (prospectsResult.error) {
                console.error("trip itinerary load error raw:", prospectsResult.error);
                console.error("trip itinerary load error code:", prospectsResult.error.code);
                console.error("trip itinerary load error message:", prospectsResult.error.message);
                console.error("trip itinerary load error details:", prospectsResult.error.details);
                console.error("trip itinerary load error hint:", prospectsResult.error.hint);

                setError(prospectsResult.error.message || "Failed to load trip itinerary.");
                setLoading(false);
                return;
            }

            const prospectRows = (prospectsResult.data as TripProspectRow[]) || [];

            const itineraryMap = prospectRows.reduce<Record<string, string[]>>((acc, row) => {
                if (!acc[row.trip_id]) {
                    acc[row.trip_id] = [];
                }

                acc[row.trip_id].push(getLocationLabel(row.name, row.address));
                return acc;
            }, {});

            const mergedRows: TripListRow[] = tripRows.map((trip) => ({
                ...trip,
                stopCount: itineraryMap[trip.id]?.length || 0,
                itinerary: itineraryMap[trip.id] || [],
            }));

            setTrips(mergedRows);
            setLoading(false);
        }

        loadTrips();
    }, []);

    const summary = useMemo(() => {
        if (!trips.length) {
            return {
                totalTrips: 0,
                todayTrips: 0,
                upcomingTrips7Days: 0,
                latestTrip: null as TripListRow | null,
            };
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        let todayTrips = 0;
        let upcomingTrips7Days = 0;

        for (const trip of trips) {
            if (!trip.start_time) continue;
            const date = new Date(trip.start_time);
            if (Number.isNaN(date.getTime())) continue;

            if (isSameDay(date, today)) {
                todayTrips += 1;
            } else if (date > today && date <= sevenDaysLater) {
                upcomingTrips7Days += 1;
            }
        }

        const latestTrip = trips[0] ?? null;

        return {
            totalTrips: trips.length,
            todayTrips,
            upcomingTrips7Days,
            latestTrip,
        };
    }, [trips]);

    function toggleExpanded(tripId: string) {
        setExpandedTripIds((prev) => ({
            ...prev,
            [tripId]: !prev[tripId],
        }));
    }

    async function handleDeleteTrip(
        event: React.MouseEvent<HTMLButtonElement>,
        tripId: string,
        tripTitle: string | null
    ) {
        event.preventDefault();
        event.stopPropagation();

        const confirmed = window.confirm(
            `Delete this trip${tripTitle?.trim() ? `: ${tripTitle.trim()}` : ""}? This action cannot be undone.`
        );

        if (!confirmed) return;

        setDeletingTripId(tripId);
        setError("");

        const deleteProspectsResult = await supabase
            .from("trip_prospects")
            .delete()
            .eq("trip_id", tripId);

        if (deleteProspectsResult.error) {
            console.error("delete trip prospects error raw:", deleteProspectsResult.error);
            setError(
                deleteProspectsResult.error.message ||
                "Failed to delete trip prospects."
            );
            setDeletingTripId(null);
            return;
        }

        const deleteTripResult = await supabase
            .from("trips")
            .delete()
            .eq("id", tripId);

        if (deleteTripResult.error) {
            console.error("delete trip error raw:", deleteTripResult.error);
            setError(deleteTripResult.error.message || "Failed to delete trip.");
            setDeletingTripId(null);
            return;
        }

        setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
        setExpandedTripIds((prev) => {
            const next = { ...prev };
            delete next[tripId];
            return next;
        });
        setDeletingTripId(null);
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

                <section className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Today & Next 7 Days
                            </p>
                            <h1 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
                                Trip Summary
                            </h1>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                A quick view of today’s trips and what is coming in the next 7 days.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center text-sm">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Total Trips
                                </p>
                                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                                    {summary.totalTrips}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Today
                                </p>
                                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                                    {summary.todayTrips}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Next 7 Days
                                </p>
                                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                                    {summary.upcomingTrips7Days}
                                </p>
                            </div>
                        </div>
                    </div>

                    {summary.latestTrip ? (
                        <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Latest Trip
                            </p>
                            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                        {summary.latestTrip.title?.trim() || "Untitled Trip"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                        {summary.latestTrip.start_address?.trim() || "—"} →{" "}
                                        {summary.latestTrip.end_address?.trim() || "—"}
                                    </p>
                                </div>
                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 md:mt-0 md:text-right">
                                    <p>Start: {formatDateTime(summary.latestTrip.start_time)}</p>
                                    <p className="mt-1">
                                        Created: {formatDateTime(summary.latestTrip.created_at)}
                                    </p>
                                    <Link
                                        href={`/trip/${summary.latestTrip.id}`}
                                        className="mt-2 inline-block text-xs font-semibold text-indigo-650 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200"
                                    >
                                        Open Latest Trip →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </section>

                {error ? (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                            Trip List Error
                        </p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                            Unable to complete trip action
                        </h2>
                        <p className="mt-3 text-sm text-red-800 dark:text-red-100/90">{error}</p>
                    </div>
                ) : null}

                {loading ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
                        <p className="text-sm text-slate-600 dark:text-slate-300">Loading saved trips...</p>
                    </div>
                ) : trips.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">No saved trips yet</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Create your first trip to see it listed here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {trips.map((trip) => {
                            const isExpanded = !!expandedTripIds[trip.id];
                            const previewStops = isExpanded ? trip.itinerary : trip.itinerary.slice(0, 3);
                            const hasMoreStops = trip.itinerary.length > 3;
                            const isDeleting = deletingTripId === trip.id;

                            return (
                                <div
                                    key={trip.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 transition hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-100/30 dark:hover:bg-slate-900/70"
                                >
                                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <Link href={`/trip/${trip.id}`} className="block">
                                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {trip.title?.trim() || "Untitled Trip"}
                                                </p>

                                                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                    {trip.stopCount} stop{trip.stopCount === 1 ? "" : "s"}
                                                </p>
                                            </Link>

                                            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-950/60 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                        Itinerary Preview
                                                    </p>

                                                    <div className="flex items-center gap-2">
                                                        {hasMoreStops ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpanded(trip.id)}
                                                                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white"
                                                            >
                                                                {isExpanded
                                                                    ? "Collapse"
                                                                    : `Show All (${trip.itinerary.length})`}
                                                            </button>
                                                        ) : null}

                                                        <button
                                                            type="button"
                                                            onClick={(event) =>
                                                                handleDeleteTrip(event, trip.id, trip.title)
                                                            }
                                                            disabled={isDeleting}
                                                            className="rounded-lg border border-red-200 dark:border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-650 dark:text-red-300 hover:border-red-450 dark:hover:border-red-400 hover:text-red-800 dark:hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isDeleting ? "Deleting..." : "Delete"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3 space-y-2">
                                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                                        <span className="font-semibold text-slate-900 dark:text-white">Start:</span>{" "}
                                                        {trip.start_address?.trim() || "—"}
                                                    </div>

                                                    {previewStops.length === 0 ? (
                                                        <div className="text-sm text-slate-500">
                                                            No saved stops yet.
                                                        </div>
                                                    ) : (
                                                        previewStops.map((location, index) => (
                                                            <div
                                                                key={`${trip.id}-stop-${index}`}
                                                                className="text-sm text-slate-700 dark:text-slate-300"
                                                            >
                                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                                    Stop {index + 1}:
                                                                </span>{" "}
                                                                {location}
                                                            </div>
                                                        ))
                                                    )}

                                                    {!isExpanded && hasMoreStops ? (
                                                        <div className="text-sm text-slate-500">
                                                            + {trip.itinerary.length - 3} more stop
                                                            {trip.itinerary.length - 3 === 1 ? "" : "s"}
                                                        </div>
                                                    ) : null}

                                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                                        <span className="font-semibold text-slate-900 dark:text-white">End:</span>{" "}
                                                        {trip.end_address?.trim() || "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-sm text-slate-600 dark:text-slate-400 md:w-52 md:text-right">
                                            <p>Start: {formatDateTime(trip.start_time)}</p>
                                            <p className="mt-1">Created: {formatDateTime(trip.created_at)}</p>

                                            <Link
                                                href={`/trip/${trip.id}`}
                                                className="mt-4 inline-block text-sm font-semibold text-indigo-650 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200"
                                            >
                                                Open Trip →
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
