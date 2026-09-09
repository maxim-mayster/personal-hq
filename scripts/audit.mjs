import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const label=process.argv[2]||'local';
const base=process.env.ARIA_BASE_URL||'http://127.0.0.1:8765';
const out=`qa-output/${label}`;mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext();const page=await context.newPage();
const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
const rows=[];
for(const width of [1440,768,390,320]) {
 await page.setViewportSize({width,height:width>900?1000:844});
 await page.goto(base+'/?audit='+label);await page.waitForFunction(()=>document.querySelector('#boot').classList.contains('hide'));
 for(const view of ['command','floor','vault','missions','analytics','settings']) {
  await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(view==='vault'?700:100);
  await page.screenshot({path:`${out}/${width}-${view}.png`,fullPage:true});
  const details=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,active:document.querySelector('.view.on')?.id,buttons:[...document.querySelectorAll('.view.on button')].map(b=>({name:b.getAttribute('aria-label')||b.textContent.trim(),disabled:b.disabled})),comms:document.querySelector('.comms').getBoundingClientRect().toJSON(),view:document.querySelector('.view.on').getBoundingClientRect().toJSON()}));
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  rows.push({width,view,...details,violations:a11y.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,examples:v.nodes.slice(0,3).map(n=>n.target)}))});
 }
}
await page.locator('[data-view="vault"]').click();await page.locator('#search').fill('Machine');await page.locator('#search').press('Space');await page.locator('#search').press('KeyL');
const typing=await page.locator('#search').inputValue();
writeFileSync(`${out}/audit.json`,JSON.stringify({base,rows,errors,consoleErrors,typing},null,2));
console.log(JSON.stringify({base,pages:rows.map(r=>({width:r.width,view:r.view,overflow:r.overflow,violations:r.violations})),errors,consoleErrors,typing},null,2));
await browser.close();
