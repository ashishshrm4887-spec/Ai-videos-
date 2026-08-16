import { NextResponse } from "next/server";
import { getProvider } from "../../../lib/providers/index.js";

const MODE_MAP = {
  "Text to Video": "text-to-video",
  "Image to Video": "image-to-video",
  "Text to Image": "text-to-image",
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const modeLabel = body?.mode || "Text to Video";
  const mode = MODE_MAP[modeLabel] || body?.mode || "text-to-video";

  const input = {
    mode,
    prompt,
    aspectRatio: body?.aspectRatio || "9:16",
    duration: body?.duration || "5s",
    quality: body?.quality || "Standard",
    imageUrl: body?.imageUrl || undefined,
  };

  try {
    const provider = getProvider();
    const job = await provider.createJob(input);
    return NextResponse.json(job);
  } catch (err) {
    console.error("[generate]", err);
    return NextResponse.json(
      { error: "Failed to create generation job." },
      { status: 500 }
    );
  }
}
