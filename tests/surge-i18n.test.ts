import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { t, setLocale, getLocale } from '../src/surge/i18n';
import { WEAPONS, MODS, SUPPORTS, UNLOCKS } from '../src/surge/content';
import { SYNERGIES } from '../src/surge/synergies';
import { MAPS } from '../src/surge/maps';
import { ENCOUNTERS, ENCOUNTER_BUFFS, ENCOUNTER_TEXT } from '../src/surge/encounters';
const han = /\p{Script=Han}/u;
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}
test('Chinese remains the exact source text, including named parameters',()=>{
  setLocale('zh-CN');assert.equal(getLocale(),'zh-CN');assert.equal(t('进入{name}',{name:'潮汐观测庭'}),'进入潮汐观测庭');assert.equal(t('回旋钩索'),'回旋钩索');
});
test('every ability, evolution, mod, support, unlock and link is translated',()=>{
  setLocale('en');for(const source of strings([WEAPONS,MODS,SUPPORTS,UNLOCKS,SYNERGIES]).filter(s=>han.test(s)))assert.ok(!han.test(t(source)),source);
});
test('both map descriptions and all encounter text are translated',()=>{
  setLocale('en');for(const source of strings([MAPS,ENCOUNTERS,ENCOUNTER_BUFFS,ENCOUNTER_TEXT]).filter(s=>han.test(s)))assert.ok(!han.test(t(source)),source);
});
test('UI literal keys and run notes have English entries',()=>{
  setLocale('en');const sf=ts.createSourceFile('ui.ts',fs.readFileSync(new URL('../src/surge/ui.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node:ts.Node){if(ts.isCallExpression(node)&&node.expression.getText(sf)==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))assert.ok(!han.test(t(node.arguments[0].text)),node.arguments[0].text);ts.forEachChild(node,visit);}visit(sf);
  for(const source of ['寻找场景设施，获取强力支援','回路接通 · 区域重获光明','所有设施接通 · 享受你的清场回路','围猎波 · 突围或利用场景设施清场'])assert.ok(!han.test(t(source)),source);
});
test('simulation rank, evolution and support messages preserve values',()=>{
  setLocale('en');assert.equal(t('震荡重拳 3'),'Shock Fist 3');assert.equal(t('近战震击 · 2 → 3'),'Melee impact · 2 → 3');assert.equal(t('机制进化 · 回震圆盾'),'Evolution · Recoil Shield');assert.equal(t('保留工坊泰坦，恢复全部生命并获得50护盾。'),'Keep Workshop Titan, fully restore health and gain 50 shield.');
});
test('dynamic site notifications and loading errors preserve context',()=>{
  setLocale('en');assert.equal(t('迎潮装配台 · 已启动'),'Tidefront Workshop · Activated');assert.equal(t('雨棚配电站 暂停 · 随时可以重新启动'),'Canopy Power Station paused · Restart it any time');assert.equal(t('载入遇到问题：Network error'),'Loading problem: Network error');
});
test('formatting is explicit and does not translate HTML',()=>{
  setLocale('en');assert.equal(t('进入{name}',{name:t('潮汐观测庭')}),'Enter Tidal Observatory');assert.equal(t(' 支援 '),' Support ');assert.equal(t('<b>支援</b>'),'<b>支援</b>');assert.equal(t(''), '');
});
