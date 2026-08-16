/**
 * Provider registry / factory.
 * Switch providers via AI_PROVIDER env (default: mock).
 * Future: seedance, etc. — no app rewrite needed.
 */

import * as mock from './mock.js';
import * as huggingface from './huggingface.js';

const providers = {
  mock,
  huggingface,
  // seedance: add later when you choose a paid path
};

/**
 * Resolve active provider. Defaults to mock. Never throws on unknown — falls back to mock.
 */
export function getProvider() {
  const name = (process.env.AI_PROVIDER || 'mock').toLowerCase().trim();
  const provider = providers[name];
  if (!provider) {
    console.warn(`[providers] Unknown AI_PROVIDER="${name}", using mock`);
    return providers.mock;
  }
  return provider;
}

export { providers };
