import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const errors=[],records=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle',timeout:30000});await page.waitForFunction(()=>window.__OINJA__?.renderer,{timeout:30000});
 await page.waitForTimeout(1500);
 for(const id of ['old-harbor','new-harbor']){
  await page.evaluate(id=>window.__OINJA__.start({mapId:id,mode:'thunder'}),id);await page.waitForTimeout(1200);
  const views=[['F',43,id==='old-harbor'?145:151,0,0],['A',-110,-47,0,0],['B',10,-63,0,0],['C',125,-33,0,0],['D',id==='old-harbor'?-110:-108,112,-5,0],['E',100,-18,8,Math.PI/2]];
  for(const [zone,x,z,y,yaw] of views){await page.evaluate(({x,z,y,yaw})=>{window.__OINJA__.teleport(x,z,y);window.__OINJA__.input.yaw=yaw;window.__OINJA__.sim.player.hp=window.__OINJA__.sim.player.maxHp;}, {x,z,y,yaw});await page.waitForTimeout(500);records.push({map:id,zone,...await page.evaluate(()=>window.__OINJA__.inspect())});await page.screenshot({path:`artifacts/maps/${id}-game-${zone}.png`});}
 }
 console.log(JSON.stringify({records,errors},null,2));await fs.writeFile('artifacts/maps/browser-review.json',JSON.stringify({records,errors},null,2));
}finally{await browser.close();}
