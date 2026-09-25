import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await page.waitForSelector('[data-action="start"]');
 await page.evaluate(()=>window.__OINJA__.start({mapId:'old-harbor',mode:'thunder'}));
 report.beforeSave=await page.evaluate(async()=>{
  const a=window.__OINJA__,ev=a.sim.events.find(e=>e.id==='bridge');ev.state='complete';ev.progress=25;a.world.openShortcut('bridge');a.world.update(a.sim.time,9);a.physics.syncShortcuts();a.teleport(-38,98,4);
  const snapshot=a.sim.snapshot();const result={events:a.sim.events.map(e=>({id:e.id,state:e.state})),mapSites:a.world.eventSites.map(e=>e.id),feet:snapshot.player.pos,bridgeHeight:a.world.heightAt(-38,98,4),bridgeCollider:a.world.colliders.find(c=>c.tag==='ramp'&&c.center[0]===-38&&c.center[2]===98)?.enabled};
  await a.menu();localStorage.setItem('oinja.run',JSON.stringify(snapshot));return result;
 });
 await page.reload({waitUntil:'networkidle'});await page.waitForSelector('[data-action="continue"]');await page.locator('[data-action="continue"]').click();await page.waitForSelector('[data-action="resume"]');
 report.restoredPaused=await page.evaluate(()=>{const a=window.__OINJA__;return {phase:a.sim.phase,feet:a.sim.player.pos,bridgeHeight:a.world.heightAt(-38,98,4),bridgeCollider:a.world.colliders.find(c=>c.tag==='ramp'&&c.center[0]===-38&&c.center[2]===98)?.enabled};});
 await page.screenshot({path:'artifacts/maps/audit-restored-bridge.png'});
 await page.locator('[data-action="resume"]').click();await page.waitForTimeout(1800);
 report.afterResume=await page.evaluate(()=>{const a=window.__OINJA__;return {phase:a.sim.phase,time:a.sim.time,feet:a.sim.player.pos,bridgeHeight:a.world.heightAt(-38,98,4)};});
 console.log(JSON.stringify(report,null,2));await fs.writeFile('artifacts/maps/integration-audit.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
