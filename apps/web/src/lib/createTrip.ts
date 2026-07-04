import { supabase } from "@/lib/supabase";
import { optimizeStopSequence } from "./routing";

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

export type ProspectInput = {
    name: string;
    address: string;
    durationMinutes: number;
    phone?: string;
    notes?: string;
};

export type CreateTripInput = {
    title: string;
    startAddress: string;
    endAddress: string;
    startDate: string;
    startTime: string;
    notes?: string;
    prospects: ProspectInput[];
};

function buildStartTimestamp(startDate: string, startTime: string) {
    const localDateTime = new Date(`${startDate}T${startTime}:00`);

    if (Number.isNaN(localDateTime.getTime())) {
        throw new Error("Invalid start date or time.");
    }

    return localDateTime.toISOString();
}

function normalizeSupabaseError(error: unknown): Error {
    if (!error) {
        return new Error("Unknown database error.");
    }

    if (error instanceof Error) {
        return error;
    }

    if (typeof error === "object") {
        const e = error as {
            message?: string;
            details?: string;
            hint?: string;
            code?: string;
        };

        const parts = [e.message, e.details, e.hint].filter(Boolean);
        const message =
            parts.length > 0
                ? parts.join(" | ")
                : e.code
                    ? `Database error (${e.code}).`
                    : "Database operation failed.";

        return new Error(message);
    }

    if (typeof error === "string") {
        return new Error(error);
    }

    return new Error("Unexpected database error.");
}

function validateInput(input: CreateTripInput) {
    if (!input.title?.trim()) {
        input.title = "New Trip";
    }

    if (!input.startAddress?.trim()) {
        throw new Error("Start address is required.");
    }

    if (!input.endAddress?.trim()) {
        throw new Error("End address is required.");
    }

    if (!input.startDate) {
        throw new Error("Start date is required.");
    }

    if (!input.startTime) {
        throw new Error("Start time is required.");
    }

    if (!input.prospects || input.prospects.length === 0) {
        throw new Error("At least one prospect is required.");
    }

    const cleanedProspects = input.prospects
        .map((p) => ({
            name: p.name?.trim() ?? "",
            address: p.address?.trim() ?? "",
            durationMinutes: Number(p.durationMinutes ?? 0),
            phone: p.phone?.trim() || undefined,
            notes: p.notes?.trim() || undefined,
        }))
        .filter((p) => p.name || p.address);

    if (cleanedProspects.length === 0) {
        throw new Error("At least one valid prospect is required.");
    }

    cleanedProspects.forEach((p, index) => {
        if (!p.name) {
            throw new Error(`Prospect ${index + 1}: name is required.`);
        }

        if (!p.address) {
            throw new Error(`Prospect ${index + 1}: address is required.`);
        }

        if (!Number.isFinite(p.durationMinutes) || p.durationMinutes <= 0) {
            throw new Error(`Prospect ${index + 1}: duration must be greater than 0.`);
        }
    });

    return cleanedProspects;
}

export async function createTrip(input: CreateTripInput) {
    const cleanedProspects = validateInput(input);
    const startTimestamp = buildStartTimestamp(input.startDate, input.startTime);

    // Optimize route sequence using "closest" strategy by default for new trips
    const stopInputs = cleanedProspects.map((p, idx) => ({
        id: String(idx),
        name: p.name,
        address: p.address,
        duration_minutes: p.durationMinutes,
        notes: p.notes ?? null,
        position: idx
    }));
    
    let optimizedProspects = [...cleanedProspects];
    try {
        const optimized = optimizeStopSequence(input.startAddress, input.endAddress, stopInputs, "closest");
        optimizedProspects = optimized.map(o => {
            const original = cleanedProspects[parseInt(o.id, 10)];
            return original;
        });
    } catch (optErr) {
        console.error("Auto-optimization failed on trip creation, saving in original order:", optErr);
    }

    const username = typeof window !== "undefined" ? localStorage.getItem("sfi_user_name") : null;
    const userUUID = username ? stringToUUID(username) : null;

    const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
            title: input.title.trim(),
            start_address: input.startAddress.trim(),
            end_address: input.endAddress.trim(),
            start_time: startTimestamp,
            notes: input.notes?.trim() || null,
            status: "optimized:skip", // Automatically optimized and no lunch by default
            user_id: userUUID || null
        })
        .select()
        .single();

    if (tripError) {
        console.error("trips insert error raw:", tripError);
        throw normalizeSupabaseError(tripError);
    }

    const rows = optimizedProspects.map((p, index) => ({
        trip_id: trip.id,
        name: p.name,
        address: p.address,
        duration_minutes: p.durationMinutes,
        position: index,
        phone: p.phone ?? null,
        notes: p.notes ?? null,
    }));

    if (rows.length > 0) {
        const { error: prospectsError } = await supabase
            .from("trip_prospects")
            .insert(rows);

        if (prospectsError) {
            console.error("trip_prospects insert error raw:", prospectsError);

            const rollbackResult = await supabase
                .from("trips")
                .delete()
                .eq("id", trip.id);

            if (rollbackResult.error) {
                console.error("trip rollback delete error:", rollbackResult.error);
            }

            throw normalizeSupabaseError(prospectsError);
        }
    }

    return trip;
}
