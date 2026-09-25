import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createObservatory} from '../../src/surge/observatory';
import {Physics,initPhysics} from '../../src/physics/world';
import type {Vec3} from '../../src/world/types';
import type {Vec} from '../../src/surge/types';
export async function validateObservatory(){
await initPhysics();const {world,sites}=await createObservatory(731);
const results:any[]=[],trajectories:any[]=[];
const walk=(id:string,start:Vec3,goals:Vec3[])=>{
 const physics=new Physics(world);let p={x:start[0],y:start[1],z:start[2]},frames=0,blocked=0,longestBlocked=0,pass=true;
 for(const goal of goals){const path=world.findPath([p.x,p.y,p.z],goal);if(!path.length){pass=false;break;}
  for(const q of path){for(let f=0;f<2400;f++){const dx=q[0]-p.x,dz=q[2]-p.z,d=Math.hypot(dx,dz);if(d<.2&&Math.abs(p.y-q[1])<.3)break;
   const old=p,step=Math.min(d,9.3/60);p=physics.move(p,{x:dx/Math.max(d,.001)*step,y:0,z:dz/Math.max(d,.001)*step},1/60);frames++;
   blocked=Math.hypot(p.x-old.x,p.z-old.z)<.002?blocked+1:0;longestBlocked=Math.max(longestBlocked,blocked);if(blocked>60||f===2399){pass=false;break;}}
   if(!pass)break;}
  if(!pass)break;}
 const last=goals.at(-1)!,error=Math.hypot(p.x-last[0],p.y-last[1],p.z-last[2]);results.push({id,pass:pass&&error<.5,error,seconds:frames/60,longestBlockedFrames:longestBlocked,end:p});physics.dispose();
};
for(const site of sites)walk(site.id,[0,0,56],[[site.pos.x,site.pos.y,site.pos.z]]);
for(const zone of world.zones)walk(`zone-${zone.id}`,[0,0,56],[zone.center]);
walk('ring-clockwise',[-32,5,-32],[[32,5,-32],[32,5,28],[-32,5,28],[-32,5,-32]]);
walk('ring-counterclockwise',[-32,5,-32],[[-32,5,28],[32,5,28],[32,5,-32],[-32,5,-32]]);
walk('ground-watergarden-loop',[-23,0,-20],[[23,0,-20],[23,0,22],[-23,0,22],[-23,0,-20]]);
walk('ground-outer-loop',[-83,0,-24],[[-83,0,83],[83,0,83],[83,0,-83],[-83,0,-83],[-83,0,-24]]);
walk('bridge-underpass',[-45,0,12],[[45,0,12]]);
const gates=[{id:'obs-relay-ring',p:[-62,0,-35] as Vec3,from:[-62,0,-39] as Vec3,to:[-62,0,-31] as Vec3},{id:'obs-relay-array',p:[65,0,22] as Vec3,from:[65,0,18] as Vec3,to:[65,0,26] as Vec3}];
for(const [index,g] of gates.entries()){
 const live=new Physics(world);let cursor={x:g.from[0],y:g.from[1],z:g.from[2]};for(let f=0;f<90;f++)cursor=live.move(cursor,{x:0,y:0,z:9.3/60},1/60);const physicallyClosed=cursor.z<g.p[2]-.25;
 const before=world.walkableAt(g.p[0],g.p[2],0);world.openShortcut(g.id,index===1);for(let f=0;f<120;f++)world.update(f/60,1/60);
 live.syncShortcuts();for(let f=0;f<90&&cursor.z<g.to[2]-.05;f++)cursor=live.move(cursor,{x:0,y:0,z:Math.min(9.3/60,g.to[2]-cursor.z)},1/60);
 results.push({id:g.id+'-live-collision-change',pass:physicallyClosed&&cursor.z>g.to[2]-.1,physicallyClosed,openedEnd:cursor});live.dispose();
 results.push({id:g.id+'-collision-change',pass:!before&&world.walkableAt(g.p[0],g.p[2],0)});walk(g.id+'-open-door',g.from,[g.to]);
}
const cases:[string,Vec3,Vec3][]=[['flat-court',[-10,0,56],[10,0,56]],['west-up',[-73,0,0],[-31,5,0]],['west-down',[-31,5,0],[-73,0,0]],['east-up',[73,0,0],[31,5,0]],['east-down',[31,5,0],[73,0,0]],['north-ring-edge',[-33,5,-34.5],[33,5,-34.5]],['south-ring-edge',[-33,5,30.5],[33,5,30.5]]];
for(const side of [-4.1,4.1])for(const [name,from,to] of [['west',-73,-31],['east',73,31]] as const){cases.push([`${name}-edge-${side}-up`,[from,0,side],[to,5,side]],[`${name}-edge-${side}-down`,[to,5,side],[from,0,side]]);}
for(const hz of [30,60,120])for(const [id,start,goal] of cases){
 const physics=new Physics(world),dt=1/hz,dx=goal[0]-start[0],dz=goal[2]-start[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;let p:Vec={x:start[0],y:start[1],z:start[2]},slow=0,longestSlow=0;const frames:any[]=[];
 for(let f=0;f<hz*15;f++){const progress=(p.x-start[0])*ux+(p.z-start[2])*uz;if(progress>=length-.05)break;const old=p;p=physics.move(p,{x:ux*9.3*dt,y:0,z:uz*9.3*dt},dt);const ratio=((p.x-old.x)*ux+(p.z-old.z)*uz)/(9.3*dt);slow=ratio<.5?slow+1:0;longestSlow=Math.max(longestSlow,slow);frames.push({t:(f+1)*dt,x:p.x,y:p.y,z:p.z,speedRatio:ratio});}
 const ratios=frames.map(f=>f.speedRatio).sort((a,b)=>a-b),p05=ratios[Math.floor(ratios.length*.05)]??0,distance=(p.x-start[0])*ux+(p.z-start[2])*uz,pass=distance>=length-.05&&longestSlow<=2&&p05>.9&&Math.abs(p.y-goal[1])<.15;
 trajectories.push({id,hz,pass,p05SpeedRatio:p05,longestSlowFrames:longestSlow,meanSpeedRatio:distance/(frames.length*9.3*dt),seconds:frames.length*dt,end:p,frames});physics.dispose();
}
let meshes=0,triangles=0;world.group.traverse(o=>{if('isMesh'in o&&o.isMesh){const g=(o as any).geometry;meshes++;triangles+=(g.index?.count??g.attributes.position.count)/3;}});
const sourcePaths=['src/surge/observatory.ts','src/surge/world-navigation.ts','src/physics/world.ts','src/world/modeling.ts','tools/surge/observatory-qa.ts'];
const report={pass:results.every(r=>r.pass)&&trajectories.every(r=>r.pass),note:'Real Rapier traversal and constant-input 9.3m/s continuous movement. Explicit fixture starts; no height overwrite, teleport, or collision suppression. Every candidate is reached before opening optional shortcuts.',sources:Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),geometry:{meshes,triangles,colliders:world.colliders.length,occluders:world.occluders.length},navigation:{nodes:world.nav.waypoints.length,edges:world.nav.edges.length},eventKinds:Object.fromEntries([...new Set(sites.map(s=>s.kind))].map(k=>[k,sites.filter(s=>s.kind===k).length])),results,trajectories};
world.dispose();return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await validateObservatory();mkdirSync('artifacts/observatory',{recursive:true});writeFileSync('artifacts/observatory/qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,sources:undefined,trajectories:report.trajectories.map(({frames,...r})=>r)},null,2));if(!report.pass)process.exitCode=1;}
