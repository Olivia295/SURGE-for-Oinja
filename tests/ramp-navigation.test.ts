import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRampNavigation} from '../tools/surge/ramp-navigation-qa';
test('navigation respects ramp undersides while retaining ascent, descent and clear underpasses',async()=>{
 const report=await validateRampNavigation();assert.equal(report.results.length,13);
 for(const r of report.results)assert.ok(r.pass,JSON.stringify(r));
 const reported=report.results.find(r=>r.name==='reported-west-side')!;
 assert.ok(reported.initialRoute.length>1,'the recorded collision must not remain a direct ground segment');
 assert.ok(reported.maxBlocked<=1,'must keep advancing through the rerouted path');
 for(const r of report.results.filter(r=>r.name.includes('clearance')&&!r.name.includes('low'))){assert.equal(r.initialRoute.length,1,`${r.map} ${r.name}: genuinely clear underpasses must remain direct`);}
});
