import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
const base='http://localhost:3100';
try {
  for (const [label,viewport] of [['desktop',{width:1366,height:850}],['mobile',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport,isMobile:label==='mobile'});
    await context.addCookies([{name:'role',value:'district_admin',url:base}]);
    const page=await context.newPage();
    await page.goto(base+'/satellite',{waitUntil:'domcontentloaded',timeout:120000});
    await page.getByRole('heading',{name:'Satellite & Ground Truth'}).waitFor({timeout:60000});
    await page.waitForFunction(() => !document.body.innerText.includes('Loading NASA feed'),null,{timeout:30000});
    const info=await page.evaluate(() => ({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    const rows=await page.locator('aside li').count();
    const alerts=await page.getByRole('alert').allInnerTexts();
    console.log(label+': page=yes, rows='+rows+', alerts='+alerts.filter(Boolean).join('|')+', width='+info.width+'/'+info.viewport);
    if (rows) {
      await page.locator('aside li button').first().click();
      console.log(label+': event details='+await page.getByLabel('Selected event details').count());
    }
    if(info.width>info.viewport+2) throw new Error(label+' horizontal overflow');
    await context.close();
  }
} finally {await browser.close();}
