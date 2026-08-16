/**
 * Hugging Face Inference Providers adapter for Wan-AI/Wan2.2-TI2V-5B.
 *
 * Auth: HF_TOKEN server-side only (Vercel env). Never sent to the browser.
 *
 * Routing (matches @huggingface/inference + hub docs):
 * - Wan2.2 is served by third-party providers (fal-ai, replicate, wavespeed, …),
 *   NOT by hf-inference.
 * - When using an HF token, requests go through the HF router:
 *     POST https://router.huggingface.co/{provider}/{providerModelId}?_subdomain=queue
 * - Official examples use provider="fal-ai" | "replicate" | "wavespeed".
 *
 * Default in this adapter:
 * - Model: Wan-AI/Wan2.2-TI2V-5B (override with HF_VIDEO_MODEL)
 * - Provider: fal-ai (override with HF_PROVIDER)
 * - Fal provider model id is resolved from HF partners mapping when possible,
 *   with a documented fallback path.
 *
 * Payload (Fal text-to-video helper in huggingface.js):
 *   { "prompt": "<text>", ...parameters }
 * Response is async queue: { request_id, status, response_url } then poll.
 *
 * Billing: free HF accounts get a small monthly Inference Providers credit
 * (~$0.10). This adapter does not purchase credits. Quota/billing errors
 * return a clear failed job.
 */

const HF_ROUTER = "https://router.huggingface.co";
const DEFAULT_MODEL = "Wan-AI/Wan2.2-TI2V-5B";
const DEFAULT_PROVIDER = "fal-ai";

function getToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "";
}

function getModel() {
  return process.env.HF_VIDEO_MODEL || DEFAULT_MODEL;
}

function getProvider() {
  // Official docs examples for Wan2.2 use fal-ai / replicate / wavespeed.
  // Default to fal-ai; set HF_PROVIDER to override.
  return (process.env.HF_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
}

function parseDurationSeconds(duration) {
  if (!duration) return 5;
  const n = parseInt(String(duration).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return Math.min(n, 8);
}

function encodeHfId(createdAt, tag) {
  const safe = encodeURIComponent(String(tag || "job")).slice(0, 180);
  return `hf_${createdAt}_vid_${safe}`;
}

function decodeHfId(id) {
  if (!id || !id.startsWith("hf_")) return null;
  const parts = id.split("_");
  if (parts.length < 4) return null;
  const createdAt = Number(parts[1]);
  if (!Number.isFinite(createdAt)) return null;
  return { createdAt, rest: parts.slice(3).join("_") };
}

function mapHfError(status, bodyText) {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || status === 403) {
    return "Hugging Face auth failed. Use a fine-grained token with Inference Providers permission.";
  }
  if (
    status === 402 ||
    lower.includes("payment") ||
    lower.includes("credit") ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded")
  ) {
    return "Hugging Face free monthly credits are exhausted or billing is required. No automatic charge was made. Switch AI_PROVIDER=mock or add credits in your HF account.";
  }
  if (status === 404) {
    return "Model/provider route not found. Wan2.2 must be called via a text-to-video provider (e.g. fal-ai), not hf-inference.";
  }
  if (status === 429) {
    return "Hugging Face or provider rate limit hit. Try again later or use mock.";
  }
  if (status === 503 || status === 504) {
    return "Provider busy or timed out. Retry with a shorter duration.";
  }
  return `Hugging Face request failed (${status}). ${(bodyText || "").slice(0, 240)}`.trim();
}

/**
 * Resolve Fal (or other) provider model id from HF partners mapping.
 * Falls back to the HF model id if mapping is unavailable.
 * @param {string} provider
 * @param {string} hfModelId
 */
async function resolveProviderModelId(provider, hfModelId) {
  try {
    const res = await fetch(
      `https://huggingface.co/api/partners/${encodeURIComponent(provider)}/models`,
      { method: "GET", headers: { Accept: "application/json" } }
    );
    if (!res.ok) return hfModelId;
    const data = await res.json();
    if (Array.isArray(data)) {
      const hit = data.find(
        (m) =>
          m?.hfModelId === hfModelId ||
          m?.hf_model_id === hfModelId ||
          m?.id === hfModelId ||
          m?.modelId === hfModelId
      );
      if (hit) {
        return (
          hit.providerId ||
          hit.provider_id ||
          hit.providerModelId ||
          hit.provider_model_id ||
          hfModelId
        );
      }
    } else if (data && typeof data === "object") {
      const entry = data[hfModelId];
      if (typeof entry === "string") return entry;
      if (entry?.providerId) return entry.providerId;
      if (entry?.id) return entry.id;
    }
  } catch {
    // ignore — use hf id
  }
  return hfModelId;
}

/**
 * Build router URL for HF-token routed third-party provider (queue subdomain for Fal).
 * Matches huggingface.js FalAiQueueTask.makeRoute + makeBaseUrl:
 *   `${HF_ROUTER_URL}/${provider}/${providerModelId}?_subdomain=queue`
 */
function buildSubmitUrl(provider, providerModelId) {
  const base = `${HF_ROUTER}/${provider}/${providerModelId}`;
  if (provider === "fal-ai") {
    return `${base}?_subdomain=queue`;
  }
  return base;
}

/**
 * @param {import('./types.js').CreateJobInput} input
 * @returns {Promise<import('./types.js').JobResult>}
 */
export async function createJob(input) {
  const token = getToken();
  const model = getModel();
  const provider = getProvider();

  if (!token) {
    return {
      id: encodeHfId(Date.now(), "no-token"),
      status: "failed",
      error:
        "HF_TOKEN is not set. Add it as a Vercel environment variable (never in the browser or GitHub).",
      provider: "huggingface",
      message: "Missing HF_TOKEN",
    };
  }

  if (input.mode === "text-to-image") {
    return {
      id: encodeHfId(Date.now(), "unsupported"),
      status: "failed",
      error:
        "This adapter targets Wan2.2 text/image-to-video via Inference Providers, not text-to-image.",
      provider: "huggingface",
      message: "Unsupported mode",
    };
  }

  const createdAt = Date.now();
  const seconds = parseDurationSeconds(input.duration);
  const numFrames = Math.min(Math.max(seconds * 8, 16), 48);

  const providerModelId = await resolveProviderModelId(provider, model);
  const url = buildSubmitUrl(provider, providerModelId);

  // Fal text-to-video payload shape from huggingface.js FalAITextToVideoTask:
  // { prompt: inputs, ...parameters }
  const payload = {
    prompt: input.prompt,
    num_frames: numFrames,
  };
  if (input.mode === "image-to-video" && input.imageUrl) {
    payload.image_url = input.imageUrl;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      id: encodeHfId(createdAt, "network"),
      status: "failed",
      error: `Network error calling Hugging Face router: ${err?.message || "unknown"}`,
      provider: "huggingface",
      message: "Network error",
      meta: { url, model, provider },
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
    return {
      id: encodeHfId(createdAt, "err"),
      status: "failed",
      error: mapHfError(res.status, text),
      provider: "huggingface",
      message: "Provider error",
      meta: { status: res.status, url, model, provider, providerModelId },
    };
  }

  // Fal queue submit: { request_id, status, response_url }
  if (data?.request_id && data?.response_url) {
    const tag = [
      provider,
      data.request_id,
      Buffer.from(String(data.response_url), "utf8").toString("base64url"),
    ].join(".");
    return {
      id: encodeHfId(createdAt, tag),
      status: "processing",
      message: "Submitted to Hugging Face Inference Providers (queued). Polling status…",
      provider: "huggingface",
      meta: {
        model,
        provider,
        providerModelId,
        requestId: data.request_id,
        endpoint: url,
      },
    };
  }

  const mediaUrl =
    data?.video?.url ||
    data?.url ||
    (typeof data?.output === "string" ? data.output : null) ||
    data?.output?.[0] ||
    null;

  if (typeof mediaUrl === "string" && mediaUrl.startsWith("http")) {
    return {
      id: encodeHfId(createdAt, "done"),
      status: "completed",
      message: "Video generated via Hugging Face Inference Providers.",
      mediaUrl,
      mediaType: "video",
      provider: "huggingface",
      meta: { model, provider, endpoint: url },
    };
  }

  return {
    id: encodeHfId(createdAt, "ok"),
    status: "completed",
    message:
      "Provider returned OK but no video URL / queue id was recognized. Check HF_PROVIDER and model mapping.",
    mediaUrl: null,
    mediaType: "video",
    provider: "huggingface",
    meta: { model, provider, endpoint: url, keys: data ? Object.keys(data) : [] },
  };
}

/**
 * Poll Fal-style queue via HF router when job id embeds request metadata.
 *
 * @param {string} id
 * @returns {Promise<import('./types.js').JobResult | null>}
 */
export async function getJob(id) {
  const decoded = decodeHfId(id);
  if (!decoded) return null;

  if (
    id.includes("_no-token") ||
    id.includes("_unsupported") ||
    id.includes("_err") ||
    id.includes("_network")
  ) {
    return {
      id,
      status: "failed",
      error: "Previous Hugging Face job failed. Start a new generation.",
      provider: "huggingface",
    };
  }

  let rest = decoded.rest;
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // keep
  }

  const token = getToken();
  const parts = rest.split(".");
  if (token && parts.length >= 3) {
    const provider = parts[0];
    const requestId = parts[1];
    let responseUrl = "";
    try {
      responseUrl = Buffer.from(parts.slice(2).join("."), "base64url").toString("utf8");
    } catch {
      responseUrl = "";
    }

    if (responseUrl && provider === "fal-ai") {
      try {
        const parsed = new URL(responseUrl);
        const modelPath = parsed.pathname;
        const baseUrl = `${HF_ROUTER}/fal-ai`;
        const statusUrl = `${baseUrl}${modelPath}/status`;
        const resultUrl = `${baseUrl}${modelPath}`;

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        const statusRes = await fetch(statusUrl, { headers });
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          const st = String(statusJson?.status || "").toUpperCase();
          if (st && st !== "COMPLETED") {
            return {
              id,
              status: "processing",
              message: `Hugging Face / Fal queue status: ${st}`,
              provider: "huggingface",
              meta: { requestId, status: st },
            };
          }
        }

        const resultRes = await fetch(resultUrl, { headers });
        if (resultRes.ok) {
          const result = await resultRes.json();
          const mediaUrl = result?.video?.url;
          if (typeof mediaUrl === "string") {
            return {
              id,
              status: "completed",
              message: "Video ready from Hugging Face Inference Providers.",
              mediaUrl,
              mediaType: "video",
              provider: "huggingface",
              meta: { requestId },
            };
          }
        }
      } catch {
        // fall through
      }
    }
  }

  const age = Date.now() - decoded.createdAt;
  if (age < 5000) {
    return {
      id,
      status: "processing",
      message: "Hugging Face job still in progress.",
      provider: "huggingface",
    };
  }

  return {
    id,
    status: "completed",
    message:
      "Poll window ended. If no mediaUrl appeared, generation may have failed (credits, timeout, or provider limits).",
    mediaUrl: null,
    mediaType: "video",
    provider: "huggingface",
  };
}
