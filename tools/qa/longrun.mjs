import {chromium} from 'playwright';import{mkdir,writeFile}from'node:fs/promises';
const out='artifacts/longrun';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-webgl','--ignore-gpu-blocklist']});
const runs=[];
for(const mapId of ['old-harbor','new-harbor'])for(const mode of ['beginner','thunder']){
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});const id=mapId+'-'+mode;const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
 await page.goto('http://127.0.0.1:4185/');await page.waitForFunction(()=>window.__OINJA__?.world);
 await page.evaluate(async({mapId,mode})=>{await window.__OINJA__.start({mapId,mode,rightSkill:'cannon',leftSkill:'lightning'});window.__OINJA__.renderer.applySettings({...window.__OINJA__.renderer.settings,quality:'low'});}, {mapId,mode});
 await page.evaluate(()=>{
 const api=window.__OINJA__;const v=(x,y,z)=>({x,y,z});let lastSkill=0;const samples=[];window.__samples=samples;
 api.input.frame=()=>{
 const s=api.sim,p=s.player,ph=api.physics,t=s.time;
 const len=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);const visible=e=>ph.clear(v(p.pos.x,p.pos.y+1,p.pos.z),v(e.pos.x,e.pos.y+.7,e.pos.z));
 const living=s.enemies.filter(e=>e.hp>0);const near=living.sort((a,b)=>len(a.pos,p.pos)-len(b.pos,p.pos));const target=near.find(e=>e.boss&&len(e.pos,p.pos)<22&&visible(e))??near.find(e=>visible(e));
 const aim=target?v(target.pos.x,target.pos.y+.65,target.pos.z):v(p.pos.x,p.pos.y,p.pos.z-12);
 let tx=50+Math.cos(t*.045)*27,tz=105+Math.sin(t*.045)*27;
 const loot=s.pickups.filter(e=>len(e.pos,p.pos)<16&&ph.clear(v(p.pos.x,p.pos.y+.5,p.pos.z),v(e.pos.x,e.pos.y+.5,e.pos.z))).sort((a,b)=>len(a.pos,p.pos)-len(b.pos,p.pos))[0];
 if(loot&&(!near[0]||len(near[0].pos,p.pos)>3.5)){tx=loot.pos.x;tz=loot.pos.z;}
 let dx=tx-p.pos.x,dz=tz-p.pos.z,d=Math.hypot(dx,dz)||1;dx/=d;dz/=d;
 for(const e of near.slice(0,10)){const r=len(e.pos,p.pos);if(r<6&&r>.05){const push=(6-r)/3;dx+=(p.pos.x-e.pos.x)/r*push;dz+=(p.pos.z-e.pos.z)/r*push;}}
 d=Math.hypot(dx,dz)||1;dx/=d;dz/=d;
 const a=Math.atan2(dz,dx);for(const shift of [0,.5,-.5,1,-1,1.7,-1.7,Math.PI]){const xx=Math.cos(a+shift),zz=Math.sin(a+shift),dest=v(p.pos.x+xx*2,p.pos.y+.7,p.pos.z+zz*2);if(ph.map.walkableAt(dest.x,dest.z,p.pos.y,.6)&&ph.clear(v(p.pos.x,p.pos.y+.7,p.pos.z),dest)){dx=xx;dz=zz;break;}}
 if(target){api.input.yaw=Math.atan2(p.pos.x-target.pos.x,p.pos.z-target.pos.z);api.input.pitch=.45;}
 if(t-lastSkill>.12&&p.barrierTime<=0){
 lastSkill=t;
 if(p.cannonTime<=0){
 if(p.levels.lightning&&p.cooldowns.lightning<=0&&target&&len(target.pos,p.pos)<22)s.cast('lightning',aim);
 if(p.levels.mist&&p.cooldowns.mist<=0&&near[0]&&len(near[0].pos,p.pos)<5)s.cast('mist',v(p.pos.x,p.pos.y,p.pos.z));
 if(p.levels.cannon&&p.cooldowns.cannon<=0&&p.energy>=s.cost('cannon')&&target)s.cast('cannon',aim);
 else if(p.hand==='right'&&p.levels.grapple&&p.cooldowns.grapple<=0&&target)s.cast('grapple',aim);
 else if(p.hand==='right'&&p.levels.shield&&p.cooldowns.shield<=0){s.cast('shield',aim);s.cast('shield',aim);}
 if(p.levels.barrier&&p.cooldowns.barrier<=0&&near[0]&&len(near[0].pos,p.pos)>13&&p.energy<40)s.cast('barrier',aim);
 }
 }
 return{x:dx,z:dz,aim,jump:false,fire:true};
 };
 let lastSample=-1;
 window.__botTimer=setInterval(()=>{
 const s=api.sim;if(!s)return;
 if(s.phase==='upgrade'){const rank=c=>c.skill==='cannon'?100:c.skill==='lightning'?95:c.id==='core:bubble'?90:c.id==='core:health'?85:c.id==='core:mobility'?70:c.skill?50:20;const c=[...s.choices].sort((a,b)=>rank(b)-rank(a))[0];if(c)api.choose(c.id);}
 if(Math.floor(s.time/30)!==lastSample){lastSample=Math.floor(s.time/30);samples.push({time:s.time,hp:s.player.hp,kills:s.player.kills,level:s.player.level,enemies:s.enemies.length,phase:s.phase,drawCalls:api.renderer.renderer.info.render.calls});}
 },100);
 });
 runs.push({id,page,errors,done:false,start:Date.now()});console.log('START',id);
}
for(let pass=0;pass<28;pass++){
 await new Promise(r=>setTimeout(r,45000));
 for(const run of runs){if(run.done)continue;const data=await run.page.evaluate(()=>({inspect:window.__OINJA__.inspect(),time:window.__OINJA__.sim.time,kills:window.__OINJA__.sim.player.kills,level:window.__OINJA__.sim.player.level,samples:window.__samples}));
 console.log(run.id,JSON.stringify(data.inspect),data.time.toFixed(1),'kills',data.kills,'level',data.level);
 await writeFile(out+'/'+run.id+'.json',JSON.stringify({id:run.id,wallSeconds:(Date.now()-run.start)/1000,...data,errors:run.errors},null,2));
 if(['won','lost'].includes(data.inspect.phase)||pass===27){run.done=true;await run.page.screenshot({path:out+'/'+run.id+'-end.png'});await run.page.close();}else if(pass%4===0)await run.page.screenshot({path:out+'/'+run.id+'-'+Math.floor(data.time)+'.png'});
 }
 if(runs.every(r=>r.done))break;
}
await browser.close();