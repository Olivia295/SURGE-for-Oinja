import type {SkillId,EnemyKind,Mode} from './types';
export const SKILLS:SkillId[]=['grapple','shield','cannon','lightning','mist','barrier'];
export const RIGHT:SkillId[]=['grapple','shield','cannon'];
export const LEFT:SkillId[]=['lightning','mist','barrier'];
export const SKILL_INFO:Record<SkillId,{name:string;cost:number;cooldown:number;description:string}>={
grapple:{name:'钩爪鞭',cost:18,cooldown:8,description:'钩敌拉近 · 钩墙飞越'},
shield:{name:'护卫盾',cost:20,cooldown:12,description:'正面抵挡 · 推进反击'},
cannon:{name:'充能炮',cost:30,cooldown:12,description:'三发贯穿 · 后坐移位'},
lightning:{name:'雷电冲击',cost:0,cooldown:5,description:'目标间折转连锁'},
mist:{name:'雷雾掩护',cost:0,cooldown:10,description:'布雾控场 · 再按回闪'},
barrier:{name:'电流屏障',cost:0,cooldown:30,description:'引导穹顶 · 强化右臂'}};
export const ENEMIES:Record<EnemyKind,{name:string;hp:number;speed:number;xp:number;radius:number;damage:number;cooldown:number;color:number}>={
crawler:{name:'群行爬机',hp:90,speed:3.8,xp:1,radius:.5,damage:45,cooldown:1.1,color:0xe4a349},
rammer:{name:'撞角奔机',hp:220,speed:4.2,xp:4,radius:.8,damage:140,cooldown:5,color:0xe57353},
gunner:{name:'针炮悬机',hp:170,speed:3,xp:3,radius:.7,damage:35,cooldown:3,color:0xe1cda1},
bulwark:{name:'重盾搬运机',hp:900,speed:2.8,xp:7,radius:1,damage:120,cooldown:2.8,color:0x839daa},
weaver:{name:'窃电织网机',hp:320,speed:3.2,xp:5,radius:.8,damage:80,cooldown:9,color:0xb99ac7}};
export const EVOLUTIONS:Record<SkillId,[string,string,string,string]>={
grapple:['回旋索','横扫扩大并聚拢小型敌人','穿场锚','飞越途中伤害沿途敌人'],
shield:['反击面','普通护盾也可反射弹体','推进壁','更快推进并撞退敌人'],
cannon:['贯流炮','贯穿第三个及后续目标增伤','脉冲炮','弹道终点释放一次范围爆炸'],
lightning:['分枝雷','电弧分枝，最多十个目标','回响雷','连锁后追加一次弱雷回响'],
mist:['滞雷雾','雾内持续伤害大幅提升','归流雾','回闪获得短时护盾'],
barrier:['疾成穹顶','完整引导缩短至1.8秒','余辉穹顶','引导结束后保留保护区域']};
export function modeDamage(mode:Mode){return mode==='beginner'?1.2:1;}
export function xpFor(level:number){return 20+8*(level-1);}
export function eligible(config:{mode:Mode;rightSkill:SkillId;leftSkill:SkillId}){return config.mode==='thunder'?SKILLS:[config.rightSkill,config.leftSkill];}
export const emptySkills=()=>Object.fromEntries(SKILLS.map(s=>[s,0])) as Record<SkillId,number>;
