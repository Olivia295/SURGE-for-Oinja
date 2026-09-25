import test from 'node:test';
import assert from 'node:assert/strict';
import {SurgeSimulation} from '../src/surge/simulation';
import {validRun} from '../src/surge/save';
import type {WorldPort} from '../src/surge/types';
const port:WorldPort={move:(p,d)=>({x:p.x+d.x,y:0,z:p.z+d.z}),floor:()=>0,clear:()=>true,valid:()=>true,route:(_a,b)=>b,spawnPoint:(p,a,d)=>({x:p.x+Math.cos(a)*d,y:0,z:p.z+Math.sin(a)*d})};
const fresh=()=>new SurgeSimulation(port,{sound:()=>{},toast:()=>{},event:()=>{},end:()=>{}},{x:0,y:0,z:0},[]).snapshot();
test('both maps and an in-progress random event survive save validation',()=>{
 for(const mapId of ['old-harbor','tidal-observatory'] as const){const s=fresh();s.mapId=mapId;s.encounter={id:1,kind:'battery-run',state:'active',pos:{x:3,y:0,z:4},createdAt:70,expiresAt:140,startedAt:80,progress:2,goal:4,radius:4,route:[{x:6,y:0,z:4},{x:8,y:0,z:4},{x:10,y:0,z:4},{x:12,y:0,z:4}]};s.nextEncounterAt=200;s.encounterBuff={kind:'haste',until:175};s.encounterHistory=[{id:0,kind:'storm-hunt',result:'complete',at:50}];assert.equal(validRun(JSON.parse(JSON.stringify(s))),true);}
 const old=fresh();delete old.mapId;delete old.encounter;delete old.encounterHistory;delete old.nextEncounterAt;delete old.encounterBuff;delete old.progressionVersion;delete old.nextUpgradeAt;assert.equal(validRun(old),true);
});
test('corrupt map/event identifiers and non-finite event state are rejected',()=>{
 for(const [key,value] of [['mapId','unknown'],['encounter',{}],['encounterBuff',{kind:'haste',until:Infinity}],['encounterHistory',[{id:1,kind:'unknown',result:'complete',at:10}]],['nextEncounterAt',NaN],['nextUpgradeAt',NaN],['progressionVersion',9]] as const){const s=fresh();(s as any)[key]=value;assert.equal(validRun(s),false,String(key));}
 const s=fresh();s.encounter={id:1,kind:'echo-hunt',state:'active',pos:{x:0,y:0,z:0},createdAt:70,expiresAt:120,progress:0,goal:2,radius:10,targetIds:[NaN]};assert.equal(validRun(s),false);
});
