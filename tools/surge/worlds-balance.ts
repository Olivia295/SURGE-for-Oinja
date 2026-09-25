/** Real-map, real-physics integration run. Only ordinary inputs and offered choices affect game state. */
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {createSurgeWorld} from '../../src/surge/worlds';
import type {SurgeMapId} from '../../src/surge/maps';
import {initPhysics,Physics} from '../../src/physics/world';
import {SurgeSimulation} from '../../src/surge/simulation';
import type {Choice,WeaponId,SupportId,Vec,Mob} from '../../src/surge/types';
import type {Vec3} from '../../src/world/types';
const plans:Record<string,{weapons:WeaponId[];mods:string[];supports:SupportId[];range:number}>= {
 fist:{weapons:['fist','hook','shield','chain'],mods:['siphon','echo','bulwark','power','tempo','area'],supports:['medic','titan','crusher','prism','tempest','orbital'],range:3.3},
 chain:{weapons:['chain','mist','bubble','drone'],mods:['conductor','detonate','shrapnel','tempo','power','area'],supports:['tempest','crusher','prism','titan','orbital','medic'],range:10},
 bubble:{weapons:['bubble','cannon','chain','hook'],mods:['shrapnel','vortex','detonate','conductor','power','tempo'],supports:['orbital','crusher','tempest','prism','titan','medic'],range:12},
 shield:{weapons:['shield','fist','hook','mist'],mods:['bulwark','siphon','echo','capacitor','area','tempo'],supports:['medic','titan','crusher','prism','tempest','orbital'],range:4},
 drone:{weapons:['drone','chain','shield','mist'],mods:['relay','shrapnel','conductor','detonate','power','tempo'],supports:['prism','tempest','titan','orbital','crusher','medic'],range:11},
 mist:{weapons:['mist','chain','bubble','hook'],mods:['vortex','conductor','detonate','area','tempo','power'],supports:['crusher','tempest','titan','prism','orbital','medic'],range:9},
};
const gap=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z),point=(p:Vec):Vec3=>[p.x,p.y,p.z],v=(p:Vec3):Vec=>({x:p[0],y:p[1],z:p[2]});
const starters=(process.env.SURGE_MAP_STARTS?.split(',')??Object.keys(plans)) as WeaponId[],seeds=(process.env.SURGE_MAP_SEEDS??'731,6000').split(',').map(Number),dt=1/30;
const maps=(process.env.SURGE_MAPS??'old-harbor,tidal-observatory').split(',') as SurgeMapId[];
const out=process.env.SURGE_MAP_OUTPUT??'artifacts/surge-worlds/map-balance.json';mkdirSync(dirname(out),{recursive:true});
await initPhysics();const results:unknown[]=[],wallStart=performance.now();
for(const mapId of maps)for(const start of starters)for(const seed of seeds){
 const plan=plans[start];if(!plan)throw new Error('Unsupported starter '+start);
 const {world,sites}=await createSurgeWorld(mapId,seed),physics=new Physics(world),events:string[]=[],eventTimes:{id:string;time:number}[]=[];
 const game=new SurgeSimulation(physics,{sound:()=>{},toast:()=>{},event:id=>{events.push(id);eventTimes.push({id,time:+game.s.time.toFixed(2)});world.openShortcut(id);physics.syncShortcuts();},end:()=>{}},world.spawn,sites,start,seed,0,'balanced');game.s.mapId=mapId;
 let peakEnemies=0;let steps=0,nextCheckpoint=30,decisionAt=0,interactAt=0,currentEvent='',route:Vec3[]=[],routeAt=0,routeGoal:Vec={...game.s.player},movementGoal:Vec={...game.s.player},input={x:0,z:0,dash:false},stuckTime=0,maxStuck=0,stuckEpisodes=0,routeFailures=0,lastPos={...game.s.player},lastProgress=0,avoidUntil=0,detour:Vec|null=null,navigating=false;
 const checkpoints:unknown[]=[],choices:string[]=[],notes:string[]=[],slowEpisodes:unknown[]=[],started=performance.now();
 const score=(c:Choice)=>{
  if(c.type==='support')return 220-plan.supports.indexOf(c.support!)*8;
  if(c.type==='evolution')return 200+(c.weapon===start?20:0)+(c.branch==='a'?1:0);
  if(c.type==='rank')return 120+(c.weapon===start?30:0)+(plan.weapons.includes(c.weapon!)?6:0);
  if(c.type==='weapon')return game.s.weapons.length<4&&plan.weapons.includes(c.weapon!)?115-plan.weapons.indexOf(c.weapon!)*3:game.s.weapons.length<3?65:0;
  if(c.type==='mod'){if(c.mod==='vitality'&&game.s.hp<game.s.maxHp*.45)return 155;const rank=plan.mods.indexOf(c.mod!);return rank>=0?100-rank*3:35;}
  return game.s.hp<game.s.maxHp*.45?150:10;
 };
 const steer=(goal:Vec)=>{
  const p=game.s.player;
  if(game.s.time>=routeAt||gap(goal,routeGoal)>3||Math.abs(goal.y-routeGoal.y)>1||!route.length){route=world.findPath(point(p),point(goal));routeAt=game.s.time+2.5;routeGoal={...goal};if(!route.length)routeFailures++;}
  while(route.length>1&&gap(p,v(route[0]))<.28&&Math.abs(p.y-route[0][1])<.7)route.shift();
  const q=route.length?v(route[0]):goal,d=gap(p,q),speed=(game.s.dashTime>0||input.dash?30:9.3)*(game.s.encounterBuff?.kind==='haste'&&game.s.encounterBuff.until>game.s.time?1.12:1);
  // Keep tactical decisions at 5 Hz, but steer each physics step and never overshoot a waypoint.
  const magnitude=Math.min(1,d/(speed*dt));return {x:d>.1?(q.x-p.x)/d*magnitude:0,z:d>.1?(q.z-p.z)/d*magnitude:0};
 };
 try {
  while(!game.ended()&&steps++<40000){
   const s=game.s;
   if(s.phase==='upgrade'){
    const choice=[...s.choices].sort((a,b)=>score(b)-score(a))[0];if(!choice)throw new Error('Upgrade without offered cards');choices.push(choice.id);
    if(!game.choose(choice.id)){const replacement=s.weapons.findIndex(w=>w.id!==start&&!plan.weapons.includes(w.id));if(replacement<0||!game.choose(choice.id,replacement)){notes.push('No legal preferred choice; choosing offered alternate');const alternate=s.choices.find(c=>c.type!=='weapon');if(!alternate||!game.choose(alternate.id))throw new Error('No legal upgrade selection');}}
    decisionAt=0;continue;
   }
   if(s.sync>=100&&s.enemies.some(e=>gap(e.pos,s.player)<18))game.sync();
   if(s.time>=interactAt){const near=s.events.filter(e=>e.state==='available'&&Math.abs(e.pos.y-s.player.y)<1.7).sort((a,b)=>gap(a.pos,s.player)-gap(b.pos,s.player))[0];const encounter=s.encounter;const optional=encounter?.state==='offered'&&gap(encounter.pos,s.player)<5.4&&Math.abs(encounter.pos.y-s.player.y)<1.7;if(near&&gap(near.pos,s.player)<5.4||optional)game.interact();interactAt=s.time+.35;}
   if(s.time>=decisionAt){
    decisionAt=s.time+.2;const p=s.player,active=s.events.find(e=>e.state==='active');
    const available=s.events.filter(e=>e.state==='available').sort((a,b)=>gap(a.pos,p)+Math.abs(a.pos.y-p.y)*6-gap(b.pos,p)-Math.abs(b.pos.y-p.y)*6);
    const site=active??s.events.find(e=>e.id===currentEvent&&e.state==='available')??available[0];if(site)currentEvent=site.id;navigating=!!site&&site.state==='available'&&gap(site.pos,p)>6;
    const enemies=s.enemies.filter(e=>e.hp>0&&Math.abs(e.pos.y-p.y)<3&&physics.clear({...p,y:p.y+1},{...e.pos,y:e.pos.y+1})).sort((a,b)=>gap(a.pos,p)-gap(b.pos,p));
    const boss=s.enemies.find(e=>e.boss&&e.hp>0),nearest=enemies[0],unseen=s.enemies.filter(e=>e.hp>0).sort((a,b)=>gap(a.pos,p)+Math.abs(a.pos.y-p.y)*8-gap(b.pos,p)-Math.abs(b.pos.y-p.y)*8)[0];let target:Mob|undefined=boss??nearest??unseen,goal:Vec=site?{...site.pos}:{...p};
    const engaged=site?.state==='active'&&site.kind!=='convoy';
    if(target&&(engaged||!site||boss)){
     if(engaged){const local=enemies.find(e=>gap(e.pos,site!.pos)<24);if(local)target=local;}
     const d=gap(target.pos,p),dx=(target.pos.x-p.x)/Math.max(d,.01),dz=(target.pos.z-p.z)/Math.max(d,.01),ideal=plan.range*(s.weapons.find(w=>w.id===start)?.evolution==='b'&&start==='fist'?1.8:1);
     // Melee deliberately closes to striking distance. Ranged kits strafe inside their usable range.
     if(!physics.clear({...p,y:p.y+1},{...target.pos,y:target.pos.y+1})||Math.abs(target.pos.y-p.y)>2)goal={...target.pos};
     else if(d>ideal+1.2)goal={x:target.pos.x-dx*ideal*.85,y:target.pos.y,z:target.pos.z-dz*ideal*.85};
     else if(d<ideal*.65)goal={x:p.x-dx*3-dz*1.4,y:p.y,z:p.z-dz*3+dx*1.4};
     else goal={x:p.x-dz*2.2,y:p.y,z:p.z+dx*2.2};
     
     if(engaged&&gap(goal,site!.pos)>20)goal={...site!.pos};
    }else if(engaged){const a=s.time*.2;goal={x:site!.pos.x+Math.cos(a)*3,y:site!.pos.y,z:site!.pos.z+Math.sin(a)*3};}
    if(site?.kind==='convoy'&&site.state==='active')goal={...site.pos};
    const danger=enemies.filter(e=>gap(e.pos,p)<2.5).length>3||s.fx.some(f=>f.type==='warning'&&gap(f.end??f.pos,p)<(f.radius>2?f.radius:3));
    if(danger&&nearest){const d=gap(nearest.pos,p)||1;const escape={x:p.x+(p.x-nearest.pos.x)/d*4.5,y:p.y,z:p.z+(p.z-nearest.pos.z)/d*4.5};if(world.walkableAt(escape.x,escape.z,p.y,.7))goal=escape;}
    if(stuckTime>1.8&&s.time>=avoidUntil){stuckEpisodes++;const nodes=world.nav.waypoints.filter(n=>Math.abs(n.position[1]-p.y)<.7&&Math.hypot(n.position[0]-p.x,n.position[2]-p.z)>3&&Math.hypot(n.position[0]-p.x,n.position[2]-p.z)<9&&physics.clear({...p,y:p.y+1},{x:n.position[0],y:n.position[1]+1,z:n.position[2]}));nodes.sort((a,b)=>Math.hypot(a.position[0]-goal.x,a.position[2]-goal.z)-Math.hypot(b.position[0]-goal.x,b.position[2]-goal.z));detour=nodes[0]?v(nodes[0].position):null;avoidUntil=s.time+1.7;routeAt=0;}
    if(detour&&s.time<avoidUntil)goal=detour;
    // Optional encounters are pursued with ordinary walking, E, attacks and offered choices.
    const enc=s.encounter;
    if(enc&&['offered','active'].includes(enc.state)){
     let encounterGoal:Vec={...enc.pos};
     if(enc.state==='active'){
      if(enc.kind==='battery-run')encounterGoal={...(enc.route?.[Math.floor(enc.progress)]??enc.pos)};
      if(enc.kind==='echo-hunt'){
       const quarry=s.enemies.find(m=>enc.targetIds?.includes(m.id)&&m.hp>0);
       if(quarry){const d=gap(p,quarry.pos)||1,r=Math.min(plan.range,6);encounterGoal={x:quarry.pos.x+(p.x-quarry.pos.x)/d*r,y:quarry.pos.y,z:quarry.pos.z+(p.z-quarry.pos.z)/d*r};}
      }
      if(enc.kind==='storm-hunt'){
       const local=enemies.find(m=>gap(m.pos,enc.pos)<enc.radius*.85);
       if(local)encounterGoal={...local.pos};
      }
      if(enc.kind==='overload')encounterGoal=danger?goal:{x:enc.pos.x+Math.cos(s.time*.5)*4,y:enc.pos.y,z:enc.pos.z+Math.sin(s.time*.5)*4};
     }
     if(!danger){goal=encounterGoal;navigating=gap(goal,p)>3;}
    }
    // Tactical offset points may land inside a wall even when the enemy itself is visible.
    // Project such intentions to legal floor nodes instead of repeatedly walking into geometry.
    if(!world.walkableAt(goal.x,goal.z,goal.y,.75)||Math.abs(world.heightAt(goal.x,goal.z,goal.y)-goal.y)>.6){
     const legal=world.nav.waypoints.filter(n=>Math.abs(n.position[1]-goal.y)<.8&&world.walkableAt(n.position[0],n.position[2],n.position[1],.75));
     legal.sort((a,b)=>Math.hypot(a.position[0]-goal.x,a.position[2]-goal.z)-Math.hypot(b.position[0]-goal.x,b.position[2]-goal.z));if(legal[0])goal=v(legal[0].position);
    }
    movementGoal=goal;input.dash=danger&&s.dashCooldown<=0;
   }
   input={...steer(movementGoal),dash:input.dash};
   const oldTime=game.s.time;game.step(dt,input);peakEnemies=Math.max(peakEnemies,game.s.enemies.length);input.dash=false;world.update(game.s.time,game.s.time-oldTime);physics.syncShortcuts();
   if(game.s.time-lastProgress>=.5){const moved=gap(game.s.player,lastPos);stuckTime=navigating&&moved<.35&&Math.hypot(input.x,input.z)>.1?stuckTime+(game.s.time-lastProgress):0;if(stuckTime>1.5)slowEpisodes.push({time:game.s.time,stuckTime,p:{...game.s.player},goal:{...movementGoal},route:route.slice(0,3),input:{...input},encounter:game.s.encounter?{kind:game.s.encounter.kind,state:game.s.encounter.state,pos:game.s.encounter.pos}:undefined});maxStuck=Math.max(maxStuck,stuckTime);lastProgress=game.s.time;lastPos={...game.s.player};}
   if(game.s.time>=nextCheckpoint){const s=game.s;const c={time:Math.round(s.time),hp:Math.round(s.hp),level:s.level,kills:s.kills,events:s.stats.events,enemies:s.enemies.length,position:{x:+s.player.x.toFixed(1),y:+s.player.y.toFixed(1),z:+s.player.z.toFixed(1)},target:currentEvent};if(process.env.SURGE_MAP_TRACE)console.log(JSON.stringify({trace:true,...c,goal:movementGoal,route:route.slice(0,3),input,detour,avoidUntil,site:s.events.find(e=>e.id===currentEvent)}));checkpoints.push(c);if(Math.round(nextCheckpoint)%120===0)console.log(JSON.stringify({progress:true,start,seed,...c}));nextCheckpoint+=30;}
  }
  const s=game.s,report={mapId,start,seed,slowEpisodes,encounterHistory:s.encounterHistory??[],encounter:s.encounter,outcome:s.phase,time:+s.time.toFixed(2),kills:s.kills,level:s.level,hp:+s.hp.toFixed(1),revives:s.revives,eventCount:s.stats.events,eventStates:s.events.map(e=>({id:e.id,state:e.state,progress:e.progress,goal:e.goal})),events,eventTimes,allEventsAt:s.stats.events===s.events.length?eventTimes.at(-1)?.time:null,firstUpgrade:s.stats.firstUpgrade,firstEvolution:s.stats.firstEvolution,build:s.weapons,mods:s.mods,support:s.support,damage:s.stats.weaponDamage,synergyTriggers:s.stats.synergyTriggers??{},synergyDamage:s.stats.synergyDamage??{},eliteKills:s.stats.eliteKills,peakEnemies,damageTaken:s.damageTaken,choices,checkpoints,routeFailures,stuckEpisodes,maxStuck:+maxStuck.toFixed(2),notes,wallSeconds:+((performance.now()-started)/1000).toFixed(1)};
  results.push(report);console.log(JSON.stringify({result:true,...report,choices:undefined,checkpoints:undefined,damage:undefined}));
  const sources=Object.fromEntries(['tools/surge/worlds-balance.ts','src/surge/observatory.ts','src/surge/encounters.ts','src/surge/progression.ts','src/surge/harbor.ts','src/surge/world-navigation.ts','src/surge/simulation.ts','src/surge/content.ts','src/physics/world.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
  writeFileSync(out,JSON.stringify({sources,note:'Deterministic input-driven bots on both authored maps + real Rapier Physics + SurgeSimulation, including optional random encounters. Danger 0, balanced kit, 30 Hz fixed steps; simulation time advances only through step(dt). No health/XP/damage/state cheats. Agents use offered choices, normal E/Q/dash, and walkable navigation. This is navigation/combat integration evidence, not a human win rate.',wallSeconds:(performance.now()-wallStart)/1000,results},null,2));
 }finally{physics.dispose();world.dispose();}
}
