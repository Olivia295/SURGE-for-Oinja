import {writeFileSync,mkdirSync} from 'node:fs';
import {SurgeSimulation} from '../../src/surge/simulation';
import {SurgeSimulation as PreviousSimulation} from '../../archive/v0.2-before-feel-update/src/surge/simulation';
import type {WeaponId,WorldPort} from '../../src/surge/types';
const world:WorldPort={move:(p,d)=>({x:p.x+d.x,y:0,z:p.z+d.z}),floor:()=>0,clear:()=>true,valid:()=>true,route:(_a,b)=>b,spawnPoint:(p,a,d)=>({x:p.x+Math.cos(a)*d,y:0,z:p.z+Math.sin(a)*d})};
const plans:Record<string,WeaponId[]>={fist:['fist','hook','shield','chain'],chain:['chain','mist','bubble','drone'],bubble:['bubble','cannon','chain','hook'],shield:['shield','fist','mist','chain'],drone:['drone','chain','shield','mist'],mist:['mist','chain','bubble','hook']};
const results:unknown[]=[];
for(const version of ['before','after'])for(const [start,wanted] of Object.entries(plans)){
 const C=version==='before'?PreviousSimulation:SurgeSimulation;
 const g=new C(world,{sound:()=>{},toast:()=>{},event:()=>{},end:()=>{}},{x:0,y:0,z:0},[],start as WeaponId,911),checkpoints:unknown[]=[];
 let next=60,steps=0;
 while(!g.ended()&&steps++<40000){
  if(g.s.phase==='upgrade'){
   const score=(c:any)=>c.type==='evolution'?100:c.type==='rank'&&c.weapon===start?90:c.type==='weapon'&&wanted.includes(c.weapon)?80-wanted.indexOf(c.weapon):c.type==='rank'?65:c.type==='mod'&&['detonate','conductor','relay','siphon','echo'].includes(c.mod)?55:c.type==='mod'?30:c.type==='heal'?20:0;
   const c=[...g.s.choices].sort((a,b)=>score(b)-score(a))[0];if(!g.choose(c.id))g.choose(c.id,3);continue;
  }
  if(g.s.sync>=100)g.sync();
  const a=g.s.time*.16;let x=Math.cos(a)*.32,z=Math.sin(a)*.32;const enemy=g.targets(g.s.player,60)[0];
  if(['fist','shield'].includes(start)&&enemy){const d=Math.hypot(enemy.pos.x-g.s.player.x,enemy.pos.z-g.s.player.z)||1,k=d>3?.65:d<1.5?-.25:0;x=(enemy.pos.x-g.s.player.x)/d*k;z=(enemy.pos.z-g.s.player.z)/d*k;}
  g.step(1/30,{x,z,dash:false});
  if(g.s.time>=next){checkpoints.push({time:Math.round(g.s.time),level:g.s.level,kills:g.s.kills,hp:Math.round(g.s.hp),damageTaken:g.s.damageTaken,revives:g.s.revives});next+=60;}
 }
 const s=g.s,stats=s.stats as typeof SurgeSimulation.prototype.s.stats;
 const report={version,start,seed:911,outcome:s.phase,time:+s.time.toFixed(2),kills:s.kills,hp:s.hp,revives:s.revives,damageTaken:s.damageTaken,firstUpgrade:s.stats.firstUpgrade,firstEvolution:s.stats.firstEvolution,synergyTriggers:stats.synergyTriggers??{},synergyDamage:stats.synergyDamage??{},build:s.weapons,mods:s.mods,checkpoints};
 results.push(report);console.log(JSON.stringify({...report,checkpoints:undefined,build:undefined,mods:undefined}));
}
mkdirSync('artifacts/surge-feel',{recursive:true});writeFileSync('artifacts/surge-feel/balance-comparison.json',JSON.stringify({note:'Before/after deterministic flat-ground comparison. Same six build preferences, seed and movement policy, no map supports, no health/XP/damage/state cheats; both choose offered cards. New choice pools and proc RNG cause different trajectories, so this is integration evidence, not an isolated effect size or human win rate.',results},null,2));
