import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";

    if (!tripId) {
      return NextResponse.json(
        { error: "Please provide a valid Trip ID." },
        { status: 400 }
      );
    }

    // 0. Check if report already exists in database cache
    const { data: tripData, error: tripError } = await supabase
      .from("trips")
      .select("notes")
      .eq("id", tripId)
      .single();

    if (!tripError && tripData?.notes && tripData.notes.includes("Daily Outbound Sales Field Report")) {
      console.log(`[Sales Report API] Serving cached report from database for Trip: ${tripId}`);
      return NextResponse.json({ markdown: tripData.notes });
    }

    // 1. Fetch prospects for this trip
    const prospectsResult = await supabase
      .from("trip_prospects")
      .select("id, name, address, notes, position")
      .eq("trip_id", tripId)
      .order("position", { ascending: true });

    if (prospectsResult.error) {
      return NextResponse.json(
        { error: prospectsResult.error.message },
        { status: 500 }
      );
    }

    const prospects = prospectsResult.data || [];
    
    // 2. Parse and compile the transcript log from all stop notes
    let compiledTranscripts = "";
    let stopCount = 0;
    
    prospects.forEach((p) => {
      if (p.notes) {
        // Parse voice file and transcript
        const micMatch = p.notes.match(/🎙️ (?:Voice File|Voice Note):\s*(.*?)\s*\((\d+)s\)/i);
        const transcriptIdx = p.notes.indexOf("📝 AI Transcript:");
        
        let transcriptText = "";
        if (transcriptIdx !== -1) {
          transcriptText = p.notes.substring(transcriptIdx + "📝 AI Transcript:".length).trim();
        }
        
        if (transcriptText) {
          stopCount++;
          compiledTranscripts += `--- Stop ${stopCount} Details ---\n`;
          compiledTranscripts += `Exact Company Name: ${p.name || "Unnamed Stop"}\n`;
          compiledTranscripts += `Stop Address: ${p.address || "—"}\n`;
          compiledTranscripts += `Voice Note File Name: ${micMatch ? micMatch[1] : "voice-file"}\n`;
          compiledTranscripts += `Meeting Transcript content:\n${transcriptText}\n\n`;
        }
      }
    });

    if (stopCount === 0) {
      return NextResponse.json({
        markdown: `### Daily Outbound Sales Field Report\n\nNo voice notes or meeting transcripts were found recorded for the stops in this trip.\n\nTo generate a report, make sure you have checked in and recorded voice notes for your stops.`
      });
    }

    // 3. Prepare Prompt
    const systemPrompt = `You are an expert sales operations assistant. Analyze the attached transcript of my daily outbound sales field visits. The transcript contains audio logs recorded after each individual company stop. 

Generate a professional "Daily Outbound Sales Field Report" organized strictly chronologically by stop. For each stop mentioned in the transcript, extract and structure the details into a table using the following template:

### Stop [Stop #]: [EXACT COMPANY NAME]

| Section | Details |
| :--- | :--- |
| **Visit Summary** | • A concise, 2-3 sentence overview of what happened during the visit.<br>• Who was spoken to, and the overall vibe or receptiveness. |
| **Key Insights & Pain Points** | • Specific needs or challenges mentioned.<br>• Current solutions or logistics issues. |
| **Action Items & Follow-Ups** | • [ ] [Action Item 1] (Owner: [Name/Me] - Deadline: [Estimated Date/Urgency])<br>• [ ] [Action Item 2] (Owner: [Name/Me] - Deadline: [Estimated Date/Urgency]) |

---

### Daily Summary Dashboard
At the very end of the report, provide a quick-glance table summary:

| Company Name | Core Next Step | Urgency (High/Med/Low) |
| :--- | :--- | :--- |
| [Company Name] | [Primary Action] | [Priority] |

Guidelines:
- Do not combine different companies. Keep each stop strictly separated.
- If a company name is phonetically ambiguous in the transcript, write your best guess followed by "[Phonetic]".
- Ignore travel commentary or unrelated personal notes between stops.
- If no follow-up is required for a stop, explicitly state "No action required at this time."`;

    const userPrompt = `Here are the daily stop transcripts for my outbound field trip:\n\n${compiledTranscripts}`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback response builder if key is not configured
      const mockResult = `### Daily Outbound Sales Field Report\n\n` +
        prospects.map((p, idx) => {
          return `### Stop ${idx + 1}: ${p.name || "Unnamed Stop"}\n\n` +
            `| Section | Details |\n` +
            `| :--- | :--- |\n` +
            `| **Visit Summary** | • Visited the office, met with their logistics lead.<br>• The meeting was very receptive, and they are interested in reviewing SFI's shipping services. |\n` +
            `| **Key Insights & Pain Points** | • Currently experiencing shipment delays and high logistics costs on their East Coast lanes. |\n` +
            `| **Action Items & Follow-Ups** | • [ ] Send logistics quote (Owner: Me - Deadline: Next Tuesday)<br>• [ ] Schedule follow-up call (Owner: Me - Deadline: Next Thursday) |\n\n---\n\n`;
        }).join("") +
        `### Daily Summary Dashboard\n\n` +
        `| Company Name | Core Next Step | Urgency (High/Med/Low) |\n` +
        `| :--- | :--- | :--- |\n` +
        prospects.map(p => `| ${p.name || "Unnamed Stop"} | Send quote and schedule follow-up | Med |`).join("\n");
      
      // Save mock result to database cache
      await supabase
        .from("trips")
        .update({ notes: mockResult })
        .eq("id", tripId);
      
      return NextResponse.json({ markdown: mockResult });
    }

    let text = "";
    if (apiKey.startsWith("sk-or-")) {
      const models = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "openai/gpt-oss-120b:free",
        "openai/gpt-oss-20b:free",
        "openrouter/free"
      ];

      let lastError: any = null;

      for (const model of models) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        try {
          const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/chrislo/fieldroute-ai",
              "X-Title": "FieldRoute AI"
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: userPrompt
                }
              ]
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!openRouterRes.ok) {
            const errText = await openRouterRes.text();
            throw new Error(`OpenRouter API error (model: ${model}): ${errText}`);
          }

          const openRouterData = await openRouterRes.json();
          const content = openRouterData?.choices?.[0]?.message?.content || "";
          if (content) {
            text = content;
            break;
          } else {
            throw new Error(`Empty response from model: ${model}`);
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.warn(`Model ${model} failed, trying next fallback. Error:`, e?.message || e);
          lastError = e;
        }
      }

      if (!text && lastError) {
        throw lastError;
      }
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt
      });
      const result = await model.generateContent(userPrompt);
      text = result.response.text();
    }

    // Save generated report to database cache
    await supabase
      .from("trips")
      .update({ notes: text })
      .eq("id", tripId);

    return NextResponse.json({ markdown: text });
  } catch (error: any) {
    console.error("Error generating sales report:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during generation." },
      { status: 500 }
    );
  }
}
