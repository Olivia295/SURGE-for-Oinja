import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await page.waitForSelector('[data-action="start"]');
 await page.route('**/assets/environment/new-harbor.glb',async route=>{await new Promise(r=>setTimeout(r,600));await route.continue();});
 const before=await page.evaluate(()=>({world:window.__OINJA__.world.id,selected:document.querySelector('[data-action="map-choice"][aria-pressed="true"]')?.getAttribute('data-id')}));
 await page.evaluate(()=>{document.querySelector('[data-action="map-choice"][data-id="new-harbor"]').click();document.querySelector('[data-action="map-choice"][data-id="old-harbor"]').click();});await page.waitForTimeout(6500);
 const after=await page.evaluate(()=>({world:window.__OINJA__.world.id,selected:document.querySelector('[data-action="map-choice"][aria-pressed="true"]')?.getAttribute('data-id'),state:window.__OINJA__.inspect().state}));
 const result={before,after,matches:after.world===after.selected};console.log(JSON.stringify(result,null,2));await fs.writeFile('artifacts/maps/map-preview-race.json',JSON.stringify(result,null,2));await page.screenshot({path:'artifacts/maps/map-preview-race.png'});
}finally{await browser.close();}
