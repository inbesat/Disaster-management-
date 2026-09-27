from pathlib import Path
p=Path('app/api/fm/coverage/route.ts');s=p.read_text(encoding='utf-8')
s=s.replace('import { MOCK_FM_STATIONS } from "@/lib/fm/mock-stations";\n','')
a=s.index('    // DB unreachable — answer coverage')
b=s.index('\n  }\n}',a)
s=s[:a]+'''    console.error("Failed to test FM coverage:", error);
    return NextResponse.json({ ok: false, source: "unavailable", covering: [], count: 0, error: "FM coverage is unavailable" }, { status: 503 });'''+s[b:]
p.write_text(s,encoding='utf-8')
