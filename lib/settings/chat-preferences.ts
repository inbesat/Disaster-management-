import { readStoredAiSettings } from "./ai-settings";

/** Only non-secret preferences leave the browser. */
export function readChatPreferences() {
  const saved = readStoredAiSettings();
  return saved
    ? {
        provider: saved.provider,
        responseVerbosity: saved.responseVerbosity,
        personality: saved.personality,
      }
    : {};
}

export function chatStyleInstruction(verbosity: unknown, personality: unknown) {
  const length = {
    concise: "Keep the answer brief and prioritize the next steps.",
    balanced: "Use a balanced amount of detail.",
    detailed: "Explain relevant reasoning, assumptions, and concrete steps.",
  };
  const tone = {
    professional: "Use a clear, professional tone.",
    collaborative: "Use a supportive, collaborative tone and explain available options.",
    urgent: "Lead with immediate priorities, using short, direct sentences.",
  };
  return [
    typeof verbosity === "string" && Object.hasOwn(length, verbosity)
      ? length[verbosity as keyof typeof length]
      : "",
    typeof personality === "string" && Object.hasOwn(tone, personality)
      ? tone[personality as keyof typeof tone]
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
