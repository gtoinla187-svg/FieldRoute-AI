import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const report = typeof body?.report === "string" ? body.report.trim() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: "Report content is empty." },
        { status: 400 }
      );
    }

    console.log(`[Email Agent] Dispatched Daily Outbound Sales Field Report to: ${email}`);
    console.log(`[Email Agent] Content Length: ${report.length} bytes`);

    // Simulated email delivery response
    return NextResponse.json({ success: true, message: `Report successfully sent to ${email}` });
  } catch (error: any) {
    console.error("Error sending report email:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during email delivery." },
      { status: 500 }
    );
  }
}
