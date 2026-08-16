/**
 * Mock provider — serverless-safe, zero external deps.
 * Job state is encoded in the job id so status works across
 * separate Vercel invocations (no in-memory Map).
 *
 * ID format: mock_<createdAtMs>_<durationMs>_<modeCode>_<random>
 */

const MODE_CODE = {
  'text-to-video': 't2v',
  'image-to-video': 'i2v',
  'text-to-image': 't2i',
};

const CODE_MODE = {
  t2v: 'text-to-video',
  i2v: 'image-to-video',
  t2i: 'text-to-image',
};

function delayMs(mode) {
  if (mode === 'text-to-image') return 1500;
  return 2500;
}

function encodeId(createdAt, durationMs, mode) {
  const code = MODE_CODE[mode] || 't2v';
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `mock_${createdAt}_${durationMs}_${code}_${rand}`;
}

/**
 * @param {string} id
 * @returns {{ createdAt: number, durationMs: number, mode: string } | null}
 */
function decodeId(id) {
  if (!id || typeof id !== 'string' || !id.startsWith('mock_')) return null;
  const parts = id.split('_');
  // mock, createdAt, durationMs, modeCode, rand
  if (parts.length < 5) return null;
  const createdAt = Number(parts[1]);
  const durationMs = Number(parts[2]);
  const mode = CODE_MODE[parts[3]];
  if (!Number.isFinite(createdAt) || !Number.isFinite(durationMs) || !mode) {
    return null;
  }
  return { createdAt, durationMs, mode };
}

/**
 * @param {import('./types.js').CreateJobInput} input
 * @returns {Promise<import('./types.js').JobResult>}
 */
export async function createJob(input) {
  const createdAt = Date.now();
  const durationMs = delayMs(input.mode);
  const id = encodeId(createdAt, durationMs, input.mode);

  return {
    id,
    status: 'queued',
    message: 'Mock job queued. No paid provider connected.',
    provider: 'mock',
  };
}

/**
 * Deterministic status from job id + current time.
 * @param {string} id
 * @returns {Promise<import('./types.js').JobResult | null>}
 */
export async function getJob(id) {
  const decoded = decodeId(id);
  if (!decoded) return null;

  const { createdAt, durationMs, mode } = decoded;
  const now = Date.now();
  const age = now - createdAt;
  const completeAt = createdAt + durationMs;
  const processingAt = createdAt + 400;

  /** @type {import('./types.js').JobStatus} */
  let status = 'queued';
  let message = 'Mock job queued. No paid provider connected.';

  if (age >= durationMs || now >= completeAt) {
    status = 'completed';
    message =
      'Mock generation complete. Connect Hugging Face or another provider for real media.';
  } else if (age >= 400 || now >= processingAt) {
    status = 'processing';
    message = 'Mock provider is processing...';
  }

  return {
    id,
    status,
    message,
    mediaUrl: null,
    mediaType: mode === 'text-to-image' ? 'image' : 'video',
    provider: 'mock',
    meta: {
      mode,
      // prompt/settings are not stored server-side in mock mode
    },
  };
}
