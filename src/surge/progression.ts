import type {RunState} from './types';
/** XP remains combat-earned; the larger curve leaves time to play each new upgrade. */
export function xpToNext(level:number){return level<=1?50:Math.round(50+22*level+9*level**1.7);}
export function upgradeBreather(level:number){return level>=18?14:level>=10?10:6;}
export function migrateProgression(s:RunState){
 if(s.progressionVersion!==2){const ratio=Math.max(0,Math.min(1,s.xp/Math.max(1,s.xpNext)));s.xpNext=xpToNext(s.level);s.xp=ratio*s.xpNext;s.progressionVersion=2;s.nextUpgradeAt=s.phase==='upgrade'?s.time:Math.max(20,s.time+upgradeBreather(s.level));}
 if(s.encounterBuff&&s.encounterBuff.until<=s.time)s.encounterBuff=undefined;
 s.nextUpgradeAt??=Math.max(20,s.time);s.encounterHistory??=[];s.nextEncounterAt??=s.time+65+(s.rng%21);
}
