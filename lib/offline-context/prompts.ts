// ---------------------------------------------------------------------
// lib/offline-context/prompts.ts — Offline-First Architecture · Phase 5
// Prompt templates tuned for the small local models (Gemma 2B / TinyLlama
// 1.1B). Small models drift without explicit structure, so every prompt is
// framed with:
//
//   • SYSTEM — the disaster-assistant persona (never hallucinate).
//   • CONTEXT — the offline briefing from buildContext().
//   • TASK — the user's question, plus the "say you don't know" escape.
//   • Answer: — a final anchor so the model stops after the reply.
//
// Context is capped at MAX_CONTEXT_TOKENS (Phase 5 deliverable: truncate
// if > 2000 tokens) so the model's attention budget isn't blown on stale
// rows.
// ---------------------------------------------------------------------

/** Phase 5 cap — contexts longer than this are truncated to fit. */
export const MAX_CONTEXT_TOKENS = 2000;

/** Disaster assistant system prompt (shared with WebLLMProvider). */
export const DISASTER_SYSTEM_PROMPT =
  "You are SafeSphere AI, an emergency assistant. " +
  "Use only the provided offline context. Be concise, actionable, and calm. " +
  "If you don't know something, say so clearly. Never hallucinate emergency procedures.";

const SECTION_HEADERS = [
  "=== CURRENT SITUATION",
  "=== NEARBY RESOURCES",
  "=== WEATHER (Next 48h)",
  "=== OFFLINE KNOWLEDGE",
] as const;

/** True when a header boundary is the best truncation point. */
function isSectionBoundary(text: string, index: number): boolean {
  return SECTION_HEADERS.some((h) => text.startsWith(h, index));
}

/**
 * Token-aware truncation for the context block. Trims whole trailing
 * sentences and, when possible, stops at a section boundary so a partial
 * "RESOURCES" table never bleeds into the answer.
 */
export function truncateContext(text: string, maxTokens: number = MAX_CONTEXT_TOKENS): string {
  if (!text) return "";
  // Approximate tokens (~4 chars each).
  const budgetChars = maxTokens * 4;
  if (text.length <= budgetChars) return text;

  // Prefer stopping right before the last section header inside the budget
  // so a partial "RESOURCES" table never bleeds into the answer.
  let end = budgetChars;
  for (let i = 0; i < budgetChars; i += 1) {
    if (isSectionBoundary(text, i)) end = i;
  }

  // Otherwise fall back to a newline boundary.
  if (end === budgetChars) {
    while (end > 0 && text[end] !== "\n") end -= 1;
    if (end <= 0) end = budgetChars;
  }

  return text.slice(0, end) + "\n\n[context truncated to fit the model window]";
}

/** Estimates tokens of a string (~4 chars/token). */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * The full augmented prompt sent to the local model: system + context +
 * question, with the context truncated to MAX_CONTEXT_TOKENS.
 */
export function buildAugmentedPrompt(
  userMessage: string,
  context: string,
  opts: { maxContextTokens?: number } = {},
): string {
  const maxTokens = opts.maxContextTokens ?? MAX_CONTEXT_TOKENS;
  const limited = truncateContext(context, maxTokens);
  return `${DISASTER_SYSTEM_PROMPT}\n\n${limited}\n\nUser Question: ${userMessage}\n\nAnswer:`;
}

export { DISASTER_SYSTEM_PROMPT as DISASTER_PROMPT };
