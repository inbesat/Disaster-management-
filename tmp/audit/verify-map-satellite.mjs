import { chromium } from '@playwright/test';
const base = 'http://localhost:3100';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  await context.addCookies([{ name: 'role', value: 'district_admin', url: base }]);
  const page = await context.newPage();
  await page.goto(base + '/satellite', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('heading', { name: 'Satellite & Ground Truth' }).waitFor({ timeout: 60000 });
  const satelliteMap = await page.getByLabel('Satellite imagery map').count();
  await page.waitForTimeout(5000);
  const eventCount = await page.locator('aside li').count();
  const feedError = await page.getByRole('alert').allInnerTexts();
  console.log('desktop satellite: heading=yes, map=' + satelliteMap + ', event rows=' + eventCount + ', alerts=' + feedError.join('|'));
  await page.goto(base + '/map', { waitUntil: 'domcontentloaded', timeout: 120000 });
  const search = page.getByRole('searchbox', { name: 'Search places on the map' });
  await search.waitFor({ timeout: 90000 });
  await search.fill('Patna, India');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.getByRole('list', { name: 'Place search results' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /Patna/ }).last().click();
  await page.getByText(/Viewing Patna/).waitFor({ timeout: 30000 });
  console.log('desktop map: search=yes, place selected=yes, title=' + await page.locator('h1').first().innerText());
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  await mobile.addCookies([{ name: 'role', value: 'district_admin', url: base }]);
  const mp = await mobile.newPage();
  await mp.goto(base + '/satellite', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mp.getByRole('heading', { name: 'Satellite & Ground Truth' }).waitFor({ timeout: 60000 });
  const widths = await mp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  console.log('mobile satellite: scrollWidth=' + widths.scroll + ', viewport=' + widths.viewport);
  if (widths.scroll > widths.viewport + 2) throw new Error('Satellite page overflows mobile width');
  await mobile.close();
  await context.close();
} finally { await browser.close(); }

