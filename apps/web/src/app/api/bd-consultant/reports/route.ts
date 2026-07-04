import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

// GET: Fetch all saved consultant reports
export async function GET(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const userUUID = stringToUUID(username);

    let query = supabase
      .from("trips")
      .select("id, title, start_address, end_address, notes, created_at, status, user_id")
      .eq("status", "consultant_report")
      .order("created_at", { ascending: false });

    if (username.toLowerCase() === "admin") {
      query = query.or(`user_id.eq.${userUUID},user_id.is.null`);
    } else {
      query = query.eq("user_id", userUUID);
    }

    const { data: trips, error } = await query;

    if (error) throw error;

    const reports = (trips || []).map((t) => ({
      id: t.id,
      name: t.title || "Unnamed Report",
      companyName: t.end_address || "",
      companyWebsite: t.start_address || "",
      markdown: t.notes || "",
      createdAt: t.created_at,
    }));

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error("Error fetching consultant reports:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch saved consultant reports." },
      { status: 500 }
    );
  }
}

// POST: Create or Update a saved consultant report
export async function POST(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, companyName, companyWebsite, markdown } = body;

    const userUUID = stringToUUID(username);

    const payload = {
      title: name || `${companyName || companyWebsite || "Unnamed"} Report`,
      start_address: companyWebsite || "",
      end_address: companyName || "",
      start_time: new Date().toISOString(),
      notes: markdown || "",
      status: "consultant_report",
      user_id: userUUID,
    };

    if (id) {
      // Verify ownership of the report before updating
      const { data: check } = await supabase.from("trips").select("user_id").eq("id", id).maybeSingle();
      if (check && check.user_id && check.user_id !== userUUID && username.toLowerCase() !== "admin") {
        return NextResponse.json({ error: "Forbidden: You do not own this report." }, { status: 403 });
      }

      const { error } = await supabase
        .from("trips")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, id });
    } else {
      const { data, error } = await supabase
        .from("trips")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, id: data.id });
    }
  } catch (error: any) {
    console.error("Error saving consultant report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save consultant report." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a saved consultant report
export async function DELETE(req: NextRequest) {
  try {
    const username = await verifySession(req);
    if (!username) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    }

    // Verify ownership of the report before deleting
    const userUUID = stringToUUID(username);
    const { data: check } = await supabase.from("trips").select("user_id").eq("id", id).maybeSingle();
    if (check && check.user_id && check.user_id !== userUUID && username.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden: You do not own this report." }, { status: 403 });
    }

    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting consultant report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete consultant report." },
      { status: 500 }
    );
  }
}
