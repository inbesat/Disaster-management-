from pathlib import Path
p=Path('tmp/audit/check-sw.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("  process.stdout.write(JSON.stringify(status)+'\\n');","  process.stdout.write(JSON.stringify(status)+'\\n');\n  const manual = await page.evaluate(async () => { try { const r=await navigator.serviceWorker.register('/sw.js'); return {scope:r.scope,installing:r.installing?.state,active:r.active?.state}; } catch(e) { return {error:String(e)}; } });\n  process.stdout.write('manual '+JSON.stringify(manual)+'\\n');\n  await page.waitForTimeout(5000);\n  process.stdout.write('after '+JSON.stringify(await page.evaluate(async()=>({controlled:!!navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length})))+'\\n');")
p.write_text(s,encoding='utf-8')
