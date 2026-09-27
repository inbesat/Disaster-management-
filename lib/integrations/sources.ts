import { hasKey } from "@/lib/ai/openrouter";
export const integrationKeys = {
  groq: ["GROQ_API_KEY", "GROQ_API_KEY_BACKUP"],
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY_BACKUP"],
  bluesminds: ["BLUESMINDS_API_KEY"],
  huggingface: ["HF_TOKEN"],
  weather: ["OPENWEATHER_API_KEY"],
  news: ["NEWSDATA_API_KEY"],
  search: ["SERPAPI_API_KEY"],
  nasa: ["NASA_API_KEY"],
  countries: ["REST_COUNTRIES_API_KEY"],
  notion: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
} as const;
export function configuredIntegrations() {
  return Object.entries(integrationKeys).map(([id, keys]) => ({
    id,
    configured:
      id === "notion"
        ? keys.every((k) => hasKey(process.env[k]))
        : keys.some((k) => hasKey(process.env[k])),
  }));
}
/** URLs are constructed by trusted adapters; never accepts arbitrary user URLs. */
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}
export async function naturalEvents() {
  const data = await read(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20&days=30",
  );
  return {
    source: "NASA EONET",
    fetchedAt: new Date().toISOString(),
    events: data.events ?? [],
  };
}
export async function spaceWeather() {
  const key = process.env.NASA_API_KEY;
  if (!hasKey(key)) throw new Error("NASA_API_KEY is not configured");
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const data = await read(
    `https://api.nasa.gov/DONKI/notifications?startDate=${start}&type=all&api_key=${encodeURIComponent(key)}`,
  );
  return {
    source: "NASA DONKI",
    fetchedAt: new Date().toISOString(),
    notifications: data,
  };
}
export async function countryInformation(country: string) {
  const key = process.env.REST_COUNTRIES_API_KEY;
  if (!hasKey(key)) throw new Error("REST_COUNTRIES_API_KEY is not configured");
  return {
    source: "REST Countries",
    data: await read(
      `https://api.restcountries.com/countries/v5?q=${encodeURIComponent(country)}&api-key=${encodeURIComponent(key)}`,
    ),
  };
}
export async function notionDocuments() {
  const token = process.env.NOTION_TOKEN,
    database = process.env.NOTION_DATABASE_ID;
  if (!hasKey(token) || !database || !/^[a-f0-9-]{32,36}$/i.test(database))
    throw new Error("Notion database is not configured");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
  };
  const db = await read(`https://api.notion.com/v1/databases/${database}`, { headers });
  const sourceId = process.env.NOTION_DATA_SOURCE_ID || db.data_sources?.[0]?.id;
  if (!sourceId || !/^[a-f0-9-]{32,36}$/i.test(sourceId))
    throw new Error("No accessible Notion data source");
  const data = await read(`https://api.notion.com/v1/data_sources/${sourceId}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ page_size: 50 }),
  });
  return {
    source: "Notion",
    hasMore: Boolean(data.has_more),
    documents: (data.results ?? []).map(
      (page: {
        id: string;
        url: string;
        properties?: Record<string, { title?: Array<{ plain_text?: string }> }>;
      }) => ({
        id: page.id,
        url: page.url,
        title: Object.values(page.properties ?? {})
          .flatMap((p) => p.title ?? [])
          .map((t) => t.plain_text || "")
          .join(""),
      }),
    ),
  };
}
