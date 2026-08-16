/**
 * Provider contract for AI media generation.
 * All providers must implement createJob + getJob.
 * No secrets belong in this file.
 */

/** @typedef {'text-to-video' | 'image-to-video' | 'text-to-image'} GenerationMode */
/** @typedef {'queued' | 'processing' | 'completed' | 'failed'} JobStatus */

/**
 * @typedef {Object} CreateJobInput
 * @property {GenerationMode} mode
 * @property {string} prompt
 * @property {string} [aspectRatio]
 * @property {string} [duration]
 * @property {string} [quality]
 * @property {string} [imageUrl]
 */

/**
 * @typedef {Object} JobResult
 * @property {string} id
 * @property {JobStatus} status
 * @property {string} [message]
 * @property {string} [mediaUrl]
 * @property {string} [mediaType]  // 'video' | 'image'
 * @property {string} [error]
 * @property {string} [provider]
 * @property {object} [meta]
 */

export const JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'];
export const GENERATION_MODES = ['text-to-video', 'image-to-video', 'text-to-image'];
