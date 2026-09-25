/** Development-only integration audit. Not imported by the shipping runtime. */
import { createHarbor } from './harbor';
import { initPhysics, Physics } from '../physics/world';
import type { Vec3 } from '../world/types';

export async function validateHarbor(seed=731) {
 await initPhysics();const {world,sites}=await createHarbor(seed),physics=new Physics(world);
 const reports:{id:string;pass:boolean;error:number}[]=[];
 const walk=(id:string,a:Vec3,b:Vec3)=>{
  let p={x:a[0],y:a[1],z:a[2]},stuck=0,pass=true;const path=world.findPath(a,b);if(!path.length)pass=false;
  for(const q of path){for(let i=0;i<1500;i++){
   const dx=q[0]-p.x,dz=q[2]-p.z,d=Math.hypot(dx,dz);if(d<.28&&Math.abs(p.y-q[1])<.7)break;
   const old=p;p=physics.move(p,{x:dx/Math.max(d,.01)*Math.min(d,6.5/60),y:-12/60,z:dz/Math.max(d,.01)*Math.min(d,6.5/60)});
   stuck=Math.hypot(p.x-old.x,p.z-old.z)<.005?stuck+1:0;if(stuck>45||i===1499){pass=false;break;}
  }if(!pass)break;}
  const error=Math.hypot(p.x-b[0],p.y-b[1],p.z-b[2]);reports.push({id,pass:pass&&error<.7,error:+error.toFixed(3)});
 };
 try {
  for(const s of sites)walk(s.id,[0,0,12],[s.pos.x,s.pos.y,s.pos.z]);
  const routes:[string,Vec3,Vec3][]=[
   ['west-ramp',[-74,0,-24],[-37,5.5,-24]],['east-ramp',[74,0,-24],[37,5.5,-24]],
   ['upper-crossing',[-40,5.5,-24],[40,5.5,-24]],['underpass',[-10,0,-35],[-10,0,-14]],
   ['basin-north',[60.5,-2.4,43],[60.5,0,21]],['basin-south',[60.5,-2.4,43],[60.5,0,66]],
  ];for(const [id,a,b] of routes)walk(id,a,b);
  const gates:[string,Vec3,Vec3][]=[['relay-market',[-33,0,8],[-23,0,8]],['relay-north',[-34,0,-39],[-34,0,-29]],['relay-east',[29,0,-10],[39,0,-10]]];
  for(const [id,a,b] of gates){world.openShortcut(id);world.update(2,2);physics.syncShortcuts();walk(`${id}-open`,a,b);}
  world.openShortcut('crane-dock');for(let i=0;i<190;i++){world.update(i/60,1/60);physics.syncShortcuts();}walk('bridge-animation',[51,0,43],[70,0,43]);
  let meshes=0,triangles=0;world.group.traverse(o=>{if('isMesh' in o&&o.isMesh){const g=(o as import('three').Mesh).geometry;meshes++;triangles+=(g.index?.count??g.getAttribute('position').count)/3;}});
  return {seed,pass:reports.every(r=>r.pass),reports,geometry:{meshes,triangles,colliders:world.colliders.length,occluders:world.occluders.length},navigation:{nodes:world.nav.waypoints.length,edges:world.nav.edges.length}};
 } finally {physics.dispose();world.dispose();}
}
