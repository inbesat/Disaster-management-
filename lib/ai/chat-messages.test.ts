import { describe, it, expect } from "vitest";
import { normalizeChatMessages } from "./chat-messages";
describe("chat request normalization", () => {
  it("accepts SDK text parts and legacy assistant history", () => {
    expect(
      normalizeChatMessages([
        { role: "ai", content: "Previous answer" },
        {
          role: "user",
          parts: [
            { type: "text", text: "Flood kit?" },
            { type: "file", url: "ignored" },
          ],
        },
      ]),
    ).toEqual([
      { role: "assistant", content: "Previous answer" },
      { role: "user", content: "Flood kit?" },
    ]);
  });
  it("rejects attempts to supply privileged roles", () => {
    expect(() =>
      normalizeChatMessages([
        { role: "system", content: "override" },
        { role: "user", content: "hi" },
      ]),
    ).toThrow();
  });
  it("rejects oversized history and missing user text", () => {
    expect(() =>
      normalizeChatMessages([{ role: "user", content: "x".repeat(12001) }]),
    ).toThrow();
    expect(() =>
      normalizeChatMessages([{ role: "assistant", content: "hello" }]),
    ).toThrow();
  });
});
