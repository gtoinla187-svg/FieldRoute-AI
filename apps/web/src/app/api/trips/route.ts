import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { optimizeStopSequence } from "@/lib/routing";

async function verifySession(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();

  const { data: configRow } = await supabase
    .from("trips")
    .select("notes")
    .eq("title", "__SYSTEM_CONFIG__")
    .maybeSingle();

  if (!configRow) return null;

  try {
    const config = JSON.parse(configRow.notes || "{}");
    const sessions = config.sessions || [];
    const active = sessions.find((s: any) => s.token === token);
    
    if (active && new Date(active.expiresAt) > new Date()) {
      return active.username;
    }
  } catch (e) {
    // ignore
  }
  return null;
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

// GET: List all trips with their associated prospects (stops)
export async function GET(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const userUUID = stringToUUID(username);

    let query = supabase
      .from("trips")
      .select("id, title, start_address, end_address, start_time, notes, status, created_at, user_id")
      .order("created_at", { ascending: false });

    if (username.toLowerCase() === "admin") {
      query = query.or(`user_id.eq.${userUUID},user_id.is.null`);
    } else {
      query = query.eq("user_id", userUUID);
    }

    const { data: trips, error: tripsError } = await query;

    if (tripsError) throw tripsError;

    const { data: prospects, error: prospectsError } = await supabase
      .from("trip_prospects")
      .select("id, trip_id, name, address, duration_minutes, phone, notes, position")
      .order("position", { ascending: true });

    if (prospectsError) throw prospectsError;

    // Group prospects by trip_id
    const prospectsMap: Record<string, any[]> = {};
    prospects?.forEach((p) => {
      if (!prospectsMap[p.trip_id]) {
        prospectsMap[p.trip_id] = [];
      }
      prospectsMap[p.trip_id].push({
        id: p.id,
        name: p.name,
        // Proactively decode percent-encoded symbols like %20 or %2C to keep address views clean
        address: typeof p.address === "string" ? decodeURIComponent(p.address) : p.address,
        duration_minutes: p.duration_minutes,
        notes: p.notes,
        phone: p.phone,
        position: p.position,
      });
    });

    const nonReportTrips = trips?.filter((t) => t.status !== "consultant_report") || [];

    const mappedTrips = nonReportTrips.map((t) => {
      // Decode start/end addresses too
      const startClean = typeof t.start_address === "string" ? decodeURIComponent(t.start_address) : t.start_address;
      const endClean = typeof t.end_address === "string" ? decodeURIComponent(t.end_address) : t.end_address;
      
      const parsedTime = t.start_time ? t.start_time.split("T") : ["", ""];
      const statusParts = (t.status || "draft").split(":");
      const cleanStatus = statusParts[0];
      const selectedLunchOption = statusParts[1] || "salad";
      
      return {
        id: t.id,
        title: t.title,
        startAddress: startClean,
        endAddress: endClean,
        startDate: parsedTime[0] || "",
        startTime: parsedTime[1] ? parsedTime[1].substring(0, 5) : "09:00",
        startTimeIso: t.start_time,
        notes: t.notes,
        status: cleanStatus,
        selectedLunchOption,
        created_at: t.created_at,
        prospects: prospectsMap[t.id] || [],
      };
    });

    return NextResponse.json({ trips: mappedTrips || [] });
  } catch (error: any) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch trips from database." },
      { status: 500 }
    );
  }
}

// POST: Create or Update a trip and its prospects
export async function POST(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      title,
      startAddress,
      endAddress,
      startDate,
      startTime,
      startTimeIso,
      status,
      selectedLunchOption,
      notes,
      prospects,
    } = body;

    if (!startAddress || !endAddress) {
      return NextResponse.json(
        { error: "Start and End addresses are required." },
        { status: 400 }
      );
    }

    // Verify ownership of existing trip before updating
    if (id) {
      const userUUID = stringToUUID(username);
      const { data: check } = await supabase.from("trips").select("user_id").eq("id", id).maybeSingle();
      if (check && check.user_id && check.user_id !== userUUID && username.toLowerCase() !== "admin") {
        return NextResponse.json({ error: "Forbidden: You do not own this trip." }, { status: 403 });
      }
    }

    const startTimestamp = startTimeIso || new Date(`${startDate || new Date().toISOString().split("T")[0]}T${startTime || "09:00"}:00`).toISOString();

    let finalStatus = status || "draft";
    let finalProspects = prospects || [];

    if (!id) {
      // Creating a new trip! Automatically optimize route sequence with closest stop strategy
      finalStatus = "optimized:skip";
      
      if (finalProspects.length > 0) {
        const stopInputs = finalProspects.map((p: any, idx: number) => ({
          id: String(idx),
          name: p.name,
          address: p.address,
          duration_minutes: p.duration_minutes || p.durationMinutes || 30,
          notes: p.notes || null,
          position: idx
        }));
        
        try {
          const optimized = optimizeStopSequence(startAddress, endAddress, stopInputs, "closest");
          finalProspects = optimized.map((o: any) => {
            const original = prospects[parseInt(o.id, 10)];
            return original;
          });
        } catch (optErr) {
          console.error("Error running auto-optimization during API trip creation:", optErr);
        }
      }
    }

    const cleanStatus = (finalStatus || "draft").split(":")[0];
    const lunchOpt = selectedLunchOption || "skip";
    const serializedStatus = `${cleanStatus}:${lunchOpt}`;

    const tripPayload = {
      title: title || "New Trip",
      start_address: startAddress,
      end_address: endAddress,
      start_time: startTimestamp,
      notes: notes || null,
      status: serializedStatus,
      user_id: stringToUUID(username),
    };

    let tripId = id;
    if (id) {
      // Update existing trip
      const { error: updateError } = await supabase
        .from("trips")
        .update(tripPayload)
        .eq("id", id);

      if (updateError) throw updateError;
    } else {
      // Insert new trip
      const { data: newTrip, error: insertError } = await supabase
        .from("trips")
        .insert(tripPayload)
        .select()
        .single();

      if (insertError) throw insertError;
      tripId = newTrip.id;
    }

    // Upsert prospects: Delete old ones and insert updated sequence
    const { error: deleteError } = await supabase
      .from("trip_prospects")
      .delete()
      .eq("trip_id", tripId);

    if (deleteError) throw deleteError;

    if (finalProspects && finalProspects.length > 0) {
      const prospectRows = finalProspects.map((p: any, idx: number) => ({
        trip_id: tripId,
        name: p.name || `Stop ${idx + 1}`,
        address: p.address,
        duration_minutes: p.duration_minutes || p.durationMinutes || 30,
        notes: p.notes || null,
        position: idx,
      }));

      const { error: insertProspectsError } = await supabase
        .from("trip_prospects")
        .insert(prospectRows);

      if (insertProspectsError) throw insertProspectsError;
    }

    return NextResponse.json({ success: true, id: tripId });
  } catch (error: any) {
    console.error("Error saving trip:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save trip to database." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a trip
export async function DELETE(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Trip ID is required." }, { status: 400 });
    }

    // Verify ownership of the trip before deleting
    const userUUID = stringToUUID(username);
    const { data: check } = await supabase.from("trips").select("user_id").eq("id", id).maybeSingle();
    if (check && check.user_id && check.user_id !== userUUID && username.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden: You do not own this trip." }, { status: 403 });
    }

    // Delete prospects first (cascade deletion fallback)
    await supabase.from("trip_prospects").delete().eq("trip_id", id);

    const { error: deleteError } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete trip from database." },
      { status: 500 }
    );
  }
}
