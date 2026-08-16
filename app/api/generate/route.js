import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();

  if (!body?.prompt?.trim()) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  // Provider integration intentionally comes later.
  // Keep API credentials server-side in environment variables.
  return NextResponse.json({
    id: crypto.randomUUID(),
    status: "queued",
    message: "Mock generation job created. Connect an AI provider to generate media."
  });
}
