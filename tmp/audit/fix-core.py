from pathlib import Path
p=Path('lib/ai-bridge/cloud-provider.ts');s=p.read_text();s=s.replace('  ) {}\n\n  private doFetch: (input: string, init?: RequestInit) => Promise<Response> =\n    this.options.fetchImpl ?? (globalThis.fetch as typeof fetch);','  ) {\n    this.doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);\n  }\n\n  private doFetch: (input: string, init?: RequestInit) => Promise<Response>;')
a=s.index('  // Whole-body JSON array');b=s.index('  // Line-oriented',a)
s=s[:a]+'''  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { /* Parse SSE below. */ }
  if (Array.isArray(parsed)) return joinParts(parsed);
  if (parsed && typeof parsed === "object") {
    const payload = parsed as { error?: unknown; message?: string };
    if (payload.error) throw new Error(typeof payload.error === "string" ? payload.error : "AI request failed");
    if (typeof payload.message === "string") return payload.message;
    throw new Error("Unrecognized AI response.");
  }

'''+s[b:];p.write_text(s)
p=Path('app/api/predict/route.ts');s=p.read_text();s=s.replace('  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {','  if (!request.nextUrl.searchParams.has("lat") || !request.nextUrl.searchParams.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {');a=s.index('  // -----------------------------------------------------------------------');s=s[:a]+'''  if (typeParam && (!DISASTER_TYPES.includes(typeParam as DisasterType) || disasterType !== "flood")) {
    return NextResponse.json({ error: "A trained prediction model is only available for flood risk." }, { status: 422 });
  }
  if (!Number.isFinite(elevation) || elevation < 0 || !Number.isFinite(rainfall) || rainfall < 0 || (saturationParam !== null && (!Number.isFinite(saturation) || saturation < 0 || saturation > 100))) {
    return NextResponse.json({ error: "Invalid rainfall, elevation or saturation." }, { status: 400 });
  }
  if (!request.nextUrl.searchParams.has("rainfall")) {
    return NextResponse.json({ error: "Measured 72-hour cumulative rainfall is required." }, { status: 400 });
  }
  try {
    const prediction = await getFloodPrediction(lat, lng, rainfallMm, elevation, options);
    return NextResponse.json({ ok: true, disasterType, ...prediction, limitations: "Experimental model; river trend and soil saturation may be estimated. Not an official warning." });
  } catch {
    return NextResponse.json({ ok: false, source: "unavailable", error: "Flood prediction service is unavailable. Risk is unknown; consult official alerts." }, { status: 503 });
  }
}
''';p.write_text(s)
p=Path('lib/ml-client.ts');s=p.read_text();a=s.index('function fallback(');b=s.index('export async function getFloodPrediction',a);s=s[:a]+s[b:];s=s.replace('source: "ml" | "fallback"','source: "ml"');a=s.index('    const classIndex =');b=s.index('    return {\n      riskLevel,',a);s=s[:a]+'''    const classIndex = data.predicted_risk_class;
    const confidenceScore = data.confidence_score;
    if (!Number.isInteger(classIndex) || classIndex < 0 || classIndex >= RISK_LABELS.length || !Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1) {
      throw new Error("Invalid model response");
    }
    const riskLevel = RISK_LABELS[classIndex];
    // Prediction requests never dispatch alerts unless explicitly enabled by an operator.
    if (process.env.ML_AUTO_ALERTS_ENABLED === "true") await maybeTriggerAlert(lat, lng, riskLevel);
    try {
      await prisma.floodPrediction.create({ data: {
        lat, lng, predictionTimestamp: new Date(), riskLevel, confidenceScore,
        rawModelOutput: { ...data, metadata: { district: nearestDistrict(lat, lng).name, experimental: true } },
      } });
    } catch { console.warn("[ml] Prediction generated but history could not be saved."); }

'''+s[b:];s=s.replace('    console.warn("ML service unreachable, returning default \'Safe\':", error);\n    return fallback(lat, lng);','    throw new Error("Flood model unavailable", { cause: error });');p.write_text(s)
p=Path('app/api/live-conditions/route.ts');s=p.read_text().replace('  if (Number.isNaN(lat) || Number.isNaN(lng)) {','  if (!request.nextUrl.searchParams.has("lat") || !request.nextUrl.searchParams.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {');p.write_text(s)
p=Path('lib/data-ingestion/fetcher.ts');s=p.read_text().replace('as { weather?: { rainfall_mm?: number } };','as { source?: string; weather?: { rainfall_mm?: number } };\n    if (weather.source === "mock" || weather.source === "synthetic") throw new Error("Weather source is simulated");');p.write_text(s)
p=Path('lib/agents/nodes/action-nodes.ts');s=p.read_text().replace('const remaining = { ...inventory };','const remaining = Object.fromEntries(Object.entries(inventory).map(([key, value]) => [key, Math.max(0, Math.floor(value * limit / 100))]));').replace('Math.max(0, Math.floor(available * limit / 100))','Math.max(0, available)');p.write_text(s)
p=Path('lib/agents/graph-state.ts');s=p.read_text().replace('reducer: appendAllocations,','reducer: (_left, right) => right,');a=s.index('/** Reducer for the `resourceAllocations`');b=s.index('export const EmergencyStateAnnotation',a);s=s[:a]+s[b:];p.write_text(s)
p=Path('app/api/chat/route.ts');s=p.read_text().replace('const result = await original(input, options);','const result = await Promise.race([original(input, options), new Promise(resolve => setTimeout(() => resolve({ error: "Live tool data unavailable; do not invent values." }), 3000))]);');p.write_text(s)
p=Path('app/api/integrations/route.ts');s=p.read_text().replace('export const dynamic', 'import { createRateLimiter } from "@/lib/security/rate-limit";\nconst limiter = createRateLimiter(20, 60_000);\nexport const dynamic').replace('  const kind =', '  const rate = limiter(request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anonymous");\n  if (!rate.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });\n  const kind =');p.write_text(s)
p=Path('next.config.mjs');s=p.read_text().replace('ignoreBuildErrors: true','ignoreBuildErrors: false').replace('ignoreDuringBuilds: true','ignoreDuringBuilds: false').replace('// Hackathon deadline: skip TypeScript checking at build time','// Require compiler validation for releases').replace('// Hackathon deadline: skip ESLint at build time','// Require lint validation for releases');p.write_text(s)
print('Fixed chat initialization, restored prediction service and tightened graph allocations.')
