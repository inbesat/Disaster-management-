const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') process.stdout.write('console '+m.text().slice(0,250)+'\n'); });
  page.on('pageerror', e => process.stdout.write('pageerror '+e.message.slice(0,250)+'\n'));
  await page.goto('http://localhost:3000/public/dashboard', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(12000);
  const status = await page.evaluate(async () => ({ controlled: !!navigator.serviceWorker.controller, registrations: (await navigator.serviceWorker.getRegistrations()).map(r => ({scope:r.scope,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state})), cacheKeys: await caches.keys() }));
  process.stdout.write(JSON.stringify(status)+'\n');
  const manual = await page.evaluate(async () => { try { const r=await navigator.serviceWorker.register('/sw.js'); return {scope:r.scope,installing:r.installing?.state,active:r.active?.state}; } catch(e) { return {error:String(e)}; } });
  process.stdout.write('manual '+JSON.stringify(manual)+'\n');
  await page.waitForTimeout(5000);
  process.stdout.write('after '+JSON.stringify(await page.evaluate(async()=>({controlled:!!navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).length})))+'\n');
  await browser.close();
})().catch(e=>{process.stderr.write(String(e));process.exitCode=1});
