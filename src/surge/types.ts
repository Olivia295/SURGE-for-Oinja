import type { MapWorld } from '../world/types';
import type {SurgeMapId} from './maps';
export type Vec={x:number;y:number;z:number};
export type EncounterKind='storm-hunt'|'battery-run'|'overload'|'echo-hunt';
export interface EncounterState{id:number;kind:EncounterKind;state:'announced'|'offered'|'active'|'complete'|'failed'|'expired';pos:Vec;createdAt:number;expiresAt:number;progress:number;goal:number;radius:number;startedAt?:number;streakUntil?:number;route?:Vec[];targetIds?:number[]}
export interface EncounterRecord{id:number;kind:EncounterKind;result:'complete'|'failed'|'expired';at:number}
export interface EncounterBuff{kind:'power'|'haste'|'magnet';until:number}
export type SynergyId='slam'|'discharge'|'storm'|'rebound'|'swarm';
export type WeaponId='fist'|'chain'|'bubble'|'shield'|'drone'|'mist'|'hook'|'cannon';
export type EnemyId='crawler'|'rammer'|'gunner'|'bulwark'|'weaver';
export type SupportId='titan'|'tempest'|'orbital'|'medic'|'prism'|'crusher';
export type EventKind='relay'|'convoy'|'crane'|'forge'|'conveyor'|'cache';
export interface WeaponSlot{id:WeaponId;level:number;evolution?:'a'|'b';cooldown:number;casts:number}
export interface Mob{id:number;kind:EnemyId;pos:Vec;hp:number;maxHp:number;elite:boolean;boss:boolean;yaw:number;timer:number;state:'move'|'windup'|'attack';target:Vec;slow:number;mark:number;stun:number;age:number;route?:Vec}
export interface Shot{id:number;pos:Vec;vel:Vec;radius:number;damage:number;ttl:number;owner:'player'|'enemy';weapon:WeaponId|'support';pierce:number;hits:number[];color:number;blast:number}
export interface Field{energized?:number;id:number;pos:Vec;radius:number;ttl:number;tick:number;damage:number;type:'mist'|'shock'|'danger';color:number}
export interface FX{yaw?:number;id:number;type:'ring'|'arc'|'bolt'|'hit'|'heal'|'warning';pos:Vec;end?:Vec;radius:number;ttl:number;duration:number;color:number;amount?:number}
export interface Drop{id:number;pos:Vec;amount:number;type:'xp'|'heal';age:number}
export interface Drone{id:number;pos:Vec;target:Vec;kind:'drone'|'titan'|'medic'|'prism';yaw:number}
export interface EventDefinition{id:string;kind:EventKind;title:string;description:string;pos:Vec;reward:SupportId}
export interface SiteState extends EventDefinition{state:'available'|'active'|'complete';progress:number;goal:number;remaining:number;rewarded:boolean;route?:Vec;guardIds?:number[];counter:number}
export interface Choice{id:string;title:string;description:string;detail:string;type:'weapon'|'rank'|'evolution'|'mod'|'support'|'heal';weapon?:WeaponId;support?:SupportId;mod?:string;branch?:'a'|'b';level?:number;color:string}
export interface Stats{synergyTriggers?:Partial<Record<SynergyId,number>>;synergyDamage?:Partial<Record<SynergyId,number>>;weaponDamage:Partial<Record<WeaponId|'support',number>>;events:number;eliteKills:number;syncs:number;firstUpgrade:number;firstEvolution:number;maxCombo:number}
export interface RunState{encounter?:EncounterState;encounterHistory?:EncounterRecord[];nextEncounterAt?:number;encounterBuff?:EncounterBuff;progressionVersion?:2;nextUpgradeAt?:number;mapId?:SurgeMapId;reactionCooldowns?:Partial<Record<SynergyId,number>>;slamReadyUntil?:number;recoilCharge?:number;droneHits?:number;lastReaction?:{id:SynergyId;until:number};nextPressure?:number;pressureWarned?:boolean;version:2;echoes?:{at:number;pos:Vec;count:number;damage:number}[];kit?:string;supportTrial?:number;choiceSource?:'level'|'event';basicCooldown?:number;armorCooldown?:number;phase:'playing'|'paused'|'upgrade'|'won'|'lost';seed:number;rng:number;time:number;startWeapon:WeaponId;danger:number;player:Vec;yaw:number;hp:number;maxHp:number;shield:number;sync:number;syncTime:number;dashTime:number;dashCooldown:number;invulnerable:number;lastHurt:number;revives:number;level:number;xp:number;xpNext:number;kills:number;damageTaken:number;damageDealt:number;rerolls:number;pendingLevels:number;weapons:WeaponSlot[];mods:Record<string,number>;support:SupportId|null;supportCooldown:number;enemies:Mob[];shots:Shot[];fields:Field[];fx:FX[];drops:Drop[];drones:Drone[];events:SiteState[];choices:Choice[];nextId:number;nextSpawn:number;bossSpawned:boolean;notes:string;stats:Stats;combo:number;comboTime:number;action:string;actionTime:number}
export interface Settings{volume:number;quality:'low'|'medium'|'high';shake:boolean;damageNumbers:boolean;reducedMotion:boolean;cameraDistance:number}
export interface Profile{version:2;unlocks:string[];runs:number;wins:number;bestKills:number;settings:Settings;lastWeapon:WeaponId;totalKills:number;totalEvents:number}
export interface WorldPort{move(pos:Vec,delta:Vec,dt?:number):Vec;floor(x:number,z:number,y?:number):number;clear(a:Vec,b:Vec):boolean;valid(x:number,z:number):boolean;route(a:Vec,b:Vec):Vec;spawnPoint(from:Vec,angle:number,distance:number):Vec|null}
export interface GameSignals{sound(kind:string):void;toast(text:string):void;event(id:string):void;end(won:boolean):void}
export interface InputState{x:number;z:number;dash:boolean}
export interface HarborResult{world:MapWorld;sites:EventDefinition[]}
