/**
 * Hugging Face Inference Providers adapter.
 *
 * Uses HF Inference Providers (router) with model Wan-AI/Wan2.2-TI2V-5B.
 * Auth: HF_TOKEN server-side only (Vercel env). Never sent to the browser.
 *
 * Billing reality (HF docs, 2026):
 * - Free users get ~$0.10/month Inference Providers credits (subject to change).
 * - After credits, usage is pay-as-you-go if the account can be billed.
 * - This adapter does NOT purchase credits or enable auto-pay.
 * - On 402 / quota / billing errors we return a clear failed job — no silent charge.
 *
 * Provider selection: HF_PROVIDER env optional (e.g. fal-ai, replicate, wavespeed).
 * Default leaves routing to Hugging Face.
 *
 * Serverless note: long video jobs may hit Vercel function timeouts.
 * Status is encoded in the job id for cross-invocation polling.
 */

const MODEL = process.env.HF_VIDEO_MODEL || "Wan-AI/Wan2.2-TI2V-5B";
const HF_API = "https://router.huggingface.co";

function getToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "";
}

function parseDurationSeconds(duration) {
  if (!duration) return 5;
  const n = parseInt(String(duration).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(n, 8); // keep short for free-tier / timeout safety
}

function encodeHfId(createdAt, mode, externalId) {
  const safe = encodeURIComponent(externalId || "sync");
  return `hf_${createdAt}_${mode === "text-to-image" ? "t2i" : "vid"}_${safe}`;
}

function decodeHfId(id) {
  if (!id || !id.startsWith("hf_")) return null;
  const parts = id.split("_");
  if (parts.length < 4) return null;
  const createdAt = Number(parts[1]);
  if (!Number.isFinite(createdAt)) return null;
  return { createdAt, kind: parts[2], rest: parts.slice(3).join("_") };
}

function mapHfError(status, bodyText) {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || status === 403) {
    return "Hugging Face auth failed. Check HF_TOKEN on the server (Inference Providers permission).";
  }
  if (
    status === 402 ||
    lower.includes("payment") ||
    lower.includes("credit") ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded")
  ) {
    return "Hugging Face free monthly credits are exhausted or billing is required. No automatic charge was made. Add credits in your HF account or switch AI_PROVIDER back to mock.";
  }
  if (status === 429) {
    return "Hugging Face rate limit hit. Try again later or use mock provider.";
  }
  if (status === 503 || status === 504) {
    return "Hugging Face provider is busy or timed out. Try a shorter prompt/duration or retry later.";
  }
  return `Hugging Face request failed (${status}). ${bodyText?.slice(0, 200) || ""}`.trim();
}

/**
 * @param {import('./types.js').CreateJobInput} input
 * @returns {Promise<import('./types.js').JobResult>}
 */
export async function createJob(input) {
  const token = getToken();
  if (!token) {
    return {
      id: encodeHfId(Date.now(), input.mode, "no-token"),
      status: "failed",
      error:
        "HF_TOKEN is not set. Add it as a Vercel environment variable (never in the browser or GitHub).",
      provider: "huggingface",
      message: "Missing HF_TOKEN",
    };
  }

  if (input.mode === "text-to-image") {
    return {
      id: encodeHfId(Date.now(), input.mode, "unsupported"),
      status: "failed",
      error:
        "This Hugging Face adapter is configured for Wan2.2 text/image-to-video, not text-to-image.",
      provider: "huggingface",
      message: "Unsupported mode",
    };
  }

  const createdAt = Date.now();
  const seconds = parseDurationSeconds(input.duration);
  // Approximate frames at 24fps (Wan TI2V is 24 FPS); keep modest for free tier
  const numFrames = Math.min(Math.max(seconds * 8, 16), 48);

  const provider = (process.env.HF_PROVIDER || "").trim(); // e.g. fal-ai, replicate
  const modelPath = MODEL;
  const url = `${HF_API}/models/${modelPath}`;

  const payload = {
    inputs: input.prompt,
    parameters: {
      num_frames: numFrames,
    },
  };

  if (input.mode === "image-to-video" && input.imageUrl) {
    payload.parameters.image = input.imageUrl;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, video/*, */*",
  };
  if (provider) {
    headers["X-HF-Provider"] = provider;
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      id: encodeHfId(createdAt, input.mode, "network"),
      status: "failed",
      error: `Network error calling Hugging Face: ${err?.message || "unknown"}`,
      provider: "huggingface",
      message: "Network error",
    };
  }

  const contentType = res.headers.get("content-type") || "";

  // Some providers return video bytes directly
  if (res.ok && contentType.includes("video")) {
    const id = encodeHfId(createdAt, input.mode, "binary");
    return {
      id,
      status: "completed",
      message:
        "Hugging Face returned video bytes. This free deploy has no media storage yet — video was generated but not saved. Add object storage later to persist outputs.",
      mediaUrl: null,
      mediaType: "video",
      provider: "huggingface",
      meta: { model: MODEL, mode: input.mode },
    };
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const id = encodeHfId(createdAt, input.mode, "err");
    return {
      id,
      status: "failed",
      error: mapHfError(res.status, text),
      provider: "huggingface",
      message: "Provider error",
      meta: { status: res.status, model: MODEL },
    };
  }

  const mediaUrl =
    data?.video?.url ||
    data?.url ||
    data?.output?.[0] ||
    data?.data?.[0]?.url ||
    null;
  const asyncId =
    data?.id || data?.requestId || data?.request_id || data?.job_id || null;

  if (mediaUrl) {
    const id = encodeHfId(createdAt, input.mode, "done");
    return {
      id,
      status: "completed",
      message: "Video generated via Hugging Face Inference Providers.",
      mediaUrl: typeof mediaUrl === "string" ? mediaUrl : null,
      mediaType: "video",
      provider: "huggingface",
      meta: { model: MODEL, mode: input.mode },
    };
  }

  if (asyncId) {
    const id = encodeHfId(createdAt, input.mode, String(asyncId));
    return {
      id,
      status: "processing",
      message:
        "Hugging Face job submitted. Polling is limited without provider-specific status APIs — refresh status shortly.",
      provider: "huggingface",
      meta: { model: MODEL, externalId: asyncId },
    };
  }

  const id = encodeHfId(createdAt, input.mode, "ok");
  return {
    id,
    status: "completed",
    message:
      "Hugging Face responded OK but no video URL was found in the response. Check provider docs for this model.",
    mediaUrl: null,
    mediaType: "video",
    provider: "huggingface",
    meta: { model: MODEL, rawKeys: data ? Object.keys(data) : [] },
  };
}

/**
 * Deterministic status from encoded id. Does not re-call HF on every poll
 * (avoids burning free credits).
 *
 * @param {string} id
 * @returns {Promise<import('./types.js').JobResult | null>}
 */
export async function getJob(id) {
  const decoded = decodeHfId(id);
  if (!decoded) return null;

  const age = Date.now() - decoded.createdAt;
  if (id.includes("_err") || id.includes("_no-token") || id.includes("_unsupported")) {
    return {
      id,
      status: "failed",
      error: "Previous Hugging Face job failed. Start a new generation.",
      provider: "huggingface",
    };
  }

  if (age < 3000) {
    return {
      id,
      status: "processing",
      message: "Hugging Face job in progress (status derived from job id).",
      provider: "huggingface",
    };
  }

  return {
    id,
    status: "completed",
    message:
      "Hugging Face job finished or timed out on the client poll window. If no media URL was returned at create time, generation may have failed due to credits, timeout, or provider limits.",
    mediaUrl: null,
    mediaType: "video",
    provider: "huggingface",
  };
}
