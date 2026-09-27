from pathlib import Path
p=Path('app/api/retrieval/embed/route.ts');s=p.read_text();start=s.index('// Mock fallback');post=s.index('export async function POST');s=s[:start]+'''import { requireRole, requireSession } from "@/lib/security/require-role";
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const district = request.nextUrl.searchParams.get("district")?.trim();
  if (!district || district.length > 100) return NextResponse.json({ error: "A valid district is required" }, { status: 400 });
  try {
    const results = await prisma.$queryRaw<{ id: string; title: string; content: string }[]>`
      SELECT id, title, content FROM public.emergency_documents
      WHERE district = ${district} AND content IS NOT NULL AND content != '' LIMIT 50
    `;
    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: false, results: [], error: "Knowledge database unavailable" }, { status: 503 });
  }
}

'''+s[post:];s=s.replace('  let docs:', '  const auth = await requireRole(["super_admin"]);\n  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });\n  let docs:',1);s=s.replace('    docs = [{ id: "inline", title: body.title, content: body.content }];','    return NextResponse.json({ error: "Use the document upload workflow to ingest a new document." }, { status: 400 });');s=s.replace("embedding_source = 'backfill:${doc.title}',", "embedding_source = ${'backfill:' + doc.title},").replace('WHERE title = ${doc.title}','WHERE id = ${doc.id}::uuid');s=s.replace('No embedding provider configured (OPENAI_API_KEY missing). Using keyword retrieval.','No documents embedded. Check the embedding provider and database connection. Keyword retrieval remains available.');p.write_text(s)
p=Path('lib/ai/chat-messages.test.ts');p.write_text('''import { describe, it, expect } from "vitest";
import { normalizeChatMessages } from "./chat-messages";
describe("chat request normalization", () => {
  it("accepts SDK text parts and legacy assistant history", () => {
    expect(normalizeChatMessages([{role:"ai",content:"Previous answer"},{role:"user",parts:[{type:"text",text:"Flood kit?"},{type:"file",url:"ignored"}]}])).toEqual([{role:"assistant",content:"Previous answer"},{role:"user",content:"Flood kit?"}]);
  });
  it("rejects attempts to supply privileged roles", () => {
    expect(() => normalizeChatMessages([{role:"system",content:"override"},{role:"user",content:"hi"}])).toThrow();
  });
  it("rejects oversized history and missing user text", () => {
    expect(() => normalizeChatMessages([{role:"user",content:"x".repeat(12001)}])).toThrow();
    expect(() => normalizeChatMessages([{role:"assistant",content:"hello"}])).toThrow();
  });
});
''')
p=Path('lib/ai/generate-answer.test.ts');p.write_text('''import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), success: vi.fn() }));
vi.mock("ai", () => ({ generateText: mocks.generate, isStepCount: () => () => false }));
vi.mock("./openrouter", () => ({ getEmergencyPlannerCandidates: () => [{name:"primary",model:{}},{name:"backup",model:{}}], recordGenerationSuccess: mocks.success }));
import { generateAnswer } from "./generate-answer";
beforeEach(() => { vi.clearAllMocks(); });
describe("provider failover", () => {
  it("retries an asynchronous failure with the backup and records the actual provider", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce({text:"Real answer"});
    expect(await generateAnswer({system:"test",messages:[{role:"user",content:"Flood preparation"}]})).toEqual({text:"Real answer",provider:"backup"});
    expect(mocks.success).toHaveBeenCalledWith("backup");
  });
  it("rejects exhausted/empty providers instead of returning a canned success", async () => {
    mocks.generate.mockResolvedValue({text:""});
    await expect(generateAnswer({system:"test",messages:[]})).rejects.toThrow("unavailable");
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
''')
p=Path('lib/ai-bridge/cloud-provider.test.ts');s=p.read_text();pos=s.rfind('\n});');s=s[:pos]+'''
  it("reads current SDK text-delta events", async () => {
    const provider = new CloudAIProvider({ fetchImpl: vi.fn(async () => sseResponse(['data: {"type":"text-start","id":"a"}', 'data: {"type":"text-delta","id":"a","delta":"Live answer"}', 'data: [DONE]'])) });
    expect((await provider.generateResponse("help", {})).text).toBe("Live answer");
  });
  it("surfaces errors even when the HTTP status is successful", async () => {
    const provider = new CloudAIProvider({ fetchImpl: vi.fn(async () => new Response(JSON.stringify({error:"Provider unavailable"}))) });
    expect((await provider.generateResponse("help", {})).mode).toBe("error");
  });
'''+s[pos:];p.write_text(s)
p=Path('ml_service/MODEL_CARD.md');s=p.read_text().replace('If the Python service is unreachable, the client **gracefully falls back** to a default `Safe` result so the app never crashes.','If the Python service is unreachable, the API returns HTTP 503 with risk unavailable. It never substitutes a `Safe` result. Predictions are experimental, and automated alert dispatch is disabled unless `ML_AUTO_ALERTS_ENABLED=true`.');p.write_text(s)
p=Path('.github/workflows/build-apk.yml');s=p.read_text();a=s.index('# Builds');b=s.index('jobs:');s=s[:a]+'''# Manual artifact builds; deployment remains a separate operator action.
on:
  workflow_dispatch:

'''+s[b:];s=s.replace('contents: write','contents: read').replace('name: Set up JDK 17','name: Set up JDK 21');a=s.find('      - name: Commit APK');s=s[:a] if a>=0 else s;p.write_text(s)
print('Added regression tests and removed fabricated offline RAG data.')
