// Central place to describe which models are available per provider, and which
// one to pick automatically for a given kind of task. Providers and model line-ups
// change faster than this app does -- if a call starts failing with a
// "model not found" style error, this is the file to update. Everything here can
// also be overridden per-request from the UI ("Override with an exact model ID"
// under the Model dropdown), so a stale default never locks anyone out -- that
// override is the reliable fix; treat the defaults below as best-effort.
//
// The OpenAI model IDs here are NOT independently verified against a live
// OpenAI account (this app has no standing connection to OpenAI to check
// against) -- if one 404s as "does not exist", use the UI override with a
// model ID from your own OpenAI dashboard/docs rather than assuming the app
// is broken.

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    apiBase: 'https://api.anthropic.com/v1/messages',
    // "flagship" = highest-quality reasoning/writing, used for the actual resume
    // and cover-letter rewriting. "fast" = cheaper/quicker, used for JD keyword
    // extraction and the small condense/expand edits during page-fitting.
    models: {
      flagship: 'claude-opus-5',
      balanced: 'claude-sonnet-5',
      fast: 'claude-haiku-4-5-20251001'
    }
  },
  openai: {
    label: 'OpenAI (GPT)',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    models: {
      flagship: 'gpt-4.1',
      balanced: 'gpt-4.1',
      fast: 'gpt-4.1-mini'
    }
  }
};

// Auto-select which provider to use when the user leaves the model choice on
// "Auto". Preference order only matters when the user has supplied more than
// one provider's API key -- otherwise whichever single key is present wins.
const AUTO_PROVIDER_PREFERENCE = ['anthropic', 'openai'];

function listAvailableProviders(apiKeys = {}) {
  return Object.keys(PROVIDERS).filter((p) => apiKeys[p] && apiKeys[p].trim().length > 0);
}

/**
 * Decide which provider + model tier to use.
 * @param {object} apiKeys - { anthropic?: string, openai?: string }
 * @param {'flagship'|'balanced'|'fast'} tier
 * @param {object} override - { provider?: string, model?: string } explicit user choice
 */
function selectModel(apiKeys = {}, tier = 'flagship', override = {}) {
  // Default parameters only apply for `undefined` -- the frontend sends an
  // explicit `null` for "Auto", so normalize that here too.
  override = override || {};
  if (override.provider && override.model) {
    return { provider: override.provider, model: override.model, auto: false };
  }

  const available = listAvailableProviders(apiKeys);
  if (available.length === 0) {
    throw new Error(
      'No LLM API key was supplied. Add at least one provider key (Anthropic or OpenAI) in the API Keys panel.'
    );
  }

  let provider = override.provider && available.includes(override.provider) ? override.provider : null;
  if (!provider) {
    provider = AUTO_PROVIDER_PREFERENCE.find((p) => available.includes(p)) || available[0];
  }

  const model = (override.model && override.model.trim()) || PROVIDERS[provider].models[tier] || PROVIDERS[provider].models.flagship;
  return { provider, model, auto: !override.model };
}

module.exports = { PROVIDERS, AUTO_PROVIDER_PREFERENCE, listAvailableProviders, selectModel };
