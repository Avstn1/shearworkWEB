import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { barberData } = await req.json();

    if (!barberData)
      return NextResponse.json({ error: "No barber data provided" }, { status: 400 });

    const prompt = `
      Summarize this barber data into clear insights:
      ${barberData}
      Return earnings trends, client frequency, and any key highlights.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content || "No summary generated.";

    return NextResponse.json({ summary });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to summarize data" }, { status: 500 });
  }
}
