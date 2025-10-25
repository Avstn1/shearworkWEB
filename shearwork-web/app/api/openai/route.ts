import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { barberData } = await req.json();

    if (!barberData) {
      return NextResponse.json(
        { error: "No barber data provided" },
        { status: 400 }
      );
    }

    // 🌟 Temporary mock summary instead of calling OpenAI
    const summary = `
      Barber data received. Summary generation is temporarily disabled.
      Received ${barberData.length} characters of data.
    `;

    return NextResponse.json({ summary });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to summarize data" },
      { status: 500 }
    );
  }
}
