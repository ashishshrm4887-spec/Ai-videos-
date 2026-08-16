/**
 * Mock provider — no external API, no keys.
 * Simulates queue → processing → completed for local/dev and free deploys.
 */

const jobs = new Map();

function delayMs(mode) {
  // Short fake latency so UI can poll
  if (mode === 'text-to-image') return 1500;
  return 2500;
}

/**
 * @param {import('./types.js').CreateJobInput} input
 * @returns {Promise<import('./types.js').JobResult>}
 */
export async function createJob(input) {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const job = {
    id,
    status: 'queued',
    message: 'Mock job queued. No paid provider connected.',
    provider: 'mock',
    mode: input.mode,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio || '9:16',
    duration: input.duration || '5s',
    quality: input.quality || 'Standard',
    createdAt,
    completeAt: createdAt + delayMs(input.mode),
  };
  jobs.set(id, job);

  return {
    id: job.id,
    status: job.status,
    message: job.message,
    provider: job.provider,
  };
}

/**
 * @param {string} id
 * @returns {Promise<import('./types.js').JobResult | null>}
 */
export async function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;

  const now = Date.now();
  if (job.status === 'queued' && now >= job.createdAt + 400) {
    job.status = 'processing';
    job.message = 'Mock provider is processing...';
  }
  if (job.status === 'processing' && now >= job.completeAt) {
    job.status = 'completed';
    job.message = 'Mock generation complete. Connect Hugging Face or another provider for real media.';
    // Placeholder — no real media bytes
    job.mediaUrl = null;
    job.mediaType = job.mode === 'text-to-image' ? 'image' : 'video';
  }

  return {
    id: job.id,
    status: job.status,
    message: job.message,
    mediaUrl: job.mediaUrl ?? null,
    mediaType: job.mediaType ?? null,
    provider: job.provider,
    meta: {
      mode: job.mode,
      prompt: job.prompt,
      aspectRatio: job.aspectRatio,
      duration: job.duration,
      quality: job.quality,
    },
  };
}
