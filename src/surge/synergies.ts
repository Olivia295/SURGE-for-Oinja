import type {Choice,RunState,SynergyId} from './types';
export interface SynergyDefinition{id:SynergyId;name:string;components:string;description:string;color:string}
export const SYNERGIES:Record<SynergyId,SynergyDefinition>={
 slam:{id:'slam',name:'牵引重击',components:'回旋钩索 + 震荡重拳',description:'钩索聚怪后重置重拳，下一拳引发额外震地冲击。',color:'#ffc184'},
 discharge:{id:'discharge',name:'感电爆破',components:'电泡 / 电炮 + 连雷 / 钩索 / 导电涂层',description:'爆破命中导电目标，消耗标记并向周围跳跃放电。',color:'#9ce8dd'},
 storm:{id:'storm',name:'雷云共振',components:'雷雾回路 + 跳跃闪电',description:'雷电击中雾区敌人，使整片雷雾震击并短暂加速放电。',color:'#c8acff'},
 rebound:{id:'rebound',name:'蓄能反击',components:'回震圆盾 + 重拳 / 钩索',description:'圆盾吸收伤害后蓄能，下一次近战释放大范围反击波。',color:'#93c6ff'},
 swarm:{id:'swarm',name:'蜂群集火',components:'蜂群援护 + 连雷 / 钩索 / 导电涂层',description:'机械蜂优先攻击导电目标，每三次命中触发额外协同齐射。',color:'#ffe29a'}
};
type Build=Pick<RunState,'weapons'|'mods'>;
export function activeSynergies(s:Build):SynergyDefinition[]{
 const has=(id:string)=>s.weapons.some(w=>w.id===id),marks=has('chain')||has('hook')||(s.mods.conductor??0)>0;
 const active:Record<SynergyId,boolean>={slam:has('fist')&&has('hook'),discharge:(has('bubble')||has('cannon'))&&marks,storm:has('mist')&&has('chain'),rebound:has('shield')&&(has('fist')||has('hook')),swarm:has('drone')&&marks};
 return (Object.keys(SYNERGIES) as SynergyId[]).filter(id=>active[id]).map(id=>SYNERGIES[id]);
}
export function previewChoiceSynergies(s:Build,c:Choice,replaceIndex?:number){
 const before=activeSynergies(s),next:Build={weapons:s.weapons.map(w=>({...w})),mods:{...s.mods}};
 const requiresReplacement=c.type==='weapon'&&next.weapons.length>=4&&replaceIndex===undefined;
 if(c.type==='weapon'&&c.weapon&&!requiresReplacement){if(next.weapons.length<4)next.weapons.push({id:c.weapon,level:1,cooldown:0,casts:0});else if(replaceIndex!==undefined&&next.weapons[replaceIndex])next.weapons[replaceIndex]={...next.weapons[replaceIndex],id:c.weapon};}
 if(c.type==='mod'&&c.mod)next.mods[c.mod]=(next.mods[c.mod]??0)+1;
 const active=activeSynergies(next);
 return {active,added:active.filter(a=>!before.some(b=>b.id===a.id)),lost:before.filter(a=>!active.some(b=>b.id===a.id)),requiresReplacement};
}
