// LLM access via Cloudflare AI Gateway's OpenAI-compat /chat/completions endpoint.
// Default model is Workers AI's free-tier Llama 3.2 vision; swap via LLM_MODEL env var.

import type { Env, LawnRow, MessageRow } from '../types';
import { getZone } from './zones';

type ChatTextBlock = { type: 'text'; text: string };
type ChatImageBlock = { type: 'image_url'; image_url: { url: string } };
type ChatContentBlock = ChatTextBlock | ChatImageBlock;

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentBlock[];
};

const CHEMICAL_KEYWORDS = [
  'fertilizer', 'fertilize', 'fertilization',
  'herbicide', 'pre-emergent', 'pre emergent', 'preemergent', 'post-emergent',
  'pesticide', 'insecticide', 'fungicide',
  'glyphosate', 'roundup', 'tenacity', 'celsius', '2,4-d', 'dimension', 'prodiamine',
  'nitrogen application', 'lbs of n', 'lb n',
];

const DISCLAIMER =
  '_Lawn Buddy is not a licensed professional. Always read product labels and follow local regulations. Keep pets and children off treated areas per the label. If unsure, consult a licensed applicator._';

// Marker that uniquely identifies an already-appended disclaimer block. Used
// to keep maybeAppendDisclaimer idempotent and to strip it from history before
// re-feeding to the LLM.
const DISCLAIMER_MARKER = 'Lawn Buddy is not a licensed professional';

export function maybeAppendDisclaimer(content: string): string {
  if (content.includes(DISCLAIMER_MARKER)) return content;
  const lower = content.toLowerCase();
  if (CHEMICAL_KEYWORDS.some((k) => lower.includes(k))) {
    return `${content}\n\n---\n${DISCLAIMER}`;
  }
  return content;
}

// Remove any platform-appended disclaimer (and its preceding rule) from a
// historical assistant message before feeding it back to the LLM. Prevents
// the model from copying the pattern and emitting its own disclaimer.
export function stripDisclaimer(content: string): string {
  const idx = content.indexOf(DISCLAIMER_MARKER);
  if (idx === -1) return content;
  // Walk back to the start of the disclaimer block, eating the leading rule
  // ("\n\n---\n_") and any whitespace.
  return content.slice(0, idx).replace(/\n*-{3,}\s*\n*_?\s*$/, '').trimEnd();
}

export function buildSystemPrompt(lawn: LawnRow, now: Date = new Date()): string {
  const zone = getZone(lawn.climate_zone);
  const intake = lawn.intake_json ? JSON.parse(lawn.intake_json) : null;
  const soil = lawn.soil_test_json ? JSON.parse(lawn.soil_test_json) : null;

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const lines = [
    'You are Lawn Buddy, a knowledgeable, practical lawn-care assistant for US and Canadian homeowners.',
    'Your job is to give specific, actionable advice tailored to the user\'s lawn profile.',
    '',
    `Today's date: ${dateStr}. Use this when reasoning about season, grass growth stage, and timing of treatments — do not guess the month.`,
    '',
    'Guidelines:',
    '- Be concise and direct. Lead with the next action.',
    '- Tailor advice to the user\'s climate zone and grass season (warm/cool/transition).',
    '- When recommending products or chemicals, name an active ingredient and give a rate per 1000 sq ft.',
    '- If a question requires information you don\'t have (recent soil test, photo of the issue, etc.), ask for it before guessing.',
    '- Avoid generic advice that could apply to any lawn.',
    '- Only reference photos when one is actually attached to the current user message. If no photo is attached, reason from the profile and conversation only — do not invent or assume visual details.',
    '- Do not append legal or safety disclaimers, license warnings, or "consult a professional" boilerplate. The platform adds those automatically when relevant.',
    '',
    `Lawn profile — name: ${lawn.name}`,
  ];

  if (zone) {
    lines.push(
      `Climate: ${zone.state} / ${zone.region} (USDA ${zone.usdaZone}, ${zone.grassSeason}-season region)`
    );
  } else {
    lines.push(`Climate zone id: ${lawn.climate_zone}`);
  }

  if (intake) {
    lines.push('Intake:');
    if (intake.size_sqft) lines.push(`  - size: ${intake.size_sqft} sq ft`);
    if (intake.sun_exposure) lines.push(`  - sun: ${intake.sun_exposure}`);
    if (intake.irrigation) lines.push(`  - irrigation: ${intake.irrigation}`);
    if (intake.mowing_frequency) lines.push(`  - mowing: ${intake.mowing_frequency}`);
    if (Array.isArray(intake.current_issues) && intake.current_issues.length)
      lines.push(`  - current issues: ${intake.current_issues.join(', ')}`);
    if (intake.notes) lines.push(`  - notes: ${intake.notes}`);
  } else {
    lines.push('Intake: not provided yet');
  }

  if (soil && Object.keys(soil).length) {
    const parts = Object.entries(soil)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(`Soil test: ${parts}`);
  } else {
    lines.push('Soil test: not provided');
  }

  return lines.join('\n');
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function buildImageBlock(
  env: Env,
  r2Key: string
): Promise<ChatImageBlock | null> {
  const obj = await env.PHOTOS.get(r2Key);
  if (!obj) return null;
  const buf = await obj.arrayBuffer();
  const mediaType = obj.httpMetadata?.contentType ?? 'image/jpeg';
  if (!SUPPORTED_IMAGE_TYPES.has(mediaType)) return null;
  return imageBlockFromBuffer(buf, mediaType);
}

export function imageBlockFromBuffer(buf: ArrayBuffer, mediaType: string): ChatImageBlock {
  return {
    type: 'image_url',
    image_url: { url: `data:${mediaType};base64,${arrayBufferToBase64(buf)}` },
  };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Convert a stored message row into a ChatMessage, attaching any referenced photos.
// Assistant messages have any platform-appended disclaimer stripped so the model
// doesn't see the pattern and reproduce it in its next reply.
export async function rowToChatMessage(
  env: Env,
  row: MessageRow,
  photoR2Keys: Map<string, string>
): Promise<ChatMessage> {
  const blocks: ChatContentBlock[] = [];
  const photoIds: string[] = row.photo_ids_json ? JSON.parse(row.photo_ids_json) : [];
  for (const pid of photoIds) {
    const key = photoR2Keys.get(pid);
    if (!key) continue;
    const block = await buildImageBlock(env, key);
    if (block) blocks.push(block);
  }
  const text = row.role === 'assistant' ? stripDisclaimer(row.content) : row.content;
  if (text) blocks.push({ type: 'text', text });
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(empty)' });
  return { role: row.role, content: blocks };
}

export type LlmCallResult = {
  content: string;
  finishReason: string | null;
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export async function callLlm(
  env: Env,
  system: string,
  messages: ChatMessage[],
  maxTokens = 1024
): Promise<LlmCallResult> {
  if (!env.CF_ACCOUNT_ID || !env.CF_AI_GATEWAY_ID) {
    throw new Error('CF_ACCOUNT_ID and CF_AI_GATEWAY_ID must be set in wrangler.toml [vars]');
  }
  if (!env.LLM_PROVIDER_TOKEN) {
    throw new Error(
      'LLM_PROVIDER_TOKEN is not set. Add it to .dev.vars locally or set as a secret for production. ' +
        'For Workers AI, mint a CF API token with Workers AI: Read+Run permission.'
    );
  }

  const url = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/compat/chat/completions`;

  const body = {
    model: env.LLM_MODEL || 'workers-ai/@cf/meta/llama-3.2-11b-vision-instruct',
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: maxTokens,
  };

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${env.LLM_PROVIDER_TOKEN}`,
  };
  if (env.CF_AI_GATEWAY_TOKEN) {
    headers['cf-aig-authorization'] = `Bearer ${env.CF_AI_GATEWAY_TOKEN}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM gateway ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: unknown };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  // Cloudflare's compat layer can return message.content in three shapes:
  //   - string (default text output)
  //   - array of typed blocks: [{ type: 'text', text: '...' }]
  //   - object (pre-parsed JSON, when the model produced valid JSON)
  // Normalize to a string so downstream code (stripJsonFence, JSON.parse) works.
  const rawContent: unknown = data.choices?.[0]?.message?.content;
  let text = '';
  if (typeof rawContent === 'string') {
    text = rawContent;
  } else if (Array.isArray(rawContent)) {
    text = rawContent
      .map((b: any) => (b && typeof b.text === 'string' ? b.text : ''))
      .join('');
  } else if (rawContent && typeof rawContent === 'object') {
    text = JSON.stringify(rawContent);
  }
  return {
    content: text.trim(),
    finishReason: data.choices?.[0]?.finish_reason ?? null,
    usage: data.usage ?? null,
  };
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return fence ? fence[1]!.trim() : trimmed;
}

export async function callLlmJson<T>(
  env: Env,
  system: string,
  userText: string,
  maxTokens = 1024
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ];
  const result = await callLlm(env, system, messages, maxTokens);
  const cleaned = stripJsonFence(result.content);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}
