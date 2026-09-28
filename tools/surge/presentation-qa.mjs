import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.SURGE_URL??'http://127.0.0.1:4185/';
const out=process.env.SURGE_QA_OUT??'artifacts/presentation-2026-09-28';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={url,checks:[],errors:[]};
try{
 for(const entry of [
  {locale:'en-AU',expected:'en'}, {locale:'zh-CN',expected:'zh-CN'}, {locale:'zh-TW',expected:'zh-CN'},
  {locale:'fr-FR',expected:'en'}, {locale:'de-DE',languages:['de-DE','zh-HK','en-AU'],expected:'zh-CN'},
  {locale:'en-AU',saved:'zh-CN',expected:'zh-CN'}, {locale:'zh-CN',saved:'en',expected:'en'},
  {locale:'en-AU',saved:'invalid',expected:'en'}, {locale:'zh-CN',blocked:true,expected:'zh-CN'},
 ]){
  const context=await browser.newContext({locale:entry.locale,viewport:{width:1440,height:900}});
  await context.addInitScript(entry=>{
   if(entry.languages)Object.defineProperty(navigator,'languages',{value:entry.languages});
   if(entry.saved)localStorage.setItem('oinja-surge-locale',entry.saved);
   if(entry.blocked){Storage.prototype.getItem=()=>{throw new Error('Test: blocked storage');};Storage.prototype.setItem=()=>{throw new Error('Test: blocked storage');};}
  },entry);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(url);await page.locator('[data-act="start"]').waitFor({timeout:60000});
  assert.equal(await page.getAttribute('html','lang'),entry.expected);
  assert.equal(await page.locator(`[data-act="locale"][data-id="${entry.expected}"]`).getAttribute('aria-pressed'),'true');
  if(!entry.saved&&!entry.blocked)assert.equal(await page.evaluate(()=>localStorage.getItem('oinja-surge-locale')),null,'automatic detection must not become a saved manual preference');
  report.checks.push({...entry,pass:true});await context.close();
 }
 const context=await browser.newContext({locale:'en-AU',viewport:{width:1440,height:900}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(url);await page.locator('[data-act="start"]').waitFor({timeout:60000});await page.screenshot({path:out+'/menu-en.jpg',type:'jpeg',quality:88,animations:'disabled'});
 await page.locator('[data-act="locale"][data-id="zh-CN"]').click();await page.reload();await page.locator('[data-act="start"]').waitFor({timeout:60000});assert.equal(await page.getAttribute('html','lang'),'zh-CN');report.checks.push({name:'Manual choice survives reload',pass:true});
 await page.locator('[data-act="locale"][data-id="en"]').click();
 await page.locator('[data-act="location"][data-id="tidal-observatory"]').click();await page.locator('[data-act="start"]').click();await page.locator('.su-hud:not([hidden])').waitFor({timeout:60000});
 await page.keyboard.down('KeyS');await page.waitForTimeout(400);await page.keyboard.up('KeyS');await page.keyboard.press('KeyE');await page.locator('[data-act="choose"]').first().waitFor();await page.locator('[data-act="choose"]').first().click();await page.waitForTimeout(1000);
 await page.screenshot({path:out+'/observatory-en.jpg',type:'jpeg',quality:88});
 await page.keyboard.press('Escape');await page.locator('[data-act="resume"]').waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('oinja.surge.run.v2')));
 await page.locator('[data-act="locale"][data-id="zh-CN"]').click();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('oinja.surge.run.v2')));
 assert.deepEqual(after,saved);assert.equal(await page.getAttribute('html','lang'),'zh-CN');report.checks.push({name:'Language change keeps the paused run intact',pass:true});
 assert.equal(report.errors.length,0);await context.close();
}catch(error){report.failure=String(error);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
