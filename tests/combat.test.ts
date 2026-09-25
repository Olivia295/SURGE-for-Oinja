import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/game/simulation';
import {vec,add} from '../src/game/math';
import {SKILLS} from '../src/game/content';
import type {WorldQueries,Signals,RunConfig,Vec,Projectile,Hazard} from '../src/game/types';

const idle={x:0,z:0,aim:vec(0,1,-20),jump:false,fire:false};
function setup(overrides:Partial<WorldQueries>={},config:Partial<RunConfig>={}){
 const ends:{won:boolean;reason:string}[]=[];
 const world:WorldQueries={move:(p,d)=>add(p,d),floor:()=>0,clear:()=>true,valid:()=>true,route:(_a,b)=>({...b}),anchor:()=>null,spawnPoint:()=>null,...overrides};
 const signals:Signals={toast:()=>{},sound:()=>{},eventComplete:()=>{},end:(won,reason)=>ends.push({won,reason})};
 const sim=new Simulation({mapId:'old-harbor',mode:'thunder',rightSkill:'grapple',leftSkill:'lightning',seed:7,...config},world,signals,vec());
 sim.nextSpawn=Infinity;sim.player.attackTimer=999;sim.lastInput=idle;return {sim,ends};
}
function foe(s:Simulation,p:Vec,hp=1000,boss=false){s.spawn(boss?'weaver':'crawler',p,false,boss);const e=s.enemies.at(-1)!;e.hp=e.maxHp=hp;e.cooldown=999;e.stun=999;return e;}
function advance(s:Simulation,seconds:number){for(let t=0;t<seconds-1e-8;t+=1/60)s.tick(1/60,idle);}
function bullet(id:number,pos:Vec,velocity:Vec):Projectile{return{id,pos,velocity,damage:100,radius:.2,ttl:2,owner:'player',kind:'bubble',hit:[],distance:0,maxDistance:30,reflected:false};}
function hazard(id:number):Hazard{return{id,pos:vec(-1,0,0),end:vec(1,0,0),ttl:6,warmup:0,owner:8,hp:60,tick:0};}

test('beginner has only its selected active skills and valid upgrade pool',()=>{
 const {sim}=setup({}, {mode:'beginner',rightSkill:'shield',leftSkill:'barrier'});
 for(const s of SKILLS)assert.equal(sim.player.levels[s],s==='shield'||s==='barrier'?1:0);
 assert.equal(sim.cast('lightning'),false);sim.gainXP(20);
 assert.equal(sim.phase,'upgrade');for(const choice of sim.choices)if(choice.skill)assert.ok(['shield','barrier'].includes(choice.skill));
 assert.equal(new Set(sim.choices.map(c=>c.id)).size,sim.choices.length);
});
test('right-arm forms are exclusive and left-arm cast closes cannon',()=>{
 const {sim}=setup();assert.equal(sim.cast('shield'),true);assert.ok(sim.player.shieldTime>0);
 assert.equal(sim.cast('cannon'),true);assert.equal(sim.player.shieldTime,0);assert.equal(sim.player.cannonShots,3);
 assert.equal(sim.cast('lightning'),true);assert.equal(sim.player.cannonShots,0);assert.equal(sim.player.cannonTime,0);assert.equal(sim.player.hand,'right');
});
test('rejected skill input cannot change hand or consume empowerment',()=>{
 const {sim}=setup();sim.player.energy=0;sim.player.empowered=8;sim.player.hand='right';
 assert.equal(sim.cast('shield'),false);assert.equal(sim.player.hand,'right');assert.equal(sim.player.empowered,8);assert.equal(sim.player.cooldowns.shield,0);
});
test('barrier cancellation does not award empowerment after original completion time',()=>{
 const {sim}=setup();sim.cast('barrier');advance(sim,1);assert.equal(sim.cast('barrier'),true);advance(sim,3);
 assert.equal(sim.player.empowered,0);assert.equal(sim.player.barrierTime,0);assert.ok(sim.player.cooldowns.barrier>0);
});
test('completed barrier empowers exactly one successful right-arm activation',()=>{
 const {sim}=setup();sim.cast('barrier');advance(sim,3.1);assert.ok(sim.player.empowered>0);
 sim.cast('cannon');assert.equal(sim.player.cannonShots,4);assert.equal(sim.player.empowered,0);assert.equal(sim.player.empoweredCannon,true);
 sim.cast('shield');assert.equal(sim.player.empoweredShield,false);assert.equal(sim.player.cannonShots,0);
});
test('lightning hits at most four distinct targets and keeps chaining after first death',()=>{
 const {sim}=setup();const enemies=[foe(sim,vec(0,0,-5),10),foe(sim,vec(1,0,-7)),foe(sim,vec(-1,0,-9)),foe(sim,vec(2,0,-11)),foe(sim,vec(1,0,-13))];
 sim.cast('lightning',vec(0,1,-5));advance(sim,.65);
 const damaged=enemies.filter(e=>e.hp<e.maxHp);assert.equal(damaged.length,4);
 for(const e of damaged.filter(e=>e.maxHp===1000))assert.equal(e.hp,840);
 assert.equal(sim.player.kills,1);
});
test('each lightning jump respects intervening walls',()=>{
 const {sim}=setup({clear:(a,b)=>!(a.x<1.5&&b.x>=1.5||b.x<1.5&&a.x>=1.5)});
 const visible=foe(sim,vec(0,0,-5));const hidden=foe(sim,vec(3,0,-5));sim.cast('lightning',vec(0,1,-5));advance(sim,.65);
 assert.equal(visible.hp,840);assert.equal(hidden.hp,1000);
});
test('a dead enemy rewards xp and energy once',()=>{
 const {sim}=setup();sim.player.energy=0;const e=foe(sim,vec(0,0,-5),50);sim.damage(e,100,'cannon');sim.damage(e,100,'cannon');
 assert.equal(sim.player.kills,1);assert.equal(sim.player.energy,4);assert.equal(sim.player.mechanical,.5);assert.equal(sim.pickups.filter(p=>p.type==='xp').length,1);
});
test('fresh runs reset combat growth while checkpoints retain it',()=>{
 const {sim}=setup();sim.player.mechanical=56;sim.player.levels.cannon=5;sim.player.hp=700;sim.player.core.health=2;
 const save=sim.snapshot();sim.player.mechanical=80;assert.equal(save.player.mechanical,56);
 const restored=setup().sim;restored.restore(save);assert.equal(restored.player.mechanical,56);assert.equal(restored.player.levels.cannon,5);assert.equal(restored.phase,'paused');
 const fresh=setup().sim;assert.equal(fresh.player.mechanical,0);assert.equal(fresh.player.levels.cannon,1);assert.equal(fresh.player.hp,1200);
});
test('a projectile stopped by a wall cannot hit an enemy beyond it in the same step',()=>{
 const {sim}=setup({clear:(a,b)=>!(a.z> -1&&b.z<= -1)});const e=foe(sim,vec(0,0,-1.8));sim.projectiles.push(bullet(991,vec(0,1,0),vec(0,0,-20)));
 sim.tickProjectiles(.1);assert.equal(e.hp,1000);assert.equal(sim.projectiles.length,0);
});
test('large electric-bubble explosion cannot damage through a wall',()=>{
 const {sim}=setup({clear:(a,b)=>!(a.x<.5&&b.x>=.5||b.x<.5&&a.x>=.5)});const e=foe(sim,vec(1,0,-4));const p=bullet(991,vec(0,.8,-4),vec());p.kind='large';sim.bubbleExplosion(p);assert.equal(e.hp,1000);
});
test('overlapping live wires deal only one contact tick',()=>{
 const {sim}=setup();sim.hazards=[hazard(1),hazard(2),hazard(3)];sim.tickHazards(.01);assert.equal(sim.player.hp,1160);
});
test('wire contact must last half a second before draining energy',()=>{
 const {sim}=setup();sim.hazards=[hazard(1)];sim.tickHazards(.1);assert.equal(sim.player.energy,100);
});
test('a boss killed in the final time-limit step wins before timeout',()=>{
 const {sim,ends}=setup();sim.time=1079.99;sim.bossSpawned=true;const e=foe(sim,vec(0,0,-2),50,true);e.stun=0;
 sim.projectiles.push(bullet(991,vec(0,1,-1.5),vec(0,0,-20)));sim.tick(.02,idle);
 assert.equal(e.hp<=0,true);assert.equal(sim.phase,'won');assert.equal(ends.length,1);assert.equal(ends[0].won,true);
});
test('simultaneous player and boss death resolves as failure',()=>{
 const {sim,ends}=setup();sim.player.hp=1;sim.player.lastHurt=0;sim.bossSpawned=true;const e=foe(sim,vec(0,0,-2),50,true);e.stun=0;
 sim.projectiles.push(bullet(991,vec(0,1,-1.5),vec(0,0,-20)));sim.hazards=[hazard(992)];sim.tick(.02,idle);
 assert.equal(sim.phase,'lost');assert.equal(ends.length,1);assert.equal(ends[0].won,false);
});
test('checkpoint restores an active mist with its remaining duration',()=>{
 const {sim}=setup();sim.cast('mist',vec(0,0,-5));advance(sim,1);const snapshot=sim.snapshot();const restored=setup().sim;restored.restore(snapshot);
 assert.ok(restored.effects.some(e=>e.kind==='mist'&&e.ttl>4&&e.ttl<6));assert.equal(restored.player.mistWindow,sim.player.mistWindow);
});
test('right-hand basic attacks can dismantle a nearby wire node without kill rewards',()=>{
 const {sim}=setup({}, {mode:'beginner',rightSkill:'shield',leftSkill:'barrier'});sim.player.attackTimer=0;sim.player.energy=0;
 const h=hazard(500);h.pos=vec(0,0,-1.8);h.end=vec(4,0,-1.8);sim.hazards=[h];sim.lastInput={...idle,aim:vec(0,.5,-1.8)};
 sim.attack();assert.ok(h.hp<60||!sim.hazards.includes(h));assert.equal(sim.player.kills,0);assert.equal(sim.pickups.length,0);assert.equal(sim.player.energy,0);assert.equal(sim.player.mechanical,0);
});
test('experience pickup cannot pass through an intervening wall',()=>{
 const {sim}=setup({clear:()=>false});sim.pickups=[{id:81,pos:vec(.4,0,0),value:5,type:'xp'}];sim.tick(1/60,idle);
 assert.equal(sim.player.xp,0);assert.equal(sim.pickups.length,1);
});

for(const rightSkill of ['grapple','shield','cannon'] as const)for(const leftSkill of ['lightning','mist','barrier'] as const){
 test(`beginner ${rightSkill} + ${leftSkill} can cast both equipped arms and complete all 19 upgrade choices`,()=>{
  const {sim}=setup({}, {mode:'beginner',rightSkill,leftSkill});foe(sim,vec(0,0,-5),10000);
  assert.equal(sim.cast(rightSkill,vec(0,1,-5)),true);assert.equal(sim.player.hand,'left');
  assert.equal(sim.cast(leftSkill,vec(0,0,-5)),true);assert.equal(sim.player.hand,'right');
  assert.equal(sim.player.shieldTime,0);assert.equal(sim.player.cannonShots,0);
  if(leftSkill==='barrier')sim.cast('barrier');
  for(let level=1;level<20;level++){
   sim.gainXP(sim.player.xpNext);assert.equal(sim.phase,'upgrade');assert.ok(sim.choices.length>0);
   assert.equal(new Set(sim.choices.map(c=>c.id)).size,sim.choices.length);
   for(const c of sim.choices)if(c.skill)assert.ok(c.skill===rightSkill||c.skill===leftSkill);
   sim.choose(sim.choices[0].id);assert.equal(sim.phase,'playing');
  }
  assert.equal(sim.player.level,20);assert.equal(sim.pendingLevels,0);
 });
}
test('cancelled barrier leaves no lingering ranged damage reduction or afterglow',()=>{
 const {sim}=setup();sim.player.evolutions.barrier='b';assert.equal(sim.cast('barrier'),true);
 sim.hurt(100,vec(0,0,-10));assert.equal(sim.player.hp,1150);
 sim.player.invulnerable=0;assert.equal(sim.cast('barrier'),true);assert.equal(sim.effects.some(e=>e.kind==='barrier'),false);
 sim.hurt(100,vec(0,0,-10));assert.equal(sim.player.hp,1050);assert.equal(sim.player.empowered,0);
});
test('electric bubble counter requires four hits, not four shots, before its large attack',()=>{
 const {sim}=setup();const e=foe(sim,vec(0,0,-5),10000);sim.player.hand='left';
 for(let i=0;i<4;i++){
  sim.player.attackTimer=0;sim.attack();assert.equal(sim.projectiles.at(-1)?.kind,'bubble');assert.equal(sim.player.bubbleCount,0);
  e.pos=vec(15,0,-5);sim.tickProjectiles(.5);sim.projectiles=[];e.pos=vec(0,0,-5);
 }
 for(let hit=1;hit<=4;hit++){
  sim.player.attackTimer=0;sim.attack();assert.equal(sim.projectiles.at(-1)?.kind,'bubble');sim.tickProjectiles(.2);assert.equal(sim.player.bubbleCount,hit);
 }
 sim.player.attackTimer=0;sim.attack();assert.equal(sim.projectiles.at(-1)?.kind,'large');assert.equal(sim.player.bubbleCount,0);
});
test('mist gift consumes its large bubble without erasing normal bubble progress',()=>{
 const {sim}=setup();foe(sim,vec(0,0,-5),10000);sim.player.hand='right';sim.player.bubbleCount=2;sim.player.giftBubble=10;sim.player.attackTimer=0;
 sim.attack();assert.equal(sim.projectiles.at(-1)?.kind,'large');assert.equal(sim.player.bubbleCount,2);assert.equal(sim.player.giftBubble,0);
});
function incoming(id:number):Projectile{return{...bullet(id,vec(0,1,-1),vec(0,0,20)),owner:'enemy',kind:'needle',damage:35};}
test('ordinary reflection evolution enforces the 0.4 second gate',()=>{
 const {sim}=setup();sim.player.evolutions.shield='a';sim.cast('shield');
 const first=incoming(701);sim.projectiles=[first];sim.tickProjectiles(.04);assert.equal(first.owner,'player');assert.equal(first.reflected,true);
 const second=incoming(702);sim.projectiles=[second];sim.tickProjectiles(.04);assert.equal(second.reflected,false);assert.equal(second.owner,'enemy');
 sim.projectiles=[];advance(sim,.42);const third=incoming(703);sim.projectiles=[third];sim.tickProjectiles(.04);assert.equal(third.reflected,true);
});
test('empowered shield can reflect a volley without the ordinary reflection gate',()=>{
 const {sim}=setup();sim.player.empowered=12;sim.cast('shield');const first=incoming(711),second=incoming(712);sim.projectiles=[first,second];sim.tickProjectiles(.04);
 assert.equal(first.reflected,true);assert.equal(second.reflected,true);assert.equal(first.owner,'player');assert.equal(second.owner,'player');
});
