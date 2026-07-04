import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

const DEFAULT_SALT = "sfi_routing_salt_2026";

function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

async function getOrInitConfig() {
  const { data: existing, error } = await supabase
    .from("trips")
    .select("id, notes")
    .eq("title", "__SYSTEM_CONFIG__")
    .maybeSingle();

  if (existing) {
    try {
      return { id: existing.id, config: JSON.parse(existing.notes || "{}") };
    } catch {
      // Re-init if corrupted
    }
  }

  // Create default admin user
  const adminSalt = crypto.randomBytes(16).toString("hex");
  // Default password: admin123
  const adminHash = hashPassword("admin123", adminSalt);

  const defaultConfig = {
    users: [
      {
        username: "admin",
        salt: adminSalt,
        passwordHash: adminHash,
        createdAt: new Date().toISOString()
      }
    ],
    logs: []
  };

  const { data: created, error: insertError } = await supabase
    .from("trips")
    .insert({
      title: "__SYSTEM_CONFIG__",
      start_address: "System",
      end_address: "System",
      start_time: new Date().toISOString(),
      status: "system:config",
      notes: JSON.stringify(defaultConfig)
    })
    .select()
    .single();

  if (insertError) {
    throw new Error("Failed to initialize system config database: " + insertError.message);
  }

  return { id: created.id, config: defaultConfig };
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const { id: tripId, config } = await getOrInitConfig();

    const users = config.users || [];
    const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const loginTime = new Date().toISOString();

    let success = false;
    if (user) {
      const incomingHash = hashPassword(password, user.salt);
      if (incomingHash === user.passwordHash) {
        success = true;
      }
    }

    // Append log event
    const newLog = {
      username,
      timestamp: loginTime,
      status: success ? "success" : "failure",
      ip: clientIp,
      userAgent
    };

    const updatedLogs = [newLog, ...(config.logs || [])].slice(0, 1000); // cap at 1000 logs
    const updatedConfig = { ...config, logs: updatedLogs };

    const { error: updateError } = await supabase
      .from("trips")
      .update({ notes: JSON.stringify(updatedConfig) })
      .eq("id", tripId);

    if (updateError) {
      console.error("Failed to write login log back to database:", updateError);
    }

    if (!success) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Generate simple token session
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
    const newSession = { token, username, expiresAt };

    const updatedSessions = [newSession, ...(config.sessions || [])]
      .filter((s: any) => new Date(s.expiresAt) > new Date());

    const finalConfig = { ...updatedConfig, sessions: updatedSessions };

    const { error: sessionUpdateError } = await supabase
      .from("trips")
      .update({ notes: JSON.stringify(finalConfig) })
      .eq("id", tripId);

    if (sessionUpdateError) {
      console.error("Failed to write login session back to database:", sessionUpdateError);
      throw new Error("Failed to save session.");
    }

    return NextResponse.json({
      success: true,
      token,
      username
    });
  } catch (error: any) {
    console.error("Error in admin auth API:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
