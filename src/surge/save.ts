import {DEFAULT_PROFILE,DEFAULT_SETTINGS,WEAPONS,SUPPORTS,ENEMY_DATA,MODS,UNLOCKS} from './content';
import type {Profile,RunState,Settings} from './types';
import {SYNERGIES} from './synergies';
import {isSurgeMapId} from './maps';
export const PROFILE_KEY='oinja.surge.profile.v2',RUN_KEY='oinja.surge.run.v2';
const record=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const num=(x:unknown,lo=0,hi=1e10)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const vec=(x:unknown)=>record(x)&&num(x.x,-1000,1000)&&num(x.y,-50,100)&&num(x.z,-1000,1000);
const list=(x:unknown,n:number)=>Array.isArray(x)&&x.length<=n;
const encounterKinds=['storm-hunt','battery-run','overload','echo-hunt'];
const validEncounter=(e:unknown)=>record(e)&&num(e.id)&&encounterKinds.includes(e.kind)&&['announced','offered','active','complete','failed','expired'].includes(e.state)&&vec(e.pos)&&['createdAt','expiresAt','progress','goal','radius'].every(k=>num(e[k],0,2000))&&e.goal>0&&e.radius<=40&&(e.startedAt===undefined||num(e.startedAt,0,2000))&&(e.streakUntil===undefined||num(e.streakUntil,0,2000))&&(e.route===undefined||list(e.route,8)&&e.route.every(vec))&&(e.targetIds===undefined||list(e.targetIds,8)&&e.targetIds.every((id:unknown)=>num(id)));
const synergyNumbers=(x:unknown)=>record(x)&&Object.entries(x).every(([id,value])=>Object.hasOwn(SYNERGIES,id)&&num(value));
export function validRun(x:unknown):x is RunState{
 if(!record(x)||x.mapId!==undefined&&!isSurgeMapId(x.mapId)||x.version!==2||!['playing','paused','upgrade'].includes(x.phase)||!vec(x.player)||!Object.hasOwn(WEAPONS,x.startWeapon))return false;
 for(const k of ['time','hp','maxHp','shield','sync','syncTime','dashTime','dashCooldown','invulnerable','level','xp','xpNext','kills','damageTaken','damageDealt','rerolls','pendingLevels','nextId','nextSpawn','revives','seed','rng'])if(!num(x[k],0,k==='seed'?Number.MAX_SAFE_INTEGER:1e10))return false;
 if(x.time>900||x.level<1||x.level>50||x.maxHp<1||x.maxHp>2000||x.hp>x.maxHp||x.revives>1||x.danger>2||!num(x.danger)||!num(x.yaw,-100,100))return false;
 if(!list(x.weapons,4)||!x.weapons.length||new Set(x.weapons.map((w:any)=>w.id)).size!==x.weapons.length||x.weapons.some((w:any)=>!record(w)||!Object.hasOwn(WEAPONS,w.id)||!num(w.level,1,5)||!Number.isInteger(w.level)||!num(w.cooldown,-1,60)||!num(w.casts)||w.evolution&&!['a','b'].includes(w.evolution)))return false;
 if(!record(x.mods)||Object.entries(x.mods).some(([k,v])=>!MODS[k]||!num(v,0,MODS[k].max)))return false;
 if(x.support!==null&&!Object.hasOwn(SUPPORTS,x.support))return false;
 if(!list(x.enemies,300)||!list(x.shots,750)||!list(x.fields,100)||!list(x.drops,5000)||!list(x.fx,250)||!list(x.events,20)||!list(x.drones,20)||!list(x.choices,3))return false;
 if(x.enemies.some((e:any)=>!record(e)||!vec(e.pos)||!vec(e.target)||!Object.hasOwn(ENEMY_DATA,e.kind)||!num(e.hp)||!num(e.maxHp)||!num(e.id)||!num(e.timer,-1000,100)||!['move','windup','attack'].includes(e.state)))return false;
 if(x.shots.some((e:any)=>!record(e)||!vec(e.pos)||!vec(e.vel)||!num(e.ttl,-1,20)||!num(e.damage)||!list(e.hits,300)))return false;
 if(x.drops.some((e:any)=>!record(e)||!vec(e.pos)||!num(e.amount)||!num(e.age)||!['xp','heal'].includes(e.type)))return false;
 if(x.events.some((e:any)=>!record(e)||!vec(e.pos)||!['available','active','complete'].includes(e.state)||!['relay','convoy','crane','forge','conveyor','cache'].includes(e.kind)||!Object.hasOwn(SUPPORTS,e.reward)||!num(e.goal,1,1000)||!num(e.progress)||!num(e.remaining,-1,1000)))return false;
 if(x.choices.some((e:any)=>!record(e)||typeof e.id!=='string'||typeof e.title!=='string'||typeof e.description!=='string'||!['weapon','rank','evolution','mod','support','heal'].includes(e.type)))return false;
 if(x.fields.some((f:any)=>!record(f)||!vec(f.pos)||!num(f.radius,0,100)||!num(f.ttl,-1,30)||!num(f.tick,-1,30)||!num(f.damage)||!num(f.color)||!['mist','shock','danger'].includes(f.type)||f.energized!==undefined&&!num(f.energized,0,5)))return false;
 if(x.fx.some((f:any)=>!record(f)||!vec(f.pos)||f.end!==undefined&&!vec(f.end)||!num(f.ttl,-1,30)||!num(f.duration,.001,30)||!num(f.radius,0,100)||!num(f.color)||!['ring','arc','bolt','hit','heal','warning'].includes(f.type)||f.amount!==undefined&&!num(f.amount)||f.yaw!==undefined&&!num(f.yaw,-1e5,1e5)))return false;
 if(x.drones.some((d:any)=>!record(d)||!vec(d.pos)||!vec(d.target)||!num(d.id)||!num(d.yaw,-1e5,1e5)||!['drone','titan','medic','prism'].includes(d.kind)))return false;
 if(x.echoes!==undefined&&(!list(x.echoes,100)||x.echoes.some((e:any)=>!record(e)||!vec(e.pos)||!num(e.at,-1,1000)||!num(e.count,1,50)||!num(e.damage))))return false;
 if(x.events.some((e:any)=>e.route!==undefined&&!vec(e.route)||e.guardIds!==undefined&&(!list(e.guardIds,20)||e.guardIds.some((id:any)=>!num(id)))))return false;
 if(x.enemies.some((e:any)=>['age','mark','slow','stun','yaw'].some(k=>!num(e[k],k==='yaw'?-100:0,1e5))))return false;
 if(x.shots.some((e:any)=>!['player','enemy'].includes(e.owner)||!num(e.radius,0,20)||!num(e.pierce,0,100)||e.hits.some((id:any)=>!num(id))))return false;
 if(x.choices.some((c:any)=>typeof c.detail!=='string'||typeof c.color!=='string'||c.weapon!==undefined&&!Object.hasOwn(WEAPONS,c.weapon)||c.support!==undefined&&!Object.hasOwn(SUPPORTS,c.support)||c.mod!==undefined&&!Object.hasOwn(MODS,c.mod)))return false;
 if(x.encounter!==undefined&&!validEncounter(x.encounter))return false;
 if(x.encounterHistory!==undefined&&(!list(x.encounterHistory,12)||x.encounterHistory.some((e:any)=>!record(e)||!num(e.id)||!encounterKinds.includes(e.kind)||!['complete','failed','expired'].includes(e.result)||!num(e.at,0,2000))))return false;
 if(x.encounterBuff!==undefined&&(!record(x.encounterBuff)||!['power','haste','magnet'].includes(x.encounterBuff.kind)||!num(x.encounterBuff.until,0,2000)))return false;
 if(x.nextEncounterAt!==undefined&&!num(x.nextEncounterAt,0,2000)||x.nextUpgradeAt!==undefined&&!num(x.nextUpgradeAt,0,2000)||x.progressionVersion!==undefined&&x.progressionVersion!==2)return false;
 if(x.reactionCooldowns!==undefined&&!synergyNumbers(x.reactionCooldowns))return false;
 if(x.recoilCharge!==undefined&&!num(x.recoilCharge,0,100)||x.droneHits!==undefined&&(!num(x.droneHits,0,2)||!Number.isInteger(x.droneHits)))return false;
 if(x.lastReaction!==undefined&&(!record(x.lastReaction)||!Object.hasOwn(SYNERGIES,x.lastReaction.id)||!num(x.lastReaction.until)))return false;
 if(x.slamReadyUntil!==undefined&&!num(x.slamReadyUntil))return false;
 if(x.nextPressure!==undefined&&!num(x.nextPressure)||x.pressureWarned!==undefined&&typeof x.pressureWarned!=='boolean')return false;
 if(record(x.stats)&&(x.stats.synergyTriggers!==undefined&&!synergyNumbers(x.stats.synergyTriggers)||x.stats.synergyDamage!==undefined&&!synergyNumbers(x.stats.synergyDamage)))return false;
 return record(x.stats)&&record(x.stats.weaponDamage)&&Object.values(x.stats.weaponDamage).every(v=>num(v))&&['events','eliteKills','syncs','firstUpgrade','firstEvolution','maxCombo'].every(k=>num(x.stats[k]))&&typeof x.notes==='string'&&num(x.supportCooldown,-1,60);
}
export function normalizeSettings(x:unknown):Settings{const s=record(x)?x:{};return {volume:num(s.volume,0,1)?s.volume:DEFAULT_SETTINGS.volume,quality:['low','medium','high'].includes(s.quality)?s.quality:DEFAULT_SETTINGS.quality,shake:typeof s.shake==='boolean'?s.shake:true,damageNumbers:typeof s.damageNumbers==='boolean'?s.damageNumbers:true,reducedMotion:typeof s.reducedMotion==='boolean'?s.reducedMotion:(typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)').matches:false),cameraDistance:num(s.cameraDistance,18,40)?Math.max(22,Math.min(30,s.cameraDistance)):27};}
export function loadProfile():Profile{try{const x=JSON.parse(localStorage.getItem(PROFILE_KEY)??'null');if(!record(x)||x.version!==2)throw 0;return {version:2,unlocks:Array.isArray(x.unlocks)?x.unlocks.filter((id:unknown)=>typeof id==='string'&&UNLOCKS.some(u=>u.id===id)):[],runs:num(x.runs)?x.runs:0,wins:num(x.wins)?x.wins:0,bestKills:num(x.bestKills)?x.bestKills:0,totalKills:num(x.totalKills)?x.totalKills:0,totalEvents:num(x.totalEvents)?x.totalEvents:0,lastWeapon:Object.hasOwn(WEAPONS,x.lastWeapon)?x.lastWeapon:'fist',settings:normalizeSettings(x.settings)};}catch{return structuredClone(DEFAULT_PROFILE);}}
export function saveProfile(profile:Profile){localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}
export function loadRun():RunState|null{try{const text=localStorage.getItem(RUN_KEY);if(!text||text.length>2e6)return null;const x=JSON.parse(text);return validRun(x)?x:null;}catch{return null;}}
export function saveRun(state:RunState){if(!['playing','paused','upgrade'].includes(state.phase))return;localStorage.setItem(RUN_KEY,JSON.stringify(state));}
export function clearRun(){localStorage.removeItem(RUN_KEY);}
export function recordResult(profile:Profile,state:RunState){profile.runs++;if(state.phase==='won')profile.wins++;profile.bestKills=Math.max(profile.bestKills,state.kills);profile.totalKills+=state.kills;profile.totalEvents+=state.stats.events;const add:string[]=[];for(const [id,ok] of [['first-circuit',profile.runs>=1],['harbor-friend',profile.totalEvents>=3],['storm-reader',profile.totalKills>=1000],['surge-master',profile.wins>=1]] as const)if(ok&&!profile.unlocks.includes(id)){profile.unlocks.push(id);add.push(id);}return add;}
