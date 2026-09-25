import test from 'node:test';
import assert from 'node:assert/strict';
import {SurgeSimulation} from '../src/surge/simulation';
import {validRun} from '../src/surge/save';
import type {WorldPort} from '../src/surge/types';
const port:WorldPort={move:(p,d)=>({x:p.x+d.x,y:0,z:p.z+d.z}),floor:()=>0,clear:()=>true,valid:()=>true,route:(_a,b)=>b,spawnPoint:(p,a,d)=>({x:p.x+Math.cos(a)*d,y:0,z:p.z+Math.sin(a)*d})};
const fresh=()=>new SurgeSimulation(port,{sound:()=>{},toast:()=>{},event:()=>{},end:()=>{}},{x:0,y:0,z:0},[]).snapshot();
test('old optional-free saves and new synergy data remain compatible',()=>{
 const old=fresh();for(const key of ['reactionCooldowns','recoilCharge','droneHits','lastReaction','nextPressure','pressureWarned','slamReadyUntil'])delete (old as any)[key];delete old.stats.synergyTriggers;delete old.stats.synergyDamage;assert.equal(validRun(old),true);
 const s=fresh();Object.assign(s,{reactionCooldowns:{slam:4,storm:7},recoilCharge:100,droneHits:2,lastReaction:{id:'storm',until:12},nextPressure:90,pressureWarned:false,slamReadyUntil:15});s.stats.synergyTriggers={storm:2};s.stats.synergyDamage={storm:120};s.fields=[{id:10,pos:{x:0,y:0,z:0},radius:3,ttl:4,tick:.4,damage:10,type:'mist',color:1,energized:5}];s.fx=[{id:11,pos:{x:0,y:0,z:0},type:'arc',radius:3,ttl:.2,duration:.3,color:1,yaw:-Math.PI}];assert.equal(validRun(s),true);
});
test('invalid optional synergy payloads are rejected',()=>{
 for(const [key,value] of [['reactionCooldowns',{storm:NaN}],['reactionCooldowns',{unknown:2}],['reactionCooldowns',null],['recoilCharge',101],['droneHits',1.5],['droneHits',3],['lastReaction',{id:'unknown',until:2}],['lastReaction',{id:'slam',until:Infinity}],['nextPressure',NaN],['slamReadyUntil',Infinity],['pressureWarned',1]] as const){const s=fresh();(s as any)[key]=value;assert.equal(validRun(s),false,key);}
 for(const key of ['synergyTriggers','synergyDamage']){const s=fresh();(s.stats as any)[key]={slam:Infinity};assert.equal(validRun(s),false,key);}
 const s=fresh();s.fields=[{id:10,pos:{x:0,y:0,z:0},radius:3,ttl:4,tick:.4,damage:10,type:'mist',color:1,energized:6}];assert.equal(validRun(s),false);
});
