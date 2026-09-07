// Thin, dependency-free client for the two supported providers. Kept deliberately
// small (raw fetch, no SDK) so the app has few moving parts to install and audit.
// API keys are passed in per-request from the browser and are never written to
// disk or logged.

const { PROVIDERS } = require('../config/models');

class LLMError extends Error {}

async function callAnthropic({ apiKey, model, system, messages, maxTokens = 4000, temperature = 0.7 }) {
  const res = await fetch(PROVIDERS.anthropic.apiBase, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: maxTokens,
      temperature,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new LLMError(`Anthropic API error (${res.status}): ${data?.error?.message || res.statusText}`);
  }
  const text = (data.content || []).map((c) => c.text || '').join('\n');
  return { text, raw: data };
}

async function callOpenAI({ apiKey, model, system, messages, maxTokens = 4000, temperature = 0.7 }) {
  const res = await fetch(PROVIDERS.openai.apiBase, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))]
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new LLMError(`OpenAI API error (${res.status}): ${data?.error?.message || res.statusText}`);
  }
  const text = data.choices?.[0]?.message?.content || '';
  return { text, raw: data };
}

/**
 * Send one chat-style request to the chosen provider.
 * @param {object} opts
 * @param {'anthropic'|'openai'} opts.provider
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.system
 * @param {{role:'user'|'assistant', content:string}[]} opts.messages
 */
async function chat({ provider, apiKey, model, system, messages, maxTokens, temperature }) {
  if (!apiKey) throw new LLMError(`Missing API key for provider "${provider}".`);
  if (provider === 'anthropic') return callAnthropic({ apiKey, model, system, messages, maxTokens, temperature });
  if (provider === 'openai') return callOpenAI({ apiKey, model, system, messages, maxTokens, temperature });
  throw new LLMError(`Unknown provider "${provider}".`);
}

/** Extract the first JSON object/array found in a model response, tolerating
 * markdown code fences and stray prose around it. */
function extractJSON(text) {
  if (!text) throw new LLMError('Empty model response.');
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  // Find the outermost balanced JSON structure.
  const start = cleaned.search(/[{[]/);
  if (start === -1) throw new LLMError('No JSON found in model response.');
  const openChar = cleaned[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === openChar) depth++;
    else if (cleaned[i] === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new LLMError('Unbalanced JSON in model response.');
  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new LLMError(`Could not parse JSON from model response: ${e.message}`);
  }
}

module.exports = { chat, extractJSON, LLMError };
