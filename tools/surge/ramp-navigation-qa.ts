import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createObservatory} from '../../src/surge/observatory';
import {createHarbor} from '../../src/surge/harbor';
import {initPhysics,Physics} from '../../src/physics/world';
import type {MapWorld,Vec3} from '../../src/world/types';

export async function validateRampNavigation(){
 await initPhysics();const results:any[]=[];
 for(const [id,create] of [['observatory',createObservatory],['harbor',createHarbor]] as const){
  const {world}=await create(731);
  const cases:[string,Vec3,Vec3[]][] = id==='observatory' ? [
   ['reported-west-side',[-54.6335,-.0523,5.1494],[[-54,0,-25]]],
   ['west-low-clearance-crossing',[-57,0,9],[[-57,0,-9]]],
   ['east-low-clearance-crossing',[57,0,9],[[57,0,-9]]],
   ['west-ramp-return',[-73,0,0],[[-32,5,-16],[-54,0,-25],[-73,0,0]]],
   ['east-ramp-return',[73,0,0],[[31,5,18],[46,0,8],[73,0,0]]],
   ['bridge-clearance',[-40,0,12],[[-23,0,12]]],
   ['high-ramp-clearance',[-42,0,9],[[-42,0,-9]]],
  ] : [
   ['relay-to-convoy',[4,5.5,-24],[[-53,0,-42]]],
   ['west-low-clearance-crossing',[-58,0,-18],[[-58,0,-30]]],
   ['east-low-clearance-crossing',[65,0,-18],[[65,0,-30]]],
   ['west-ramp-return',[-73,0,-24],[[4,5.5,-24],[-73,0,-24],[-53,0,-42]]],
   ['east-ramp-return',[73,0,-24],[[4,5.5,-24],[73,0,-24],[51,0,2]]],
   ['bridge-clearance',[0,0,-30],[[0,0,-18]]],
  ];
  for(const [name,start,goals] of cases){
   const physics=new Physics(world);let p={x:start[0],y:start[1],z:start[2]},blocked=0,maxBlocked=0,time=0,pass=true;const trace:any[]=[],initialRoute=world.findPath(start,goals[0]);
   for(const goal of goals){for(let f=0;f<60*120;f++){
    if(Math.hypot(p.x-goal[0],p.z-goal[2])<.35&&Math.abs(p.y-goal[1])<.4)break;
    const q=physics.route(p,{x:goal[0],y:goal[1],z:goal[2]}),dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,9.3/60),old=p;
    p=physics.move(p,{x:dx/Math.max(d,.00001)*step,y:0,z:dz/Math.max(d,.00001)*step},1/60);time+=1/60;
    blocked=Math.hypot(p.x-old.x,p.z-old.z)<.002?blocked+1:0;maxBlocked=Math.max(maxBlocked,blocked);
    if(f%60===0)trace.push({t:time,p:{...p},waypoint:q,goal});
    if(blocked>60||f===60*120-1){pass=false;break;}
   }if(!pass)break;}
   results.push({map:id,name,pass,time,maxBlocked,start,goals,initialRoute,end:p,trace});physics.dispose();
  }
  world.dispose();
 }
 return {pass:results.every(r=>r.pass),note:'Real Physics.route replanned every 1/60 s followed by Rapier movement at 9.3m/s; explicit starts, no teleport, path fallback, height overwrite or ignored collisions.',sources:Object.fromEntries(['src/surge/world-navigation.ts','src/physics/world.ts','src/surge/observatory.ts','src/surge/harbor.ts','tools/surge/ramp-navigation-qa.ts'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await validateRampNavigation(),name=process.env.OBS_RAMP_LABEL??'after';mkdirSync('artifacts/observatory',{recursive:true});writeFileSync(`artifacts/observatory/ramp-nav-${name}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:report.results.map(({trace,...r})=>r)},null,2));if(!report.pass)process.exitCode=1;}
