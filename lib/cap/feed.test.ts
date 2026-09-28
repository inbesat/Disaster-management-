// Public CAP feed — RSS/Atom builder tests.
import { describe, it, expect } from "vitest";
import { buildCapAtomFeed, buildCapRssFeed, toFeedItems } from "./feed";

const ROWS = [
  {
    alertId: "dl-evt1-abc",
    capXml:
      "<alert><info><headline>Flood Warning: Patna</headline>" +
      "<description>Evacuate low-lying areas.</description></info></alert>",
    severity: "Severe",
    language: "hi-IN",
    createdAt: new Date("2026-08-12T07:00:00Z"),
  },
];

describe("public CAP feed", () => {
  it("reduces rows to items with per-alert links", () => {
    const items = toFeedItems(ROWS, "https://example.in");
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe("Flood Warning: Patna");
    expect(items[0].link).toBe("https://example.in/api/cap/dl-evt1-abc");
  });

  it("builds RSS 2.0", () => {
    const rss = buildCapRssFeed(toFeedItems(ROWS, "https://example.in"), "https://example.in");
    expect(rss).toContain("<rss version=\"2.0\">");
    expect(rss).toContain("Flood Warning: Patna");
    expect(rss).toContain("dl-evt1-abc");
  });

  it("builds Atom 1.0", () => {
    const atom = buildCapAtomFeed(toFeedItems(ROWS, "https://example.in"), "https://example.in");
    expect(atom).toContain("<feed xmlns=\"http://www.w3.org/2005/Atom\">");
    expect(atom).toContain("Flood Warning: Patna");
  });

  it("escapes XML metacharacters", () => {
    const items = toFeedItems(
      [{ ...ROWS[0], capXml: "<alert><info><headline>A & B <C></headline><description>D</description></info></alert>" }],
      "https://example.in",
    );
    const rss = buildCapRssFeed(items, "https://example.in");
    expect(rss).toContain("A &amp; B &lt;C&gt;");
  });
});
