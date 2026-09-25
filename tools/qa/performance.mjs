import{chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';
const out='artifacts/performance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await page.goto(process.env.OINJA_QA_URL??'http://127.0.0.1:4175/');await page.waitForFunction(()=>window.__OINJA__?.world);
const environment=await page.evaluate(()=>{const gl=window.__OINJA__.renderer.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,hardwareConcurrency:navigator.hardwareConcurrency};});
const results=[];
for(const mapId of ['old-harbor','new-harbor'])for(const count of [220,260]){
 await page.evaluate(async({mapId,count})=>{
 const api=window.__OINJA__;await api.start({mapId,mode:'thunder'});const s=api.sim,p=s.player;s.time=800;s.bossSpawned=true;s.nextSpawn=1e8;s.enemies=[];p.invulnerable=1e8;p.attackTimer=1e8;
 api.input.yaw=0;api.input.pitch=.45;api.renderer.applySettings({...api.renderer.settings,quality:'medium',damageNumbers:false});
 for(let i=0;i<count;i++){const pos=api.physics.spawnPoint(p.pos,i*2.399963,10+(i%5)*5);if(pos)s.spawn(['crawler','rammer','gunner','bulwark','weaver'][i%5],pos);}
 },{mapId,count});await page.waitForTimeout(2500);
 const data=await page.evaluate(async()=>{
 const samples=[],simSamples=[];let prev=performance.now();const start=prev;
 const sim=window.__OINJA__.sim,original=sim.tick.bind(sim);sim.tick=function(...args){const t=performance.now();const r=original(...args);simSamples.push(performance.now()-t);return r;};
 await new Promise(resolve=>{function sample(t){samples.push(t-prev);prev=t;if(t-start<7000)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});sim.tick=original;
 samples.sort((a,b)=>a-b);simSamples.sort((a,b)=>a-b);
 const mean=samples.reduce((a,b)=>a+b,0)/samples.length,api=window.__OINJA__;
 return{frames:samples.length,meanMs:mean,fps:1000/mean,p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1),simulationP95:simSamples[Math.floor(simSamples.length*.95)],entities:api.sim.enemies.length,projectiles:api.sim.projectiles.length,render:api.renderer.renderer.info.render,memory:api.renderer.renderer.info.memory};
 });
 results.push({mapId,targetCount:count,...data});await page.screenshot({path:out+'/'+mapId+'-'+count+'.png'});console.log(JSON.stringify(results.at(-1)));
}
await writeFile(out+'/pressure.json',JSON.stringify({recordedAt:new Date().toISOString(),device:'Apple M1 Max / 32 GB / macOS 26.4',viewport:'1920x1080 DPR1',quality:'medium',method:'Real render loop and enemy AI. Player invulnerable and basic attack disabled only to hold concurrency constant. 2.5s warmup, 7s measurements.',environment,results,errors},null,2));await browser.close();