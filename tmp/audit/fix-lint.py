from pathlib import Path
p=Path('lib/agents/nodes/intelligence-nodes.ts');s=p.read_text().replace('response.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")','response.content.filter((p: { type?: string; text?: unknown }) => p.type === "text" && typeof p.text === "string").map((p: { text?: unknown }) => String(p.text)).join("")');p.write_text(s)
p=Path('lib/integrations/sources.ts');s=p.read_text().replace('(page: any)', '(page: { id: string; url: string; properties?: Record<string, { title?: Array<{ plain_text?: string }> }> })').replace('(p: any) => p.title ?? []','p => p.title ?? []').replace('(t: any) => t.plain_text || ""','t => t.plain_text || ""');p.write_text(s)
p=Path('lib/nova/nova-reply.test.ts');s=p.read_text().replace('{ history: any[] }','{ history: Array<{ content: string }> }');p.write_text(s)
for name in ['.env.example','.env.local']:
 p=Path(name);s=p.read_text();
 if 'ML_AUTO_ALERTS_ENABLED=' not in s:s+='\n# Predictions remain advisory unless an operator enables alert automation.\nML_AUTO_ALERTS_ENABLED=false\n'
 p.write_text(s)
print('Resolved lint type errors and documented the alert automation switch.')
