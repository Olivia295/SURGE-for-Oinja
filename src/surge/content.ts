import type {WeaponId,SupportId,EnemyId,Settings,Profile} from './types';
export const WEAPONS:Record<WeaponId,{name:string;description:string;color:string;icon:string;family:string;cooldown:number;damage:number;range:number;evolutions:[string,string];evoDescriptions:[string,string]}>={
 fist:{name:'震荡重拳',description:'自动震击周围敌群。近身更强，击杀提供护盾。',color:'#ffbe75',icon:'✦',family:'近战震击',cooldown:.6,damage:60,range:5.8,evolutions:['裂地连拳','贯空震波'],evoDescriptions:['重拳伤害强化，每次再产生一圈范围更广的震荡。','拳势化为远距离贯穿冲击波，穿过整列敌人。']},
 chain:{name:'跳跃闪电',description:'雷电在敌人之间跳跃，给敌群附上导电标记。',color:'#b5a0ff',icon:'ϟ',family:'链雷传导',cooldown:1.05,damage:55,range:22,evolutions:['万雷归流','雷暴回响'],evoDescriptions:['跳跃目标增加，标记敌人被击败时向附近传播雷电。','每轮闪电延迟再释放一次，逐跳提升伤害。']},
 bubble:{name:'电泡集束',description:'自动瞄准怪群发射电泡，命中引发范围爆炸。',color:'#81e8d8',icon:'◉',family:'电泡重炮',cooldown:1.3,damage:82,range:27,evolutions:['连环聚爆','星散电泡'],evoDescriptions:['爆炸范围扩大，附近标记敌人产生额外爆破。','每次向不同目标发射三枚电泡，连续覆盖战场。']},
 shield:{name:'回震圆盾',description:'周期性扫退近敌并获得护盾；受到攻击加速下次回震。',color:'#8dbfff',icon:'⬡',family:'盾反蓄能',cooldown:2,damage:95,range:6.2,evolutions:['雷棘堡垒','疾行盾阵'],evoDescriptions:['护盾承伤引发额外雷棘反击，反击覆盖更广范围。','移动时也能持续获得护盾，回震频率大幅提高。']},
 drone:{name:'蜂群援护',description:'两台机械蜂自主跟随并攻击。每次升级强化协同齐射。',color:'#ffe58b',icon:'⋈',family:'机械召唤',cooldown:.75,damage:34,range:27,evolutions:['蜂群母机','棱镜编队'],evoDescriptions:['增加两台援护蜂，援护弹命中时产生范围电爆。','机械蜂以瞬发射线锁定敌人，并附加导电标记。']},
 mist:{name:'雷雾回路',description:'在怪群脚下生成雷雾，减速并持续放电。',color:'#d0a7f6',icon:'≋',family:'雷雾持续伤害',cooldown:3,damage:24,range:18,evolutions:['积雨雷云','雾海引爆'],evoDescriptions:['雷雾覆盖更广、持续更久，自动追随怪群生成。','雷雾中的导电敌人定期爆炸，并承受更高持续伤害。']},
 hook:{name:'回旋钩索',description:'卷起并拉近一片敌人，制造破甲与近战机会。',color:'#f4ae85',icon:'↝',family:'近战震击',cooldown:1.8,damage:62,range:13,evolutions:['引力绞盘','雷索回旋'],evoDescriptions:['大范围聚怪，钩中敌人受到的近战与爆炸伤害提高。','钩索每轮扫击身边，并触发额外连锁闪电。']},
 cannon:{name:'重构电炮',description:'自动瞄准精英优先，贯穿并炸开前方敌阵。',color:'#ff976f',icon:'➤',family:'电泡重炮',cooldown:1.8,damage:155,range:32,evolutions:['破城重炮','双联速射'],evoDescriptions:['炮弹贯穿更多敌人，并扩大每次命中的爆破范围。','双发电炮，射击间隔缩短，形成持续炮火。']}
};
export const MODS:Record<string,{name:string;description:string;color:string;icon:string;max:number;tags:WeaponId[]}>= {
 conductor:{name:'导电涂层',description:'任意攻击都能标记敌人；被标记目标额外承伤 20%。',color:'#b5a0ff',icon:'ϟ',max:1,tags:['chain','mist','drone']},
 detonate:{name:'雷核殉爆',description:'导电目标被击败时引爆附近敌人，形成有限次数连锁。',color:'#ffb47d',icon:'✹',max:2,tags:['chain','bubble','mist']},
 echo:{name:'双臂回响',description:'每三次能力发动产生额外震荡波；能触发标记与殉爆。',color:'#c4a8ff',icon:'∞',max:2,tags:['fist','shield','hook']},
 shrapnel:{name:'散射组件',description:'电泡、电炮与机械蜂增加一发侧向弹；连雷增加跳跃目标。',color:'#ffe58b',icon:'⋰',max:2,tags:['bubble','cannon','drone','chain']},
 siphon:{name:'近战回收',description:'近身击杀恢复生命并获得护盾，鼓励主动冲进怪潮。',color:'#83ead2',icon:'♥',max:2,tags:['fist','hook','shield']},
 vortex:{name:'引力线圈',description:'爆炸与雷雾把外围敌人拖向中心，更容易集中清场。',color:'#afa2ff',icon:'◎',max:2,tags:['bubble','mist','hook']},
 relay:{name:'协同中继',description:'机械蜂数量 +1；召唤攻击会为同调积累更多能量。',color:'#e6df8e',icon:'⋈',max:2,tags:['drone']},
 capacitor:{name:'过载电容',description:'同调积累 +30%，爆发期间增加攻击范围。',color:'#a6e5e7',icon:'◇',max:2,tags:['chain','shield']},
 tempo:{name:'极速换构',description:'所有能力冷却缩短 12%，可叠加三次。',color:'#93dfd2',icon:'»',max:3,tags:[]},
 area:{name:'波域扩展',description:'范围攻击半径 +18%，雷电跳跃与索敌距离也提高。',color:'#c7aeed',icon:'◌',max:3,tags:[]},
 power:{name:'高能模组',description:'所有能力伤害 +22%，包括召唤物与地图支援。',color:'#ffc184',icon:'✦',max:3,tags:[]},
 vitality:{name:'应急修复',description:'生命上限 +45，立即恢复 70 生命。',color:'#93ddbc',icon:'+',max:3,tags:[]},
 magnet:{name:'回收磁场',description:'经验吸附距离 +8 米；远处遗落经验也会定时回收。',color:'#b6d3f2',icon:'⊕',max:2,tags:[]},
 bulwark:{name:'复合装甲',description:'受到伤害降低 15%，每隔一段时间自动补充护盾。',color:'#a0bdec',icon:'⬡',max:2,tags:['shield','fist']}
};
export const SUPPORTS:Record<SupportId,{name:string;description:string;color:string;icon:string}>={
 titan:{name:'工坊泰坦',description:'重型援护机跟随作战，周期性重锤轰击怪群。',color:'#ffd08b',icon:'⬢'},
 tempest:{name:'临界雷暴',description:'每隔数秒，对附近多个怪群降下强力雷击。',color:'#cbb0ff',icon:'ϟ'},
 orbital:{name:'轨道电炮',description:'远程重炮优先锁定精英，贯穿并炸开附近敌群。',color:'#ffab82',icon:'⌖'},
 medic:{name:'修复精灵',description:'维修无人机持续恢复生命，同时投射护盾脉冲。',color:'#8ce9cb',icon:'✚'},
 prism:{name:'棱镜浮游炮',description:'浮游炮同时锁定多个目标，以高能射线压制精英。',color:'#a6d7ff',icon:'◇'},
 crusher:{name:'磁暴碎星',description:'周期性聚拢敌群并引爆，帮助所有范围攻击成型。',color:'#f5b78e',icon:'✹'}
};
export const ENEMY_DATA:Record<EnemyId,{name:string;hp:number;speed:number;damage:number;xp:number}>={crawler:{name:'蜂群爬机',hp:30,speed:3.2,damage:8,xp:1},rammer:{name:'破阵冲机',hp:80,speed:3.5,damage:18,xp:3},gunner:{name:'巡弋炮机',hp:58,speed:2.7,damage:10,xp:3},bulwark:{name:'护卫重装',hp:175,speed:2.1,damage:16,xp:5},weaver:{name:'增殖母机',hp:135,speed:2.4,damage:12,xp:5}};
export const DEFAULT_SETTINGS:Settings={volume:.5,quality:'medium',shake:true,damageNumbers:true,reducedMotion:false,cameraDistance:27};
export const DEFAULT_PROFILE:Profile={version:2,unlocks:[],runs:0,wins:0,bestKills:0,settings:{...DEFAULT_SETTINGS},lastWeapon:'fist',totalKills:0,totalEvents:0};
export const UNLOCKS=[{id:'first-circuit',name:'回路初成',description:'完成一次行动，解锁回收方案：更多重抽，稍低伤害。'},{id:'harbor-friend',name:'工坊伙伴',description:'累计完成 3 个地图事件，解锁支援试用方案：90 秒支援，少一次重抽。'},{id:'storm-reader',name:'逐雷者',description:'累计击败 1000 个敌人，解锁导电方案：初始标记，较低生命。'},{id:'surge-master',name:'电涌行者',description:'赢得一次行动，解锁广域方案：初始扩展，稍慢冷却。'}];
