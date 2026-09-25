import fs from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';
const root='/Users/oliviapan/Desktop/Oinja-game';const results=[];
for(const group of ['characters','enemies'])for(const file of await fs.readdir(path.join(root,'public/assets',group))){
 if(!file.endsWith('.glb'))continue;const data=await fs.readFile(path.join(root,'public/assets',group,file));
 const result=await validator.validateBytes(new Uint8Array(data),{uri:file,maxIssues:100});results.push({file:group+'/'+file,issues:result.issues,info:result.info});
}
await fs.writeFile(path.join(root,'art/reviews/gltf-validation.json'),JSON.stringify(results,null,2));console.log(results.map(r=>({file:r.file,errors:r.issues.numErrors,warnings:r.issues.numWarnings,codes:[...new Set(r.issues.messages.map(m=>m.code))]})));
if(results.some(r=>r.issues.numErrors))process.exitCode=1;
