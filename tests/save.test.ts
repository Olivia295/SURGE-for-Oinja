import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {loadProfile,loadRun,saveProfile,saveRun,clearRun,defaultSettings} from '../src/game/save';
import {Simulation} from '../src/game/simulation';
import {vec,add} from '../src/game/math';
import type {GameSnapshot,WorldQueries} from '../src/game/types';

let entries:Map<string,string>;
beforeEach(()=>{
 entries=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)}});
});
function checkpoint(action?:'bubble'|'heavy'):GameSnapshot{
 const world:WorldQueries={move:(p,d)=>add(p,d),floor:()=>0,clear:()=>true,valid:()=>true,route:(_a,b)=>b,anchor:()=>null,spawnPoint:()=>null};
 const sim=new Simulation({mapId:'old-harbor',mode:'thunder',rightSkill:'grapple',leftSkill:'lightning',seed:7},world,{toast:()=>{},sound:()=>{},eventComplete:()=>{},end:()=>{}},vec());
 sim.spawn('crawler',vec(0,0,-5));sim.cast('mist',vec(0,0,-4));if(action){sim.enemies[0].pos=vec(0,0,-1.6);sim.player.hand=action==='bubble'?'left':'right';sim.player.punchCount=2;sim.attack();assert.equal(sim.player.lastAction,action);}sim.gainXP(20);
 return sim.snapshot();
}
function store(value:unknown){entries.set('oinja.run',JSON.stringify(value));}

test('real checkpoint with combat effects and pending upgrades round trips unchanged',()=>{
 const original=checkpoint();saveRun(original);assert.deepEqual(loadRun(),original);clearRun();assert.equal(loadRun(),null);
});
test('checkpoints during actual bubble and heavy attacks remain recoverable',()=>{for(const action of ['bubble','heavy'] as const){const original=checkpoint(action);saveRun(original);assert.deepEqual(loadRun(),original);}});
test('older version-1 checkpoint can omit optional transient fields',()=>{
 const original=checkpoint();delete original.effects;delete original.delayed;delete original.hazardContact;delete original.hazardDamageTimer;store(original);assert.deepEqual(loadRun(),original);
});
test('truncated checkpoint and malformed JSON are ignored',()=>{
 store({version:1,player:{hp:100},time:2,enemies:[]});assert.equal(loadRun(),null);
 entries.set('oinja.run','{bad');assert.equal(loadRun(),null);store(null);assert.equal(loadRun(),null);
});
const invalidMutations:Record<string,(s:any)=>void>={
 'unknown version':s=>s.version=2,
 'invalid mode':s=>s.config.mode='nightmare',
 'invalid map':s=>s.config.mapId='missing-map',
 'left skill on right arm':s=>s.config.rightSkill='lightning',
 'right skill on left arm':s=>s.config.leftSkill='cannon',
 'non-finite time':s=>s.time=Infinity,
 'negative time':s=>s.time=-1,
 'finished run':s=>s.time=1080,
 'dead player':s=>s.player.hp=0,
 'missing player position':s=>delete s.player.pos,
 'string player numeric field':s=>s.player.speed='fast',
 'invalid player hand':s=>s.player.hand='both',
 'missing skill cooldown':s=>delete s.player.cooldowns.mist,
 'null skill levels':s=>s.player.levels=null,
 'missing core data':s=>s.player.core={},
 'invalid evolution':s=>s.player.evolutions.mist='c',
 'missing events':s=>delete s.events,
 'null projectile list':s=>s.projectiles=null,
 'malformed enemy':s=>s.enemies[0].target=null,
 'invalid enemy type':s=>s.enemies[0].kind='dragon',
 'malformed projectile':s=>s.projectiles=[{id:3}],
 'malformed hazard':s=>s.hazards=[null],
 'malformed pickup':s=>s.pickups=[{id:4}],
 'malformed event':s=>s.events=[{id:'broken'}],
 'malformed delayed hit':s=>s.delayed=[{time:1,target:1,damage:'huge',skill:'lightning'}],
 'malformed effect':s=>s.effects=[{id:8}],
 'missing upgrade choices':s=>s.choices=[],
 'invalid upgrade skill':s=>s.choices=[{id:'missing',skill:'missing',title:'X',description:'X',kind:'skill',level:2,maxLevel:5}],
 'invalid unlocks':s=>s.unlocks={},
 'invalid identifier':s=>s.nextId=null,
};
for(const [label,mutate] of Object.entries(invalidMutations))test(`rejects ${label}`,()=>{const s=checkpoint();mutate(s);store(s);assert.equal(loadRun(),null);});
test('profile merges defaults and preserves valid preferences and unlocks',()=>{
 const lastSelection={mapId:'new-harbor',mode:'beginner',rightSkill:'cannon',leftSkill:'mist'};
 entries.set('oinja.profile',JSON.stringify({version:1,lastSelection,wins:3,best:750,unlocks:['mist','mist','unknown','shield'],settings:{volume:.4,quality:'high',shake:false,keybinds:{forward:'KeyI',barrier:'Digit4'}}}));
 const profile=loadProfile();assert.deepEqual(profile.lastSelection,lastSelection);assert.equal(profile.wins,3);assert.equal(profile.best,750);assert.deepEqual(profile.unlocks,['mist','shield']);assert.equal(profile.settings.volume,.4);assert.equal(profile.settings.musicVolume,defaultSettings.musicVolume);assert.equal(profile.settings.quickCast,false);assert.deepEqual(profile.settings.keybinds,{forward:'KeyI',barrier:'Digit4'});saveProfile(profile);assert.deepEqual(loadProfile(),profile);
});
test('malformed profile fields cannot contaminate defaults or key bindings',()=>{
 entries.set('oinja.profile','{"version":1,"wins":"many","best":-3,"unlocks":[null,4,"mist"],"settings":{"volume":4,"musicVolume":null,"effectsVolume":"loud","quality":"ultra","shake":1,"sensitivity":0,"damageNumbers":null,"reducedMotion":"no","quickCast":"false","keybinds":{"forward":5,"left":"KeyJ","unknown":"KeyA","__proto__":"KeyQ"},"__proto__":{"polluted":true}},"unexpected":true}');
 const profile=loadProfile();assert.equal(profile.wins,0);assert.equal(profile.best,0);assert.deepEqual(profile.unlocks,['mist']);assert.deepEqual(profile.settings,{...defaultSettings,keybinds:{left:'KeyJ'}});assert.equal('unexpected' in profile,false);assert.equal('polluted' in profile.settings,false);
 profile.settings.keybinds!.right='KeyL';entries.delete('oinja.profile');assert.deepEqual(loadProfile().settings.keybinds,{});assert.deepEqual(defaultSettings.keybinds,{});
});
test('unavailable storage and non-object profile settings safely fall back',()=>{
 entries.set('oinja.profile',JSON.stringify({version:1,settings:'broken',lastSelection:{mapId:'new-harbor',mode:'beginner',rightSkill:'mist',leftSkill:'cannon'}}));assert.deepEqual(loadProfile().settings,defaultSettings);assert.equal(loadProfile().lastSelection,undefined);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage disabled');}});
 assert.equal(loadRun(),null);assert.deepEqual(loadProfile().settings,defaultSettings);
});
