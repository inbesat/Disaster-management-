const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ headless: true });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://safesphere0.netlify.app/', { waitUntil:'domcontentloaded', timeout:60000 });
 console.log('Deployed title:',await page.title());
 console.log((await page.locator('body').innerText()).slice(0,4500));
 await page.screenshot({path:'tmp/audit/deployed-desktop.png'});
 console.log('Deployed errors:',JSON.stringify(errors));
 await page.goto('http://localhost:3000/api/ping',{timeout:120000});console.log('Local ping:',await page.locator('body').innerText());
 await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
