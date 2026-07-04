import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseProspectsInput, correctOcrSpelling } from "@/app/intake/parseProspects";

type ParsedProspectOutput = {
  name: string;
  address: string;
  durationMinutes: number;
  phone: string | null;
  notes: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
    const image = typeof body?.image === "string" ? body.image : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "image/png";

    if (!rawText && !image) {
      return NextResponse.json({ prospects: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
      try {
        const prompt = `You are a sales route planning AI assistant. Parse the following ${image ? "attached image (which may be a screenshot of a spreadsheet, table, email, or list)" : "unstructured raw text"} containing prospect locations.
Identify the following details for each stop:
- name: The name of the company/business. Only if there is no company name given, use the contact person's name.
- address: The full physical street address formatted as a single line (e.g. '123 Main St, City, ST 12345'). Replace any newlines with commas or spaces. Do NOT include contact names, email addresses, phone numbers, comments, or any other extra information inside the address field (for example, extract '412 Kato Terrace, Fremont, CA 94539' instead of 'Kenneth Rosequist (mailbox full) 412, Kato Terrance, Fremont, CA, 94539').
- durationMinutes: The duration of the visit in minutes. Default to 30 if not specified.
- phone: Always return null.
- notes: Always return "".

Return the response strictly as a JSON object matching this schema:
{
  "prospects": [
    {
      "name": "string",
      "address": "string",
      "durationMinutes": number,
      "phone": "string | null",
      "notes": "string | null"
    }
  ]
}

Only return the raw JSON object itself. Do not include markdown code block backticks (like \`\`\`json) or any other text.${image ? "" : " Here is the raw text to parse:"}`;

        let responseText = "";

        if (apiKey.startsWith("sk-or-")) {
          try {
            if (image) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 35000);
              try {
                const openRouterBody = {
                  model: "nvidia/nemotron-nano-12b-v2-vl:free",
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: prompt },
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:${mimeType};base64,${image}`
                          }
                        }
                      ]
                    }
                  ]
                };

                const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/chrislo/fieldroute-ai",
                    "X-Title": "FieldRoute AI"
                  },
                  body: JSON.stringify(openRouterBody),
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!openRouterRes.ok) {
                  const errText = await openRouterRes.text();
                  throw new Error(`OpenRouter API error: ${errText}`);
                }

                const openRouterData = await openRouterRes.json();
                responseText = openRouterData?.choices?.[0]?.message?.content || "";
              } catch (e) {
                clearTimeout(timeoutId);
                throw e;
              }
            } else {
              const cleanText = correctOcrSpelling(rawText);
              const models = [
                "meta-llama/llama-3.3-70b-instruct:free",
                "openai/gpt-oss-120b:free",
                "openai/gpt-oss-20b:free",
                "openrouter/free"
              ];

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let lastError: any = null;
              for (const model of models) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 35000);

                try {
                  console.log(`Attempting parse-prospects OpenRouter with model: ${model}`);
                  const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                      "HTTP-Referer": "https://github.com/chrislo/fieldroute-ai",
                      "X-Title": "FieldRoute AI"
                    },
                    body: JSON.stringify({
                      model: model,
                      messages: [
                        {
                          role: "user",
                          content: `${prompt}\n${cleanText}`
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
                    responseText = content;
                    console.log(`Successfully parsed prospects with model: ${model}`);
                    break;
                  } else {
                    throw new Error(`Empty response from model: ${model}`);
                  }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (e: any) {
                  clearTimeout(timeoutId);
                  console.warn(`Model ${model} failed, trying next fallback. Error:`, e?.message || e);
                  lastError = e;
                }
              }

              if (!responseText && lastError) {
                throw lastError;
              }
            }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            throw e;
          }
        } else {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          let response;
          if (image) {
            response = await model.generateContent([
              {
                inlineData: {
                  data: image,
                  mimeType
                }
              },
              prompt
            ]);
          } else {
            // Pre-correct spelling on text to improve Gemini parsing accuracy
            const cleanText = correctOcrSpelling(rawText);
            response = await model.generateContent(`${prompt}\n${cleanText}`);
          }
          responseText = response.response.text();
        }

        const jsonString = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonString);

        if (parsed && Array.isArray(parsed.prospects)) {
          const prospects: ParsedProspectOutput[] = parsed.prospects.map((p: Record<string, unknown>) => ({
            name: correctOcrSpelling(String(p.name || "").trim()),
            address: correctOcrSpelling(String(p.address || "").replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim()),
            durationMinutes: Number(p.durationMinutes || 30),
            phone: null,
            notes: "",
          }));

          // Validate that each prospect has a name and address
          const filteredProspects = prospects.filter((p) => p.name && p.address);

          return NextResponse.json({
            prospects: filteredProspects,
            source: apiKey.startsWith("sk-or-") ? "openrouter-ai" : "gemini-ai",
          });
        }
      } catch (aiError) {
        console.error("AI parsing failed, falling back to heuristics:", aiError);
      }
    }

    // Fallback: Run local heuristic parser
    if (image && !rawText) {
      return NextResponse.json({
        prospects: [],
        source: "heuristics-fallback",
        error: "Image parsing requires Gemini API key",
      });
    }

    const result = parseProspectsInput({ rawText });
    const prospects: ParsedProspectOutput[] = result.prospects.map((p) => ({
      name: correctOcrSpelling(p.name),
      address: correctOcrSpelling(p.address.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim()),
      durationMinutes: p.durationMinutes ?? 30,
      phone: null,
      notes: "",
    }));

    // Filter by name and address
    const filteredProspects = prospects.filter((p) => p.name && p.address);

    return NextResponse.json({
      prospects: filteredProspects,
      source: "heuristics-fallback",
    });

  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json(
      {
        prospects: [],
        error: "Invalid request body",
      },
      { status: 400 }
    );
  }
}
