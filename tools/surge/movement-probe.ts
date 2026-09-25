/** Continuous trajectory regression, not an end-point-only reachability test. */
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createHarbor} from '../../src/surge/harbor';
import {initPhysics,Physics} from '../../src/physics/world';
import type {Vec} from '../../src/surge/types';
const stage=process.env.MOVEMENT_STAGE??'after',legacy=stage==='before';
const fixtures:[string,Vec,Vec][]=[
 ['ordinary-plaza',{x:-16,y:0,z:12},{x:16,y:0,z:12}],
 ['ordinary-north-street',{x:-20,y:0,z:-48},{x:20,y:0,z:-48}],
 ['crate-edge-forward',{x:-70,y:0,z:-36.34},{x:-60,y:0,z:-36.34}],
 ['crate-edge-backward',{x:-60,y:0,z:-36.34},{x:-70,y:0,z:-36.34}],
 ['west-uphill',{x:-73,y:0,z:-24},{x:-38,y:5.5,z:-24}],
 ['west-downhill',{x:-38,y:5.5,z:-24},{x:-73,y:0,z:-24}],
 ['east-uphill',{x:73,y:0,z:-24},{x:38,y:5.5,z:-24}],
 ['east-downhill',{x:38,y:5.5,z:-24},{x:73,y:0,z:-24}],
 ['west-ramp-edge-up',{x:-73,y:0,z:-26.6},{x:-38,y:5.5,z:-26.6}],
 ['west-ramp-edge-down',{x:-38,y:5.5,z:-26.6},{x:-73,y:0,z:-26.6}],
 ['basin-ramp-down',{x:60.5,y:-.24,z:26.3},{x:60.5,y:-2.4,z:42}],
 ['basin-ramp-up',{x:60.5,y:-2.4,z:42},{x:60.5,y:-.24,z:26.3}],
];
await initPhysics();const {world}=await createHarbor(731),results=[];
for(const hz of [30,60,120])for(const [id,start,end] of fixtures){
 const physics=new Physics(world);if(process.env.MOVEMENT_AUTOSTEP==='off')physics.controller.disableAutostep();if(process.env.MOVEMENT_NUDGE)physics.controller.setNormalNudgeFactor(Number(process.env.MOVEMENT_NUDGE));
 const dt=1/hz,dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 let p={...start},longestSlow=0,slow=0,maxYStep=0,total=0;const trajectory=[];
 for(let frame=0;frame<hz*12;frame++){
  if((p.x-start.x)*ux+(p.z-start.z)*uz>=length-.02)break;
  const before={...p},delta={x:ux*9.3*dt,y:legacy?-.3:0,z:uz*9.3*dt};
  p=physics.move(p,delta,legacy?undefined:dt);if(legacy)p.y=physics.floor(p.x,p.z,p.y);
  const forward=(p.x-before.x)*ux+(p.z-before.z)*uz,ratio=forward/(9.3*dt);total+=forward;
  slow=ratio<.5?slow+1:0;longestSlow=Math.max(longestSlow,slow);maxYStep=Math.max(maxYStep,Math.abs(p.y-before.y));
  trajectory.push({t:+((frame+1)*dt).toFixed(5),x:p.x,y:p.y,z:p.z,speed:forward/dt,ratio,grounded:physics.controller.computedGrounded(),collisions:physics.controller.numComputedCollisions(),...(slow===5?{contacts:Array.from({length:physics.controller.numComputedCollisions()},(_,i)=>{const c=physics.controller.computedCollision(i);return c?{handle:c.collider?.handle,id:[...physics.colliders].find(([,collider])=>collider.handle===c.collider?.handle)?.[0],normal:c.normal1,witness:c.witness1}:null;})}:{})});
 }
 const ratios=trajectory.slice(4).map(p=>p.ratio).sort((a,b)=>a-b),p05=ratios[Math.floor(ratios.length*.05)]??0,mean=total/(trajectory.length*9.3*dt),arrived=total>=length-.02;
 results.push({id,hz,arrived,seconds:trajectory.length*dt,meanSpeedRatio:mean,p05SpeedRatio:p05,slowFrames:trajectory.filter(f=>f.ratio<.5).length,longestSlowFrames:longestSlow,maxYStep,end:p,trajectory});physics.dispose();
}
const sources=Object.fromEntries(['src/physics/world.ts','src/surge/simulation.ts','src/world/modeling.ts','src/surge/harbor.ts','src/surge/world-navigation.ts','tools/surge/movement-probe.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const report={stage,note:'Constant 9.3m/s input, real Rapier collisions, complete per-frame trajectories at 30/60/120Hz; explicit fixture spawn positions. Before matches old simulation floor overwrite; after uses physics dt and preserves controller y. No teleport, collision filtering, or speed changes.',sources,results};
mkdirSync('artifacts/surge-movement',{recursive:true});writeFileSync(`artifacts/surge-movement/physics-${stage}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(results.map(({trajectory,...r})=>r),null,2));world.dispose();
