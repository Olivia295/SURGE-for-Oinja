import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
for(const id of ['old-harbor','new-harbor']) {
 await page.goto(`http://127.0.0.1:5182/tools/maps/review.html?map=${id}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.mapReview?.ready);await page.waitForTimeout(1200);
 for(const view of ['overview','A','B','C','D','E','F']){await page.evaluate(v=>window.mapReview.setView(v),view);await page.waitForTimeout(250);await page.screenshot({path:`artifacts/maps/${id}-${view}.png`});}
 console.log(id,await page.evaluate(()=>({meshes:window.mapReview.renderer.info.render.calls,triangles:window.mapReview.renderer.info.render.triangles,spawn:window.mapReview.map.spawn.toArray()})));
}
console.log({errors});await browser.close();
