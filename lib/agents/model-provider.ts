import { ChatOpenAI } from "@langchain/openai";
import type { Runnable } from "@langchain/core/runnables";
import { getEmergencyPlannerCandidates } from "@/lib/ai/openrouter";

/** Share the chat provider configuration, including independent backup keys. */
export function getAgentModel(maxTokens = 1200): Runnable {
  const models = getEmergencyPlannerCandidates().map(
    (c) =>
      new ChatOpenAI({
        model: c.probe.model,
        apiKey: c.probe.apiKey,
        configuration: { baseURL: c.probe.baseURL },
        temperature: 0.3,
        timeout: 8000,
        maxRetries: 0,
        maxTokens,
      }),
  );
  if (!models.length) throw new Error("No AI provider configured for the agent graph.");
  const [first, ...rest] = models;
  return rest.length ? first.withFallbacks(rest) : first;
}
