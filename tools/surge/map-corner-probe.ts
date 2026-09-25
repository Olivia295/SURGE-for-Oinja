/** Regression fixtures from observed runs; never counted as fair normal-start runs. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHarbor} from '../../src/surge/harbor';
import {initPhysics,Physics} from '../../src/physics/world';
import type {Vec} from '../../src/surge/types';
await initPhysics();const {world}=await createHarbor(731),physics=new Physics(world),dt=1/30;
const results=[];
const fixtures:[string,Vec,Vec][]=[
 ['convoy-crate-corner',{x:-66.32406532108263,y:0,z:-36.582329919475654},{x:-73.05810289844602,y:0,z:-27.077784745040326}],
 ['convoy-retry-target',{x:-66.32406532108263,y:0,z:-36.582329919475654},{x:-73.80598059287696,y:0,z:-12.728170033499985}],
 ['player-quay-corner',{x:42.2,y:0,z:30.9},{x:48,y:0,z:-48}],
];
for(const [name,start,goal] of fixtures){
 let p={...start},time=0,blockedFrames=0,maxBlocked=0,distance=0;const route=world.findPath([p.x,p.y,p.z],[goal.x,goal.y,goal.z]),trace=[];
 for(let i=0;i<1800&&Math.hypot(p.x-goal.x,p.z-goal.z)>.35;i++){
  const q=physics.route(p,goal),d=Math.hypot(q.x-p.x,q.z-p.z),speed=name.startsWith('convoy')?3:9.3;
  const move={x:(q.x-p.x)/Math.max(d,.001)*Math.min(d,speed*dt),y:-.3,z:(q.z-p.z)/Math.max(d,.001)*Math.min(d,speed*dt)};
  const old={...p};
  if(name.startsWith('convoy')){const at={x:p.x+move.x,y:p.y,z:p.z+move.z};if(physics.valid(at.x,at.z))p={...at,y:physics.floor(at.x,at.z,p.y)};}
  else {p=physics.move(p,{...move,y:0},dt);}
  const walked=Math.hypot(p.x-old.x,p.z-old.z);distance+=walked;blockedFrames=walked<.001?blockedFrames+1:0;maxBlocked=Math.max(maxBlocked,blockedFrames);time+=dt;
  if(i%60===0)trace.push({time:+time.toFixed(2),position:{...p},next:q});if(blockedFrames>30)break;
 }
 results.push({name,start,goal,pass:Math.hypot(p.x-goal.x,p.z-goal.z)<.35,time:+time.toFixed(2),distance:+distance.toFixed(2),maxBlocked,end:p,initialRoute:route,trace});
}
const report={note:'Explicit fixtures preserve the actual stopped convoy position and target. Convoys use the shipping Physics.route, valid and floor with the same 0.1m step; player fixture uses the actual Rapier controller.',pass:results.every(r=>r.pass),results};mkdirSync('artifacts/surge',{recursive:true});writeFileSync(process.env.SURGE_CORNER_OUTPUT??'artifacts/surge/map-corner-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));physics.dispose();world.dispose();if(!report.pass)process.exitCode=1;
