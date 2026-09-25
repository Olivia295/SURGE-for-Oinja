import fs from 'node:fs/promises';
import {buildMap} from '../../src/world/maps';
import {initPhysics,Physics} from '../../src/physics/world';
import type {MapId,Vec3} from '../../src/world/types';
await initPhysics();const results=[];
for(const id of ['old-harbor','new-harbor'] as MapId[]){
 const map=buildMap(id),physics=new Physics(map);
 const journeys:{name:string,from:Vec3,to:Vec3}[]=[
  {name:'west ramp ascent',from:[-61,0,-18],to:[-8,8,-18]},
  {name:'east ramp ascent',from:[171,0,-18],to:[118,8,-18]},
  {name:'south ramp ascent',from:[-10,0,151],to:[-10,8,98]},
  {name:'walk below elevated deck',from:[30,0,-27],to:[30,0,-8]},
  {name:'upper deck crossing',from:[-8,8,-18],to:[118,8,-18]},
  {name:'drydock lower north ramp',from:[id==='old-harbor'?-110:-108,0,id==='old-harbor'?-10:-14],to:[id==='old-harbor'?-110:-108,-5,26]},
  {name:'drydock south ascent',from:[id==='old-harbor'?-110:-108,-5,id==='old-harbor'?114:125],to:[id==='old-harbor'?-110:-108,0,id==='old-harbor'?150:162]},
 ];
 for(const j of journeys){let p={x:j.from[0],y:j.from[1],z:j.from[2]};let steps=0;for(;steps<2400;steps++){
  const dx=j.to[0]-p.x,dz=j.to[2]-p.z,dist=Math.hypot(dx,dz);if(dist<.2)break;
  p=physics.move(p,{x:dx/dist*.1,y:-.085,z:dz/dist*.1});
 }
 const distance=Math.hypot(p.x-j.to[0],p.y-j.to[1],p.z-j.to[2]);results.push({map:id,test:j.name,passed:distance<.4,distance,final:p,steps});}
 physics.dispose();map.dispose();
}
console.log(JSON.stringify(results,null,2));await fs.writeFile('artifacts/maps/physics-traversal.json',JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
