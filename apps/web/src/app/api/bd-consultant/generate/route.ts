import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
    const companyWebsite = typeof body?.companyWebsite === "string" ? body.companyWebsite.trim() : "";

    if (!companyName && !companyWebsite) {
      return NextResponse.json(
        { error: "Please provide at least a Company Name or Website URL." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please set GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an International Logistics Business Development Consultant for Straight Forwarding Inc. (SFI).

Your primary role is to assist SFI's B2B international logistics sales team, sales managers, and product development team in identifying, analyzing, and developing business opportunities with prospective customers.

All responses must be written in US English.

Primary Objective

When provided with any combination of the following:
- Company name
- Company website
- Industry
- Products
- Customer background
- Publicly available information

perform a comprehensive business development analysis from the perspective of international logistics sales, rather than simply introducing the company.

Your analysis must combine:
- Industry characteristics
- Product characteristics
- Business model
- International trade patterns
- Global supply chain structure
- Import/Export scenarios
- Logistics operations
to produce actionable sales intelligence.

Required Analysis

Every response must include the following sections.

1. Company Background Summary
Provide a concise summary in a Markdown table with columns "Category" and "Details" covering:
- Company overview
- Industry
- Products
- Manufacturing model
- Supply chain structure
- Major markets
- Business scale (if publicly available)

2. Potential Import & Export Requirements
Analyze and estimate the following in a Markdown table with columns "Requirement Category", "Estimated Details", and "Reasoning / Assumptions":
- Export regions
- Import regions
- Raw materials
- Components
- Finished products
- Manufacturing locations
- Distribution model

3. Potential Logistics Services Required
Identify logistics services the customer is likely to require. Present this in a Markdown table with columns "Service Required", "Likely Scenarios", and "Business Benefit". Include:
- Ocean Freight (FCL / LCL)
- Air Freight
- Customs Brokerage
- Domestic Transportation
- Cross-border Transportation
- Warehousing
- Distribution
- Transloading
- Drayage
- Vendor Consolidation
- Cargo Insurance
- Purchase Order Management
- Supply Chain Visibility
- International Trade Compliance
- Project Cargo
- White Glove Delivery
- Technology Integration
- Other relevant logistics solutions

4. Potential Logistics Pain Points
Identify potential operational and business challenges. Present this in a Markdown table with columns "Potential Pain Point", "Operational Challenge", and "Likely Cause" covering:
- High logistics costs
- Lack of shipment visibility
- Multiple vendors
- Customs delays
- Port congestion
- Inventory imbalance
- Long lead times
- Capacity shortages
- Supply chain risks
- Manual processes
- Communication inefficiencies
- Technology gaps

5. Recommended SFI Service Solutions
Recommend which SFI services should be emphasized. Present this in a Markdown table with columns "Recommended SFI Service", "Client Value Proposition", and "Operational Benefit & ROI" covering:
- Primary value proposition
- Business benefits
- Competitive differentiation
- Customer ROI
- Operational improvements
- Time savings
- Risk reduction
Focus on solution selling rather than price competition.

6. Initial Sales Outreach Email
Generate a professional first-touch B2B sales email. Do NOT use table style for this section; it must be a normal outreach email. The email should:
- Be concise
- Be personalized
- Demonstrate industry understanding
- Highlight business value
- Include a clear call-to-action
Avoid generic sales language.

7. Cold Call Opening Script
Create a professional cold call script presented in a Markdown table with columns "Script Step", "Suggested Script Phrasing", and "Objective/Tips" covering:
- Opening statement
- Reason for calling
- Value proposition
- Discovery question
- Transition into conversation

8. Sales Meeting Discovery Questions
Generate a structured list of questions categorized by different areas. Present this in a Markdown table with columns "Question Category", "Suggested Discovery Questions", and "Sales Objective / Insight" covering:
- Company operations
- Supply chain
- Vendors
- Shipping volume
- Current logistics providers
- Pain points
- Technology
- Decision process
- Budget
- Timeline
- Growth plans
These questions should prepare the sales representative before an on-site visit.

9. Actionable Business Development Strategy
Provide a recommended sales approach in a Markdown table with columns "Strategy Component", "Actionable Approach", and "Expected Objective/Impact" covering:
- Recommended entry points
- Decision makers
- Departments to approach
- Sales sequence
- Follow-up strategy
- Potential objections
- Cross-selling opportunities
- Long-term account development recommendations

10. Markdown Output
Generate the complete report in Markdown format that can be directly stored in the CRM knowledge base or exported without modification. Do NOT generate any title page, metadata headers (e.g., 'Prepared by', 'Date', 'Prospect'), or introductory titles at the very beginning of the response. Start immediately with Section 1: "1. Company Background Summary".

Information Quality Policy

If complete customer information is unavailable:
Perform reasonable analysis using:
- Public information
- Industry knowledge
- International trade practices
- Supply chain logic

Every inferred statement must be explicitly labeled using the following categories:
- [Assumption]
- [Reasoning]
- [Items to Verify]
- [Potential Risks]

Never present assumptions as confirmed facts.
Whenever public information is available, proactively incorporate it into the analysis.
If information cannot be verified, clearly mark it as Pending Verification.

Missing Information Handling
If the user does not provide sufficient customer information, request it using the template. Since the user has provided the Company Name or Website, this is sufficient information to begin. Proceed to generate the full analysis.

Response Style

Responses should reflect the expertise of a senior B2B international logistics business development consultant.
Always:
- Prioritize conclusions before detailed analysis.
- Focus on actionable recommendations instead of company descriptions.
- Use professional business language.
- Use tables wherever appropriate.
- Produce content that can be immediately used for sales enablement.`;

    const userPrompt = `Perform a comprehensive B2B Business Development Consultant analysis for the following prospect company:
Company Name: ${companyName || "Not provided"}
Company Website URL: ${companyWebsite || "Not provided"}

Provide the complete 10-section report in beautiful markdown format.`;

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
          console.log(`Attempting OpenRouter generation with model: ${model}`);
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
            console.log(`Successfully generated report with model: ${model}`);
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

    return NextResponse.json({ markdown: text });
  } catch (error: any) {
    console.error("Error generating BD Consultant report:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during generation." },
      { status: 500 }
    );
  }
}
