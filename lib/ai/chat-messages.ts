/** Accept text conversations from useChat (parts) and native/legacy clients (content). */
export function normalizeChatMessages(
  input: unknown,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(input) || !input.length || input.length > 40)
    throw new Error("Send between 1 and 40 messages.");
  let total = 0;
  const messages = input
    .map((value: unknown) => {
      if (!value || typeof value !== "object") throw new Error("Invalid message.");
      const m = value as Record<string, unknown>;
      const role = m.role === "ai" ? "assistant" : m.role;
      if (role !== "user" && role !== "assistant")
        throw new Error("Only user and assistant messages are accepted.");
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.parts)
            ? m.parts
                .filter(
                  (p: unknown): p is { type: "text"; text: string } =>
                    !!p &&
                    typeof p === "object" &&
                    "type" in p &&
                    p.type === "text" &&
                    "text" in p &&
                    typeof p.text === "string",
                )
                .map((p) => p.text)
                .join("\n")
            : "";
      if (content.length > 12000) throw new Error("Message is too long.");
      total += content.length;
      return { role, content: content.trim() };
    })
    .filter((m) => m.content);
  if (!messages.length || messages[messages.length - 1].role !== "user")
    throw new Error("A user message is required.");
  if (total > 32000) throw new Error("Conversation is too long. Start a new chat.");
  return messages as Array<{ role: "user" | "assistant"; content: string }>;
}
