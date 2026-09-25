import type {Vec,SkillId,EnemyKind,RunConfig,Player,Enemy,Projectile,Hazard,Pickup,Effect,Upgrade,RunEvent,GameSnapshot,WorldQueries,Signals,InputFrame,Phase} from './types';
import {SKILLS,RIGHT,SKILL_INFO,ENEMIES,EVOLUTIONS,modeDamage,xpFor,eligible,emptySkills} from './content';
import {vec,copy,dist,norm,add,sub,mul,yawTo,forward,clamp,segmentDistance,Random} from './math';

export class Simulation {
 phase:Phase='playing';time=0;rng:Random;player:Player;enemies:Enemy[]=[];projectiles:Projectile[]=[];hazards:Hazard[]=[];pickups:Pickup[]=[];effects:Effect[]=[];events:RunEvent[]=[];
 rerolls=2;bossSpawned=false;nextSpawn=0;nextId=1;pendingLevels=0;choices:Upgrade[]=[];unlocks:string[]=[];reason='';bossPos:Vec;lastInput:InputFrame={x:0,z:0,aim:vec(0,1,-10),jump:false,fire:false};
 private eliteTimes=new Set<number>();private delayed:{time:number;target:number;damage:number;skill:SkillId}[]=[];private mistTick=0;private lastTime=0;private hazardContact=0;private hazardDamageTimer=0;private bossDefeated=false;private ticking=false;
 constructor(public config:RunConfig,public world:WorldQueries,public signals:Signals,spawn:Vec,events:RunEvent[]=[],unlocks:string[]=[]){
 this.rng=new Random(config.seed??Date.now());this.bossPos=copy(spawn);this.events=events;this.unlocks=unlocks;
 const levels=emptySkills();for(const s of eligible(config))levels[s]=1;
 this.player={pos:copy(spawn),yaw:0,hp:1200,maxHp:1200,energy:100,maxEnergy:100,speed:6.5,attackTimer:0,hand:'right',punchCount:0,bubbleCount:0,level:1,xp:0,xpNext:20,kills:0,damageDealt:0,damageTaken:0,lastHurt:-10,invulnerable:0,fastCharge:0,sinceRight:10,mechanical:0,shieldTime:0,cannonShots:0,cannonTime:0,barrierTime:0,barrierTotal:3,empowered:0,empoweredCannon:false,empoweredShield:false,mistCenter:null,mistWindow:0,giftBubble:0,tempShield:0,tempShieldTime:0,vy:0,grounded:true,levels,cooldowns:emptySkills(),evolutions:{},core:{fist:0,bubble:0,sync:0,health:0,energy:0,mobility:0},lastAction:'idle',actionTime:0,switchBuff:0,reflectCooldown:0,pushCooldown:0,grappleTarget:null};
 }
 id(){return this.nextId++;}
 fx(kind:Effect['kind'],pos:Vec,duration=.3,end?:Vec,radius?:number,color?:number){this.effects.push({id:this.id(),kind,pos:copy(pos),end:end?copy(end):undefined,ttl:duration,duration,radius,color});}
 scale(){return modeDamage(this.config.mode);}
 cooldown(s:SkillId){const l=this.player.levels[s];return SKILL_INFO[s].cooldown*((s==='barrier'?l>=2:l>=3)?.8:1);}
 cost(s:SkillId){return s==='shield'&&this.player.levels[s]>=3?15:SKILL_INFO[s].cost;}
 target(range:number,aim=this.lastInput.aim){const p=this.player.pos;const direction=norm(sub(aim,p));return this.enemies.filter(e=>e.hp>0&&dist(p,e.pos)<=range&&Math.abs(p.y-e.pos.y)<5&&this.world.clear(add(p,vec(0,1,0)),add(e.pos,vec(0,.7,0)))&&(sub(e.pos,p).x*direction.x+sub(e.pos,p).z*direction.z)/(dist(p,e.pos)||1)>.65).sort((a,b)=>{const score=(e:Enemy)=>{const v=norm(sub(e.pos,p));return (1-v.x*direction.x-v.z*direction.z)*12+dist(p,e.pos)*.08;};return score(a)-score(b);})[0];}
 damage(e:Enemy,amount:number,skill?:SkillId,from=this.player.pos,area=false){
 if(e.hp<=0)return;let value=amount*this.scale();
 if(e.kind==='bulwark'&&!area){const dir=norm(sub(from,e.pos)),fw=forward(e.yaw),dot=dir.x*fw.x+dir.z*fw.z;value*=dot>.34?.2:dot<-.35?1.4:1;}
 if(e.boss&&e.stun>0)value*=1.5;
 e.hp-=value;this.player.damageDealt+=value;this.fx('hit',add(e.pos,vec(0,1.4,0)),.65,undefined,e.boss?1:.4);this.effects[this.effects.length-1].amount=Math.round(value);this.signals.sound('hit');
 if(e.hp>0)return;
 this.player.kills++;const base=ENEMIES[e.kind];this.pickups.push({id:this.id(),pos:copy(e.pos),value:base.xp*(e.elite?5:1),type:'xp'});
 if(e.elite||this.rng.next()<.01)this.pickups.push({id:this.id(),pos:copy(e.pos),value:.12,type:'heal'});
 this.player.energy=clamp(this.player.energy+(e.boss?30:e.elite?10:4),0,this.player.maxEnergy);
 if(skill){if(RIGHT.includes(skill))this.player.mechanical=Math.min(120,this.player.mechanical+(e.elite?3:.5));else this.player.fastCharge=3;}
 this.fx('burst',e.pos,.45,undefined,base.radius*1.8,base.color);
 if(e.kind==='weaver')this.hazards=this.hazards.filter(h=>h.owner!==e.id);
 if(e.boss){this.bossDefeated=true;if(!this.ticking)this.finish(true,'织网主机已解除。港区重获流动。');}
 }
 area(pos:Vec,radius:number,damage:number,skill:SkillId,limit=999){let n=0;for(const e of this.enemies){if(e.hp>0&&dist(e.pos,pos)<=radius&&Math.abs(e.pos.y-pos.y)<3&&this.world.clear(add(pos,vec(0,.5,0)),add(e.pos,vec(0,.5,0)))){this.damage(e,damage,skill,pos,true);if(++n>=limit)break;}}}
 hurt(amount:number,from:Vec,ground=false){
 const p=this.player;if(this.phase!=='playing'||p.invulnerable>0&&!ground)return;
 let dmg=amount*Math.min(1.35,1+this.time/60*.02);
 if(p.shieldTime>0&&!ground){const d=norm(sub(from,p.pos)),f=forward(p.yaw);if(d.x*f.x+d.z*f.z>(p.empoweredShield?0:.5))dmg*=.2;}
 if(!ground&&dist(from,p.pos)>3&&(p.barrierTime>0||this.effects.some(e=>e.kind==='barrier'&&e.ttl>0&&dist(e.pos,p.pos)<8)))dmg*=.5;
 if(p.tempShield>0){const take=Math.min(dmg,p.tempShield);p.tempShield-=take;dmg-=take;}
 p.hp-=dmg;p.damageTaken+=dmg;p.lastHurt=this.time;if(!ground)p.invulnerable=.25;
 this.signals.sound('hurt');this.fx('hit',add(p.pos,vec(0,1,0)),.22,undefined,.65,0xff5a61);
 if(p.hp<=0){p.hp=0;this.finish(false,'被敌群击倒。尝试利用环路与掩体重新组织战斗。');}
 }
 finish(won:boolean,reason:string){if(this.phase==='won'||this.phase==='lost')return;this.phase=won?'won':'lost';this.reason=reason;this.signals.end(won,reason);}
 cast(s:SkillId,aim=this.lastInput.aim):boolean{
 const p=this.player;if(this.phase!=='playing'||!p.levels[s])return false;
 if(s==='grapple'&&p.grappleTarget){p.grappleTarget=null;p.lastAction='idle';return true;}
 if(s==='barrier'&&p.barrierTime>0){p.barrierTime=0;this.effects=this.effects.filter(e=>e.kind!=='barrier');p.lastAction='idle';this.signals.toast('已取消引导 · 未获得强化');return true;}
 if(p.barrierTime>0)return false;
 if(s==='shield'&&p.shieldTime>0){this.closeShield();return true;}
 if(s==='mist'&&p.mistWindow>0&&p.mistCenter){
 if(dist(p.pos,p.mistCenter)>15||!this.world.clear(add(p.pos,vec(0,1,0)),add(p.mistCenter,vec(0,1,0)))){this.signals.toast('回闪落点不可达');return false;}
 this.fx('burst',p.pos,.4,undefined,2);p.pos=copy(p.mistCenter);p.mistWindow=0;p.giftBubble=10;p.hand='left';p.lastAction='mist';p.actionTime=.7;if(p.evolutions.mist==='b'){p.tempShield=160;p.tempShieldTime=5;}this.signals.sound('mist');return true;
 }
 if(p.cooldowns[s]>0){this.signals.toast('能力正在恢复');return false;}
 if(p.energy<this.cost(s)){this.signals.toast('电量不足 · 左臂击杀可快速充电');return false;}
 const right=RIGHT.includes(s),powered=right&&p.empowered>0;
 const target=this.target(s==='lightning'?24:22,aim);
 let anchor:Vec|null=null;if(s==='grapple'&&!target)anchor=this.world.anchor(aim,p.pos);
 if(s==='grapple'&&!target&&!anchor){this.signals.toast('瞄准敌人或高处锚点');return false;}
 if(s==='mist'&&!this.world.valid(aim.x,aim.z)){this.signals.toast('雾弹需要有效地面');return false;}
 if(p.shieldTime>0)this.closeShield();p.cannonShots=0;p.cannonTime=0;p.grappleTarget=null;
 p.energy-=this.cost(s);p.cooldowns[s]=this.cooldown(s);p.lastAction=s;p.actionTime=s==='barrier'?3:.65;
 p.hand=right?'left':'right';p.switchBuff=p.core.sync>0?2:0;
 if(right){p.sinceRight=0;if(powered)p.empowered=0;}
 p.yaw=yawTo(p.pos,aim);const level=p.levels[s];
 if(s==='grapple'){
 if(target){this.damage(target,90*(level>=2?1.3:1),s);this.fx('grapple',add(p.pos,vec(0,1.2,0)),.3,add(target.pos,vec(0,.6,0)));
 if(!target.boss&&!(target.kind==='bulwark'&&this.frontFacing(target,p.pos))){const dest=add(p.pos,mul(norm(sub(target.pos,p.pos)),1.7));if(this.world.clear(add(target.pos,vec(0,.7,0)),add(dest,vec(0,.7,0))))target.pos=dest;target.stun=.8;}
 if(powered||level>=4){this.area(target.pos,p.evolutions.grapple==='a'?4.5:3,60,s);this.fx('burst',target.pos,.5,undefined,4.5);}
 if(p.evolutions.grapple==='a')for(const e of this.enemies)if(!e.boss&&e!==target&&dist(e.pos,target.pos)<4.5)e.pos=add(e.pos,mul(norm(sub(target.pos,e.pos)),1.5));
 }else if(anchor){p.grappleTarget=copy(anchor);this.fx('grapple',add(p.pos,vec(0,1.2,0)),1,anchor);}
 }else if(s==='shield'){p.shieldTime=level>=2?5:4;p.empoweredShield=powered;}
 else if(s==='cannon'){p.cannonShots=powered?4:3;p.cannonTime=8;p.empoweredCannon=powered;this.signals.toast('充能炮就绪 · 左键逐炮发射');}
 else if(s==='lightning'&&target){
 let current=target;const hit=new Set<number>();const max=p.evolutions.lightning==='a'?10:level>=2?6:4;
 for(let i=0;i<max;i++){hit.add(current.id);const from=i===0?add(p.pos,vec(0,1.2,0)):add(this.enemies.find(e=>e.id===[...hit][hit.size-2])!.pos,vec(0,.7,0));this.fx('lightning',from,.35+i*.025,add(current.pos,vec(0,.7,0)));
 this.damage(current,160+p.mechanical,s);
 if(p.evolutions.lightning==='b')this.delayed.push({time:this.time+.7,target:current.id,damage:(160+p.mechanical)*.35,skill:s});
 const next=this.enemies.filter(e=>e.hp>0&&!hit.has(e.id)&&dist(e.pos,current.pos)<(level>=4?9:7)&&this.world.clear(add(current.pos,vec(0,.7,0)),add(e.pos,vec(0,.7,0)))).sort((a,b)=>dist(a.pos,current.pos)-dist(b.pos,current.pos))[0];if(!next)break;current=next;
 }
 }else if(s==='mist'){const delta=sub(aim,p.pos);const len=dist(aim,p.pos);const pt=len>18?add(p.pos,mul(delta,18/len)):copy(aim);pt.y=this.world.floor(pt.x,pt.z,p.pos.y);p.mistCenter=pt;p.mistWindow=5;this.fx('mist',pt,6,undefined,level>=2?5.5:4.5);}
 else if(s==='barrier'){p.barrierTotal=p.evolutions.barrier==='a'?1.8:3;p.barrierTime=p.barrierTotal;p.actionTime=p.barrierTotal;this.fx('barrier',p.pos,p.barrierTotal,undefined,8);}
 this.signals.sound(s);return true;
 }
 frontFacing(e:Enemy,from:Vec){const d=norm(sub(from,e.pos)),f=forward(e.yaw);return d.x*f.x+d.z*f.z>.34;}
 closeShield(){if(this.player.shieldTime>0&&this.player.levels.shield>=4){this.area(add(this.player.pos,mul(forward(this.player.yaw),2)),3,80,'shield');this.fx('burst',this.player.pos,.4,undefined,3);}this.player.shieldTime=0;}
 fireCannon(){const p=this.player;if(p.cannonShots<=0||p.attackTimer>0||this.phase!=='playing')return;p.cannonShots--;p.attackTimer=.65;p.lastAction='cannon';p.actionTime=.55;
 const start=add(p.pos,vec(0,1.1,0));const dir=norm(sub(this.lastInput.aim,start));dir.y=clamp(dir.y,-.15,.15);
 this.projectiles.push({id:this.id(),pos:start,velocity:mul(norm(dir),35),damage:(p.empoweredCannon?225:175)*(p.levels.cannon>=2?1.25:1),radius:(p.empoweredCannon?.6:.4)+(p.levels.cannon>=4?.15:0),ttl:1.5,owner:'player',skill:'cannon',kind:'cannon',hit:[],distance:0,maxDistance:p.empoweredCannon?40:35,reflected:false});
 const back=mul(norm(vec(dir.x,0,dir.z)),-2);const destination=this.world.move(p.pos,back);if(this.world.floor(destination.x,destination.z,p.pos.y)>=p.pos.y-1)p.pos=destination;
 this.fx('burst',add(start,mul(norm(dir),1)),.18,undefined,1.2,0xffda89);this.signals.sound('cannon');if(p.cannonShots===0)p.cannonTime=0;
 }
 attack(){const p=this.player;if(p.attackTimer>0||p.barrierTime>0||p.shieldTime>0||p.cannonTime>0||p.grappleTarget)return;
 const gifted=p.giftBubble>0;const left=p.hand==='left'||gifted;const enemy=this.target(left?22:2.5);const aimDir=norm(sub(this.lastInput.aim,p.pos));const node=this.hazards.filter(h=>h.hp>0&&dist(h.pos,p.pos)<(left?22:2.5)&&Math.abs(h.pos.y-p.pos.y)<2&&this.world.clear(add(p.pos,vec(0,.7,0)),add(h.pos,vec(0,.5,0)))&&((h.pos.x-p.pos.x)*aimDir.x+(h.pos.z-p.pos.z)*aimDir.z)/(dist(h.pos,p.pos)||1)>.65).sort((a,b)=>dist(a.pos,p.pos)-dist(b.pos,p.pos))[0];const e=node&&(!enemy||dist(node.pos,p.pos)<dist(enemy.pos,p.pos))?node:enemy;if(!e)return;
 p.yaw=yawTo(p.pos,e.pos);p.attackTimer=1/(1.6*(p.switchBuff>0?1+(p.core.sync===2?.25:.15):1));p.lastAction=left?'bubble':'punch';p.actionTime=.32;
 if(!left){const heavy=p.punchCount>=2;p.punchCount=heavy?0:p.punchCount+1;if(heavy)p.lastAction='heavy';
 const damage=(heavy?140:80)*(heavy&&p.core.fist>=2?1.4:1);
 if(!('kind' in e)){this.damageNode(e,damage);}
 else if(p.core.fist>=1){for(const foe of this.enemies){const d=norm(sub(foe.pos,p.pos)),fw=forward(p.yaw);if(dist(foe.pos,p.pos)<=2.7&&d.x*fw.x+d.z*fw.z>.65&&Math.abs(foe.pos.y-p.pos.y)<2&&this.world.clear(add(p.pos,vec(0,.7,0)),add(foe.pos,vec(0,.7,0))))this.damage(foe,damage);}}
 else this.damage(e,damage);
 if(heavy&&(this.lastInput.x*forward(p.yaw).x+this.lastInput.z*forward(p.yaw).z)>.5)p.pos=this.world.move(p.pos,mul(forward(p.yaw),1.5));
 this.fx('burst',add(p.pos,mul(forward(p.yaw),1.1)),.15,undefined,heavy?1.5:.8,0xf0bf85);
 }else{const large=gifted||p.bubbleCount>=4;if(gifted)p.giftBubble=0;else if(large)p.bubbleCount=0;
 const start=add(p.pos,vec(0,1.2,0));const direction=norm(sub(add(e.pos,vec(0,.6,0)),start));
 this.projectiles.push({id:this.id(),pos:start,velocity:mul(direction,30),damage:(large?90:50)*(p.core.bubble>=1?1.25:1),radius:large?.45:.22,ttl:1,owner:'player',kind:large?'large':'bubble',hit:[],distance:0,maxDistance:22,reflected:false});
 }
 this.signals.sound(left?'bubble':'punch');
 }
 damageNode(h:Hazard,amount:number){h.hp-=amount*this.scale();this.fx('hit',add(h.pos,vec(0,.5,0)),.2,undefined,.6);if(h.hp<=0){this.fx('burst',h.pos,.4,undefined,1,0xaee1e7);const owner=this.enemies.find(e=>e.id===h.owner);if(owner?.boss)owner.stun=4;}}
 gainXP(value:number){const p=this.player;p.xp+=value;while(p.level<20&&p.xp>=p.xpNext){p.xp-=p.xpNext;p.level++;p.xpNext=xpFor(p.level);this.pendingLevels++;}if(p.level>=20)p.xp=0;if(this.pendingLevels>0&&this.phase==='playing'){this.phase='upgrade';this.makeChoices();this.signals.sound('level');}}
 makeChoices(){const p=this.player;const pool:Upgrade[]=[];
 for(const s of eligible(this.config)){const l=p.levels[s];if(l>=5)continue;
 if(l===4){const ev=EVOLUTIONS[s];pool.push({id:s+':a',skill:s,title:ev[0],description:ev[1],kind:'evolution',level:5,maxLevel:5,branch:'a'});if(this.unlocks.includes(s))pool.push({id:s+':b',skill:s,title:ev[2],description:ev[3],kind:'evolution',level:5,maxLevel:5,branch:'b'});}
 else pool.push({id:s,skill:s,title:SKILL_INFO[s].name,description:this.levelDescription(s,l+1),kind:'skill',level:l+1,maxLevel:5});
 }
 const names:Record<string,[string,string[]]>={fist:['拳势',['普攻横扫前方小扇区','强化重击伤害 +40%']],bubble:['电泡塑形',['电泡伤害 +25%','大电泡爆炸半径 +1m']],sync:['双臂同调',['换手后2秒攻速 +15%','换手攻速提高至25%']],health:['韧性',['最大生命 +180，并回复180','最大生命再 +180，并回复180']],energy:['蓄电',['电量上限 +20','普通回电速度 +25%']],mobility:['流动',['移动速度 +8%','经验吸取范围 +2m']]};
 for(const [id,[name,descs]]of Object.entries(names)){const l=p.core[id]??0;if(l<2)pool.push({id:'core:'+id,title:name,description:descs[l],kind:['fist','bubble','sync'].includes(id)?'core':'utility',level:l+1,maxLevel:2});}
 const result:Upgrade[]=[];const skillPool=pool.filter(x=>x.skill);if(skillPool.length)result.push(this.rng.pick(skillPool));
 while(result.length<3){const avail=pool.filter(x=>!result.some(a=>a.id===x.id));if(!avail.length)break;result.push(this.rng.pick(avail));}
 this.choices=result;
 }
 levelDescription(s:SkillId,l:number){const a:Record<SkillId,string[]>={grapple:['伤害 +30%','冷却 -20%','牵引结束产生范围横扫'],shield:['护盾持续 +1秒','耗电降低25%','收盾释放近身短震'],cannon:['炮击伤害 +25%','冷却 -20%','弹道加宽0.3米'],lightning:['连锁目标 +2','冷却 -20%','连锁搜索范围 +2米'],mist:['雾半径 +1米','冷却 -20%','雾内敌人减速25%'],barrier:['冷却 -20%','强化保留 +6秒','完成引导造成范围脉冲']};return a[s][l-2]??'能力进化';}
 choose(id:string){if(this.phase!=='upgrade')return;const u=this.choices.find(c=>c.id===id);if(!u)return;const p=this.player;
 if(u.skill){p.levels[u.skill]=u.level;if(u.branch)p.evolutions[u.skill]=u.branch;}
 else{const key=id.slice(5);p.core[key]=(p.core[key]??0)+1;if(key==='health'){p.maxHp+=180;p.hp=Math.min(p.maxHp,p.hp+180);}if(key==='energy'&&p.core.energy===1){p.maxEnergy+=20;p.energy+=20;}if(key==='mobility'&&p.core.mobility===1)p.speed=6.5*1.08;}
 this.pendingLevels--;if(this.pendingLevels>0)this.makeChoices();else{this.phase='playing';this.choices=[];}
 }
 reroll(){if(this.phase==='upgrade'&&this.rerolls>0){this.rerolls--;this.makeChoices();}}
 interact(){const ev=this.events.find(e=>dist(e.pos,this.player.pos)<5&&(e.state==='available'||e.state==='active'));if(ev?.state==='available'){ev.state='active';this.signals.toast('保持附近，恢复港区设施');}}
 spawn(kind:EnemyKind,pos:Vec,elite=false,boss=false){const base=ENEMIES[kind],hp=boss?18000:base.hp*Math.min(1.6,1+this.time/60*.035)*(elite?3:1);this.enemies.push({id:this.id(),kind,pos:copy(pos),hp,maxHp:hp,yaw:0,age:0,cooldown:1+this.rng.next(),state:'move',timer:0,target:copy(this.player.pos),elite,boss,lastAttack:0,stun:0});}
 weightedKind():EnemyKind{const types:EnemyKind[]=['crawler'];if(this.time>=45)types.push('rammer');if(this.time>=150)types.push('gunner');if(this.time>=270)types.push('bulwark');if(this.time>=390)types.push('weaver');const roll=this.rng.next();return roll<.64?'crawler':this.rng.pick(types);}
 director(){if(this.time>=720&&!this.bossSpawned){this.bossSpawned=true;const at=this.world.spawnPoint(this.bossPos,0,10)??this.bossPos;this.spawn('weaver',at,false,true);this.signals.toast('织网主机抵达 · 前往广场终结回路');this.signals.sound('boss');}
 if(this.time>=1080)return;
 if(this.time<this.nextSpawn)return;
 const phase=this.time<45?0:this.time<150?1:this.time<270?2:this.time<390?3:this.time<540?4:this.time<720?5:this.time<900?6:7;
 const counts=[5,8,12,16,20,24,12,16],caps=[35,65,95,130,170,220,220,260],interval=[8,8,8,7,7,6,8,6];
 this.nextSpawn=this.time+interval[phase];
 const amount=Math.min(counts[phase],caps[phase]-this.enemies.filter(e=>e.hp>0).length);
 for(let i=0;i<amount;i++){const pos=this.world.spawnPoint(this.player.pos,this.rng.next()*Math.PI*2,25+this.rng.next()*22);if(pos)this.spawn(this.weightedKind(),pos);}
 for(const t of [240,480,600])if(this.time>=t&&!this.eliteTimes.has(t)){this.eliteTimes.add(t);if(!this.enemies.some(e=>e.elite&&e.hp>0)){const at=this.world.spawnPoint(this.player.pos,this.rng.next()*6.28,32);if(at)this.spawn(this.weightedKind(),at,true);}}
 }
 tick(dt:number,input:InputFrame){if(this.phase!=='playing')return;this.ticking=true;this.time+=dt;this.lastInput=input;const p=this.player;
 p.attackTimer=Math.max(0,p.attackTimer-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.sinceRight+=dt;p.fastCharge=Math.max(0,p.fastCharge-dt);p.empowered=Math.max(0,p.empowered-dt);p.giftBubble=Math.max(0,p.giftBubble-dt);p.switchBuff=Math.max(0,p.switchBuff-dt);p.reflectCooldown=Math.max(0,(p.reflectCooldown??0)-dt);p.pushCooldown=Math.max(0,(p.pushCooldown??0)-dt);p.actionTime=Math.max(0,p.actionTime-dt);p.mistWindow=Math.max(0,p.mistWindow-dt);
 const rate=p.fastCharge>0?12:p.sinceRight>=5?4:1.5;p.energy=Math.min(p.maxEnergy,p.energy+rate*(p.core.energy>=2?1.25:1)*dt);
 if(this.time-p.lastHurt>5)p.hp=Math.min(p.maxHp,p.hp+3*dt);
 if(p.tempShieldTime>0){p.tempShieldTime-=dt;p.tempShield=Math.max(0,p.tempShield-32*dt);}else p.tempShield=0;
 for(const s of SKILLS)p.cooldowns[s]=Math.max(0,p.cooldowns[s]-dt);
 if(p.cannonTime>0){p.cannonTime-=dt;if(p.cannonTime<=0)p.cannonShots=0;}
 if(p.shieldTime>0){p.shieldTime-=dt;if(p.shieldTime<=0){p.shieldTime=.001;this.closeShield();}}
 if(p.barrierTime>0){p.barrierTime=Math.max(0,p.barrierTime-dt);if(p.barrierTime===0){p.empowered=p.levels.barrier>=3?18:12;this.signals.toast('同调完成 · 下一项右臂技能强化');this.fx('burst',p.pos,.8,undefined,8);if(p.levels.barrier>=4)this.area(p.pos,8,120,'barrier');if(p.evolutions.barrier==='b')this.fx('barrier',p.pos,4,undefined,8);}}
 let move=vec(input.x,0,input.z);const length=Math.hypot(move.x,move.z);if(length>1)move=mul(move,1/length);
 if(p.barrierTime<=0){
 const slow=this.hazards.some(h=>h.warmup<=0&&segmentDistance(p.pos,h.pos,h.end)<.65)?.75:1;const f=forward(p.yaw);const shieldBoost=p.shieldTime>0&&move.x*f.x+move.z*f.z>.86?(p.evolutions.shield==='b'?1.5:1.35):1;
 if(p.grappleTarget){const delta=sub(p.grappleTarget,p.pos),len=Math.hypot(delta.x,delta.y,delta.z);const step=mul(norm(delta),Math.min(len,22*dt));const old=copy(p.pos);p.pos=this.world.move(p.pos,step);if(p.evolutions.grapple==='b')this.area(p.pos,2,100*dt*4,'grapple',8);if(len<.7||dist(old,p.pos)<.01)p.grappleTarget=null;}
 else{
 if(input.jump&&p.grounded){p.vy=5;p.grounded=false;}
 p.vy-=15*dt;const newPos=this.world.move(p.pos,vec(move.x*p.speed*slow*shieldBoost*dt,p.vy*dt,move.z*p.speed*slow*shieldBoost*dt));const floor=this.world.floor(newPos.x,newPos.z,p.pos.y);
 if(newPos.y<=floor+.05){newPos.y=floor;p.vy=0;p.grounded=true;}else p.grounded=false;
 p.pos=newPos;if(newPos.y<-15){p.pos=copy(this.bossPos);this.hurt(p.maxHp*.1,p.pos,true);}
 }
 if(length>.05&&p.actionTime<=0&&p.shieldTime<=0)p.yaw=Math.atan2(-move.x,-move.z);
 if(p.shieldTime>0||p.cannonTime>0)p.yaw=yawTo(p.pos,input.aim);
 }
 if(p.shieldTime>0&&p.evolutions.shield==='b'&&p.pushCooldown<=0){p.pushCooldown=1;const center=add(p.pos,mul(forward(p.yaw),1.7));for(const e of this.enemies)if(!e.boss&&dist(e.pos,center)<2){this.damage(e,90,'shield');const target=add(e.pos,mul(forward(p.yaw),1.2));if(this.world.clear(add(e.pos,vec(0,.5,0)),add(target,vec(0,.5,0))))e.pos=target;}}this.director();this.attack();if(input.fire)this.fireCannon();
 this.tickEnemies(dt);this.tickProjectiles(dt);this.tickHazards(dt);
 for(const e of this.effects)e.ttl-=dt;this.effects=this.effects.filter(e=>e.ttl>0);
 this.mistTick+=dt;if(this.mistTick>=.5){this.mistTick=0;for(const fx of this.effects)if(fx.kind==='mist'){this.area(fx.pos,fx.radius??4.5,p.evolutions.mist==='a'?30:10,'mist');}}
 for(const d of this.delayed.filter(d=>d.time<=this.time)){const e=this.enemies.find(e=>e.id===d.target);if(e&&e.hp>0){this.damage(e,d.damage,d.skill);this.fx('lightning',add(e.pos,vec(0,3,0)),.2,e.pos);}}this.delayed=this.delayed.filter(d=>d.time>this.time);
 this.enemies=this.enemies.filter(e=>e.hp>0&& (e.boss||e.elite||dist(e.pos,p.pos)<100));
 const collected:Pickup[]=[];for(const pick of this.pickups){const d=dist(p.pos,pick.pos);if(Math.abs(pick.pos.y-p.pos.y)>2.5)continue;if(d<(p.core.mobility>=2?5:3)&&this.world.clear(add(p.pos,vec(0,.3,0)),add(pick.pos,vec(0,.3,0)))){pick.pos=add(pick.pos,mul(norm(sub(p.pos,pick.pos)),Math.min(d,dt*14)));if(d<.7)collected.push(pick);}}
 for(const pick of collected){if(pick.type==='heal'){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*pick.value);this.fx('heal',p.pos,.5,undefined,1);this.signals.sound('heal');}else this.gainXP(pick.value);}
 this.pickups=this.pickups.filter(x=>!collected.includes(x));if(this.pickups.length>350){const first=this.pickups[0],near=this.pickups.find((v,i)=>i>0&&v.type===first.type&&dist(v.pos,first.pos)<8);if(near){near.value+=first.value;this.pickups.shift();}}
 this.tickEvents(dt);this.ticking=false;if(this.player.hp<=0){if((this.phase as string)!=='lost')this.finish(false,'被敌群击倒。');}else if(this.bossDefeated)this.finish(true,'织网主机已解除，港区重获流动。');else if(this.time>=1080)this.finish(false,'加时结束，织网主机仍在运行。');
 }
 tickEvents(dt:number){for(const e of this.events){if(e.state==='locked'&&this.time>=e.triggerTime){e.state='available';this.signals.toast('港区事件已出现 · 地图查看位置');}if(e.state==='active'){e.elapsed+=dt;if(dist(e.pos,this.player.pos)<12)e.progress+=dt;if(e.progress>=25){e.state='complete';this.signals.eventComplete(e.id);this.gainXP(120);this.player.hp=Math.min(this.player.maxHp,this.player.hp+144);this.rerolls=Math.min(4,this.rerolls+1);this.signals.toast(e.kind==='supply'?'补给回收 · 经验、修复与重抽已领取':'设施恢复 · 新路线开启 · 经验与补给已领取');}else if(e.elapsed>=90)e.state='failed';}}}
 tickEnemies(dt:number){
 const p=this.player;let activeRams=this.enemies.filter(e=>e.kind==='rammer'&&e.state==='windup').length,activeGunners=this.enemies.filter(e=>e.kind==='gunner'&&e.state==='windup').length;
 for(const e of this.enemies){if(e.hp<=0)continue;e.age+=dt;e.cooldown-=dt;e.stun=Math.max(0,e.stun-dt);if(e.stun>0&&!e.boss)continue;
 const base=ENEMIES[e.kind],d=dist(e.pos,p.pos);const delta=sub(p.pos,e.pos);const mist=this.effects.find(f=>f.kind==='mist'&&dist(f.pos,p.pos)<(f.radius??4.5));const sees=(!mist||d<3)&&Math.abs(e.pos.y-p.pos.y)<5&&this.world.clear(add(e.pos,vec(0,.8,0)),add(p.pos,vec(0,1,0)));
 if(e.state==='windup'){e.timer-=dt;if(e.timer>0)continue;
 if(e.kind==='rammer'){e.state='attack';e.timer=12/14;this.signals.sound('charge');}
 else{this.enemyAttack(e);e.state='recover';e.timer=e.kind==='bulwark'?1:.5;e.cooldown=e.boss?5:base.cooldown;}
 continue;
 }if(e.state==='attack'&&e.kind==='rammer'){
 e.timer-=dt;const step=mul(norm(sub(e.target,e.pos)),14*dt);const next=add(e.pos,step);if(!this.world.valid(next.x,next.z)||!this.world.clear(add(e.pos,vec(0,.7,0)),add(next,vec(0,.7,0))))e.timer=0;else e.pos=next;
 if(dist(e.pos,p.pos)<1.2&&Math.abs(e.pos.y-p.pos.y)<2){this.hurt(140,e.pos);e.timer=0;}if(e.timer<=0){e.state='recover';e.timer=1.4;e.cooldown=5;}continue;
 }if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='move';continue;}
 const attackDistance=e.boss?20:e.kind==='gunner'?18:e.kind==='weaver'?13:e.kind==='rammer'?16:e.kind==='bulwark'?2.2:1.1;
 if(sees&&d<attackDistance&&e.cooldown<=0&&!(e.kind==='rammer'&&d<4)&&!(e.kind==='rammer'&&activeRams>=2)&&!(e.kind==='gunner'&&activeGunners>=4)){
 e.state='windup';e.timer=e.boss?1.2:e.kind==='rammer'?.85:e.kind==='gunner'?.65:e.kind==='bulwark'?1.1:e.kind==='weaver'?1.2:.4;e.target=copy(p.pos);e.yaw=yawTo(e.pos,e.target);
 if(e.kind==='rammer'){activeRams++;const dir=norm(sub(e.target,e.pos));e.target=add(e.pos,mul(dir,12));this.fx('warning',e.pos,.85,e.target,1,0xff9e54);}else if(e.kind==='gunner'){activeGunners++;this.fx('warning',add(e.pos,vec(0,.8,0)),.65,add(e.target,vec(0,.5,0)),.4,0xff9866);}else if(e.kind==='bulwark'||e.boss)this.fx('warning',e.pos,e.timer,undefined,e.boss?5:2.8,0xff9866);continue;
 }
 let destination=p.pos;if(!sees&&(!e.navTarget||dist(e.pos,e.navTarget)<2||Math.floor(e.age*2)!==Math.floor((e.age-dt)*2)))e.navTarget=this.world.route(e.pos,p.pos);
 if(!sees&&e.navTarget)destination=e.navTarget;
 const toward=norm(vec(destination.x-e.pos.x,0,destination.z-e.pos.z));let speed=base.speed*(e.elite?1.1:1)*(e.boss?.5:1);
 if(e.kind==='gunner'&&sees){if(d<10)speed*=-.8;else if(d<16)speed=0;}
 if(mist&&this.player.levels.mist>=4&&dist(mist.pos,e.pos)<(mist.radius??4.5))speed*=.75;
 // Small local repulsion prevents complete visual stacking without quadratic global queries.
 const separation=vec();const start=Math.max(0,this.enemies.indexOf(e)-8),end=Math.min(this.enemies.length,start+16);
 for(let j=start;j<end;j++){const other=this.enemies[j];if(other===e||other.hp<=0)continue;const distance=dist(e.pos,other.pos);if(distance<1.1&&distance>.01){separation.x+=(e.pos.x-other.pos.x)/distance*(1.1-distance);separation.z+=(e.pos.z-other.pos.z)/distance*(1.1-distance);}}
 const next=add(e.pos,vec((toward.x*speed+separation.x*2)*dt,0,(toward.z*speed+separation.z*2)*dt));
 if(this.world.valid(next.x,next.z)&&this.world.clear(add(e.pos,vec(0,.7,0)),add(next,vec(0,.7,0)))){next.y=this.world.floor(next.x,next.z,e.pos.y);if(Math.abs(next.y-e.pos.y)<1.5)e.pos=next;}
 e.yaw=yawTo(e.pos,destination);
 if(e.boss&&Math.floor(e.age/8)!==Math.floor((e.age-dt)/8)){for(let i=-1;i<=1;i++)this.enemyBullet(e,add(p.pos,vec(i*3,0,0)),50);}
 }
 }
 enemyAttack(e:Enemy){if(e.kind==='crawler'||e.kind==='bulwark'){if(dist(e.pos,this.player.pos)<(e.kind==='bulwark'?3:1.7)&&Math.abs(e.pos.y-this.player.pos.y)<2)this.hurt(ENEMIES[e.kind].damage*(e.elite?1.2:1),e.pos);}
 else if(e.kind==='gunner'){for(let i=-1;i<=1;i++)this.enemyBullet(e,add(e.target,vec(i*.9,0,0)),35);}
 else if(e.kind==='weaver'){const count=e.boss?(e.hp/e.maxHp<.35?5:4):3;this.hazards=this.hazards.filter(h=>h.owner!==e.id);
 const center=copy(e.target);const start=this.rng.next()*6.28;const points:Vec[]=[];for(let i=0;i<count;i++){const angle=start+i*Math.PI*1.5/(count-1);const pt=add(center,vec(Math.cos(angle)*5,0,Math.sin(angle)*5));pt.y=this.world.floor(pt.x,pt.z,e.pos.y);points.push(pt);}
 for(let i=0;i<points.length-1;i++)if(this.world.clear(add(points[i],vec(0,.2,0)),add(points[i+1],vec(0,.2,0))))this.hazards.push({id:this.id(),pos:points[i],end:points[i+1],ttl:7.2,warmup:1.2,owner:e.id,hp:e.boss?180:60,tick:0});
 }}
 enemyBullet(e:Enemy,target:Vec,damage:number){const pos=add(e.pos,vec(0,e.boss?2:1.1,0));const aim=add(target,vec(0,1,0));this.projectiles.push({id:this.id(),pos,velocity:mul(norm(sub(aim,pos)),e.boss?12:14),damage,radius:.2,ttl:4,owner:'enemy',kind:'needle',hit:[],distance:0,maxDistance:45,reflected:false});}
 tickProjectiles(dt:number){
 const p=this.player;for(const bullet of this.projectiles){bullet.ttl-=dt;const old=copy(bullet.pos);bullet.pos=add(old,mul(bullet.velocity,dt));bullet.distance+=Math.hypot(bullet.velocity.x,bullet.velocity.y,bullet.velocity.z)*dt;
 if(!this.world.clear(old,bullet.pos)){bullet.pos=old;bullet.ttl=0;if(bullet.kind==='large')this.bubbleExplosion(bullet);continue;}if(bullet.distance>bullet.maxDistance){bullet.ttl=0;}
 if(bullet.owner==='player'){
 for(const h of this.hazards){if(h.hp>0&&Math.abs(bullet.pos.y-h.pos.y)<2&&segmentDistance(add(h.pos,vec(0,.65,0)),old,bullet.pos)<.8){this.damageNode(h,bullet.damage);bullet.ttl=0;break;}}
 if(bullet.ttl<=0)continue;
 for(const e of this.enemies){if(e.hp<=0||bullet.hit.includes(e.id))continue;const radius=ENEMIES[e.kind].radius*(e.boss?2.4:1)+bullet.radius;if(segmentDistance(e.pos,old,bullet.pos)<radius&&Math.abs(e.pos.y+.7-bullet.pos.y)<(e.boss?3:1.5)){
 bullet.hit.push(e.id);if(bullet.kind==='bubble'&&bullet.hit.length===1)p.bubbleCount=Math.min(4,p.bubbleCount+1);let damage=bullet.damage;if(bullet.skill==='cannon'&&p.evolutions.cannon==='a'&&bullet.hit.length>=3)damage*=1.4;
 if(bullet.kind==='large'){this.bubbleExplosion(bullet);bullet.ttl=0;}else this.damage(e,damage,bullet.skill,old);
 if(bullet.kind!=='cannon'||e.kind==='bulwark'&&this.frontFacing(e,old))bullet.ttl=0;
 if(bullet.ttl<=0)break;
 }}
 }else if(segmentDistance(p.pos,old,bullet.pos)<.6&&Math.abs(p.pos.y+1-bullet.pos.y)<1){
 const d=norm(sub(old,p.pos)),fw=forward(p.yaw);if(p.shieldTime>0&&d.x*fw.x+d.z*fw.z>(p.empoweredShield?0:.5)&&(p.empoweredShield||p.evolutions.shield==='a'&&(p.reflectCooldown??0)<=0)&&!bullet.reflected){p.reflectCooldown=.4;bullet.owner='player';bullet.skill='shield';bullet.reflected=true;bullet.velocity=mul(norm(sub(this.lastInput.aim,bullet.pos)),20);bullet.ttl=3;bullet.distance=0;this.signals.sound('shield');}
 else{this.hurt(bullet.damage,old);bullet.ttl=0;}
 }
 if(bullet.ttl<=0){if(bullet.kind==='large'&&bullet.hit.length===0)this.bubbleExplosion(bullet);if(bullet.kind==='cannon'&&p.evolutions.cannon==='b'){for(const e of this.enemies)if(e.hp>0&&!bullet.hit.includes(e.id)&&dist(e.pos,bullet.pos)<3)this.damage(e,125,'cannon',bullet.pos,true);this.fx('burst',bullet.pos,.4,undefined,3);}}
 }this.projectiles=this.projectiles.filter(b=>b.ttl>0);
 }
 bubbleExplosion(b:Projectile){const radius=this.player.core.bubble>=2?3.5:2.5;for(const e of this.enemies)if(e.hp>0&&dist(e.pos,b.pos)<radius&&Math.abs(e.pos.y-b.pos.y)<3&&this.world.clear(b.pos,add(e.pos,vec(0,.7,0))))this.damage(e,b.damage,undefined,b.pos,true);this.fx('burst',b.pos,.35,undefined,radius);}
 tickHazards(dt:number){let contact=false;for(const h of this.hazards){h.ttl-=dt;h.warmup-=dt;if(h.warmup<=0&&h.hp>0&&segmentDistance(this.player.pos,h.pos,h.end)<.65&&Math.abs(this.player.pos.y-h.pos.y)<1.5)contact=true;}
 this.hazardDamageTimer-=dt;if(contact){this.hazardContact+=dt;if(this.hazardDamageTimer<=0){this.hurt(40,this.player.pos,true);this.hazardDamageTimer=.5;}if(this.hazardContact>.5)this.player.energy=Math.max(0,this.player.energy-8*dt);}else{this.hazardContact=0;this.hazardDamageTimer=0;}this.hazards=this.hazards.filter(h=>h.ttl>0&&h.hp>0);}
 snapshot():GameSnapshot{return JSON.parse(JSON.stringify({version:1,config:this.config,time:this.time,rng:this.rng.state,player:this.player,enemies:this.enemies,projectiles:this.projectiles,hazards:this.hazards,pickups:this.pickups,events:this.events,rerolls:this.rerolls,bossSpawned:this.bossSpawned,nextSpawn:this.nextSpawn,nextId:this.nextId,pendingLevels:this.pendingLevels,choices:this.choices,unlocks:this.unlocks,effects:this.effects,delayed:this.delayed,hazardContact:this.hazardContact,hazardDamageTimer:this.hazardDamageTimer}));}
 restore(s:GameSnapshot){if(s.version!==1)throw Error('Unsupported save');this.time=s.time;this.rng.state=s.rng;this.player=s.player;this.enemies=s.enemies;this.projectiles=s.projectiles;this.hazards=s.hazards;this.pickups=s.pickups;this.events=s.events;this.rerolls=s.rerolls;this.bossSpawned=s.bossSpawned;this.nextSpawn=s.nextSpawn;this.nextId=s.nextId;this.pendingLevels=s.pendingLevels;this.choices=s.choices;this.unlocks=s.unlocks;this.effects=s.effects??[];this.delayed=s.delayed??[];this.hazardContact=s.hazardContact??0;this.hazardDamageTimer=s.hazardDamageTimer??0;this.phase=s.pendingLevels?'upgrade':'paused';for(const t of [240,480,600])if(t<this.time)this.eliteTimes.add(t);}
}
