import {WEAPONS,MODS,SUPPORTS,ENEMY_DATA} from './content';
import {activeSynergies,previewChoiceSynergies} from './synergies';
import {xpToNext,upgradeBreather,migrateProgression} from './progression';
import {encounterBuffActive,encounterCanStart,startEncounter,updateEncounter,recordEncounterKill,finishEncounter} from './encounters';
import type {RunState,WeaponId,SupportId,EnemyId,WorldPort,GameSignals,EventDefinition,Vec,Choice,Mob,InputState,WeaponSlot,SynergyId} from './types';
const V=(x=0,y=0,z=0):Vec=>({x,y,z});
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
const raised=(a:Vec,h=1):Vec=>({...a,y:a.y+h});
const toward=(a:Vec,b:Vec):Vec=>{const d=Math.hypot(b.x-a.x,b.z-a.z)||1;return V((b.x-a.x)/d,0,(b.z-a.z)/d);};
const color=(s:string)=>parseInt(s.slice(1),16);
export class SurgeSimulation {
 state:RunState;
 private moving=false;
 constructor(public world:WorldPort,public signals:GameSignals,spawn:Vec,sites:EventDefinition[],weapon:WeaponId='fist',seed=Date.now(),danger=0,kit='balanced'){
 this.state={version:2,progressionVersion:2,nextUpgradeAt:20,encounterHistory:[],nextPressure:150,kit,phase:'playing',seed,rng:seed>>>0,time:0,startWeapon:weapon,danger,player:{...spawn},yaw:0,hp:240,maxHp:240,shield:0,sync:0,syncTime:0,dashTime:0,dashCooldown:0,invulnerable:2,lastHurt:-10,revives:1,level:1,xp:0,xpNext:xpToNext(1),kills:0,damageTaken:0,damageDealt:0,rerolls:4,pendingLevels:0,weapons:[{id:weapon,level:1,cooldown:.1,casts:0}],mods:{},support:null,supportCooldown:0,enemies:[],shots:[],fields:[],fx:[],drops:[],drones:[],events:[],choices:[],nextId:1,nextSpawn:.8,bossSpawned:false,notes:'寻找场景设施，获取强力支援',stats:{weaponDamage:{},events:0,eliteKills:0,syncs:0,firstUpgrade:0,firstEvolution:0,maxCombo:0},combo:0,comboTime:0,action:'idle',actionTime:0};
 const candidates=[...sites],selected:EventDefinition[]=[];
 for(const kind of ['relay','convoy','crane','forge','conveyor','cache']){const pool=candidates.filter(e=>e.kind===kind);if(pool.length){const choice=pool[Math.floor(this.random()*pool.length)];selected.push(kind==='forge'?(pool.find(e=>e.id.endsWith('forge-home'))??choice):choice);}}
 for(const e of selected)this.state.events.push({...e,pos:{...e.pos},state:'available',progress:0,goal:e.kind==='convoy'?24:e.kind==='relay'?14:e.kind==='conveyor'?16:e.kind==='cache'?2:1,remaining:90,rewarded:false,counter:0});
 this.state.nextEncounterAt=65+Math.floor(this.random()*21);
 if(kit==='recycler')this.state.rerolls+=2;
 if(kit==='conductor'){this.state.mods.conductor=1;this.state.maxHp-=35;this.state.hp=this.state.maxHp;}
 if(kit==='wanderer')this.state.mods.area=1;
 if(kit==='support'){this.state.supportTrial=90;this.state.support=(Object.keys(SUPPORTS) as SupportId[])[Math.floor(this.random()*6)];this.state.rerolls--;}
 }
 random(){let x=this.state.rng||123456789;x^=x<<13;x^=x>>>17;x^=x<<5;this.state.rng=x>>>0;return this.state.rng/4294967296;}
 id(){return this.state.nextId++;}
 get s(){return this.state;}
 ended(){return this.s.phase==='won'||this.s.phase==='lost';}
 mod(id:string){return this.s.mods[id]??0;}
 power(){return (1+this.mod('power')*.22)*(1+(this.s.level-1)*.026)*(this.s.syncTime>0?1.6:1)*(this.s.kit==='recycler'?.92:1)*(encounterBuffActive(this.s,'power')?1.4:1);}
 area(){return 1+this.mod('area')*.18+(this.s.syncTime>0?.2+this.mod('capacitor')*.1:0);}
 rate(){return Math.max(.38,1-this.mod('tempo')*.12)*(this.s.syncTime>0?.55:1)*(this.s.kit==='wanderer'?1.1:1)*(encounterBuffActive(this.s,'haste')?.8:1);}
 fx(type:RunState['fx'][number]['type'],pos:Vec,radius:number,c:number,ttl=.45,end?:Vec,amount?:number){if(this.s.fx.length>200)this.s.fx.splice(0,20);this.s.fx.push({id:this.id(),type,pos:{...pos},end:end?{...end}:undefined,radius,color:c,ttl,duration:ttl,amount});}
 sync(){if(this.s.phase!=='playing'||this.s.sync<100||this.s.syncTime>0)return false;this.s.sync=0;this.s.syncTime=10;this.s.stats.syncs++;this.s.invulnerable=Math.max(this.s.invulnerable,1);for(const w of this.s.weapons)w.cooldown=0;this.fx('ring',this.s.player,12,0xffddaa,.8);this.signals.sound('barrier');this.signals.toast('双臂同调 · 全回路过载');return true;}
 charge(v:number){if(this.s.syncTime<=0)this.s.sync=Math.min(100,this.s.sync+v*(1+this.mod('capacitor')*.3));}
 nearby(pos:Vec,range:number){return this.s.enemies.filter(e=>e.hp>0&&distance(e.pos,pos)<=range&&Math.abs(e.pos.y-pos.y)<4);}
 targets(pos:Vec,range:number,elite=false){return this.nearby(pos,range).sort((a,b)=>(elite?(Number(b.elite||b.boss)-Number(a.elite||a.boss))*100:0)+distance(a.pos,pos)-distance(b.pos,pos));}
 nearest(pos:Vec,range:number,predicate?:(e:Mob)=>boolean,elite=false){let best:Mob|undefined,bestScore=Infinity;const limit=range*range;for(const e of this.s.enemies){if(e.hp<=0||Math.abs(e.pos.y-pos.y)>=4)continue;const d=(e.pos.x-pos.x)**2+(e.pos.z-pos.z)**2;if(d>limit)continue;const score=d-(elite&&(e.elite||e.boss)?limit+1:0);if(score<bestScore&&(!predicate||predicate(e))){best=e;bestScore=score;}}return best;}
 visible(a:Vec,b:Vec){return this.world.clear(raised(a),raised(b));}
 step(dt:number,input:InputState){
 const s=this.s;if(s.phase!=='playing')return;dt=Math.min(.1,Math.max(0,dt));s.time+=dt;
 for(const key of ['syncTime','dashTime','dashCooldown','invulnerable','actionTime','comboTime'] as const)s[key]=Math.max(0,s[key]-dt);
 if(s.comboTime===0)s.combo=0;
 if(s.supportTrial){s.supportTrial=Math.max(0,s.supportTrial-dt);if(!s.supportTrial){s.support=null;this.signals.toast('援护试用结束 · 地图设施可获取永久本局支援');}}
 const move=V(input.x,0,input.z),length=Math.hypot(move.x,move.z);if(length>1){move.x/=length;move.z/=length;}
 if(input.dash&&s.dashCooldown<=0){s.dashTime=.23;s.dashCooldown=1.5;s.invulnerable=Math.max(s.invulnerable,.4);this.fx('ring',s.player,2,0x99dfd6,.3);this.signals.sound('jump');}
 this.moving=length>.1;const speed=(s.dashTime>0?30:9.3)*(encounterBuffActive(s,'haste')?1.12:1);const delta=V(move.x*speed*dt,0,move.z*speed*dt);if(s.dashTime>0&&length===0){delta.x=-Math.sin(s.yaw)*speed*dt;delta.z=-Math.cos(s.yaw)*speed*dt;}
 s.player=this.world.move(s.player,delta,dt);if(length>.1)s.yaw=Math.atan2(-move.x,-move.z);
 if(s.time-s.lastHurt>3.5)s.hp=Math.min(s.maxHp,s.hp+dt*2.8);
 s.basicCooldown=(s.basicCooldown??0)-dt;if(s.basicCooldown<=0){const e=this.nearest(s.player,27);if(e&&this.visible(s.player,e.pos)){this.shoot(s.player,e.pos,13,'bubble',.18,24,0,0,0xb3e8db);s.basicCooldown=.85;}else s.basicCooldown=.2;}
 for(const w of s.weapons){w.cooldown-=dt;if(w.cooldown<=0)this.cast(w);}
 if(this.mod('bulwark')||s.weapons.some(w=>w.id==='shield'&&w.evolution==='b')){s.armorCooldown=(s.armorCooldown??0)-dt;if(s.armorCooldown<=0){s.shield=Math.max(s.shield,Math.min(100,s.shield+10+this.mod('bulwark')*10));s.armorCooldown=5;}}
 for(const echo of s.echoes??[])if(echo.at<=s.time&&echo.at>=0){const target=this.nearest(echo.pos,15);if(target)this.chain(target,echo.count,echo.damage,'chain');echo.at=-1;}s.echoes=s.echoes?.filter(e=>e.at>=0);
 this.updateSupport(dt);if(this.ended())return;this.updateDrones(dt);this.updateEnemies(dt);this.separateEnemies(dt);if(this.ended())return;this.updateShots(dt);if(this.ended())return;this.updateFields(dt);if(this.ended())return;this.updateDrops(dt);this.updateEvents(dt);if(this.ended())return;updateEncounter(this,dt);
 s.enemies=s.enemies.filter(e=>e.hp>0);for(const e of s.fx)e.ttl-=dt;s.fx=s.fx.filter(e=>e.ttl>0);
 if(s.time>=s.nextSpawn){this.wave();s.nextSpawn=s.time+(s.time<90?2.1:1.7);}
 this.updatePressure();
 if(s.time>=720&&!s.bossSpawned){s.bossSpawned=true;s.notes='终局 · 找到断电统御机，完成最后清场';this.spawn('weaver',true,true);this.signals.toast('终局 · 断电统御机降临');this.signals.sound('boss');}
 if(s.time>=900)this.end(false,'时间耗尽 · 下次试试新的回路');
 if(s.pendingLevels>0&&s.phase==='playing'&&s.time>=(s.nextUpgradeAt??0))this.openLevel();
 }
 cast(w:WeaponSlot){
 const s=this.s,def=WEAPONS[w.id],a=this.area(),range=def.range*a*(w.id==='hook'&&w.evolution==='a'?1.35:1)*(w.id==='fist'&&w.evolution==='b'?4:1),targets=this.targets(s.player,range,w.id==='cannon');const target=targets.find(e=>this.visible(s.player,e.pos));if(!target){if(w.id==='fist'&&this.releaseSlam(range)){w.cooldown=def.cooldown*this.rate();w.casts++;s.action='punch';s.actionTime=.24;this.signals.sound('punch');}else w.cooldown=.13;return;}
 const evo=!!w.evolution,d=def.damage*(1+(w.level-1)*.32)*this.power();w.cooldown=def.cooldown*this.rate()*(w.evolution==='b'&&['shield','cannon'].includes(w.id)?.65:1);w.casts++;this.charge(1.2);s.actionTime=.24;s.action=w.id==='fist'?'punch':w.id==='chain'?'cast':w.id==='hook'?'grapple':w.id==='drone'?'bubble':w.id;
 if(w.id==='fist'||w.id==='shield'||w.id==='hook'){
 let r=range;if(w.id==='hook'){for(const e of targets){const n=toward(e.pos,s.player),gap=Math.max(0,distance(e.pos,s.player)-3);const pos=V(e.pos.x+n.x*gap*.65,e.pos.y,e.pos.z+n.z*gap*.65);if(this.world.valid(pos.x,pos.z)&&this.visible(e.pos,pos))e.pos=pos;e.mark=5;e.stun=.5;}this.fx('bolt',raised(s.player),.2,0xffc598,.25,raised(target.pos));}
 const attackYaw=Math.atan2(s.player.x-target.pos.x,s.player.z-target.pos.z);if(!this.moving)s.yaw=attackYaw;
 for(const e of this.nearby(s.player,r)){if(this.visible(s.player,e.pos)){const near=distance(e.pos,s.player)<3.7;this.hit(e,d*(near&&w.id==='fist'?1.4:1)*(w.evolution==='a'&&w.id==='fist'?1.6:1),w.id);e.stun=Math.max(e.stun,.18);if(w.id==='shield')this.push(e,1.2);}}
 this.fx(w.id==='fist'?'arc':'ring',s.player,r,color(def.color),.38);s.fx[s.fx.length-1].yaw=attackYaw;if(w.id==='shield')s.shield=Math.max(s.shield,Math.min(110,s.shield+20+w.level*4));
 if(w.id==='fist'&&w.evolution==='b')this.shoot(s.player,target.pos,d*.9,'fist',.8,32,12,2.4,0xffcc8d);
 if(w.id==='hook'&&w.evolution==='b')this.chain(target,3,d*.6,'hook');
 if(w.id==='fist'&&w.evolution==='a')this.areaHit(s.player,r*1.2,d*.35,'fist');
 if(w.id==='hook'&&this.linked('slam')&&this.reactionReady('slam',1.2)){const fist=s.weapons.find(v=>v.id==='fist')!;fist.cooldown=0;s.slamReadyUntil=s.time+1.5;}
 if(w.id==='fist')this.releaseSlam(r);
 if((w.id==='fist'||w.id==='hook')&&(s.recoilCharge??0)>=8&&this.linked('rebound')&&this.reactionReady('rebound',1.5)){const charge=s.recoilCharge!;s.recoilCharge=0;this.reaction('rebound');this.areaHit(s.player,9*a,(35+charge*1.5)*this.power(),w.id,1,'rebound');this.fx('ring',s.player,9*a,0x93c6ff,.6);}

 }else if(w.id==='chain'){const count=4+w.level+this.mod('shrapnel')*2+(w.evolution==='a'?5:0);this.chain(target,count,d,'chain');if(w.evolution==='b'){s.echoes??=[];s.echoes.push({at:s.time+.3,pos:{...target.pos},count,damage:d*.65});}
 }else if(w.id==='bubble'||w.id==='cannon'){
 const count=1+this.mod('shrapnel')+(w.evolution==='b'?(w.id==='bubble'?2:1):0);for(let i=0;i<count;i++){const t=targets[i%targets.length];if(this.visible(s.player,t.pos))this.shoot(s.player,t.pos,d,w.id,w.id==='cannon'?.5:.4,w.id==='cannon'?38:23,w.id==='cannon'?(evo?8:3):0,(w.id==='bubble'?4:3.5)*a*(w.evolution==='a'?1.4:1),color(def.color),i===0?0:(i%2===0?.09:-.09));}
 }else if(w.id==='drone'){
 const n=2+Math.floor((w.level-1)/2)+this.mod('relay')+this.mod('shrapnel')+(w.evolution==='a'?2:0);for(let i=0;i<n;i++){const preferred=this.linked('swarm')?targets.filter(e=>e.mark>0):[];const group=preferred.length?preferred:targets;const t=group[i%group.length];if(!this.visible(s.player,t.pos))continue;const from=V(s.player.x+Math.cos(i*2.4)*2,s.player.y+1.2,s.player.z+Math.sin(i*2.4)*2);if(w.evolution==='b'){this.fx('bolt',from,.1,0xffe496,.22,raised(t.pos));t.mark=4;this.hit(t,d*1.2,'drone');}else this.shoot(from,t.pos,d,'drone',.17,37,0,w.evolution==='a'?2:0,0xffda80);this.charge(this.mod('relay')*.3);}
 }else if(w.id==='mist'){
 const r=5.3*a*(w.evolution==='a'?1.35:1);s.fields.push({id:this.id(),pos:{...target.pos},radius:r,ttl:w.evolution==='a'?7:4.5,tick:0,damage:d,type:'mist',color:0xb693e5});this.fx('ring',target.pos,r,0xbe9fee,.55);
 }
 this.signals.sound(w.id==='fist'?'punch':w.id==='chain'?'lightning':w.id==='hook'?'grapple':w.id==='drone'?'bubble':w.id);
 if(this.mod('echo')&&w.casts%3===0){this.areaHit(s.player,7*a,38*this.power()*this.mod('echo'),w.id);this.fx('ring',s.player,7*a,0xe3c7ff,.45);}
 }
 chain(first:Mob,count:number,damage:number,weapon:WeaponId,depth=0,synergy?:SynergyId,origin?:Vec,excludeId?:number){let current=first,from=raised(origin??this.s.player);const visited=new Set<number>(excludeId===undefined?[]:[excludeId]);for(let i=0;i<count&&current;i++){visited.add(current.id);this.fx('bolt',from,.12,0xc8b7ff,.25,raised(current.pos));current.mark=5;this.hit(current,damage*(1+i*.06),weapon,depth,synergy);from=raised(current.pos);const next=this.targets(current.pos,9*this.area()).find(e=>!visited.has(e.id)&&this.visible(current.pos,e.pos));if(!next)break;current=next;}}
 releaseSlam(range:number){const s=this.s;if((s.slamReadyUntil??0)<=s.time||!this.linked('slam'))return false;s.slamReadyUntil=0;this.reaction('slam');this.areaHit(s.player,range*1.25,75*this.power(),'fist',1,'slam');this.fx('ring',s.player,range*1.25,0xffc184,.5);return true;}
 linked(id:SynergyId){return activeSynergies(this.s).some(x=>x.id===id);}
 reactionAvailable(id:SynergyId){return (this.s.reactionCooldowns?.[id]??0)<=this.s.time;}
 reactionReady(id:SynergyId,cooldown:number){const s=this.s;s.reactionCooldowns??={};if((s.reactionCooldowns[id]??0)>s.time)return false;s.reactionCooldowns[id]=s.time+cooldown;return true;}
 reaction(id:SynergyId){const s=this.s;s.stats.synergyTriggers??={};s.stats.synergyTriggers[id]=(s.stats.synergyTriggers[id]??0)+1;s.lastReaction={id,until:s.time+2};this.charge(2);}
 reactToHit(e:Mob,raw:number,weapon:WeaponId|'support',marked:boolean){
  const s=this.s;
  if((weapon==='bubble'||weapon==='cannon')&&s.weapons.some(w=>w.id===weapon)&&marked&&this.reactionAvailable('discharge')&&this.linked('discharge')){const next=this.nearest(e.pos,11,m=>m.id!==e.id&&this.visible(e.pos,m.pos));if(next&&this.reactionReady('discharge',.75)){e.mark=0;this.reaction('discharge');this.chain(next,3,raw*.45+20*this.power(),weapon,1,'discharge',e.pos,e.id);}}
  if(weapon==='chain'&&this.reactionAvailable('storm')&&this.linked('storm')){const f=s.fields.find(f=>f.type==='mist'&&f.ttl>0&&(f.energized??0)<.25&&distance(f.pos,e.pos)<=f.radius&&Math.abs(f.pos.y-e.pos.y)<3&&this.visible(f.pos,e.pos));if(f&&this.reactionReady('storm',.95)){f.energized=1.8;f.tick=0;this.reaction('storm');this.areaHit(f.pos,f.radius,48*this.power(),'mist',1,'storm');this.fx('ring',f.pos,f.radius,0xd8bcff,.55);}}
  if(weapon==='drone'&&marked&&this.linked('swarm')){s.droneHits=(s.droneHits??0)+1;if(s.droneHits>=3){s.droneHits=0;if(!this.reactionAvailable('swarm'))return;const targets=this.targets(e.pos,15).filter(m=>m.mark>0&&this.visible(s.player,m.pos)).slice(0,3);if(targets.length&&this.reactionReady('swarm',1.4)){this.reaction('swarm');for(const m of targets){this.fx('bolt',raised(s.player,2),.16,0xffe29a,.35,raised(m.pos));this.hit(m,raw*.65,'drone',1,'swarm');}}}}
 }

 shoot(from:Vec,to:Vec,damage:number,weapon:WeaponId|'support',radius:number,speed:number,pierce:number,blast:number,c:number,angle=0){const dir=toward(from,to),ca=Math.cos(angle),sa=Math.sin(angle),len=Math.max(1,distance(from,to));this.s.shots.push({id:this.id(),pos:raised(from,.9),vel:V((dir.x*ca-dir.z*sa)*speed,(to.y-from.y)/len*speed,(dir.z*ca+dir.x*sa)*speed),radius,damage,ttl:2.2,owner:'player',weapon,pierce,hits:[],color:c,blast});}
 areaHit(pos:Vec,radius:number,damage:number,weapon:WeaponId|'support',depth=0,synergy?:SynergyId){for(const e of this.nearby(pos,radius))if(this.visible(pos,e.pos))this.hit(e,damage,weapon,depth,synergy);}
 push(e:Mob,amount:number){if(e.boss)return;const n=toward(this.s.player,e.pos),p=V(e.pos.x+n.x*amount,e.pos.y,e.pos.z+n.z*amount);if(this.world.valid(p.x,p.z)&&this.visible(e.pos,p))e.pos=p;}
 hit(e:Mob,raw:number,weapon:WeaponId|'support',depth=0,synergy?:SynergyId){
 if(e.hp<=0)return;const s=this.s;if(this.mod('conductor'))e.mark=4;const marked=e.mark>0;let damage=raw*(e.mark>0?1.2:1);if(!e.boss&&e.kind!=='bulwark'&&s.enemies.some(g=>g.hp>0&&g.kind==='bulwark'&&!g.boss&&distance(g.pos,e.pos)<7))damage*=.8;
 const actual=Math.min(e.hp,damage);e.hp-=damage;s.damageDealt+=actual;s.stats.weaponDamage[weapon]=(s.stats.weaponDamage[weapon]??0)+actual;if(synergy){s.stats.synergyDamage??={};s.stats.synergyDamage[synergy]=(s.stats.synergyDamage[synergy]??0)+actual;}
 if(this.random()<.25||e.elite||e.boss)this.fx('hit',raised(e.pos),.2,0xffe8b8,.5,undefined,Math.round(damage));
 if(e.hp>0){if(depth===0&&!synergy)this.reactToHit(e,raw,weapon,marked);return;}e.hp=0;s.kills++;s.combo++;s.comboTime=2.2;s.stats.maxCombo=Math.max(s.stats.maxCombo,s.combo);this.charge(e.elite?7:1.7);if(e.elite)s.stats.eliteKills++;
 if(!e.boss)recordEncounterKill(this,e);
 const xp=ENEMY_DATA[e.kind].xp*(e.elite?5:1);s.drops.push({id:this.id(),pos:{...e.pos},amount:xp,type:'xp',age:0});
 if(e.elite||this.random()<.025)s.drops.push({id:this.id(),pos:{...e.pos},amount:30,type:'heal',age:0});
 if(distance(e.pos,s.player)<7){s.shield=Math.max(s.shield,Math.min(90,s.shield+(weapon==='fist'?2:0)+this.mod('siphon')*2));if(this.mod('siphon'))s.hp=Math.min(s.maxHp,s.hp+this.mod('siphon')*1.7);}
 for(const site of s.events)if(site.state==='active'){if(site.kind==='cache'&&site.guardIds?.includes(e.id))site.progress++;else if(distance(e.pos,site.pos)<26&&(site.kind==='relay'||site.kind==='conveyor'))site.progress++;}
 if(e.mark>0&&depth<2&&(this.mod('detonate')||s.weapons.some(w=>w.id==='chain'&&w.evolution==='a'))){const d=(25+this.mod('detonate')*20)*this.power();this.fx('ring',e.pos,3.5*this.area(),0xcda3ff,.3);this.areaHit(e.pos,3.5*this.area(),d,weapon,depth+1,synergy);}
 if(e.boss){this.end(true,'回路接通 · 区域重获光明');this.signals.sound('victory');return;}if(depth===0&&!synergy&&!this.ended())this.reactToHit(e,raw,weapon,marked);
 }
 hurt(amount:number){const s=this.s;if(s.invulnerable>0||s.phase!=='playing')return;let d=amount*(s.encounter?.kind==='overload'&&s.encounter.state==='active'?1.3:1)*1.12*(1-this.mod('bulwark')*.15)*(1+s.danger*.2);const absorbed=Math.min(s.shield,d);if(absorbed>0&&this.linked('rebound'))s.recoilCharge=Math.min(100,(s.recoilCharge??0)+absorbed);s.shield-=absorbed;d-=absorbed;s.hp-=d;s.damageTaken+=d;s.lastHurt=s.time;s.invulnerable=.34;this.signals.sound('hurt');const shield=s.weapons.find(w=>w.id==='shield');if(shield){shield.cooldown=Math.max(.05,shield.cooldown-.6);if(shield.evolution==='a'&&absorbed>0){this.areaHit(s.player,8,85*this.power(),'shield');this.fx('ring',s.player,8,0x8dc6ff,.35);}}
 if(s.hp<=0){if(s.encounter?.state==='active')finishEncounter(this,'failed');if(s.revives>0){s.revives--;s.hp=s.maxHp;s.shield=80;s.invulnerable=5;s.sync=100;this.areaHit(s.player,18,600,'support');this.fx('ring',s.player,18,0xafffec,1);this.signals.toast('应急复起 · 满血恢复，同调已就绪');this.signals.sound('heal');}else this.end(false,'回路暂时中断 · 带着新发现再来一次');}}
 spawn(kind:EnemyId,elite=false,boss=false,pos?:Vec){const s=this.s;if(!boss&&(s.enemies.length>=299||!elite&&s.enemies.length>=270))return;const at=pos??this.world.spawnPoint(s.player,this.random()*Math.PI*2,boss?22:15+this.random()*10);if(!at)return;
 // Reserve the final actor slot for the finale, including snapshots from the previous budget.
 if(boss&&s.enemies.length>=300){const protectedIds=new Set(s.events.flatMap(e=>e.guardIds??[]));for(const id of s.encounter?.targetIds??[])protectedIds.add(id);
  while(s.enemies.length>=300){let index=-1,score=-Infinity;for(let i=0;i<s.enemies.length;i++){const enemy=s.enemies[i];if(enemy.boss||protectedIds.has(enemy.id))continue;const value=distance(enemy.pos,s.player)+(enemy.elite?0:1e6);if(value>score){score=value;index=i;}}if(index<0)return;s.enemies.splice(index,1);}
 }
 const base=ENEMY_DATA[kind],hp=boss?28000*(1+s.danger*.4):base.hp*1.12*(1+s.time*.0019)*(elite?5:1)*(1+s.danger*.25);s.enemies.push({id:this.id(),kind,pos:{...at},hp,maxHp:hp,elite,boss,yaw:0,timer:boss?3:1+this.random()*2,state:'move',target:{...s.player},slow:0,mark:0,stun:0,age:0});}
 wave(){const s=this.s;const n=Math.min(29,7+Math.floor(s.time/38)+s.danger*3);for(let i=0;i<n;i++){const r=this.random();let kind:EnemyId='crawler';if(s.time>35&&r>.77)kind='rammer';if(s.time>65&&r>.85)kind='gunner';if(s.time>130&&r>.92)kind='bulwark';if(s.time>190&&r>.97)kind='weaver';this.spawn(kind);}const cycle=Math.floor(s.time/90);if(cycle>0&&Math.floor((s.time-2)/90)<cycle){this.spawn(cycle%2?'rammer':'bulwark',true);this.signals.toast('精英来袭 · 击破获得大量经验');}}
 updatePressure(){const s=this.s;s.nextPressure??=(Math.floor(s.time/150)+1)*150;if(s.nextPressure>600)return;if(s.time>=s.nextPressure-5&&!s.pressureWarned){s.pressureWarned=true;this.signals.toast('围猎波将至 · 冲锋机与炮机正在集结');}if(s.time<s.nextPressure)return;const base=this.random()*Math.PI*2;for(let i=0;i<8;i++){const p=this.world.spawnPoint(s.player,base+i*Math.PI/4,24);if(p)this.spawn(i%3===0?'rammer':'gunner',i<2,false,p);}s.nextPressure+=150;s.pressureWarned=false;this.signals.toast('围猎波 · 突围或利用场景设施清场');}
 updateEnemies(dt:number){const s=this.s;for(const e of [...s.enemies]){if(e.hp<=0)continue;e.age+=dt;e.mark=Math.max(0,e.mark-dt);e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);e.timer=Math.max(-.5,e.timer-dt);const gap=distance(e.pos,s.player);e.yaw=Math.atan2(e.pos.x-s.player.x,e.pos.z-s.player.z);if(e.stun>0)continue;
 if(e.state==='windup'){if(e.timer<=0){e.state='attack';e.timer=e.kind==='rammer'?.5:.3;if(e.boss){this.fx('ring',e.target,7,0xffaa66,.4);if(distance(s.player,e.target)<7)this.hurt(38);for(let i=0;i<12;i++){const a=i*Math.PI/6;s.shots.push({id:this.id(),pos:raised(e.pos),vel:V(Math.cos(a)*11,0,Math.sin(a)*11),radius:.3,damage:17,ttl:4,owner:'enemy',weapon:'support',pierce:0,hits:[],blast:0,color:0xffa170});}}else if(e.kind==='gunner'){const dir=toward(e.pos,e.target);s.shots.push({id:this.id(),pos:raised(e.pos),vel:V(dir.x*14,0,dir.z*14),radius:.25,damage:10,ttl:2.6,owner:'enemy',weapon:'support',pierce:0,hits:[],blast:0,color:0xffa170});}}continue;}
 if(e.state==='attack'){if(e.kind==='rammer'){const n=toward(e.pos,e.target),p=V(e.pos.x+n.x*16*dt,e.pos.y,e.pos.z+n.z*16*dt);if(this.world.valid(p.x,p.z))e.pos=p;if(distance(e.pos,s.player)<1.8)this.hurt(18);}if(e.timer<=0){e.state='move';e.timer=e.boss?3.5:2.5;}continue;}
 if(e.timer<=0&&e.boss){e.state='windup';e.target={...s.player};e.timer=1.2;this.fx('warning',e.target,7,0xff7a52,1.2);if(e.age%20<4)for(let i=0;i<4;i++)this.spawn('crawler');continue;}
 if(e.timer<=0&&((e.kind==='rammer'&&gap<17)||(e.kind==='gunner'&&gap<25))&&this.visible(e.pos,s.player)){e.state='windup';e.target={...s.player};e.timer=e.kind==='rammer'?.85:.8;this.fx('warning',e.pos,.5,0xffa170,e.timer,e.target);continue;}
 if(e.kind==='weaver'&&!e.boss&&e.timer<=0){for(let i=0;i<2;i++)this.spawn('crawler',false,false,V(e.pos.x+(i?2:-2),e.pos.y,e.pos.z));e.timer=8;}
 const speed=ENEMY_DATA[e.kind].speed*1.12*(e.slow>0?.45:1)*(e.boss?.7:1);let dir=toward(e.pos,s.player);if(e.kind==='gunner'&&gap<10){dir.x*=-.6;dir.z*=-.6;}
 let next=V(e.pos.x+dir.x*speed*dt,e.pos.y,e.pos.z+dir.z*speed*dt);
 if(Math.abs(s.player.y-e.pos.y)>2||!this.world.valid(next.x,next.z)||Math.abs(this.world.floor(next.x,next.z,e.pos.y)-e.pos.y)>.8){if(!e.route||Math.floor(e.age*2)!==Math.floor((e.age-dt)*2))e.route=this.world.route(e.pos,s.player);dir=toward(e.pos,e.route);next=V(e.pos.x+dir.x*speed*dt,e.pos.y,e.pos.z+dir.z*speed*dt);}
 if(this.world.valid(next.x,next.z)){next.y=this.world.floor(next.x,next.z,e.pos.y);if(Math.abs(next.y-e.pos.y)<1)e.pos=next;}
 if(gap<(e.boss?3:1.5)&&Math.abs(e.pos.y-s.player.y)<2&&this.visible(e.pos,s.player))this.hurt(e.boss?24:ENEMY_DATA[e.kind].damage);
 }}
 separateEnemies(dt:number){const grid=new Map<string,Mob[]>();const size=3;for(const e of this.s.enemies){if(e.hp<=0)continue;const x=Math.floor(e.pos.x/size),z=Math.floor(e.pos.z/size);let dx=0,dz=0;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const cell=grid.get((x+ox)+':'+(z+oz));if(!cell)continue;for(const other of cell.slice(-10)){if(Math.abs(e.pos.y-other.pos.y)>2)continue;let vx=e.pos.x-other.pos.x,vz=e.pos.z-other.pos.z,d=Math.hypot(vx,vz);const r=(e.boss?2.2:e.kind==='bulwark'?1:.55)+(other.boss?2.2:other.kind==='bulwark'?1:.55);if(d>=r)continue;if(d<.01){vx=Math.cos(e.id*2.399);vz=Math.sin(e.id*2.399);d=1;}const k=(r-Math.min(d,r))*.8+.15;dx+=vx/d*k;dz+=vz/d*k;}}const length=Math.hypot(dx,dz);if(length>0){const scale=Math.min(length,dt*4)/length,nx=e.pos.x+dx*scale,nz=e.pos.z+dz*scale;if(this.world.valid(nx,nz)&&Math.abs(this.world.floor(nx,nz,e.pos.y)-e.pos.y)<.6){e.pos.x=nx;e.pos.z=nz;}}const key=x+':'+z,cell=grid.get(key)??[];cell.push(e);grid.set(key,cell);}}
 updateShots(dt:number){const s=this.s;for(const p of s.shots){p.ttl-=dt;if(p.ttl<=0)continue;const old={...p.pos};p.pos.x+=p.vel.x*dt;p.pos.y+=p.vel.y*dt;p.pos.z+=p.vel.z*dt;if(!this.world.clear(old,p.pos)){p.ttl=0;continue;}
 if(p.owner==='enemy'){if(distance(p.pos,s.player)<p.radius+.65&&Math.abs(p.pos.y-s.player.y-1)<1.5){this.hurt(p.damage);p.ttl=0;}continue;}
 for(const e of s.enemies){if(e.hp<=0||p.hits.includes(e.id))continue;const segment=V(p.pos.x-old.x,0,p.pos.z-old.z),den=segment.x**2+segment.z**2||1,t=Math.max(0,Math.min(1,((e.pos.x-old.x)*segment.x+(e.pos.z-old.z)*segment.z)/den)),closest=V(old.x+segment.x*t,old.y+(p.pos.y-old.y)*t,old.z+segment.z*t);if(distance(closest,e.pos)>p.radius+(e.boss?2:1)||Math.abs(closest.y-e.pos.y-1)>2)continue;
 p.hits.push(e.id);this.hit(e,p.damage,p.weapon);if(p.blast){if(p.weapon==='bubble'&&e.mark>0&&s.weapons.some(w=>w.id==='bubble'&&w.evolution==='a')){this.areaHit(e.pos,p.blast*1.3,p.damage*.4,p.weapon);this.fx('ring',e.pos,p.blast*1.3,0xc5b4ff,.6);}this.areaHit(e.pos,p.blast,p.damage*.65,p.weapon);this.fx('ring',e.pos,p.blast,p.color,.38);if(this.mod('vortex'))for(const v of this.nearby(e.pos,p.blast*1.5)){const n=toward(v.pos,e.pos),at=V(v.pos.x+n.x*1.2,v.pos.y,v.pos.z+n.z*1.2);if(this.world.valid(at.x,at.z))v.pos=at;}}
 if(p.hits.length>p.pierce){p.ttl=0;break;}}
 }s.shots=s.shots.filter(p=>p.ttl>0).slice(-700);}
 updateFields(dt:number){for(const f of this.s.fields){f.ttl-=dt;f.energized=Math.max(0,(f.energized??0)-dt);f.tick-=dt;if(f.tick>0)continue;const charged=f.energized>0;f.tick=charged?.22:.4;for(const e of this.nearby(f.pos,f.radius)){if(!this.visible(f.pos,e.pos))continue;e.slow=.7;const evolved=this.s.weapons.find(w=>w.id==='mist')?.evolution==='b';if(evolved&&e.mark>0){this.areaHit(e.pos,2.5,f.damage*.35,'mist');this.fx('ring',e.pos,2.5,0xd5b4ff,.25);}this.hit(e,f.damage*(evolved&&e.mark>0?1.7:1)*(charged?1.3:1),'mist',charged?1:0,charged?'storm':undefined);if(this.mod('vortex')){const n=toward(e.pos,f.pos),at=V(e.pos.x+n.x*.6,e.pos.y,e.pos.z+n.z*.6);if(this.world.valid(at.x,at.z))e.pos=at;}}}this.s.fields=this.s.fields.filter(f=>f.ttl>0);}
 updateDrops(dt:number){const s=this.s,magnet=13+this.mod('magnet')*8+(encounterBuffActive(s,'magnet')?10:0);for(const p of s.drops){p.age+=dt;const gap=distance(p.pos,s.player);if(gap<magnet||p.age>8){const n=toward(p.pos,s.player);p.pos.x+=n.x*Math.min(gap,dt*38);p.pos.z+=n.z*Math.min(gap,dt*38);p.pos.y+=(s.player.y-p.pos.y)*Math.min(1,dt*12);}
 if(gap<1.5||p.age>16){if(p.type==='xp')this.gainXp(p.amount);else{s.hp=Math.min(s.maxHp,s.hp+p.amount);this.fx('heal',s.player,2,0x91edca,.4);}p.amount=0;}}
 s.drops=s.drops.filter(p=>p.amount>0);}
 gainXp(n:number){const s=this.s;s.xp+=n;while(s.xp>=s.xpNext&&s.level<36){s.xp-=s.xpNext;s.level++;s.xpNext=xpToNext(s.level);s.pendingLevels++;s.hp=Math.min(s.maxHp,s.hp+12);}}
 updateSupport(dt:number){const s=this.s;if(!s.support)return;s.supportCooldown-=dt;if(s.supportCooldown>0)return;const target=this.nearest(s.player,32,undefined,true),d=this.power();if(s.support==='medic'){s.hp=Math.min(s.maxHp,s.hp+18);s.shield=Math.max(s.shield,Math.min(100,s.shield+15));this.fx('heal',s.player,5,0x8ce9cb,.5);s.supportCooldown=4;return;}if(!target){s.supportCooldown=.3;return;}
 const id=s.support;if(id==='titan'){this.areaHit(target.pos,8,260*d,'support');this.fx('ring',target.pos,8,0xffd08b,.55);s.supportCooldown=3;}if(id==='tempest'){for(const e of this.targets(s.player,28).slice(0,8)){this.fx('bolt',raised(e.pos,12),.3,0xcbb0ff,.4,raised(e.pos));this.areaHit(e.pos,3,125*d,'support');}s.supportCooldown=4.5;}if(id==='orbital'){this.shoot(s.player,target.pos,480*d,'support',.75,42,8,5,0xffab82);s.supportCooldown=3.7;}if(id==='prism'){for(const e of this.targets(s.player,29,true).slice(0,3)){this.fx('bolt',raised(s.player,2),.2,0xa6d7ff,.35,raised(e.pos));this.hit(e,170*d,'support');}s.supportCooldown=1.6;}if(id==='crusher'){for(const e of this.nearby(target.pos,12)){if(e.boss)continue;const n=toward(e.pos,target.pos);const at=V(e.pos.x+n.x*3,e.pos.y,e.pos.z+n.z*3);if(this.world.valid(at.x,at.z))e.pos=at;e.stun=.5;}this.areaHit(target.pos,9,260*d,'support');this.fx('ring',target.pos,10,0xf5b78e,.65);s.supportCooldown=4;}}
 updateDrones(_dt:number){const s=this.s,w=s.weapons.find(w=>w.id==='drone'),n=w?2+Math.floor((w.level-1)/2)+this.mod('relay')+this.mod('shrapnel')+(w.evolution==='a'?2:0):0;s.drones=[];const droneTarget=this.nearest(s.player,28);for(let i=0;i<n;i++){const a=s.time*.6+i*Math.PI*2/n;const pos=V(s.player.x+Math.cos(a)*2.5,s.player.y+1.8+Math.sin(s.time*3+i)*.15,s.player.z+Math.sin(a)*2.5);const target=droneTarget;s.drones.push({id:i+1,pos,target:target?raised(target.pos):raised(s.player),kind:'drone',yaw:a});}if(['titan','medic','prism'].includes(s.support??'')){const target=this.nearest(s.player,26);s.drones.push({id:100,pos:V(s.player.x+3,s.player.y+(s.support==='titan'?0:2),s.player.z+2),target:target?raised(target.pos):raised(s.player),kind:s.support as 'titan'|'medic'|'prism',yaw:s.yaw});}}
 interact(){const s=this.s;if(s.phase!=='playing')return false;const e=s.events.filter(e=>e.state==='available'&&Math.abs(e.pos.y-s.player.y)<2.3).sort((a,b)=>distance(a.pos,s.player)-distance(b.pos,s.player))[0];if(encounterCanStart(s)&&(!e||distance(s.encounter!.pos,s.player)<distance(e.pos,s.player)))return startEncounter(this);if(!e||distance(e.pos,s.player)>6)return false;e.state='active';this.signals.toast(e.title+' · 已启动');this.signals.sound('charge');
 if(e.kind==='crane'){this.areaHit(e.pos,24,2500,'support');this.fx('ring',e.pos,24,0xffcb91,.85);e.progress=e.goal;}
 if(e.kind==='forge'){s.hp=Math.min(s.maxHp,s.hp+80);s.sync=100;e.progress=e.goal;}
 if(e.kind==='convoy')e.route=this.world.spawnPoint(e.pos,this.random()*Math.PI*2,25)??{...s.player};
 if(e.kind==='cache'){e.guardIds=[];for(let i=0;i<2;i++){const pos=this.world.spawnPoint(e.pos,i*Math.PI,6);if(pos){this.spawn(i?'bulwark':'rammer',true,false,pos);e.guardIds.push(s.enemies[s.enemies.length-1].id);}else e.progress++;}}
 if(e.kind==='relay'){s.sync=100;this.areaHit(e.pos,18,150,'support');this.fx('ring',e.pos,18,0x93e6e0,.8);}
 return true;}
 updateEvents(dt:number){if(this.ended())return;for(const e of this.s.events){if(e.state!=='active')continue;e.remaining-=dt;
 if(e.kind==='convoy'&&e.route){if(distance(this.s.player,e.pos)<15){const next=this.world.route(e.pos,e.route),n=toward(e.pos,next),at=V(e.pos.x+n.x*dt*3,e.pos.y,e.pos.z+n.z*dt*3);if(this.world.valid(at.x,at.z)){at.y=this.world.floor(at.x,at.z,e.pos.y);e.pos=at;e.progress+=dt*3;}if(distance(e.pos,e.route)<3)e.progress=e.goal;}}
 if(e.kind==='conveyor'){for(const m of this.nearby(e.pos,18)){if(m.boss)continue;const n=toward(m.pos,e.pos),at=V(m.pos.x+n.x*dt*3,m.pos.y,m.pos.z+n.z*dt*3);if(this.world.valid(at.x,at.z))m.pos=at;m.slow=.5;}e.counter+=dt;if(e.counter>=2){e.counter=0;this.areaHit(e.pos,12,90*this.power(),'support');if(this.ended())return;this.fx('ring',e.pos,12,0xeabf83,.6);}}
 if(e.remaining<=0&&e.progress<e.goal){e.state='available';e.progress=0;e.remaining=90;this.signals.toast(e.title+' 暂停 · 随时可以重新启动');continue;}
 if(e.progress>=e.goal&&!e.rewarded){e.state='complete';e.rewarded=true;this.s.stats.events++;if(this.s.events.every(site=>site.state==='complete'))this.s.notes='所有设施接通 · 享受你的清场回路';this.s.hp=Math.min(this.s.maxHp,this.s.hp+45);this.s.rerolls++;this.signals.event(e.id);this.signals.sound('level');this.signals.toast('设施接通 · 选择强力支援');this.s.choiceSource='event';this.s.choices=this.supportChoices(e.reward);this.s.phase='upgrade';break;}
 }}
 supportChoices(reward:SupportId):Choice[]{const ids=Object.keys(SUPPORTS) as SupportId[],other=ids.filter(id=>id!==reward&&id!==this.s.support);const choices:Choice[]=[reward,...this.shuffle(other).slice(0,2)].map(id=>({id:'support:'+id,title:SUPPORTS[id].name,description:SUPPORTS[id].description,detail:this.s.support?'替换地图支援 · 四个常规能力保持':'地图专属支援 · 不占常规能力槽',type:'support',support:id,color:SUPPORTS[id].color}));if(this.s.support)choices[2]={id:'heal:keep-support',title:'维持当前回路',description:'保留'+SUPPORTS[this.s.support].name+'，恢复全部生命并获得50护盾。',detail:'保留你的构筑 · 整备补给',type:'heal',color:'#90e5c6'};return choices;}
 shuffle<T>(items:T[]):T[]{const list=[...items];for(let i=list.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
 upgradePool():Choice[]{const s=this.s,pool:Choice[]=[];for(const id of Object.keys(WEAPONS) as WeaponId[]){const def=WEAPONS[id],w=s.weapons.find(w=>w.id===id);if(!w)pool.push({id:'weapon:'+id,title:def.name,description:def.description,detail:s.weapons.length<4?'新能力 · 自动攻击':'新能力 · 选择替换，继承原槽等级',type:'weapon',weapon:id,level:1,color:def.color});else if(w.level<4)pool.push({id:'rank:'+id,title:def.name+' '+(w.level+1),description:'伤害提升，'+(id==='drone'?'援护编队成长。':id==='chain'?'增加连锁目标。':'向终阶进化迈进一步。'),detail:WEAPONS[id].family+' · '+w.level+' → '+(w.level+1),type:'rank',weapon:id,level:w.level+1,color:def.color});else if(w.level===4)for(const branch of ['a','b'] as const){const i=branch==='a'?0:1;pool.push({id:'evolution:'+id+':'+branch,title:def.evolutions[i],description:def.evoDescriptions[i],detail:'机制进化 · '+def.name,type:'evolution',weapon:id,branch,level:5,color:def.color});}}
 for(const [id,def] of Object.entries(MODS))if(this.mod(id)<def.max)pool.push({id:'mod:'+id,title:def.name,description:def.description,detail:def.tags.some(w=>s.weapons.some(v=>v.id===w))?'与你的能力产生联动':'通用改装 · 可跨流派组合',type:'mod',mod:id,level:this.mod(id)+1,color:def.color});return pool;}
 makeChoices(){const s=this.s,pool=this.upgradePool(),choices:Choice[]=[];const focus=pool.filter(c=>['rank','evolution'].includes(c.type));if(focus.length)choices.push(this.shuffle(focus)[0]);
 if(s.weapons.length<4){const fresh=pool.filter(c=>c.type==='weapon'),partners=fresh.filter(c=>previewChoiceSynergies(s,c).added.length>0);if(fresh.length)choices.push(this.shuffle(partners.length?partners:fresh)[0]);}
 const links=pool.filter(c=>c.type==='mod'&&MODS[c.mod!].tags.some(id=>s.weapons.some(w=>w.id===id)));if(choices.length<3&&links.length)choices.push(this.shuffle(links)[0]);for(const c of this.shuffle(pool))if(choices.length<3&&!choices.some(x=>x.id===c.id))choices.push(c);
 if(s.weapons.length===4&&choices.every(c=>c.type==='weapon'))choices.pop();
 while(choices.length<3)choices.push({id:'heal:'+choices.length,title:'整备补给',description:'恢复全部生命，获得 50 护盾。',detail:'继续享受已成型的回路',type:'heal',color:'#90e5c6'});return choices;}
 openLevel(){if(!this.s.stats.firstUpgrade)this.s.stats.firstUpgrade=this.s.time;this.s.choiceSource='level';this.s.choices=this.makeChoices();this.s.phase='upgrade';this.signals.sound('level');}
 choose(id:string,replace?:number){const s=this.s;if(s.phase!=='upgrade')return false;const c=s.choices.find(c=>c.id===id);if(!c)return false;
 if(c.type==='weapon'){if(!c.weapon)return false;if(s.weapons.length>=4){if(replace===undefined||replace<0||replace>=4)return false;const previous=s.weapons[replace];s.weapons[replace]={id:c.weapon,level:previous.level,evolution:previous.evolution,cooldown:0,casts:0};}else s.weapons.push({id:c.weapon,level:1,cooldown:0,casts:0});}
 if(c.type==='rank'||c.type==='evolution'){const w=s.weapons.find(w=>w.id===c.weapon);if(!w)return false;w.level=c.level!;if(c.branch){w.evolution=c.branch;if(!s.stats.firstEvolution)s.stats.firstEvolution=s.time;}w.cooldown=0;}
 if(c.type==='mod'&&c.mod){s.mods[c.mod]=this.mod(c.mod)+1;if(c.mod==='vitality'){s.maxHp+=45;s.hp=Math.min(s.maxHp,s.hp+70);}}
 if(c.type==='support'){s.support=c.support!;s.supportTrial=undefined;s.supportCooldown=0;}
 if(c.type==='heal'){s.hp=s.maxHp;s.shield+=50;}
 if(!this.linked('slam'))s.slamReadyUntil=0;if(!this.linked('rebound'))s.recoilCharge=0;if(!this.linked('swarm'))s.droneHits=0;
 if(s.choiceSource==='level'){s.pendingLevels=Math.max(0,s.pendingLevels-1);s.nextUpgradeAt=s.time+upgradeBreather(s.level);}else s.nextUpgradeAt=Math.max(s.nextUpgradeAt??0,s.time+3);s.choices=[];s.phase='playing';return true;}
 reroll(){if(this.s.phase!=='upgrade'||this.s.rerolls<=0)return false;this.s.rerolls--;this.s.choices=this.s.choiceSource==='event'?this.supportChoices((Object.keys(SUPPORTS) as SupportId[])[Math.floor(this.random()*6)]):this.makeChoices();return true;}
 end(won:boolean,reason:string){if(this.s.phase==='won'||this.s.phase==='lost')return;this.s.phase=won?'won':'lost';this.s.notes=reason;this.signals.end(won);}
 snapshot(){return JSON.parse(JSON.stringify(this.s)) as RunState;}
 restore(state:RunState){this.state=JSON.parse(JSON.stringify(state));migrateProgression(this.state);if(this.state.phase==='playing')this.state.phase='paused';}
}
