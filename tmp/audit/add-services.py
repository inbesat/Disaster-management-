from pathlib import Path
files={
'lib/integrations/sources.ts':'''import { hasKey } from "@/lib/ai/openrouter";
export const integrationKeys = {
  groq: ["GROQ_API_KEY", "GROQ_API_KEY_BACKUP"], openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY_BACKUP"],
  bluesminds: ["BLUESMINDS_API_KEY"], huggingface: ["HF_TOKEN"], weather: ["OPENWEATHER_API_KEY"],
  news: ["NEWSDATA_API_KEY"], search: ["SERPAPI_API_KEY"], nasa: ["NASA_API_KEY"],
  countries: ["REST_COUNTRIES_API_KEY"], notion: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
} as const;
export function configuredIntegrations() {
  return Object.entries(integrationKeys).map(([id, keys]) => ({ id, configured: id === "notion" ? keys.every(k => hasKey(process.env[k])) : keys.some(k => hasKey(process.env[k])) }));
}
/** URLs are constructed by trusted adapters; never accepts arbitrary user URLs. */
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}
export async function naturalEvents() {
  const data = await read("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20&days=30");
  return { source: "NASA EONET", fetchedAt: new Date().toISOString(), events: data.events ?? [] };
}
export async function spaceWeather() {
  const key = process.env.NASA_API_KEY;
  if (!hasKey(key)) throw new Error("NASA_API_KEY is not configured");
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const data = await read(`https://api.nasa.gov/DONKI/notifications?startDate=${start}&type=all&api_key=${encodeURIComponent(key)}`);
  return { source: "NASA DONKI", fetchedAt: new Date().toISOString(), notifications: data };
}
export async function countryInformation(country: string) {
  const key = process.env.REST_COUNTRIES_API_KEY;
  if (!hasKey(key)) throw new Error("REST_COUNTRIES_API_KEY is not configured");
  return { source: "REST Countries", data: await read(`https://api.restcountries.com/countries/v5?q=${encodeURIComponent(country)}&api-key=${encodeURIComponent(key)}`) };
}
export async function notionDocuments() {
  const token = process.env.NOTION_TOKEN, database = process.env.NOTION_DATABASE_ID;
  if (!hasKey(token) || !database || !/^[a-f0-9-]{32,36}$/i.test(database)) throw new Error("Notion database is not configured");
  const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" };
  const db = await read(`https://api.notion.com/v1/databases/${database}`, { headers });
  const sourceId = process.env.NOTION_DATA_SOURCE_ID || db.data_sources?.[0]?.id;
  if (!sourceId || !/^[a-f0-9-]{32,36}$/i.test(sourceId)) throw new Error("No accessible Notion data source");
  const data = await read(`https://api.notion.com/v1/data_sources/${sourceId}/query`, { method: "POST", headers, body: JSON.stringify({ page_size: 50 }) });
  return { source: "Notion", hasMore: Boolean(data.has_more), documents: (data.results ?? []).map((page: any) => ({
    id: page.id, url: page.url, title: Object.values(page.properties ?? {}).flatMap((p: any) => p.title ?? []).map((t: any) => t.plain_text || "").join(""),
  })) };
}
''',
'app/api/integrations/route.ts':'''import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import { configuredIntegrations, naturalEvents, spaceWeather, countryInformation, notionDocuments } from "@/lib/integrations/sources";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("source");
  if (kind !== "events" && kind !== "space-weather" && kind !== "country") {
    const auth = await requireRole(["district_admin", "super_admin"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    if (kind === "events") return NextResponse.json(await naturalEvents());
    if (kind === "space-weather") return NextResponse.json(await spaceWeather());
    if (kind === "country") {
      const q = request.nextUrl.searchParams.get("q")?.trim();
      if (!q || q.length > 80) return NextResponse.json({ error: "Country query is required (max 80 characters)." }, { status: 400 });
      return NextResponse.json(await countryInformation(q));
    }
    if (kind === "notion") return NextResponse.json(await notionDocuments());
    return NextResponse.json({ integrations: configuredIntegrations() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Integration unavailable" }, { status: 503 });
  }
}
''',
'app/(dashboard)/settings/integrations/page.tsx':'''"use client";
import { useEffect, useState } from "react";
type Integration = { id: string; configured: boolean };
export default function IntegrationsSettingsPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => { void fetch("/api/integrations").then(async r => {
    const data = await r.json(); if (!r.ok) throw new Error(data.error); setItems(data.integrations);
  }).catch(e => setError(e.message)); }, []);
  async function preview(source: string) {
    setResult("Loading…");
    try { const r = await fetch(`/api/integrations?source=${source}`); const data = await r.json();
      setResult(r.ok ? JSON.stringify(data, null, 2) : data.error);
    } catch { setResult("Could not reach this source."); }
  }
  return <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
    <h1 className="text-2xl font-semibold">Integrations</h1>
    <p className="text-sm text-muted">Connections use server configuration. Configured means credentials are present; it does not guarantee provider access or quota.</p>
    {error && <p role="alert">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-border bg-secondary p-4">
      <h2 className="font-semibold capitalize">{item.id}</h2><p className="mt-2 text-sm">{item.configured ? "Configured on server" : "Not configured"}</p>
    </article>)}</div>
    <div className="flex flex-wrap gap-3">{[["events", "Natural events"], ["space-weather", "Space weather"], ["notion", "Notion documents"], ["country&q=India", "Country information"]].map(([source, label]) => <button key={source} className="min-h-11 rounded-lg border border-border px-4 py-2" onClick={() => void preview(source)}>{label}</button>)}</div>
    {result && <pre aria-live="polite" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-4 text-xs">{result}</pre>}
  </section>;
}
'''}
for name,content in files.items():
 p=Path(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
p=Path('lib/security/require-role.test.ts');s=p.read_text().replace('it("admits the demo cookie session when no Supabase user is signed in", async () => {','it("admits an explicitly enabled demo cookie session", async () => {\n    vi.stubEnv("DEMO_AUTH_ENABLED", "true");');p.write_text(s)
p=Path('lib/ai/AIBridge.ts');s=p.read_text().replace('export interface RouteChatDeps {','export interface RouteChatDeps {\n  history?: import("@/lib/ai-bridge/types").ChatMessage[];');s=s.replace('const cloudRoute = deps.cloudRoute ?? defaultCloudRoute;','const cloudRoute = deps.cloudRoute ?? ((message: string, district: string) => getAIBridge().route(message, { currentDistrict: district, history: deps.history }));');p.write_text(s)
p=Path('components/public/ai/NovaChat.tsx');s=p.read_text().replace('routeChatQuery(trimmed, CHAT_DISTRICT)','routeChatQuery(trimmed, CHAT_DISTRICT, { history: messages.filter(m => m.content).slice(-12).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content! })) })');s=s.replace('return { text: t("nova_reply"), source: "local", engineUsed: "local-fallback" };','return { text: "AI is temporarily unavailable. Please retry. For immediate danger, use SOS or call your local emergency number.", source: "local", engineUsed: "local-fallback" };');s=s.replace('const TYPING_MS = 1800','const TYPING_MS = 150');p.write_text(s)
p=Path('lib/nova/nova-reply.ts');s=p.read_text().replace('text: fbResult.text.trim(),','text: `[Offline guidance] ${fbResult.text.trim()}`,');p.write_text(s)
p=Path('components/public/NovaChat.tsx');s=p.read_text().replace('t("nova_reply") : result.text','"AI is unavailable. Please retry shortly." : result.text').replace('streamReveal(t("nova_reply"));','streamReveal("AI is unavailable. Please retry shortly.");');p.write_text(s)
print('Added real integration status and read-only NASA/Notion/country adapters; fixed Nova history and outage messages.')
