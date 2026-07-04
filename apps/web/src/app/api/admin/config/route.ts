import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

async function verifySession(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();

  const { data: configRow, error } = await supabase
    .from("trips")
    .select("id, notes")
    .eq("title", "__SYSTEM_CONFIG__")
    .maybeSingle();

  if (error || !configRow) return null;

  try {
    const config = JSON.parse(configRow.notes || "{}");
    const sessions = config.sessions || [];
    const active = sessions.find((s: any) => s.token === token);
    
    if (active && new Date(active.expiresAt) > new Date()) {
      return { configId: configRow.id, config, username: active.username };
    }
  } catch (e) {
    // Fail verification
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const { config } = session;
  const filteredUsers = (config.users || []).map((u: any) => ({
    username: u.username,
    email: u.email || "",
    createdAt: u.createdAt || new Date().toISOString()
  }));

  return NextResponse.json({
    users: filteredUsers,
    logs: config.logs || []
  });
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { username, password, email } = await req.json();

    if (!username || !password || !email) {
      return NextResponse.json({ error: "Username, password, and email are required." }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json({
        error: "Username must be 3-20 characters long and alphanumeric (letters, numbers, underscore)."
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    if (!email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { configId, config } = session;
    const users = config.users || [];

    const exists = users.some((u: any) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return NextResponse.json({ error: "Username already exists." }, { status: 400 });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(password, newSalt);

    const newUser = {
      username: username.trim(), // preserve casing for display
      email: email.trim(),
      salt: newSalt,
      passwordHash: newHash,
      createdAt: new Date().toISOString()
    };

    const updatedConfig = {
      ...config,
      users: [...users, newUser]
    };

    const { error } = await supabase
      .from("trips")
      .update({ notes: JSON.stringify(updatedConfig) })
      .eq("id", configId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error?.message || "Failed to create user." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { action, username, password, email } = await req.json();

    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const { configId, config } = session;
    const users = config.users || [];
    const userIndex = users.findIndex((u: any) => u.username.toLowerCase() === username.toLowerCase());

    if (userIndex === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const targetUser = users[userIndex];

    if (action === "reset_password") {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      const newHash = hashPassword(password, newSalt);
      targetUser.salt = newSalt;
      targetUser.passwordHash = newHash;
    } else if (action === "set_email") {
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
      }
      targetUser.email = email.trim();
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    users[userIndex] = targetUser;
    const updatedConfig = { ...config, users };

    const { error } = await supabase
      .from("trips")
      .update({ notes: JSON.stringify(updatedConfig) })
      .eq("id", configId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user config:", error);
    return NextResponse.json({ error: error?.message || "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUser = searchParams.get("username")?.trim();

    if (!targetUser) {
      return NextResponse.json({ error: "Username parameter is required." }, { status: 400 });
    }

    if (targetUser.toLowerCase() === "admin") {
      return NextResponse.json({ error: "Default admin user account cannot be deleted." }, { status: 400 });
    }

    if (targetUser.toLowerCase() === session.username.toLowerCase()) {
      return NextResponse.json({ error: "You cannot delete your own logged-in user account." }, { status: 400 });
    }

    const { configId, config } = session;
    const users = config.users || [];

    const updatedUsers = users.filter((u: any) => u.username.toLowerCase() !== targetUser.toLowerCase());

    if (updatedUsers.length === users.length) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updatedConfig = {
      ...config,
      users: updatedUsers
    };

    const { error } = await supabase
      .from("trips")
      .update({ notes: JSON.stringify(updatedConfig) })
      .eq("id", configId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete user." }, { status: 500 });
  }
}
