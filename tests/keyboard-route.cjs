const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:960,height:720},recordVideo:{dir:path.join(__dirname,'..','rhino-video'),size:{width:960,height:720}}});
const page=await context.newPage();await page.goto('http://127.0.0.1:8765/#test');await page.click('#start');
const state=()=>page.evaluate(()=>rhinoTest.state());
const move=async(axis,target,jump=false,dash=false)=>{
 const before=await state(),positive=target>before.player[axis];const key=axis==='x'?(positive?'d':'a'):(positive?'s':'w');
 await page.waitForFunction(()=>rhinoTest.state().player.grounded);
 await page.keyboard.down(key);if(jump)await page.keyboard.press('Space');if(dash)await page.keyboard.press('Shift');
 await page.waitForFunction(({axis,target,positive})=>positive?rhinoTest.state().player[axis]>=target:rhinoTest.state().player[axis]<=target,{axis,target,positive},{timeout:20000});
 await page.keyboard.up(key);await page.waitForFunction(()=>rhinoTest.state().player.grounded);
 const after=await state();if(after.deaths!==before.deaths)throw Error(`Fall on ${axis} ${target}`);
 console.log(`Reached ${axis} ${target}`);
};
const action=async()=>{await page.keyboard.press('e');await page.waitForTimeout(150);};
await move('z',-2);await move('z',-8,true);await move('z',-14);await move('z',-20,true);await move('z',-25);await move('z',-27);await move('z',-32,false,true);await move('z',-41);await move('z',-48);await action();
if((await state()).mode!=='complete')throw Error('Level 1 not complete');console.log('FULL ROUTE level 1 PASS');await page.click('#next');
await move('z',-3);await move('z',-9,true);await move('z',-17.5);await move('x',-8);await move('z',-24,true);await move('z',-29);await action();await move('z',-31.5);await move('z',-38,true);await move('z',-40);await move('x',8);await move('z',-37);await move('z',-30.5,true);await move('z',-29);await action();await move('z',-31.5);await move('z',-38,true);await move('z',-43);await move('x',0);await move('z',-49);await action();
if((await state()).mode!=='complete')throw Error('Level 2 not complete');console.log('FULL ROUTE level 2 PASS');await page.click('#next');
await move('z',-3);await move('z',-9,true);await move('z',-19);await move('x',-4.5);await move('x',-8,false,true);await move('x',-10);await move('z',-20);await action();await move('x',0);await move('x',4);await move('x',9,true);await move('x',10);await action();await move('x',8);await move('x',2,true);await move('x',0);await move('z',-23);await move('z',-29,true);await move('z',-32);await action();await move('z',-36);await action();
if((await state()).mode!=='complete')throw Error('Level 3 not complete');console.log('FULL ROUTE level 3 PASS');await page.waitForTimeout(1200);
fs.writeFileSync(path.join(__dirname,'..','rhino-route-results.json'),JSON.stringify({date:new Date().toISOString(),result:'PASS',method:'All three levels traversed using browser keyboard events, without teleportation, level skipping or modifying player state. Test adapter used only for reading state.',finalState:await state()},null,2));
await context.close();const videoPath=await page.video().path();fs.copyFileSync(videoPath,path.join(__dirname,'..','screenshots','keyboard-playthrough.webm'));await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
