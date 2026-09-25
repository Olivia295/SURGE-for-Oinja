import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Drone} from './types';

type Kind=Drone['kind'];
type Part='shell'|'dark'|'trim'|'gold'|'light'|'glass';
/** Original mechanical support silhouettes; geometry is shared by all instances. */
export class MachineLibrary{
 readonly templates=new Map<Kind,THREE.Group>();
 private geometries=new Set<THREE.BufferGeometry>();
 private materials=new Set<THREE.Material>();
 constructor(){for(const kind of ['drone','titan','medic','prism'] as Kind[])this.templates.set(kind,this.build(kind));}
 create(kind:Kind){return this.templates.get(kind)!.clone(true);}
 private build(kind:Kind){
  const root=new THREE.Group();root.name='surge-support-'+kind;
  const accent=kind==='medic'?0x7aefc0:kind==='titan'?0xffc879:kind==='prism'?0xd7aaff:0x8fe6ef;
  const mats:Record<Part,THREE.MeshStandardMaterial>={
   shell:new THREE.MeshStandardMaterial({color:kind==='titan'?0x665776:0xe5e3d5,roughness:.52,metalness:.35}),
   dark:new THREE.MeshStandardMaterial({color:0x25313e,roughness:.57,metalness:.62}),
   trim:new THREE.MeshStandardMaterial({color:0x80638f,roughness:.44,metalness:.48}),
   gold:new THREE.MeshStandardMaterial({color:0xc99d64,roughness:.48,metalness:.5}),
   light:new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:1.55,roughness:.28,metalness:.15}),
   glass:new THREE.MeshStandardMaterial({color:0x24425c,emissive:accent,emissiveIntensity:.28,roughness:.22,metalness:.72})};
  Object.values(mats).forEach(m=>this.materials.add(m));
  const buckets=new Map<Part,THREE.BufferGeometry[]>();const matrix=new THREE.Object3D();
  const part=(geo:THREE.BufferGeometry,p:Part,pos:THREE.Vector3Tuple,scale:THREE.Vector3Tuple=[1,1,1],rot:THREE.Vector3Tuple=[0,0,0])=>{
   matrix.position.set(...pos);matrix.scale.set(...scale);matrix.rotation.set(...rot);matrix.updateMatrix();geo.applyMatrix4(matrix.matrix);
   const plain=geo.index?geo.toNonIndexed():geo;if(plain!==geo)geo.dispose();
   const list=buckets.get(p)??[];list.push(plain);buckets.set(p,list);
  };
  const box=(p:Part,x:number,y:number,z:number,w:number,h:number,d:number,rot:THREE.Vector3Tuple=[0,0,0])=>part(new THREE.BoxGeometry(w,h,d),p,[x,y,z],[1,1,1],rot);
  const cylinder=(p:Part,x:number,y:number,z:number,r:number,h:number,rot:THREE.Vector3Tuple=[0,0,0],sides=12)=>part(new THREE.CylinderGeometry(r,r,h,sides),p,[x,y,z],[1,1,1],rot);
  const sphere=(p:Part,x:number,y:number,z:number,r:number,scale:THREE.Vector3Tuple=[1,1,1])=>part(new THREE.IcosahedronGeometry(r,1),p,[x,y,z],scale);
  const ring=(p:Part,x:number,y:number,z:number,r:number,t:number,rot:THREE.Vector3Tuple=[Math.PI/2,0,0])=>part(new THREE.TorusGeometry(r,t,6,24),p,[x,y,z],[1,1,1],rot);
  if(kind==='drone'){
   // Twin ducted fans, faceted armoured fuselage, forward optic and ventral emitter.
   sphere('shell',0,0,0,.48,[.82,.54,1.32]);box('dark',0,-.13,.03,.48,.2,.66);
   box('trim',0,.17,.04,.16,.1,.72);box('light',0,.16,-.24,.05,.025,.35);
   for(const side of [-1,1]){
    box('gold',side*.47,-.015,0,.6,.09,.13);ring('shell',side*.69,0,0,.31,.065);ring('dark',side*.69,-.015,0,.245,.04);
    cylinder('dark',side*.69,-.055,0,.11,.18);cylinder('light',side*.69,-.15,0,.065,.04);
    for(let j=0;j<4;j++)box('trim',side*.69,-.015,0,.45,.028,.043,[0,j*Math.PI/4,0]);
    box('shell',side*.21,.02,.45,.22,.09,.39,[.16,0,side*.18]);
   }
   cylinder('gold',0,-.12,-.48,.14,.1,[Math.PI/2,0,0]);cylinder('light',0,-.12,-.545,.095,.035,[Math.PI/2,0,0]);
   cylinder('dark',0,-.27,-.08,.13,.23);cylinder('light',0,-.4,-.08,.085,.06);
   box('gold',.14,.37,.22,.025,.35,.025);sphere('light',.14,.57,.22,.045);
  }else if(kind==='titan'){
   // Broad planted biped; a central reactor and two heavy industrial gauntlets.
   for(const side of [-1,1]){
    box('dark',side*.5,.19,-.13,.55,.34,.94);box('gold',side*.5,.24,-.5,.51,.11,.16);
    cylinder('trim',side*.5,.75,.1,.23,.93);box('shell',side*.5,.72,-.15,.43,.67,.34);
    cylinder('gold',side*.5,1.16,0,.22,.23,[0,0,Math.PI/2]);box('dark',side*.5,1.41,.06,.3,.35,.3);
    box('shell',side*1.01,2.21,.01,.61,.5,.66,[0,0,side*.12]);cylinder('gold',side*.84,2.04,.02,.2,.5,[0,0,Math.PI/2]);
    box('dark',side*1.13,1.78,-.02,.3,.51,.31,[0,0,side*.12]);box('shell',side*1.2,1.4,-.13,.64,.65,.7);
    for(let k=0;k<3;k++)box('gold',side*1.2,1.4+(k-1)*.17,-.5,.49,.09,.065);
    box('light',side*1.2,1.69,-.36,.39,.055,.04);box('dark',side*.56,2.23,.38,.18,.66,.4);
   }
   box('dark',0,1.41,.05,.8,.35,.45);sphere('shell',0,1.93,.02,.86,[.95,.75,.57]);
   cylinder('gold',0,2,-.49,.29,.12,[Math.PI/2,0,0],6);cylinder('light',0,2,-.57,.19,.06,[Math.PI/2,0,0],6);
   box('gold',0,2.47,0,.59,.11,.39);box('shell',0,2.64,-.05,.53,.31,.39);box('dark',0,2.66,-.26,.44,.12,.035);box('light',0,2.67,-.285,.3,.046,.025);
   box('trim',0,2.06,.44,.69,.67,.33);cylinder('light',0,2.43,.47,.12,.14);
  }else if(kind==='medic'){
   // White rescue pod surrounded by four petal-shaped stabilisers and a medical cross.
   sphere('shell',0,0,0,.39,[1,.78,1]);ring('gold',0,0,0,.46,.07);cylinder('dark',0,-.25,0,.2,.25);cylinder('light',0,-.41,0,.14,.06);
   for(let i=0;i<4;i++){
    const a=i*Math.PI/2,x=Math.cos(a)*.56,z=Math.sin(a)*.56;
    box('gold',x*.65,-.02,z*.65,.45,.065,.065,[0,-a,0]);sphere('shell',x,0,z,.23,[1.15,.5,.8]);sphere('light',x,-.045,z,.1,[1,.3,1]);
   }
   box('trim',0,.29,0,.34,.035,.34);box('light',0,.318,0,.28,.02,.08);box('light',0,.32,0,.08,.02,.28);
   ring('light',0,-.08,0,.69,.018);box('gold',.2,.38,.14,.025,.25,.025);
  }else{
   // An elongated crystal enclosed in a mechanical three-spoke gyroscope.
   part(new THREE.OctahedronGeometry(.46,0),'light',[0,0,0],[.62,1.4,.62]);
   cylinder('dark',0,-.64,0,.21,.16,undefined,6);cylinder('gold',0,.63,0,.16,.11,undefined,6);
   ring('shell',0,0,0,.63,.048,[.25,0,.4]);ring('gold',0,0,0,.65,.027,[Math.PI/2,0,.45]);
   for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,x=Math.cos(a)*.64,z=Math.sin(a)*.64;
    sphere('dark',x,0,z,.15);sphere('light',x,-.02,z,.075);box('gold',x*.72,-.28,z*.72,.055,.42,.055,[0,0,-x*.6]);
   }
  }
  for(const [name,parts] of buckets){const geometry=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());geometry.computeBoundingSphere();this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,mats[name]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  return root;
 }
 dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.templates.clear();}
}
