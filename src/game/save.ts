import type {GameSnapshot} from './types';
import type {GameSettings,RunSelection} from '../ui/types';
export interface Profile {wins:number;best:number;unlocks:string[];settings:GameSettings;version:1;lastSelection?:RunSelection;}
export const defaultSettings:GameSettings={volume:.6,musicVolume:.35,effectsVolume:.8,quality:'medium',shake:true,sensitivity:1,damageNumbers:true,reducedMotion:false,invertY:false,quickCast:false,keybinds:{}};

const skills=['grapple','shield','cannon','lightning','mist','barrier'];
const cores=['fist','bubble','sync','health','energy','mobility'];
const actions=['forward','backward','left','right','jump',...skills,'interact','map','resetCamera','beginnerRight','beginnerLeft'];
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const between=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>finite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>between(v,min,max)&&Number.isSafeInteger(v);
const oneOf=(v:unknown,values:readonly string[]):v is string=>typeof v==='string'&&values.includes(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=2500;
const numbers=(v:Record<string,unknown>,names:string)=>names.split(' ').every(k=>finite(v[k]));
const bools=(v:Record<string,unknown>,names:string)=>names.split(' ').every(k=>typeof v[k]==='boolean');
const vector=(v:unknown)=>record(v)&&numbers(v,'x y z');
const maybeVector=(v:unknown)=>v===null||vector(v);
const list=(v:unknown,check:(item:unknown)=>boolean)=>Array.isArray(v)&&v.every(check);
const skillList=(v:unknown)=>list(v,s=>oneOf(s,skills));
const selection=(v:unknown):v is RunSelection=>record(v)&&oneOf(v.mapId,['old-harbor','new-harbor'])&&oneOf(v.mode,['beginner','thunder'])&&oneOf(v.rightSkill,skills.slice(0,3))&&oneOf(v.leftSkill,skills.slice(3));
const numericMap=(v:unknown,keys:string[],max=Number.MAX_SAFE_INTEGER)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>between(v[k],0,max));

export function loadProfile():Profile{
 const profile:Profile={version:1,wins:0,best:0,unlocks:[],settings:{...defaultSettings,keybinds:{}}};
 try{
  const p:unknown=JSON.parse(localStorage.getItem('oinja.profile')??'null');
  if(!record(p)||p.version!==1)return profile;
  if(selection(p.lastSelection)){const {mapId,mode,rightSkill,leftSkill}=p.lastSelection;profile.lastSelection={mapId,mode,rightSkill,leftSkill};}
  if(integer(p.wins))profile.wins=p.wins;
  if(between(p.best,0,1080))profile.best=p.best;
  if(Array.isArray(p.unlocks))profile.unlocks=[...new Set(p.unlocks.filter(s=>oneOf(s,skills)))];
  if(record(p.settings)){
   const s=p.settings;
   for(const k of ['volume','musicVolume','effectsVolume'] as const)if(between(s[k],0,1))profile.settings[k]=s[k] as number;
   if(between(s.sensitivity,.2,2.5))profile.settings.sensitivity=s.sensitivity;
   if(oneOf(s.quality,['low','medium','high']))profile.settings.quality=s.quality as GameSettings['quality'];
   for(const k of ['shake','damageNumbers','reducedMotion','invertY','quickCast'] as const)if(typeof s[k]==='boolean')profile.settings[k]=s[k] as boolean;
   if(record(s.keybinds))for(const action of actions){
    const code=s.keybinds[action];
    if(typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[A-Za-z0-9]+|Arrow(Up|Down|Left|Right)|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Escape|CapsLock|(Shift|Control|Alt|Meta)(Left|Right)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code))profile.settings.keybinds![action]=code;
   }
  }
 }catch{}
 return profile;
}
export function saveProfile(p:Profile){localStorage.setItem('oinja.profile',JSON.stringify(p));}

function validPlayer(p:unknown):boolean{
 if(!record(p)||!vector(p.pos)||!maybeVector(p.mistCenter)||!maybeVector(p.grappleTarget))return false;
 if(!numbers(p,'yaw hp maxHp energy maxEnergy speed attackTimer punchCount bubbleCount level xp xpNext kills damageDealt damageTaken lastHurt invulnerable fastCharge sinceRight mechanical shieldTime cannonShots cannonTime barrierTime barrierTotal empowered mistWindow giftBubble tempShield tempShieldTime vy actionTime switchBuff reflectCooldown pushCooldown'))return false;
 if(!bools(p,'empoweredCannon empoweredShield grounded')||!oneOf(p.hand,['right','left'])||!oneOf(p.lastAction,[...skills,'punch','heavy','bubble','cast','idle']))return false;
 if(!between(p.hp,Number.MIN_VALUE,p.maxHp as number)||!between(p.maxHp,Number.MIN_VALUE)||!between(p.energy,0,p.maxEnergy as number)||!between(p.maxEnergy,Number.MIN_VALUE)||!between(p.speed,Number.MIN_VALUE)||!between(p.xpNext,Number.MIN_VALUE)||!integer(p.level,1,20))return false;
 if(!numericMap(p.levels,skills,5)||!numericMap(p.cooldowns,skills)||!numericMap(p.core,cores,2))return false;
 if(!record(p.evolutions)||!Object.entries(p.evolutions).every(([k,v])=>skills.includes(k)&&oneOf(v,['a','b'])))return false;
 return true;
}
function validEnemy(e:unknown):boolean{
 return record(e)&&integer(e.id,1)&&oneOf(e.kind,['crawler','rammer','gunner','bulwark','weaver'])&&vector(e.pos)&&vector(e.target)&&(e.navTarget===undefined||vector(e.navTarget))&&numbers(e,'hp maxHp yaw age cooldown timer lastAttack stun')&&bools(e,'elite boss')&&oneOf(e.state,['move','windup','attack','recover']);
}
function validProjectile(p:unknown):boolean{
 return record(p)&&integer(p.id,1)&&vector(p.pos)&&vector(p.velocity)&&numbers(p,'damage radius ttl distance maxDistance')&&oneOf(p.owner,['player','enemy'])&&oneOf(p.kind,['bubble','large','cannon','needle'])&&(p.skill===undefined||oneOf(p.skill,skills))&&list(p.hit,id=>integer(id,1))&&typeof p.reflected==='boolean';
}
function validHazard(h:unknown):boolean{return record(h)&&integer(h.id,1)&&vector(h.pos)&&vector(h.end)&&numbers(h,'ttl warmup owner hp tick');}
function validPickup(p:unknown):boolean{return record(p)&&integer(p.id,1)&&vector(p.pos)&&between(p.value,0)&&oneOf(p.type,['xp','heal']);}
function validEvent(e:unknown):boolean{return record(e)&&text(e.id)&&text(e.kind)&&vector(e.pos)&&numbers(e,'progress elapsed triggerTime')&&oneOf(e.state,['locked','available','active','complete','failed']);}
function validUpgrade(u:unknown):boolean{
 if(!record(u)||!text(u.id)||!text(u.title)||!text(u.description)||!integer(u.level,1,5)||!integer(u.maxLevel,1,5))return false;
 if(u.kind==='skill')return oneOf(u.skill,skills)&&u.id===u.skill&&u.level<=4&&u.maxLevel===5&&u.branch===undefined;
 if(u.kind==='evolution')return oneOf(u.skill,skills)&&oneOf(u.branch,['a','b'])&&u.id===u.skill+':'+u.branch&&u.level===5&&u.maxLevel===5;
 return oneOf(u.kind,['core','utility'])&&cores.some(c=>u.id==='core:'+c)&&u.level<=2&&u.maxLevel===2&&u.skill===undefined&&u.branch===undefined;
}
function validEffect(e:unknown):boolean{
 return record(e)&&integer(e.id,1)&&oneOf(e.kind,['hit','lightning','burst','grapple','mist','barrier','shield','trail','heal','warning'])&&vector(e.pos)&&(e.end===undefined||vector(e.end))&&numbers(e,'ttl duration')&&['radius','color','amount'].every(k=>e[k]===undefined||finite(e[k]));
}
function validSnapshot(v:unknown):v is GameSnapshot{
 if(!record(v)||v.version!==1||!record(v.config))return false;
 const c=v.config;
 if(!selection(c)||(c.seed!==undefined&&!finite(c.seed)))return false;
 if(!between(v.time,0)||v.time>=1080||!finite(v.rng)||!integer(v.rerolls)||!between(v.nextSpawn,0)||!integer(v.nextId,1)||!integer(v.pendingLevels,0,19)||typeof v.bossSpawned!=='boolean'||!validPlayer(v.player))return false;
 if(!list(v.enemies,validEnemy)||!list(v.projectiles,validProjectile)||!list(v.hazards,validHazard)||!list(v.pickups,validPickup)||!list(v.events,validEvent)||!list(v.choices,validUpgrade)||!skillList(v.unlocks))return false;
 if(v.pendingLevels>0&&(v.choices as unknown[]).length===0)return false;
 if(v.effects!==undefined&&!list(v.effects,validEffect))return false;
 if(v.delayed!==undefined&&!list(v.delayed,d=>record(d)&&numbers(d,'time target damage')&&oneOf(d.skill,skills)))return false;
 return ['hazardContact','hazardDamageTimer'].every(k=>v[k]===undefined||between(v[k],0));
}
export function loadRun():GameSnapshot|null{
 try{const v:unknown=JSON.parse(localStorage.getItem('oinja.run')??'null');return validSnapshot(v)?v:null;}catch{return null;}
}
export function saveRun(s:GameSnapshot){localStorage.setItem('oinja.run',JSON.stringify(s));}
export function clearRun(){localStorage.removeItem('oinja.run');}
