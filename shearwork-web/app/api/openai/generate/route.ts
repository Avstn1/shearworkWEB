import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { openai } from "@/lib/openaiClient";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const url = new URL(req.url);

    const type = url.searchParams.get("type") || "monthly";
    const user_id = url.searchParams.get("user_id");
    const month =
      url.searchParams.get("month") ||
      new Date().toLocaleString("default", { month: "long" });
    const year = parseInt(
      url.searchParams.get("year") || String(new Date().getFullYear()),
      10
    );

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    // 🧮 Week number only for weekly reports
    const week_number = Math.ceil(new Date().getDate() / 7);

    // 🧲 1️⃣ monthly_data
    const { data: monthlyData, error: monthlyError } = await supabase
      .from("monthly_data")
      .select("*")
      .eq("user_id", user_id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (monthlyError) throw monthlyError;

    // 🧲 2️⃣ service_bookings
    const { data: services, error: serviceError } = await supabase
      .from("service_bookings")
      .select("*")
      .eq("user_id", user_id)
      .eq("report_month", month)
      .eq("report_year", year);

    if (serviceError) throw serviceError;

    // 🧲 3️⃣ marketing_funnels
    const { data: funnels, error: funnelError } = await supabase
      .from("marketing_funnels")
      .select("*")
      .eq("user_id", user_id)
      .eq("report_month", month)
      .eq("report_year", year);

    if (funnelError) throw funnelError;

    // 🧩 Structured dataset
    const dataset = {
      month,
      year,
      monthly_summary: monthlyData || {},
      services: services || [],
      marketing_funnels: funnels || [],
    };

    // 🧠 Prompt for OpenAI
    const prompt = `
You are a professional analytics assistant creating a ${type} performance report for a barbershop professional. 

Below is the dataset in JSON format:
\`\`\`json
${JSON.stringify(dataset, null, 2)}
\`\`\`

Generate a detailed ${type} report in **HTML** suitable for direct insertion into a TinyMCE editor.

Formatting requirements:
- Use <h1>, <h2>, <h3> appropriately.
- Use <p> for body text.
- Use <ul><li> for bullet lists.
- Use <table> for tabular data (like service breakdowns or marketing performance).
- Include simple inline font-size or style attributes for visual hierarchy.
- Professional, readable, and visually balanced layout.
- If any section is missing data, write: “No data available for this section.”

Sections to include:
1. <h1> ${month} ${year} Performance Report
2. Overview (from monthly_data)
3. Service Breakdown (from service_bookings)
4. Marketing Insights (from marketing_funnels)
5. AI Tips & Recommendations (based on available data)
6. Summary

Output only the HTML body — no <html> or <body> tags.
`;

    // 🤖 Call OpenAI
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an expert analytics report writer specializing in barbershop business performance summaries.",
        },
        { role: "user", content: prompt },
      ],
    });

    const htmlReport = response.choices?.[0]?.message?.content?.trim() || "";

    // 📊 Rollup metrics
    const total_revenue = monthlyData?.total_revenue || 0;
    const avg_ticket = monthlyData?.avg_ticket || 0;
    const total_cuts =
      services?.reduce((sum, s) => sum + (s.bookings || 0), 0) || 0;

    // 💾 Save in reports table
    const { data: newReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        user_id,
        type,
        month,
        week_number: type === "weekly" ? week_number : null,
        year,
        content: htmlReport,
        total_cuts,
        total_revenue,
        avg_ticket,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, report: newReport });
  } catch (err: any) {
    console.error("❌ Report generation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
