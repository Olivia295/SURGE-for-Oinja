import fs from 'node:fs/promises';
import { buildMap } from '../../src/world/maps';
import { initPhysics, Physics } from '../../src/physics/world';
import type { MapId,Vec3 } from '../../src/world/types';
await initPhysics();const results=[];
for(const id of ['old-harbor','new-harbor'] as MapId[]){
 const map=buildMap(id),physics=new Physics(map);
 for(const zone of map.zones){
  let p={x:map.spawn.x,y:map.spawn.y,z:map.spawn.z},stuck=0,steps=0;const path=map.findPath(map.spawn.toArray() as Vec3,zone.center);let completed=0;
  for(const point of path){let reached=false;for(let i=0;i<1600;i++){
   const dx=point[0]-p.x,dz=point[2]-p.z,dist=Math.hypot(dx,dz);if(dist<.55){if(Math.abs(p.y-point[1])<.65){reached=true;completed++;}break;}
   const old=p;p=physics.move(p,{x:dx/dist*.11,y:-.05,z:dz/dist*.11});steps++;if(Math.hypot(p.x-old.x,p.z-old.z)<.001)stuck++;else stuck=0;if(stuck>100)break;
  }if(!reached)break;}
  const distance=Math.hypot(p.x-zone.center[0],p.y-zone.center[1],p.z-zone.center[2]);results.push({map:id,zone:zone.id,passed:distance<1,distance,completed,pathLength:path.length,steps,final:p});
 }
 physics.dispose();
 const bridgePhysics=new Physics(map);map.openShortcut('bridge');for(let n=0;n<401;n++){map.update(n*.02,.02);bridgePhysics.syncShortcuts();}
 let p={x:-64,y:0,z:98};for(let n=0;n<1500;n++){if(p.x>-10.25)break;p=bridgePhysics.move(p,{x:.1,y:-.045,z:0});}
 results.push({map:id,zone:'optional bridge after opening',passed:Math.hypot(p.x+10,p.y-8,p.z-98)<.6,final:p});
 const wasClosed=!map.walkableAt(-51,20,0);map.openShortcut('power');bridgePhysics.syncShortcuts();const nowOpen=map.walkableAt(-51,20,0);let gate={x:-51,y:0,z:17};for(let i=0;i<60;i++)gate=bridgePhysics.move(gate,{x:0,y:-.04,z:.1});results.push({map:id,zone:'powered gate collision and navigation',passed:wasClosed&&nowOpen&&gate.z>22,final:gate});bridgePhysics.dispose();map.dispose();
}
console.log(JSON.stringify(results,null,2));await fs.writeFile('artifacts/maps/navigation-physics-tour.json',JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
