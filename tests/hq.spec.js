const {test,expect}=require('@playwright/test');
async function open(page,view='command') {
 await page.goto('/');
 await page.waitForFunction(()=>document.querySelector('#boot').classList.contains('hide'));
 if(view!=='command') await page.locator(`[data-view="${view}"]`).click();
}
test('Obsidian connection rejects remote origins and imports nested read-only snapshots before graph initialization',async({page})=>{
 await open(page,'settings');let remoteRequests=0;
 await page.route('https://example.com/**',route=>{remoteRequests++;return route.abort()});
 await page.locator('#apiurl').fill('https://example.com');await page.locator('#sync').click();
 await expect(page.locator('#syncmsg')).toContainText('loopback');expect(remoteRequests).toBe(0);
 await page.route('http://localhost:27123/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/vault/')return route.fulfill({json:{files:['Projects/','Root.md']}});
  if(path==='/vault/Projects/')return route.fulfill({json:{files:['Plan.md']}});
  return route.fulfill({contentType:'text/markdown',body:path.endsWith('Root.md')?'# Root\n[[Projects/Plan]]':'---\r\ntype: project\r\n---\r\n# Plan\n[[Root]]'});
 });
 await page.locator('#apiurl').fill('http://localhost:27123');await page.locator('#sync').click();
 await expect(page.locator('#syncmsg')).toContainText('2 notes');
 await page.locator('[data-view="vault"]').click();await expect(page.locator('#graphmode')).toContainText('READ-ONLY SNAPSHOT');
 await page.locator('#browse').click();await page.getByRole('button',{name:'Inspect Plan',exact:true}).click();
 await expect(page.locator('#dtype')).toHaveText('PROJECT');await expect(page.locator('#connections')).toContainText('Root');
 expect(await page.evaluate(()=>JSON.stringify(localStorage).includes('# Plan'))).toBe(false);
 await page.locator('[data-view="settings"]').click();await page.unroute('http://localhost:27123/**');
 await page.route('http://localhost:27123/**',route=>route.fulfill({status:500,body:'failed'}));await page.locator('#sync').click();
 await expect(page.locator('#syncmsg')).toContainText('Kept previous data');
 await page.getByRole('button',{name:'Use demo memories',exact:true}).click();await page.locator('[data-view="vault"]').click();
 await expect(page.locator('#graphmode')).toContainText('DEMO');
});

test('settings, agent details and collapsible panels work with keyboard and persist',async({page})=>{
 await open(page,'settings');
 await page.getByLabel('Mission statement').fill('Keep decisions grounded in evidence.');
 await page.getByRole('button',{name:'Save mission',exact:true}).click();
 await page.getByRole('switch',{name:'Ambient graph motion',exact:true}).click();
 await page.reload();await page.locator('[data-view="settings"]').click();
 await expect(page.getByRole('switch',{name:'Ambient graph motion',exact:true})).toHaveAttribute('aria-checked','false');
 await page.locator('[data-view="command"]').click();await expect(page.locator('.mission h2')).toHaveText('Keep decisions grounded in evidence.');
 const collapse=page.getByRole('button',{name:'Collapse Live activity feed',exact:true});await collapse.click();await expect(page.locator('#feed')).toBeHidden();
 await page.getByRole('button',{name:'Expand Live activity feed',exact:true}).click();await expect(page.locator('#feed')).toBeVisible();
 await page.locator('[data-view="floor"]').click();const agent=page.getByRole('button',{name:'Inspect agent Researcher',exact:true});await agent.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog')).toContainText('not a running process');await page.keyboard.press('Escape');await expect(agent).toBeFocused();
 await page.locator('[data-view="vault"]').click();await page.waitForFunction(()=>graphReady);expect(await page.evaluate(()=>animationFrame)).toBe(0);
});

test('all original zones fit mobile and keep named navigation and filters',async({page})=>{
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:844});await open(page);
  for(const view of ['command','floor','vault','missions','analytics','settings']){
   await page.locator(`[data-view="${view}"]`).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${view} overflow`).toBe(true);
   await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-current','page');
  }
  await page.locator('[data-view="vault"]').click();await expect(page.getByRole('button',{name:'ORPHANS',exact:true})).toBeVisible();
 }
});

test('Comms renders text safely and runs only explicit local commands',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Expand Comms',exact:true}).click();
 const send=async text=>{await page.locator('#chatinput').fill(text);await page.locator('#chatinput').press('Enter')};
 await send('<img src=x onerror="window.injected=true">');
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();await expect(page.locator('#chatbody img')).toHaveCount(0);
 await expect(page.locator('#chatbody')).toContainText('No live model');
 await send('/help');await expect(page.locator('#chatbody')).toContainText('/task');
 await send('/find Machine Learning');await expect(page.locator('#chatbody')).toContainText('Machine Learning');
 await page.getByRole('button',{name:'Open memory Machine Learning',exact:true}).click();
 await expect(page.locator('#dtitle')).toHaveText('Machine Learning');
 await page.locator('#ask').click();await expect(page.locator('#chatbody')).toContainText('Ideas about systems that learn from data.');
 await send('/task Check source evidence');await expect(page.locator('#chatbody')).toContainText('Created local task');
 await page.locator('[data-view="missions"]').click();await expect(page.locator('#tasks')).toContainText('Check source evidence');
 await send('/clear');await expect(page.locator('#chatbody .bubble')).toHaveCount(1);
});

test('local task workflow persists, updates activity and opens its Vault context',async({page})=>{
 await open(page,'missions');
 await page.getByRole('button',{name:'New task',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Task title').fill('Review graph readability');
 await page.getByLabel('Memory context').selectOption('Personal HQ');
 await page.getByRole('button',{name:'Create task',exact:true}).click();
 await expect(page.locator('#tasks')).toContainText('Review graph readability');
 await page.reload();await page.locator('[data-view="missions"]').click();
 await page.getByRole('button',{name:'Inspect task Review graph readability',exact:true}).click();
 await page.getByRole('button',{name:'Open memory context',exact:true}).click();
 await expect(page.locator('#vault')).toBeVisible();await expect(page.locator('#dtitle')).toHaveText('Personal HQ');
 await page.getByRole('button',{name:'Set focus',exact:true}).click();
 await page.locator('[data-view="command"]').click();
 await expect(page.locator('#agentfocus')).toContainText('Personal HQ');
 await expect(page.locator('#feed')).toContainText('focus');
 await page.locator('[data-view="missions"]').click();
 await page.getByRole('button',{name:'Inspect task Review graph readability',exact:true}).click();
 await page.getByRole('button',{name:'Mark complete',exact:true}).click();
 await page.locator('[data-view="command"]').click();await expect(page.locator('#done')).toHaveText('1');
});

test('Vault is deterministic, retains directed links and typing never triggers camera shortcuts',async({page})=>{
 await open(page,'vault');
 await page.waitForFunction(()=>typeof graphReady!=='undefined'&&graphReady);
 const positions=await page.evaluate(()=>nodes.map(({id,x,y,z})=>({id,x,y,z})));
 expect(await page.evaluate(()=>edges.some(e=>[e.a.id,e.b.id].includes('Reliability')&&[e.a.id,e.b.id].includes('Personal HQ')))).toBe(true);
 await page.locator('#search').fill('Machine');await page.locator('#search').press('Space');await page.locator('#search').press('KeyL');
 await expect(page.locator('#search')).toHaveValue('Machine l');
 await page.locator('#search').fill('no-such-memory');
 await page.locator('#browse').click();
 await expect(page.locator('#notelist')).toContainText('No matching notes');
 expect(await page.evaluate(()=>nodeMeshes.filter(m=>m.visible).length)).toBe(0);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(page.locator('#notelist button')).toHaveCount(12);
 await page.getByRole('button',{name:'Inspect Reliability',exact:true}).click();
 await expect(page.locator('#connections')).toContainText('Personal HQ');
 await page.keyboard.press('Escape');
 await page.reload();await page.locator('[data-view="vault"]').click();await page.waitForFunction(()=>graphReady);
 expect(await page.evaluate(()=>nodes.map(({id,x,y,z})=>({id,x,y,z})))).toEqual(positions);
 await page.locator('[data-view="command"]').click();
 expect(await page.evaluate(()=>animationFrame)).toBe(0);
});

test('graph dependency outage never disables the HQ or keyboard memory fallback',async({page})=>{
 await page.route(/cdn.jsdelivr.net/,route=>route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,'vault');
 await expect(page.locator('#graphmode')).toContainText('3D unavailable');
 await expect(page.locator('#notelist')).toBeVisible();
 await page.getByRole('button',{name:'Inspect Machine Learning',exact:true}).click();
 await expect(page.locator('#dtitle')).toHaveText('Machine Learning');
 await expect(page.locator('#dmeta')).toContainText('Unverified');
 await page.keyboard.press('Escape');
 await expect(page.locator('#detail')).toBeHidden();
 await page.locator('[data-view="missions"]').click();
 await expect(page.locator('#missions')).toBeVisible();
 expect(errors).toEqual([]);
});
