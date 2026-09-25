import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,resample} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='/Users/oliviapan/Desktop/Oinja-game';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const records=[];
for(const group of ['characters','enemies']){
 for(const file of await fs.readdir(path.join(root,'public/assets',group))){
  if(!file.endsWith('.glb'))continue;
  const target=path.join(root,'public/assets',group,file);const before=(await fs.stat(target)).size;
  const doc=await io.read(target);await doc.transform(dedup(),weld(),prune(),resample());await io.write(target,doc);
  const bytes=await fs.readFile(target);let triangles=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())triangles+=p.getIndices().getCount()/3;
  records.push({id:file.slice(0,-4),path:'assets/'+group+'/'+file,bytes:bytes.length,beforeBytes:before,triangles,animations:doc.getRoot().listAnimations().map(a=>a.getName()),bones:doc.getRoot().listSkins().reduce((n,s)=>n+s.listJoints().length,0),materials:doc.getRoot().listMaterials().length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
}
await fs.writeFile(path.join(root,'art/reviews/runtime-actors.json'),JSON.stringify({coordinateSystem:'meters; Y-up; facing -Z; ground origin',sourceStatus:'New game adaptation, not new approved original canon',optimization:'glTF Transform dedup, weld, prune, resample; portable GLB without decoder requirement',assets:records},null,2));
console.log(JSON.stringify(records,null,2));
