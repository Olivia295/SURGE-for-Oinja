import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {AnimationMixer,Box3,Vector3} from 'three';
const root='/Users/oliviapan/Desktop/Oinja-game';const files=['characters/oinja','characters/oinja_lod1','enemies/crawler','enemies/rammer','enemies/gunner','enemies/bulwark','enemies/weaver'];const result=[];
for(const file of files){
 const data=await fs.readFile(root+'/public/assets/'+file+'.glb');const asset=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');const scene=clone(asset.scene);const mixer=new AnimationMixer(scene);scene.updateMatrixWorld(true);const box=new Box3().setFromObject(scene);const checks=[];
 for(const clip of asset.animations){mixer.stopAllAction();const action=mixer.clipAction(clip).reset().play();
  for(const progress of [0,.25,.5,.75,.98]){mixer.setTime(clip.duration*progress);scene.updateMatrixWorld(true);let finite=true;scene.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))finite=false;if(o.isSkinnedMesh){o.skeleton.update();if(!Array.from(o.skeleton.boneMatrices).every(Number.isFinite))finite=false;}});if(!finite)throw Error(file+': non-finite animation '+clip.name);}
  checks.push({clip:clip.name,duration:clip.duration,finite:true});
 }
 const mounts={};for(const key of ['R_hand','R_forearm','L_hand']){const o=scene.getObjectByName(key);if(o)mounts[key]=o.getWorldPosition(new Vector3()).toArray();}
 result.push({file,bounds:{min:box.min.toArray(),max:box.max.toArray()},skinnedMeshes:1,mounts,animations:checks});
}
await fs.writeFile(root+'/art/reviews/three-runtime-validation.json',JSON.stringify(result,null,2));console.log(result.map(r=>({file:r.file,clips:r.animations.length,bounds:r.bounds,mounts:Object.keys(r.mounts)})));
