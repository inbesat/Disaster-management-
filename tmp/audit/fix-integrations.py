from pathlib import Path
import re,json,secrets
p=Path('lib/ai/openrouter.ts');s=p.read_text().replace('"bluesminds" | "auto"','"bluesminds" | "huggingface" | "auto"');s=s.replace('export const PROVIDER_KEY_CONFIGS: ProviderKeyConfig[] = [','export const PROVIDER_KEY_CONFIGS: ProviderKeyConfig[] = [\n  { keyEnvVar: "HF_TOKEN", name: "huggingface", group: "huggingface", baseURL: "https://router.huggingface.co/v1", modelId: "openai/gpt-oss-120b" },');# HF is a last resort, after requested primary providers
s=s.replace('  { keyEnvVar: "HF_TOKEN", name: "huggingface", group: "huggingface", baseURL: "https://router.huggingface.co/v1", modelId: "openai/gpt-oss-120b" },\n','');s=s.replace('modelId: BLUESMINDS_MODEL },','modelId: BLUESMINDS_MODEL },\n  { keyEnvVar: "HF_TOKEN", name: "huggingface", group: "huggingface", baseURL: "https://router.huggingface.co/v1", modelId: "openai/gpt-oss-120b" },');p.write_text(s)
p=Path('lib/ai/openrouter.test.ts');s=p.read_text().replace('  "BLUESMINDS_API_KEY",','  "BLUESMINDS_API_KEY",\n  "HF_TOKEN",');p.write_text(s)
# Route both retrieval paths through the same real embedding provider.
p=Path('lib/retrieval/retrieve.ts');s=p.read_text();a=s.index('export async function getEmbedding(');b=s.index('\nfunction tokenize',a);s=s[:a]+'''export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const { generateEmbeddings } = await import("@/lib/rag/embeddings");
    return (await generateEmbeddings([text]))[0]?.embedding ?? null;
  } catch { return null; }
}
'''+s[b:];p.write_text(s)
# Save old SOP rows unless the entire replacement succeeds.
p=Path('app/actions/documents.ts');s=p.read_text().replace('  const embedded = await generateEmbeddings(chunks);','  const embedded = await generateEmbeddings(chunks).catch(() => []);');s=s.replace('    await prisma.$executeRaw`\n      DELETE','    await prisma.$transaction(async (tx) => {\n    await tx.$executeRaw`\n      DELETE');s=s.replace('      await prisma.$executeRaw`\n        INSERT','      await tx.$executeRaw`\n        INSERT');s=s.replace('      ingested++;\n    }','      ingested++;\n    }\n    });');s=s.replace('return { ok: true, ingested, chunks: chunks.length, title, district, documentType, message: "DB bypassed — simulated ingestion." };','return { ok: false, ingested: 0, chunks: chunks.length, title, district, documentType, message: "Document was not saved. Check database connectivity; the previous version is preserved." };');s=s.replace('console.warn("[documents] ingestDocument fell back to mock success.", error);','console.warn("[documents] document transaction failed.");');p.write_text(s)
# Clean, complete onboarding template; never copy supplied secrets to examples.
keys=set()
for folder in ['app','lib','server','scripts']:
 for file in Path(folder).rglob('*'):
  if file.suffix not in ['.ts','.tsx','.js','.mjs']: continue
  keys.update(re.findall(r'process\.env\.([A-Z][A-Z0-9_]*)',file.read_text(encoding='utf-8',errors='ignore')))
source=Path('C:/Users/Lenovo/.codex/attachments/89f3d4e5-6963-4f6f-92b8-91a36bc6ee22/Pasted text.txt').read_text(encoding='utf-8-sig')
keys.update(re.findall(r'^([A-Z][A-Z0-9_]*)=',source,re.M));keys.update(['DEMO_AUTH_ENABLED','CAPACITOR_SERVER_URL','GROQ_MODEL','OPENROUTER_MODEL','BLUESMINDS_MODEL','HUGGINGFACE_MODEL','ML_API_KEY','ML_ALLOWED_ORIGINS','NOTION_DATA_SOURCE_ID'])
keys-= {'NODE_ENV','CI'}
defaults={'NEXT_PUBLIC_SITE_URL':'http://localhost:3000','NEXT_PUBLIC_APP_URL':'http://localhost:3000','CAPACITOR_SERVER_URL':'https://safesphere0.netlify.app','ML_SERVICE_URL':'http://127.0.0.1:8000','DEMO_AUTH_ENABLED':'false','GROQ_MODEL':'openai/gpt-oss-120b','OPENROUTER_MODEL':'openrouter/free','BLUESMINDS_MODEL':'google/gemini-2.5-flash','HUGGINGFACE_MODEL':'openai/gpt-oss-120b','ML_ALLOWED_ORIGINS':'http://localhost:3000'}
Path('.env.example').write_text('# Copy needed settings to .env.local. All secrets remain server-side.\n# Blank optional integrations stay disabled. Demo auth is deliberately opt-in.\n'+'\n'.join(k+'='+defaults.get(k,'') for k in sorted(keys))+'\n')
values=dict(re.findall(r'^([A-Z][A-Z0-9_]*)=(.*)$',Path('.env.local').read_text(),re.M));values.setdefault('ML_API_KEY',secrets.token_urlsafe(32));values.setdefault('CRON_SECRET',secrets.token_urlsafe(32));Path('.env.local').write_text('# Local only. Do not commit.\n'+'\n'.join(k+'='+v for k,v in values.items())+'\n')
Path('ml_service/.env.local').write_text('ENVIRONMENT=development\nML_ALLOWED_ORIGINS=http://localhost:3000\nML_API_KEY='+values['ML_API_KEY']+'\n')
Path('ml_service/.env.example').write_text('ENVIRONMENT=development\nML_ALLOWED_ORIGINS=http://localhost:3000\nML_API_KEY=\n')
p=Path('ml_service/api.py');s=p.read_text();anchor='MODEL_PATH =';a=s.index(anchor);s=s[:a]+'''# Explicit local configuration; production deployments can provide process env.
from pathlib import Path
for _line in (Path(__file__).parent / ".env.local").read_text().splitlines() if (Path(__file__).parent / ".env.local").exists() else []:
    if "=" in _line and not _line.lstrip().startswith("#"):
        _key, _value = _line.split("=", 1)
        os.environ.setdefault(_key.strip(), _value.strip())

'''+s[a:];p.write_text(s)
print('Added Hugging Face provider, transactional document ingestion and sanitized environment templates.')
