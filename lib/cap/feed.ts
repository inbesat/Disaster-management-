// ---------------------------------------------------------------------
// lib/cap/feed.ts — public CAP pull feed (RSS 2.0 + Atom 1.0).
//
// The dispatcher is push-only: it can only reach stations that handed us
// an endpoint (today: none — every seeded emergency_api_endpoint is NULL
// or placeholder). Real CAP ecosystems work the other way: NDMA/SDMA
// publishes, broadcasters poll. These builders turn stored cap_alerts
// rows into that pull surface so AIR, private stations, newsrooms, NGOs
// and competing platforms can consume us as the source.
//
//   GET /api/cap/feed          → RSS 2.0 (default)
//   GET /api/cap/feed?format=atom → Atom 1.0
//   GET /api/cap/<alertId>     → raw CAP v1.2 XML
//
// Pure functions (rows in, XML out) — unit-tested, no DB import.
// ---------------------------------------------------------------------

export interface CapFeedRow {
  alertId: string;
  capXml: string;
  severity: string | null;
  language: string | null;
  createdAt: Date | string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : "";
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export interface CapFeedItem {
  alertId: string;
  headline: string;
  description: string;
  severity: string;
  language: string;
  link: string;
  pubDate: string;
}

/** Reduce stored rows to feed items (headline/description from the XML). */
export function toFeedItems(rows: CapFeedRow[], baseUrl: string): CapFeedItem[] {
  const base = baseUrl.replace(/\/$/, "");
  return rows.map((row) => {
    const headline = tagValue(row.capXml, "headline") || `Emergency Alert ${row.alertId}`;
    const description =
      tagValue(row.capXml, "description") || tagValue(row.capXml, "instruction") || headline;
    const created = toDate(row.createdAt);
    return {
      alertId: row.alertId,
      headline,
      description,
      severity: row.severity ?? "Unknown",
      language: row.language ?? "hi-IN",
      link: `${base}/api/cap/${encodeURIComponent(row.alertId)}`,
      pubDate: Number.isNaN(created.getTime()) ? new Date().toUTCString() : created.toUTCString(),
    };
  });
}

/** RSS 2.0 feed document. */
export function buildCapRssFeed(items: CapFeedItem[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const now = new Date().toUTCString();
  const entries = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.headline)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <category>${escapeXml(item.severity)}</category>
      <pubDate>${escapeXml(item.pubDate)}</pubDate>
    </item>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n` +
    `  <channel>\n` +
    `    <title>SafeSphere Emergency Alerts (CAP)</title>\n` +
    `    <link>${escapeXml(base)}/api/cap/feed</link>\n` +
    `    <description>Common Alerting Protocol v1.2 emergency alerts — District Disaster Management Authority</description>\n` +
    `    <language>en-in</language>\n` +
    `    <lastBuildDate>${escapeXml(now)}</lastBuildDate>\n` +
    `${entries}\n` +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/** Atom 1.0 feed document. */
export function buildCapAtomFeed(items: CapFeedItem[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const now = new Date().toISOString();
  const entries = items
    .map(
      (item) => `  <entry>
    <title>${escapeXml(item.headline)}</title>
    <link href="${escapeXml(item.link)}" />
    <id>${escapeXml(item.link)}</id>
    <summary>${escapeXml(item.description)}</summary>
    <category term="${escapeXml(item.severity)}" />
    <updated>${escapeXml(new Date(item.pubDate).toISOString())}</updated>
  </entry>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
    `  <title>SafeSphere Emergency Alerts (CAP)</title>\n` +
    `  <link href="${escapeXml(base)}/api/cap/feed?format=atom" rel="self" />\n` +
    `  <updated>${escapeXml(now)}</updated>\n` +
    `  <id>${escapeXml(base)}/api/cap/feed</id>\n` +
    `${entries}\n` +
    `</feed>\n`
  );
}
