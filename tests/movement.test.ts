import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarbor} from '../src/surge/harbor';
import {initPhysics,Physics} from '../src/physics/world';
import {SurgeSimulation} from '../src/surge/simulation';
import type {Vec} from '../src/surge/types';

test('continuous character movement preserves contact height and real collisions',async t=>{
 await initPhysics();const {world}=await createHarbor(731);
 const walk=(start:Vec,dx:number,dz:number,seconds:number,hz=60)=>{
  const physics=new Physics(world),trajectory:Vec[]=[],dt=1/hz;let p={...start},slow=0,longestSlow=0,maxYStep=0;
  for(let i=0;i<seconds*hz;i++){const old=p;p=physics.move(p,{x:dx*9.3*dt,y:0,z:dz*9.3*dt},dt);const forward=(p.x-old.x)*dx+(p.z-old.z)*dz;slow=forward<9.3*dt*.5?slow+1:0;longestSlow=Math.max(longestSlow,slow);maxYStep=Math.max(maxYStep,Math.abs(p.y-old.y));trajectory.push({...p});}
  physics.dispose();return {p,longestSlow,maxYStep,trajectory};
 };
 try{
  await t.test('flat plaza advances continuously instead of sticking on its floor',()=>{const r=walk({x:-16,y:0,z:12},1,0,3.5);assert.ok(r.p.x>16);assert.ok(r.longestSlow<=1);assert.ok(r.maxYStep<.06);});
  for(const [name,start,dx] of [
   ['west ascent',{x:-73,y:0,z:-24},1],['west descent',{x:-38,y:5.5,z:-24},-1],
   ['east ascent',{x:73,y:0,z:-24},-1],['east descent',{x:38,y:5.5,z:-24},1],
   ['west ramp edge',{x:-73,y:0,z:-26.6},1],
  ] as [string,Vec,number][]){await t.test(name+' has no sustained loss of forward motion',()=>{const r=walk(start,dx,0,4);assert.ok((r.p.x-start.x)*dx>34.5);assert.ok(r.longestSlow<=1);assert.ok(r.maxYStep<.15);});}
  await t.test('ramp travel is independent of 30, 60 or 120 Hz updates',()=>{const distances=[30,60,120].map(hz=>walk({x:-73,y:0,z:-24},1,0,3,hz).p.x+73);assert.ok(Math.max(...distances)-Math.min(...distances)<.5);});
  await t.test('a crate blocks movement while allowing tangent motion along its edge',()=>{
   const physics=new Physics(world);let p={x:-65,y:0,z:-38};for(let i=0;i<60;i++)p=physics.move(p,{x:0,y:0,z:9.3/60},1/60);
   assert.ok(p.z< -36.3&&p.z> -36.5,'must stop outside the crate');const x=p.x;for(let i=0;i<60;i++)p=physics.move(p,{x:9.3/60,y:0,z:0},1/60);assert.ok(p.x-x>8.8,'tangent motion must not stay caught on the wall');physics.dispose();
  });
  await t.test('stepping off the bridge falls continuously rather than snapping to another floor',()=>{const r=walk({x:4,y:5.5,z:-24},0,1,2);assert.ok(Math.abs(r.p.y)<.06);assert.ok(r.maxYStep<.4);assert.ok(r.trajectory.some(p=>p.y>1&&p.y<4));});
  await t.test('the actual simulation preserves the physical ramp height',()=>{
   const physics=new Physics(world),game=new SurgeSimulation(physics,{sound(){},toast(){},event(){},end(){}},{x:-73,y:0,z:-24},[],'fist',731);let maxError=0;
   for(let i=0;i<240;i++){if(game.s.phase==='upgrade'){const choice=game.s.choices.find(c=>c.type!=='weapon')??game.s.choices[0];game.choose(choice.id);}game.step(1/60,{x:1,z:0,dash:false});maxError=Math.max(maxError,Math.abs(physics.player.translation().y-.86-game.s.player.y));}
   assert.ok(game.s.player.x> -39);assert.ok(maxError<.0001,'simulation must not overwrite controller height');physics.dispose();
  });
 }finally{world.dispose();}
});
