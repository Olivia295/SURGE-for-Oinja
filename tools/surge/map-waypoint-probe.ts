/** Isolated real-physics waypoint controller regression, using explicit position fixtures. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHarbor} from '../../src/surge/harbor';
import {initPhysics,Physics} from '../../src/physics/world';
import type {Vec3} from '../../src/world/types';
await initPhysics();const {world}=await createHarbor(731),physics=new Physics(world),dt=1/30;
const results=[];
for(const [name,start,end] of [ ['freight-corner',[-65,0,-40],[-53,0,-42]],['north-crossing',[4.3,0,-49.5],[48,0,-48]] ] as [string,Vec3,Vec3][]){
 for(const mode of ['old-200ms','per-frame-capped']){
  let p={x:start[0],y:start[1],z:start[2]},time=0,decisionAt=0,routeAt=0,route:Vec3[]=[],dx=0,dz=0;
  const trace=[];
  for(let frame=0;frame<1800;frame++){
   if(Math.hypot(p.x-end[0],p.z-end[2])<.35)break;
   if(mode==='per-frame-capped'||time>=decisionAt){
    decisionAt=time+.2;
    if(time>=routeAt||!route.length){route=world.findPath([p.x,p.y,p.z],end);routeAt=time+2.5;}
    const localClear=(b:Vec3)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-p.x,b[2]-p.z)/.65));for(let i=0;i<=n;i++){const f=i/n,x=p.x+(b[0]-p.x)*f,z=p.z+(b[2]-p.z)*f,y=p.y+(b[1]-p.y)*f;if(!world.walkableAt(x,z,y,.28)||Math.abs(world.heightAt(x,z,y)-y)>.5)return false;}return true;};
    while(route.length>1&&(mode==='old-200ms'?((Math.hypot(p.x-route[0][0],p.z-route[0][2])<.75&&Math.abs(p.y-route[0][1])<.8)||(Math.hypot(p.x-route[0][0],p.z-route[0][2])<4&&localClear(route[1]))):Math.hypot(p.x-route[0][0],p.z-route[0][2])<.28&&Math.abs(p.y-route[0][1])<.7))route.shift();
    const q=route[0]??end,d=Math.hypot(q[0]-p.x,q[2]-p.z),scale=mode==='old-200ms'?1:Math.min(1,d/(9.3*dt));dx=d>.16?(q[0]-p.x)/d*scale:0;dz=d>.16?(q[2]-p.z)/d*scale:0;
   }
   p=physics.move(p,{x:dx*9.3*dt,y:-.3,z:dz*9.3*dt});p.y=world.heightAt(p.x,p.z,p.y);time+=dt;
   if(frame%300===0)trace.push({time:+time.toFixed(2),position:{...p},waypoint:route[0]});
  }
  results.push({name,mode,pass:Math.hypot(p.x-end[0],p.z-end[2])<.35,time:+time.toFixed(2),end:p,trace});
 }
}
const report={note:'Two suspected player stop coordinates have traversable direct routes in isolation. This probe does not reproduce the active convoy failure; map-corner-probe preserves the actual convoy coordinates. No full-run state is altered.',results};mkdirSync('artifacts/surge',{recursive:true});writeFileSync('artifacts/surge/map-waypoint-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));physics.dispose();world.dispose();
