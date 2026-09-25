import test from 'node:test';
import assert from 'node:assert/strict';
import {validateObservatory} from '../tools/surge/observatory-qa';
test('Observatory offers reachable events, physical shortcuts and uninterrupted ramp travel',async t=>{
 const report=await validateObservatory();
 await t.test('each of six event kinds has exactly two candidates',()=>{assert.equal(Object.keys(report.eventKinds).length,6);for(const count of Object.values(report.eventKinds))assert.equal(count,2);});
 await t.test('all events, both ring directions and both live doors are traversable in Rapier',()=>{for(const result of report.results)assert.ok(result.pass,JSON.stringify(result));});
 await t.test('ramps and exposed edges retain continuous motion at 30, 60 and 120Hz',()=>{assert.equal(report.trajectories.length,45);for(const {frames,...result} of report.trajectories)assert.ok(result.pass,JSON.stringify(result));});
});
