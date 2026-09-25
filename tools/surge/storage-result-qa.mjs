import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/surge-worlds/storage';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage();const report={scope:'Injected unavailable-storage regression, not a natural run.',checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
try{
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:4175');await page.locator('[data-act="start"]').waitFor({timeout:60000});await page.locator('[data-act="start"]').click();await page.waitForFunction(()=>window.__SURGE__?.sim?.s.phase==='playing');
 await page.evaluate(()=>{Storage.prototype.removeItem=()=>{throw new DOMException('Storage unavailable','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('Storage unavailable','SecurityError');};window.__SURGE__.sim.end(false,'回路暂时中断 · 带着新发现再来一次');});
 await page.locator('[data-act="restart"]').waitFor();report.checks.push({name:'Result and restart remain visible when storage throws',pass:await page.locator('[data-act="restart"]').isVisible()});report.checks.push({name:'No uncaught exception',pass:report.errors.length===0});
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
