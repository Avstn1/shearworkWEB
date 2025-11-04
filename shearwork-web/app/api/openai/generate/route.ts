'use server'

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

    // 🧲 name
    const { data: userName, error: nameError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user_id)
    .single();

    if (nameError) throw nameError;

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

    // 🔹 Calculate percentage of each service
    let services_percentage: { name: string; bookings: number; percentage: number }[] = [];
    if (services && services.length > 0) {
      const totalBookings = services.reduce((sum, s) => sum + (s.bookings || 0), 0);
      services_percentage = services.map((s) => ({
        name: s.service_name,
        bookings: s.bookings || 0,
        percentage: totalBookings > 0 ? ((s.bookings || 0) / totalBookings) * 100 : 0,
      }));
    }

    // 🧲 3️⃣ marketing_funnels
    const { data: funnels, error: funnelError } = await supabase
      .from("marketing_funnels")
      .select("*")
      .eq("user_id", user_id)
      .eq("report_month", month)
      .eq("report_year", year);

    if (funnelError) throw funnelError;

    // 🧲 3️⃣ top_clients
    const { data: topClients, error: topClientsError } = await supabase
      .from('report_top_clients')
      .select('id, client_name, total_paid, num_visits, notes')
      .eq('user_id', user_id)
      .eq('month', month)
      .order('total_paid', { ascending: false });

    if (topClientsError) throw topClientsError;

    // 🧩 Structured dataset
    const dataset = {
      month,
      year,
      monthly_summary: monthlyData || {},
      services: services || [],
      services_percentage, // <--- added this
      marketing_funnels: funnels || [],
      top_clients: topClients || [],
      user_name: userName,
    };

    // 🧠 Define prompts for each report type
    const prompts = {
      monthly: `
You are a professional analytics assistant creating a monthly performance report for a barbershop professional. 
Be a little fun and use some emojis, especially in section headers.

Dataset (JSON):
${JSON.stringify(dataset, null, 2)}

Generate a detailed monthly report in HTML suitable for TinyMCE. Include sections:
1. <h1>${month} ${year} Business Report</h1>
2. Quick Overview (from monthly_data)
    - Display table with columns: Metric, Value.
    - In the same table with rows: Total Clients, New Clients, Returning Clients, Average Ticket, Total Revenue, Personal Earnings, Date Range
    - **After the table**, write a short summary paragraph (2–3 sentences) that naturally interprets these metrics.
      Example style:
      "<strong>${month}</strong> was a strong month for ${userName} — [X] total clients with [Y]% new bookings. 
      Consistent pricing kept the average ticket around $[avg_ticket], reflecting steady efficiency and client growth."
      Make it sound natural, insightful, and encouraging, but concise.
3. Service Breakdown (from service_bookings) 
    - Include % of each service relative to total bookings
4. Marketing Funnels (from marketing_funnels) 
    - Display table with columns: Source, New Clients, Returning, Retention, and Avg Ticket 
    - Highlights
5. Top Clients (from top_clients)
    - Display table with columns: Rank (medal emojis for top 3 ranks), Client, Total Paid, Visit, Notes
    - Top 10 clients generated... (summary)
6. Frequency Highlights (from top_clients)
    - Display table sorted by Visits with columns: Client, Visits, Total Paid, Notes (but more summarized)
7. Key Takeaways (emojis beside every point rather than bullets)

Use <h2>/<h3> for headings, <p> for text, <ul><li> for lists, <table> for tables. If any section has no data, write: "No data available for this section." Output only HTML body, no triple backticks.
      `,
      weekly: `
You are a professional analytics assistant creating a weekly performance report for a barbershop professional.

Dataset (JSON):
${JSON.stringify(dataset, null, 2)}

Generate a detailed weekly report in HTML for TinyMCE. Include sections:
1. <h1>Week ${week_number} - ${month} ${year} Performance Report</h1>
2. Quick Overview (from monthly_data)
3. Service Breakdown (from service_bookings) 
    - Include % of each service relative to total bookings
4. Marketing Funnels (from marketing_funnels) 
    - Key Insights
    - Action Items
5. AI Tips & Recommendations
6. Summary

Use proper HTML headings, paragraphs, bullet lists, and tables. If a section has no data, write: "No data available for this section." Output only HTML body, no triple backticks.
      `,
      weekly_comparison: `
You are a professional analytics assistant creating a weekly comparison report for a barbershop professional.

Dataset (JSON):
${JSON.stringify(dataset, null, 2)}

Generate a detailed weekly comparison report in HTML for TinyMCE. Compare current week to previous week. Include sections:
1. <h1>Week ${week_number} Comparison Report - ${month} ${year}</h1>
2. Overview and week-over-week trends
3. Service Breakdown Comparison 
    - Include % of each service relative to total bookings
4. Marketing Insights Comparison
5. AI Recommendations based on trends
6. Summary

Use headings, paragraphs, lists, tables. If a section has no data, write: "No data available for this section." Output only HTML body, no triple backticks.
      `,
    };

    // Assign prompt based on report type
    const prompt = prompts[type as keyof typeof prompts] || prompts.monthly;

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
