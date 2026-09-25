import * as THREE from 'three';
import type {Vec} from './types';
const up=new THREE.Vector3(0,1,0);
/** Fixed GPU allocation; alpha and colour are per instance, so fading creates no objects. */
export class RenderPool{
 readonly mesh:THREE.InstancedMesh;
 private alpha:THREE.InstancedBufferAttribute;
 private cursor=0;
 private transform=new THREE.Object3D();
 private color=new THREE.Color();
 private direction=new THREE.Vector3();
 constructor(geometry:THREE.BufferGeometry,capacity:number,options:{additive?:boolean;opacity?:number;depthTest?:boolean}={}){
  const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:options.opacity??1,depthWrite:false,depthTest:options.depthTest??true,side:THREE.DoubleSide,blending:options.additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
  this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);this.alpha.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('instanceAlpha',this.alpha);
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceAlpha;\nvarying float vPoolAlpha;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolAlpha = instanceAlpha;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPoolAlpha;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vPoolAlpha;');
  };
  material.customProgramCacheKey=()=>`surge-pool-alpha-${options.additive?1:0}`;
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.renderOrder=2;
 }
 reset(){this.cursor=0;}
 add(pos:Vec,scale:number|[number,number,number],color:number,alpha=1,rotation:[number,number,number]=[0,0,0]){
  if(this.cursor>=this.mesh.instanceMatrix.count)return;
  this.transform.position.set(pos.x,pos.y,pos.z);this.transform.rotation.set(...rotation);typeof scale==='number'?this.transform.scale.setScalar(scale):this.transform.scale.set(...scale);this.transform.updateMatrix();this.write(color,alpha);
 }
 line(a:Vec,b:Vec,width:number,color:number,alpha=1){
  if(this.cursor>=this.mesh.instanceMatrix.count)return;
  this.direction.set(b.x-a.x,b.y-a.y,b.z-a.z);const length=this.direction.length();if(length<.001)return;
  this.transform.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);this.transform.quaternion.setFromUnitVectors(up,this.direction.multiplyScalar(1/length));this.transform.scale.set(width,length,width);this.transform.updateMatrix();this.write(color,alpha);
 }
 private write(color:number,alpha:number){const i=this.cursor++;this.mesh.setMatrixAt(i,this.transform.matrix);this.mesh.setColorAt(i,this.color.setHex(color));this.alpha.setX(i,Math.max(0,Math.min(1,alpha)));}
 finish(){this.mesh.count=this.cursor;if(!this.cursor)return;this.mesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();this.mesh.dispose();}
}
