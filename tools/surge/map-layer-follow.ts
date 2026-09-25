/** Focused traversal probe, separate from fair full-run balance checks. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHarbor} from '../../src/surge/harbor';
import {Physics,initPhysics} from '../../src/physics/world';
import {SurgeSimulation} from '../../src/surge/simulation';
await initPhysics();const {world}=await createHarbor(6000),physics=new Physics(world);
const game=new SurgeSimulation(physics,{sound(){},toast(){},event(){},end(){}},{x:4,y:5.5,z:-24},[],'fist',6000);
const probes=[];for(const p of [{x:0,y:0,z:-35},{x:30,y:0,z:-10},{x:-65,y:0,z:-44}]){game.spawn('crawler',false,false,p);const mob=game.s.enemies.at(-1)!;probes.push({id:mob.id,start:{...p},peakY:0,reachedDeckAt:null as number|null,last:{...p}});}
for(let i=0;i<2400&&!game.ended();i++){
 if(game.s.phase==='upgrade'){const choice=game.s.choices.find(c=>c.type==='rank')??game.s.choices[0];if(!game.choose(choice.id)){const alternate=game.s.choices.find(c=>c.type!=='weapon');if(alternate)game.choose(alternate.id);else break;}continue;}
 game.step(1/30,{x:0,z:0,dash:false});world.update(game.s.time,1/30);physics.syncShortcuts();
 for(const probe of probes){const mob=game.s.enemies.find(e=>e.id===probe.id);if(!mob)continue;probe.last={...mob.pos};probe.peakY=Math.max(probe.peakY,mob.pos.y);if(mob.pos.y>5.48&&probe.reachedDeckAt===null)probe.reachedDeckAt=+game.s.time.toFixed(2);}
 if(probes.every(p=>p.reachedDeckAt!==null))break;
}
const report={note:'Focused real-map pursuit probe. Three crawler start positions and player deck spawn are explicit test fixtures; this is not one of the normal-start balance runs. Simulation otherwise advances through normal step(dt), with offered upgrades only.',pass:probes.every(p=>p.reachedDeckAt!==null),time:game.s.time,phase:game.s.phase,probes,remaining:game.s.enemies.filter(e=>probes.some(p=>p.id===e.id)).map(e=>({id:e.id,pos:e.pos,route:e.route,path:world.findPath([e.pos.x,e.pos.y,e.pos.z],[game.s.player.x,game.s.player.y,game.s.player.z]).slice(0,6)}))};
mkdirSync('artifacts/surge',{recursive:true});writeFileSync('artifacts/surge/map-layer-follow.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));physics.dispose();world.dispose();if(!report.pass)process.exitCode=1;
