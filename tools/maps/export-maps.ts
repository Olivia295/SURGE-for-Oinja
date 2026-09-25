/** Rebuild original harbor GLBs and check that authored navigation joins all six zones. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildMap } from '../../src/world/maps';
import type { MapId, Vec3 } from '../../src/world/types';

// GLTFExporter's browser-style blob reader, adapted to Node without remote dependencies.
class BlobReader {
  result: ArrayBuffer | string | null=null;
  onloadend:(()=>void)|null=null;
  async readAsArrayBuffer(blob:Blob) {this.result=await blob.arrayBuffer();this.onloadend?.();}
  async readAsDataURL(blob:Blob) {const bytes=Buffer.from(await blob.arrayBuffer());this.result=`data:${blob.type};base64,${bytes.toString('base64')}`;this.onloadend?.();}
}
(globalThis as any).FileReader=BlobReader;
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(project,'public/assets/environment');
await fs.mkdir(output,{recursive:true});
const records:any[]=[];
for(const id of ['old-harbor','new-harbor'] as MapId[]) {
  const start=performance.now(),world=buildMap(id);
  let meshes=0,triangles=0,vertices=0;
  const materials=new Set<THREE.Material>();
  world.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;vertices+=o.geometry.attributes.position.count;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
  const zones=world.zones.map(z=>({id:z.id,name:z.name,walkable:world.walkableAt(z.center[0],z.center[2],z.center[1]),pathNodes:world.findPath(world.spawn.toArray() as Vec3,z.center).length}));
  const failed=zones.filter(z=>!z.walkable||!z.pathNodes);
  if(failed.length)throw new Error(`${id} disconnected/unwalkable zones: ${JSON.stringify(failed)}`);
  // Every named upper entrance must connect to ground without a grapple.
  const rampPaths=[[-58,0,-18],[168,0,-18],[-10,0,148]].map(p=>world.findPath(p as Vec3,[43,8,-18]).length);
  if(rampPaths.some(n=>n===0))throw new Error(`${id} upper deck inaccessible: ${rampPaths}`);
  const raw=await new GLTFExporter().parseAsync(world.group,{binary:true,onlyVisible:true,trs:false}) as ArrayBuffer;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const doc=await io.readBinary(new Uint8Array(raw));
  await doc.transform(dedup(),weld(),prune({keepAttributes:true}));
  const binary=await io.writeBinary(doc);
  const file=path.join(output,`${id}.glb`);await fs.writeFile(file,Buffer.from(binary));
  const record={id,file:`assets/environment/${id}.glb`,format:'glTF 2.0',bytes:binary.byteLength,sha256:createHash('sha256').update(Buffer.from(binary)).digest('hex'),triangles,vertices,meshes,materials:materials.size,colliders:world.colliders.length,navigationNodes:world.nav.waypoints.length,navigationEdges:world.nav.edges.length,zones,rampPaths,bounds:world.bounds,generationMilliseconds:Math.round(performance.now()-start),status:'generated; navigation graph verified; browser visual verification pending',source:'src/world/modeling.ts + src/world/maps.ts',license:'Original project-authored asset',coordinateSystem:'metres; Y up'};
  records.push(record);console.log(JSON.stringify(record,null,2));world.dispose();
}
const textureRecords=[];for(const name of ['brick','concrete','asphalt','rust','wood']){const data=await fs.readFile(path.join(output,`${name}.png`));textureRecords.push({id:name,file:`assets/environment/${name}.png`,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex'),source:'tools/maps/generate-textures.py',license:'Original project-authored seamless texture',dimensions:[512,512]});}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:1,generated:new Date().toISOString(),assets:records,textures:textureRecords},null,2));
await fs.writeFile(path.join(project,'art/source/environment/README.md'),`# Original harbor environments\n\nThe editable authoring sources are [modeling.ts](../../../src/world/modeling.ts) and [maps.ts](../../../src/world/maps.ts). All building kits, hulls, fixtures and layouts were authored specifically for this project. No third-party models or textures are used. Five original seamless 512px textures are produced by \`tools/maps/generate-textures.py\` using only the Python standard library.\n\nRegenerate the glTF 2.0 shipping assets with:\n\n\`\`\`sh\nnpx tsx tools/maps/export-maps.ts\n\`\`\`\n\nRuntime assets are in \`public/assets/environment\`. Materials and static geometry are batched by region; transform pivots for gates and rotors remain separate. Collider proxies, floor levels, accessible ramps, grapple anchors and the navigation graph are authored beside the visuals. Dynamic lighting is supplied by the game renderer; environment lamps use emissive materials without expensive point-light arrays. No lightmaps are required; small original surface textures are loaded once per map and repeated at metre-scaled UVs.\n\nThe six-region graph is checked on each export, including three ordinary ramp entrances to the upper route. Visual review, physics traversal and full gameplay must still be assessed in the actual browser renderer.\n`);
