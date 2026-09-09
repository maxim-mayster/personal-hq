const {test,expect}=require('@playwright/test');
async function open(page,view='command'){
 await page.goto('/');
 await page.waitForFunction(()=>document.querySelector('#boot').classList.contains('hide'));
 if(view!=='command')await page.locator(`[data-view="${view}"]`).click();
}

test('HQ starts disconnected and contains no demo records',async({page})=>{
 await open(page);
 await expect(page.locator('#status')).toHaveText('LIVE DATA REQUIRED');
 await expect(page.locator('#feed')).toContainText('waiting for authenticated live work data');
 await expect(page.locator('#done')).toHaveText('—');
 await expect(page.locator('body')).not.toContainText(/DEMO/i);
 await page.locator('[data-view="vault"]').click();
 await expect(page.locator('#graphmode')).toContainText('LIVE DATA REQUIRED');
 await page.locator('#browse').click();
 await expect(page.locator('#notelist')).toContainText('No matching notes');
 await expect(page.locator('#notelist button')).toHaveCount(0);
});

test('only a real connector response populates the Vault',async({page})=>{
 await open(page,'settings');
 await page.route('http://localhost:27123/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/vault/')return route.fulfill({json:{files:['Projects/','Root.md']}});
  if(path==='/vault/Projects/')return route.fulfill({json:{files:['Plan.md']}});
  return route.fulfill({contentType:'text/markdown',body:path.endsWith('Root.md')?'# Root\n[[Projects/Plan]]':'---\ntype: project\n---\n# Plan\n[[Root]]'});
 });
 await page.locator('#apiurl').fill('http://localhost:27123');
 await page.locator('#sync').click();
 await expect(page.locator('#syncmsg')).toContainText('2 notes');
 await page.locator('[data-view="vault"]').click();
 await expect(page.locator('#graphmode')).toContainText('READ-ONLY LIVE SNAPSHOT');
 await page.locator('#browse').click();
 await expect(page.getByRole('button',{name:'Inspect Plan',exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(/DEMO/i);
});

test('failed live reads do not fabricate replacement data',async({page})=>{
 await open(page,'settings');
 await page.route('http://localhost:27123/**',route=>route.fulfill({status:500,body:'failed'}));
 await page.locator('#apiurl').fill('http://localhost:27123');
 await page.locator('#sync').click();
 await expect(page.locator('#syncmsg')).toContainText('HTTP 500');
 await page.locator('[data-view="vault"]').click();
 await expect(page.locator('#notelist')).toContainText('No matching notes');
});

test('local task creation is unavailable without a live task connector',async({page})=>{
 await open(page,'missions');
 await expect(page.getByRole('button',{name:'Live task connector required',exact:true})).toBeDisabled();
 await expect(page.locator('#tasks')).toContainText('No live work tasks connected');
});

test('Comms never presents local commands as live agent activity',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Expand Comms',exact:true}).click();
 const send=async text=>{await page.locator('#chatinput').fill(text);await page.locator('#chatinput').press('Enter')};
 await expect(page.locator('#chatbody')).toContainText('No live agent connection');
 await send('<img src=x onerror="window.injected=true">');
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 await expect(page.locator('#chatbody img')).toHaveCount(0);
 await expect(page.locator('#chatbody')).toContainText('No live model');
 await send('/find Machine Learning');
 await expect(page.locator('#chatbody')).toContainText('0 matching memories');
 await expect(page.locator('body')).not.toContainText(/DEMO/i);
});

test('all original zones remain responsive in disconnected mode',async({page})=>{
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:844});await open(page);
  for(const view of ['command','floor','vault','missions','analytics','settings']){
   await page.locator(`[data-view="${view}"]`).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${view} overflow`).toBe(true);
   await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-current','page');
  }
 }
});

test('graph dependency outage keeps an honest empty fallback',async({page})=>{
 await page.route(/cdn.jsdelivr.net/,route=>route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,'vault');
 await expect(page.locator('#graphmode')).toContainText('3D UNAVAILABLE');
 await expect(page.locator('#notelist')).toBeVisible();
 await expect(page.locator('#notelist')).toContainText('No matching notes');
 await expect(page.locator('body')).not.toContainText(/DEMO/i);
 expect(errors).toEqual([]);
});
