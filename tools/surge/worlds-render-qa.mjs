import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/surge-worlds/render';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const report={date:new Date().toISOString(),scope:'Both real maps, model/encounter presentation, and an explicitly injected 220-enemy combat fixture; not a natural-run win-rate test.',maps:[],errors:[],failedResources:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)report.failedResources.push(r.url());});
try{
 await page.goto('http://127.0.0.1:4175/');await page.locator('[data-act="start"]').waitFor({timeout:60000});
 for(const mapId of ['old-harbor','tidal-observatory']){
  await page.evaluate(async mapId=>{const a=window.__SURGE__;await a.start('fist',0,'balanced',undefined,mapId);a.profile.settings.shake=false;a.profile.settings.volume=0;a.renderer.applySettings(a.profile.settings);},mapId);
  await page.waitForTimeout(300);await page.keyboard.press('Escape');
  const identity=await page.evaluate(()=>{const a=window.__SURGE__;return{mapId:a.sim.s.mapId,worldId:a.world.id,zones:a.world.zones.length,sites:a.sim.s.events.length,spawn:{...a.sim.s.player}};});
  if(identity.mapId!==mapId||identity.worldId!==mapId||identity.sites!==6)throw new Error('Map identity / facility selection failed');
  await page.evaluate(()=>{const a=window.__SURGE__;a.ui.game();a.ui.hud(a.sim.s,a.world.zones[0].name);});
  await page.screenshot({path:out+'/'+mapId+'-spawn.png'});
  await page.evaluate(()=>{const a=window.__SURGE__,s=a.sim.s;s.time=360;s.phase='playing';s.nextPressure=750;s.nextEncounterAt=1000;s.nextUpgradeAt=900;s.xpNext=1e7;s.pendingLevels=0;s.invulnerable=10000;s.enemies=[];s.fx=[];s.shots=[];s.drops=[];s.nextSpawn=10000;s.weapons=['chain','mist','bubble','drone'].map(id=>({id,level:5,evolution:'a',cooldown:0,casts:0}));s.mods={conductor:1,detonate:1};for(let i=0;i<220;i++){const p=a.physics.spawnPoint(s.player,i*2.399,9+i%9);if(p){a.sim.spawn(['crawler','rammer','gunner','bulwark','weaver'][i%5],false,false,p);const m=s.enemies.at(-1);m.hp=m.maxHp=8000;}}a.ui.game();a.syncUI(true);});
  await page.waitForTimeout(2000);
  const metrics=await page.evaluate(async()=>{const a=window.__SURGE__,steps=[],frames=[],renders=[],draws=[];const original=a.sim.step.bind(a.sim),render=a.renderer.render.bind(a.renderer);a.sim.step=(...args)=>{const t=performance.now();const v=original(...args);steps.push(performance.now()-t);return v;};a.renderer.render=(...args)=>{const t=performance.now();const v=render(...args);renders.push(performance.now()-t);draws.push(a.renderer.renderer.info.render.calls);return v;};let previous=performance.now();await new Promise(resolve=>{const end=performance.now()+5000;const tick=now=>{frames.push(now-previous);previous=now;if(now<end)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});a.sim.step=original;a.renderer.render=render;frames.shift();const stats=list=>{const x=[...list].sort((a,b)=>a-b);return{mean:x.reduce((a,b)=>a+b,0)/x.length,p95:x[Math.floor(x.length*.95)],max:x.at(-1)};};return{phase:a.sim.s.phase,frameMs:stats(frames),simMs:stats(steps),renderSubmissionMs:stats(renders),drawCalls:stats(draws),enemies:a.sim.s.enemies.length,synergies:a.sim.s.stats.synergyTriggers,geometry:a.renderer.renderer.info.memory.geometries};});
  await page.screenshot({path:out+'/'+mapId+'-combat-pressure.png'});await page.keyboard.press('Escape');
  report.maps.push({...identity,pressure:metrics});console.log(mapId,JSON.stringify(metrics));
 }
 if(report.errors.length||report.failedResources.length)throw new Error('Browser errors or failed resources');
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
