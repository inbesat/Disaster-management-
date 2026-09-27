from pathlib import Path
p=Path('lib/retrieval/retrieve.ts');s=p.read_text().replace('  limit = 4,\n','  limit = 4,\n  district?: string,\n');s=s.replace('import { prisma }','import { Prisma } from "@prisma/client";\nimport { prisma }',1);s=s.replace('WHERE embedding IS NOT NULL\n','WHERE embedding IS NOT NULL\n          ${district ? Prisma.sql`AND (metadata->>\'district\' = ${district} OR metadata->>\'district\' IS NULL)` : Prisma.empty}\n');s=s.replace('      where: {\n        OR:','      where: {\n        ...(district ? { AND: [{ OR: [{ metadata: { path: ["district"], equals: district } }, { metadata: { path: ["district"], equals: Prisma.AnyNull } }] }] } : {}),\n        OR:');p.write_text(s)
p=Path('lib/rag/vector-search.ts');s=p.read_text();s=s.replace('  const [embedded] = await generateEmbeddings([normalizedQuery]);','  const [embedded] = await generateEmbeddings([normalizedQuery]).catch(() => []);');a=s.index('    if (rows.length === 0) {');b=s.index('\n    return rows.map',a);s=s[:a]+s[b:];s=s.replace('return MOCK_RESULTS.slice(0, topK);','return [];').replace('console.warn("[rag] vector search failed — returning mock results.", error);','console.warn("[rag] vector search unavailable; trying scoped keyword retrieval.");');a=s.index('const MOCK_RESULTS:');b=s.index('/**',a);s=s[:a]+s[b:];p.write_text(s)
p=Path('lib/rag/embeddings.ts');s=p.read_text();s=s.replace('const apiKey = process.env.OPENAI_API_KEY;','const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;');s=s.replace('    console.warn("[rag] No OPENAI_API_KEY — returning mock embeddings.");\n    return chunks.map((text) => ({ text, embedding: mockVector(text) }));','    throw new Error("No embedding provider configured. Use keyword retrieval until embeddings are configured.");');s=s.replace('new OpenAI({ apiKey, baseURL: EMBEDDING_BASE_URL })','new OpenAI({ apiKey, baseURL: process.env.OPENAI_API_KEY ? EMBEDDING_BASE_URL : "https://openrouter.ai/api/v1", timeout: 6000, maxRetries: 0 })');s=s.replace('model: EMBEDDING_MODEL,','model: process.env.OPENAI_API_KEY ? EMBEDDING_MODEL : "openai/text-embedding-3-small",\n      dimensions: EMBEDDING_DIM,');s=s.replace('const embedding = Array.isArray(raw) && raw.length > 0 ? normalize(raw) : mockVector(text);','if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIM || raw.some(v => !Number.isFinite(v))) throw new Error("Invalid embedding dimensions.");\n      const embedding = normalize(raw);');s=s.replace('    console.warn("[rag] Embedding call failed — returning mock embeddings.", error);\n    return chunks.map((text) => ({ text, embedding: mockVector(text) }));','    throw new Error("Embedding service unavailable; no synthetic vectors were stored.");');# preserve original order even when only some embeddings cached
s=s.replace('  return results;\n}', '  const byText = new Map(results.map(item => [item.text, item]));\n  return cleanChunks.map(text => byText.get(text)!);\n}');p.write_text(s)
# AI must never manufacture local operational facts from demo fixtures.
p=Path('lib/ai/tools/shelter-tools.ts');s=p.read_text();a=s.index('function mockShelters');b=s.index('export const getShelterStatus',a);s=s[:a]+s[b:];s=s.replace('if (!rows.length) return { district, shelters: mockShelters(district) };','if (!rows.length) return { district, shelters: [], source: "database", message: "No verified shelters found." };');s=s.replace('return { district, shelters: mockShelters(district) };','return { district, shelters: [], source: "unavailable", error: "Shelter database unavailable. Do not invent shelter locations or capacity." };');s=s.replace('where: { district },','where: { district, isDemo: false },');p.write_text(s)
p=Path('lib/ai/tools/resources-tools.ts');s=p.read_text();a=s.index('function mockInventory');b=s.index('export const getResourceInventory',a);s=s[:a]+s[b:];a=s.index('    try {');s=s[:a]+'''    try {
      // Resources have coordinates rather than a district column. Restrict to
      // verified depots whose labels explicitly identify the requested district.
      const rows = await prisma.resource.findMany({
        where: { isDemo: false, depotName: { contains: district, mode: "insensitive" }, ...(category ? { category } : {}) },
        select: { id: true, name: true, category: true, quantity: true, unit: true, status: true, depotName: true },
        take: 50,
      });
      return { district, resources: rows, source: "database", coverage: "District-labelled depots only; unassigned depots require operator review." };
    } catch {
      return { district, resources: [], source: "unavailable", error: "Inventory unavailable. Do not assume stock is available." };
    }
  },
});
export const resourceInventoryTools = { getResourceInventory };
''';p.write_text(s)
p=Path('lib/ai/tools/flood-tools.ts');p.write_text('''import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/prisma";
export const getFloodPrediction = tool({
  description: "Reads recent verified flood predictions tagged with this district; reports unavailable when no verified local prediction exists.",
  inputSchema: z.object({ district: z.string().min(1).max(80) }),
  execute: async ({ district }) => {
    try {
      const latest = await prisma.floodPrediction.findFirst({
        where: { isDemo: false, rawModelOutput: { path: ["district"], equals: district }, predictionTimestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { predictionTimestamp: "desc" },
        select: { riskLevel: true, confidenceScore: true, predictionTimestamp: true },
      });
      return { district, source: latest ? "database" : "unavailable", prediction: latest,
        message: latest ? "Model estimate; verify with local authorities." : "No current verified prediction for this district. Do not invent rainfall or risk." };
    } catch { return { district, prediction: null, source: "unavailable" }; }
  },
});
export const floodTools = { getFloodPrediction };
''')
# Demo authentication stays explicit and can be switched off for real deployment.
p=Path('app/actions/auth.ts');s=p.read_text();s=s.replace('return { ok: false, message: "Enter the 6-digit code from your phone." };','return { ok: false, message: "Enter the code from your phone (6 digits)." };');needle='  // Brute-force guard: max 5 verify attempts';s=s.replace(needle,'  if (process.env.DEMO_AUTH_ENABLED === "true") { setGuestCookie(); redirect("/command-center"); }\n\n'+needle);s=s.replace('  if (fullName.length < 2) {','  if (process.env.DEMO_AUTH_ENABLED === "true" && fullName && email && password) {\n    setSessionCookie("role", "public", 60 * 60 * 24);\n    redirect("/public/dashboard");\n  }\n  if (fullName.length < 2) {');needle='  let failure: string | null = null;';a=s.index(needle,s.index('export async function signInAction'));s=s[:a]+'''  if (process.env.DEMO_AUTH_ENABLED === "true") {
    const role = email.toLowerCase().includes("superadmin") ? "super_admin" : email.toLowerCase().includes("admin") ? "district_admin" : "public";
    cookies().delete("guest_mode");
    setSessionCookie("role", role, 60 * 60 * 24);
    redirect(role === "super_admin" ? "/gov/overview" : role === "district_admin" ? "/gov/dashboard" : "/public/dashboard");
  }
'''+s[a:];p.write_text(s)
p=Path('tests/auth-demo.test.ts');s=p.read_text().replace('beforeEach }','beforeEach, afterEach }').replace('    vi.clearAllMocks();','    vi.clearAllMocks();\n    vi.stubEnv("DEMO_AUTH_ENABLED", "true");');s+='\nafterEach(() => vi.unstubAllEnvs());\n';p.write_text(s)
p=Path('lib/security/require-role.ts');s=p.read_text();s=s.replace('  const cookieAdmitted =','  const demoEnabled = process.env.DEMO_AUTH_ENABLED === "true";\n  const cookieAdmitted =');s=s.replace('  if (\n    !process.env.NEXT_PUBLIC_SUPABASE_URL','  if (demoEnabled && cookieAdmitted) return { ok: true, role: roleCookie };\n\n  if (\n    !process.env.NEXT_PUBLIC_SUPABASE_URL',1);s=s.replace('return cookieAdmitted ? { ok: true, role: roleCookie } : deny(false);','return demoEnabled && cookieAdmitted ? { ok: true, role: roleCookie } : deny(false);');p.write_text(s)
p=Path('app/api/chat/route.ts');s=p.read_text();s=s.replace('  try {\n    const supabase = createClient();','  if (process.env.DEMO_AUTH_ENABLED === "true") {\n    return { role: cookieStore.get("role")?.value || "viewer", district: cookieStore.get("district")?.value || "Patna" };\n  }\n  try {\n    const supabase = createClient();',1);p.write_text(s)
print('Removed fabricated AI tool data; scoped retrieval; repaired explicit demo login.')
