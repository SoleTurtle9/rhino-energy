const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/#test');await page.click('#start');
 const results=[];const check=async(test,fn)=>{await fn();results.push({test,result:'PASS'});console.log('PASS',test);};
 await check('Wall blocks walking without dash',async()=>{
  await page.evaluate(()=>rhinoTest.place(0,0,-27));await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  const s=await page.evaluate(()=>rhinoTest.state());assert(!s.broken[0]);assert(s.player.z> -28.3);
 });
 await check('Moving platform carries standing player',async()=>{
  await page.evaluate(()=>{rhinoTest.load(1);const p=rhinoTest.state().movers[0];rhinoTest.place(p.x,0,p.z);});
  await page.waitForFunction(()=>rhinoTest.state().player.grounded);const before=await page.evaluate(()=>rhinoTest.state());
  await page.waitForTimeout(550);const after=await page.evaluate(()=>rhinoTest.state());
  assert(Math.abs(after.movers[0].x-before.movers[0].x)>.05);
  assert(Math.abs((after.player.x-before.player.x)-(after.movers[0].x-before.movers[0].x))<.08);
 });
 await check('Pause freezes platform and hazard phase',async()=>{
  await page.keyboard.press('Escape');const before=await page.evaluate(()=>rhinoTest.state());await page.waitForTimeout(400);
  const after=await page.evaluate(()=>rhinoTest.state());assert.equal(after.worldTime,before.worldTime);assert.deepEqual(after.movers,before.movers);assert.deepEqual(after.hazards,before.hazards);await page.click('#continue');
 });
 await check('Active trap causes collision damage',async()=>{
  await page.waitForFunction(()=>rhinoTest.state().hazards[0]);await page.evaluate(()=>rhinoTest.place(8,0,-21));
  await page.waitForFunction(()=>rhinoTest.state().player.hp===2);assert.equal((await page.evaluate(()=>rhinoTest.state())).deaths,0);
 });
 await check('Offline file launch has rendered scene',async()=>{
  const ctx=await browser.newContext({offline:true});const p=await ctx.newPage();const failures=[];p.on('pageerror',e=>failures.push(e.message));
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.click('#start');await p.waitForTimeout(500);
  assert(await p.locator('canvas').isVisible());assert.equal(await p.locator('#levelTitle').innerText(),'Учебный двор');
  assert(await p.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return !!gl&&!gl.isContextLost();}));
  assert.deepEqual(failures,[]);await ctx.close();
 });
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'additional-results.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),scope:'Targeted setup uses diagnostic positioning; platform motion, trap collision and pause run in normal simulation. Offline launch uses file:// with network disabled.',results,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
