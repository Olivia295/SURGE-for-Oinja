export type Vec = {x:number;y:number;z:number};
export type SkillId = 'grapple'|'shield'|'cannon'|'lightning'|'mist'|'barrier';
export type EnemyKind = 'crawler'|'rammer'|'gunner'|'bulwark'|'weaver';
export type Mode = 'beginner'|'thunder';
export type MapId = 'old-harbor'|'new-harbor';
export type Phase = 'menu'|'playing'|'paused'|'upgrade'|'won'|'lost';
export interface RunConfig { mapId:MapId; mode:Mode; rightSkill:SkillId; leftSkill:SkillId; seed?:number; }
export interface InputFrame {x:number;z:number;aim:Vec;jump:boolean;fire:boolean;}
export interface Enemy {id:number;kind:EnemyKind;pos:Vec;hp:number;maxHp:number;yaw:number;age:number;cooldown:number;state:'move'|'windup'|'attack'|'recover';timer:number;target:Vec;elite:boolean;boss:boolean;lastAttack:number;stun:number;navTarget?:Vec;}
export interface Projectile {id:number;pos:Vec;velocity:Vec;damage:number;radius:number;ttl:number;owner:'player'|'enemy';skill?:SkillId;kind:'bubble'|'large'|'cannon'|'needle';hit:number[];distance:number;maxDistance:number;reflected:boolean;}
export interface Hazard {id:number;pos:Vec;end:Vec;ttl:number;warmup:number;owner:number;hp:number;tick:number;}
export interface Pickup {id:number;pos:Vec;value:number;type:'xp'|'heal';}
export interface Effect {id:number;kind:'hit'|'lightning'|'burst'|'grapple'|'mist'|'barrier'|'shield'|'trail'|'heal'|'warning';pos:Vec;end?:Vec;radius?:number;ttl:number;duration:number;color?:number;amount?:number;}
export interface Upgrade {id:string;skill?:SkillId;title:string;description:string;kind:'skill'|'core'|'utility'|'evolution';level:number;maxLevel:number;branch?:'a'|'b';}
export interface Player {pos:Vec;yaw:number;hp:number;maxHp:number;energy:number;maxEnergy:number;speed:number;attackTimer:number;hand:'right'|'left';punchCount:number;bubbleCount:number;level:number;xp:number;xpNext:number;kills:number;damageDealt:number;damageTaken:number;lastHurt:number;invulnerable:number;fastCharge:number;sinceRight:number;mechanical:number;shieldTime:number;cannonShots:number;cannonTime:number;barrierTime:number;barrierTotal:number;empowered:number;empoweredCannon:boolean;empoweredShield:boolean;mistCenter:Vec|null;mistWindow:number;giftBubble:number;tempShield:number;tempShieldTime:number;vy:number;grounded:boolean;levels:Record<SkillId,number>;cooldowns:Record<SkillId,number>;evolutions:Partial<Record<SkillId,'a'|'b'>>;core:Record<string,number>;lastAction:SkillId|'punch'|'heavy'|'bubble'|'cast'|'idle';actionTime:number;switchBuff:number;reflectCooldown:number;pushCooldown:number;grappleTarget:Vec|null;}
export interface GameSnapshot {version:1;config:RunConfig;time:number;rng:number;player:Player;enemies:Enemy[];projectiles:Projectile[];hazards:Hazard[];pickups:Pickup[];events:RunEvent[];rerolls:number;bossSpawned:boolean;nextSpawn:number;nextId:number;pendingLevels:number;choices:Upgrade[];unlocks:string[];effects?:Effect[];delayed?:{time:number;target:number;damage:number;skill:SkillId}[];hazardContact?:number;hazardDamageTimer?:number;}
export interface RunEvent {id:string;pos:Vec;kind:string;state:'locked'|'available'|'active'|'complete'|'failed';progress:number;elapsed:number;triggerTime:number;}
export interface WorldQueries {move(pos:Vec,delta:Vec):Vec;floor(x:number,z:number,y?:number):number;clear(a:Vec,b:Vec):boolean;valid(x:number,z:number):boolean;route(a:Vec,b:Vec):Vec;anchor(aim:Vec,from:Vec):Vec|null;spawnPoint(from:Vec,angle:number,distance:number):Vec|null;}
export interface Signals {toast(text:string):void;sound(kind:string):void;eventComplete(id:string):void;end(won:boolean,reason:string):void;}
