import { NextResponse } from "next/server";
import { getProvider } from "../../../../lib/providers/index.js";

export async function GET(request) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Job id is required." }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const job = await provider.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (err) {
    console.error("[status]", err);
    return NextResponse.json(
      { error: "Failed to fetch job status." },
      { status: 500 }
    );
  }
}
