import { generateText, isStepCount, type ModelMessage, type Tool } from "ai";
import {
  getEmergencyPlannerCandidates,
  recordGenerationSuccess,
  type ProviderGroup,
} from "./openrouter";

/** Buffer a completed answer so asynchronous provider errors can fall through safely. */
export async function generateAnswer(options: {
  system: string;
  messages: ModelMessage[];
  tools?: Record<string, Tool>;
  preferred?: ProviderGroup;
  signal?: AbortSignal;
}) {
  const deadline = Date.now() + 48_000;
  for (const candidate of getEmergencyPlannerCandidates(options.preferred)) {
    if (options.signal?.aborted) throw new Error("Request cancelled.");
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;
    try {
      const timeout = AbortSignal.timeout(Math.min(12_000, remaining));
      const result = await generateText({
        model: candidate.model,
        system: options.system,
        messages: options.messages,
        tools: options.tools,
        stopWhen: isStepCount(3),
        maxOutputTokens: 1600,
        maxRetries: 0,
        temperature: 0.4,
        abortSignal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout,
      });
      if (!result.text.trim()) throw new Error("Empty model response");
      recordGenerationSuccess(candidate.name);
      return { text: result.text, provider: candidate.name };
    } catch {
      // Never log SDK errors: upstream objects may carry Authorization headers.
      console.warn(
        `[ai-provider] generation failed for ${candidate.name}; trying next configured provider`,
      );
    }
  }
  throw new Error(
    "AI providers are unavailable or rate-limited. Please retry shortly. Offline guidance is available when disconnected.",
  );
}
