import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=root+'artifacts/surge-runtime';await mkdir(out,{recursive:true});
const pressureOnly=process.argv.includes('--pressure-only');
const chosenPopulation=Number(process.argv.find(a=>a.startsWith('--population='))?.split('=')[1]??0);
if(chosenPopulation&&![220,260].includes(chosenPopulation))throw new Error('Population must be 220 or 260');
const populations=chosenPopulation?[chosenPopulation]:[220,260];
const sourceHashes={};for(const path of ['src/surge/main.ts','src/surge/simulation.ts','src/surge/renderer.ts','src/surge/render-pool.ts','src/physics/world.ts','src/surge/harbor.ts','src/surge/world-navigation.ts','src/surge/content.ts','src/surge/save.ts'])sourceHashes[path]=createHash('sha256').update(await readFile(root+path)).digest('hex');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-precise-memory-info','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const report={date:new Date().toISOString(),scope:pressureOnly?'Final pressure only after exact AABB segment intersection navigation, save validation and terminal-event fixes':'Full integrated runtime QA',sourceHashes,url:process.env.SURGE_URL??'http://127.0.0.1:4175/',environment:{viewport:'1920x1080',deviceScaleFactor:1,quality:'medium',browser:await browser.version()},fixture:{description:'Integrated main-loop pressure, not a normal run or balance test.',changes:['Initial enemy population is injected, including all five enemy kinds.','Player weapons and passive basic shots are disabled to hold enemy population.','Player has test invulnerability, normal health values.','Natural waves and additional weaver summons are suppressed after population is created.','AI movement, windup, attacks, enemy projectiles, physical world queries, UI, and rendering run through the real main loop.'],warmupSeconds:2,sampleSeconds:6},errors:[],failedResources:[],pressure:[],restarts:[],context:null};
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.failedResources.push({status:r.status(),url:r.url()});});
try{
 await page.goto(report.url);await page.waitForFunction(()=>window.__SURGE__?.renderer&&window.__SURGE__?.world,{timeout:60000});
 await page.evaluate(()=>{const api=window.__SURGE__;api.profile.settings={...api.profile.settings,quality:'medium',volume:0,shake:false,cameraDistance:26};api.renderer.applySettings(api.profile.settings);});
 report.environment.graphics=await page.evaluate(()=>{const r=window.__SURGE__.renderer.renderer,gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):'unavailable',pixelRatio:r.getPixelRatio(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]};});
 for(const population of populations){
  await page.evaluate(async population=>{
   const api=window.__SURGE__;await api.start('fist',0,'balanced');const sim=api.sim,s=sim.s;
   s.weapons=[];s.basicCooldown=1000000;s.nextSpawn=1000000;s.invulnerable=1000000;s.enemies=[];s.shots=[];s.drops=[];s.fx=[];s.support=null;s.time=360;s.notes='Controlled pressure fixture';
   for(let i=0;i<population;i++){const angle=i*2.399963229728653;const pos=api.physics.spawnPoint(s.player,angle,8+(i%7)*1.7);if(!pos)throw new Error('No valid fixture spawn position at '+i);sim.spawn(['crawler','rammer','gunner','bulwark','weaver'][i%5],false,false,pos);}
   sim.spawn=()=>{};
   const metrics={active:false,steps:[],renders:[],queryCounts:{},alive:[],shots:[],fx:[],draws:[],triangles:[]};window.__runtimeMetrics=metrics;
   const step=sim.step.bind(sim);sim.step=(...args)=>{const t=performance.now();const r=step(...args);if(metrics.active)metrics.steps.push(performance.now()-t);return r;};
   for(const name of ['move','floor','clear','valid','route','spawnPoint']){const original=api.physics[name].bind(api.physics);api.physics[name]=(...args)=>{if(metrics.active)metrics.queryCounts[name]=(metrics.queryCounts[name]??0)+1;return original(...args);};}
   const renderer=api.renderer;if(!renderer.__runtimeOriginalRender)renderer.__runtimeOriginalRender=renderer.render.bind(renderer);
   renderer.render=(...args)=>{const m=window.__runtimeMetrics,t=performance.now();const result=renderer.__runtimeOriginalRender(...args);if(m?.active){m.renders.push(performance.now()-t);m.alive.push(api.sim.s.enemies.filter(e=>e.hp>0).length);m.shots.push(api.sim.s.shots.length);m.fx.push(api.sim.s.fx.length);m.draws.push(renderer.renderer.info.render.calls);m.triangles.push(renderer.renderer.info.render.triangles);}return result;};
  },population);
  await page.waitForTimeout(2000);
  const result=await page.evaluate(async()=>{
   const api=window.__SURGE__,m=window.__runtimeMetrics,startTime=api.sim.s.time;const frameTimes=[];let previous=performance.now();m.active=true;
   await new Promise(resolve=>{const end=performance.now()+6000;function sample(now){frameTimes.push(now-previous);previous=now;if(now<end)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});m.active=false;frameTimes.shift();
   const stats=arr=>{const values=[...arr].sort((a,b)=>a-b);return{count:values.length,min:values[0],max:values.at(-1),average:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),p95:values[Math.floor(values.length*.95)]};};
   return{phase:api.sim.s.phase,simulationTime:[startTime,api.sim.s.time],frameMs:stats(frameTimes),averageFPS:1000/stats(frameTimes).average,cpuSimulationStepMs:stats(m.steps),cpuRenderSubmissionMs:stats(m.renders),alive:stats(m.alive),shots:stats(m.shots),fx:stats(m.fx),drawCalls:stats(m.draws),triangles:stats(m.triangles),physicsQueries:m.queryCounts,memory:{...api.renderer.renderer.info.memory},heap:performance.memory?.usedJSHeapSize};
  });
  report.pressure.push({initialPopulation:population,...result});console.log('PRESSURE',population,JSON.stringify(result));await page.screenshot({path:out+`/pressure-${population}${pressureOnly?'-final':''}.png`});
 }
 if(!pressureOnly){
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');
 for(let cycle=1;cycle<=3;cycle++){
  await page.evaluate(async()=>{const api=window.__SURGE__;window.__runtimeMetrics.active=false;await api.start('fist',0,'balanced');const s=api.sim.s;s.nextSpawn=1000000;s.basicCooldown=1000000;s.weapons=[];s.phase='paused';for(let i=0;i<5;i++)api.sim.spawn(['crawler','rammer','gunner','bulwark','weaver'][i],false,false,{x:s.player.x+(i-2)*2,y:s.player.y,z:s.player.z-5});});
  await page.waitForTimeout(450);await cdp.send('HeapProfiler.collectGarbage');
  const snapshot=await page.evaluate(()=>{const a=window.__SURGE__,r=a.renderer;return{geometry:r.renderer.info.memory.geometries,textures:r.renderer.info.memory.textures,actors:r.actors.size,sceneChildren:r.scene.children.length,heap:performance.memory?.usedJSHeapSize,programs:r.renderer.info.programs.length,phase:a.sim.s.phase};});
  report.restarts.push({cycle,...snapshot});console.log('RESTART',JSON.stringify(report.restarts.at(-1)));
 }
 await page.screenshot({path:out+'/restart-3.png'});
 await page.evaluate(async()=>{await window.__SURGE__.start('fist',0,'balanced');});await page.waitForTimeout(450);
 const before=await page.evaluate(()=>{const api=window.__SURGE__,canvas=document.querySelector('#game-canvas'),gl=api.renderer.renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw new Error('WEBGL_lose_context unavailable');window.__contextProbe={ext,events:[]};for(const name of ['webglcontextlost','webglcontextrestored'])canvas.addEventListener(name,()=>window.__contextProbe.events.push({name,time:performance.now()}));const before={time:api.sim.s.time,phase:api.sim.s.phase};ext.loseContext();return before;});
 await page.waitForFunction(()=>window.__SURGE__.renderer.renderer.getContext().isContextLost()&&window.__SURGE__.sim.s.phase==='paused');
 const frozen=await page.evaluate(()=>window.__SURGE__.sim.s.time);await page.waitForTimeout(800);
 const lost=await page.evaluate(()=>({phase:window.__SURGE__.sim.s.phase,time:window.__SURGE__.sim.s.time,contextLost:window.__SURGE__.renderer.renderer.getContext().isContextLost()}));
 await page.screenshot({path:out+'/context-lost.png'});
 await page.evaluate(()=>window.__contextProbe.ext.restoreContext());await page.waitForFunction(()=>window.__contextProbe.events.some(e=>e.name==='webglcontextrestored'),{timeout:10000});await page.waitForTimeout(500);
 const restored=await page.evaluate(()=>({time:window.__SURGE__.sim.s.time,phase:window.__SURGE__.sim.s.phase,contextLost:window.__SURGE__.renderer.renderer.getContext().isContextLost(),drawCalls:window.__SURGE__.renderer.renderer.info.render.calls}));
 await page.screenshot({path:out+'/context-restored-paused.png'});await page.keyboard.press('Escape');await page.waitForTimeout(500);
 const resumed=await page.evaluate(()=>({time:window.__SURGE__.sim.s.time,phase:window.__SURGE__.sim.s.phase,events:window.__contextProbe.events,drawCalls:window.__SURGE__.renderer.renderer.info.render.calls,memory:{...window.__SURGE__.renderer.renderer.info.memory}}));
 report.context={before,lost,restored,resumed,pausedTimeStable:Math.abs(lost.time-frozen)<1e-8,restoredPaused:restored.phase==='paused'&&!restored.contextLost,resumedAndAdvanced:resumed.phase==='playing'&&resumed.time>restored.time};
 await page.screenshot({path:out+'/context-resumed.png'});console.log('CONTEXT',JSON.stringify(report.context));
 }
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;}finally{
 await writeFile(out+(pressureOnly?'/runtime-qa-final-pressure.json':'/runtime-qa.json'),JSON.stringify(report,null,2));await browser.close();
}
