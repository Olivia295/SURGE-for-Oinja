/** Original parametric harbor kit. Metres, Y up; authored for Oinja: Thunder Circuit. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Surface, Vec3, WorldCollider } from './types';

type MaterialName = 'concrete' | 'paving' | 'asphalt' | 'dark' | 'steel' | 'lightSteel' | 'rust' | 'brick' | 'brickLight' | 'wood' | 'orange' | 'yellow' | 'white' | 'glass' | 'cyan' | 'water' | 'foam' | 'green' | 'blue' | 'red' | 'roof' | 'gravel';
const PALETTE: Record<MaterialName, [number,number,number]> = {
  concrete:[0x8d9694,.91,.02],paving:[0x697576,.94,.02],asphalt:[0x354647,.97,.01],dark:[0x192b31,.72,.32],
  steel:[0x395b62,.49,.57],lightSteel:[0xb9cfce,.45,.45],rust:[0xa96344,.88,.3],brick:[0x995943,.91,.01],
  brickLight:[0xbe8666,.9,.02],wood:[0x957655,.92,.01],orange:[0xdb8943,.61,.2],yellow:[0xecc76b,.61,.1],
  white:[0xe1e4d9,.73,.05],glass:[0x5c999f,.21,.55],cyan:[0x62d2d3,.46,.2],water:[0x2b6577,.31,.51],
  foam:[0x75a0a5,.58,.02],green:[0x56796c,.67,.35],blue:[0x38677f,.64,.35],red:[0x9f5650,.72,.31],
  roof:[0x34494a,.72,.42],gravel:[0x666d67,.96,.01],
};
const temp = new THREE.Object3D();
const unitBox = new THREE.BoxGeometry(1,1,1);
const unitCylinder = new THREE.CylinderGeometry(1,1,1,10);
const unitRound = new THREE.CylinderGeometry(1,1,1,24);
const buckets = (group: THREE.Group) => {
  const storage = new Map<string,{mat:THREE.Material; geoms:THREE.BufferGeometry[]}>();
  return {
    add(key: string, mat: THREE.Material, geometry:THREE.BufferGeometry) {
      let b=storage.get(key); if(!b) { b={mat,geoms:[]}; storage.set(key,b); }
      if(geometry.index){const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;}
      b.geoms.push(geometry);
    },
    finish() {
      for(const [key,b] of storage) {
        if(!b.geoms.length) continue;
        const geometry=mergeGeometries(b.geoms,false)!;
        geometry.computeBoundingSphere();
        const textured=['brick','brickLight','concrete','paving','asphalt','rust','wood'].some(m=>key.endsWith('-'+m));
        if(textured){const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');const uv=geometry.getAttribute('uv');
          const tile=key.endsWith('brick')||key.endsWith('brickLight')?4:8;
          for(let i=0;i<positions.count;i++){const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
            uv.setXY(i,(nx>nz?positions.getZ(i):positions.getX(i))/tile,(ny>Math.max(nx,nz)?positions.getZ(i):positions.getY(i))/tile);}
        }
        const mesh=new THREE.Mesh(geometry,b.mat);mesh.name=key;
        mesh.castShadow=!key.includes('ground')&&!key.includes('water')&&!key.includes('paint');
        mesh.receiveShadow=true;mesh.userData.environment=true;
        if(key.includes('roof')) mesh.userData.cameraFade=true;
        group.add(mesh);for(const g of b.geoms) g.dispose();
      }
      storage.clear();
    }
  };
};

export class HarborKit {
  root = new THREE.Group();
  colliders: WorldCollider[]=[];
  surfaces: Surface[]=[];
  materials: Record<MaterialName, THREE.MeshStandardMaterial>;
  dynamic: THREE.Object3D[]=[];
  current: THREE.Group;
  private collectors = new Map<THREE.Group,ReturnType<typeof buckets>>();
  private serial=0;
  constructor(public modern: boolean) {
    this.root.name=modern?'霁电新港':'潮锈旧港';
    this.materials=Object.fromEntries(Object.entries(PALETTE).map(([name,[color,roughness,metalness]])=>[
      name,new THREE.MeshStandardMaterial({name:`harbor-${name}`,color,roughness,metalness})
    ])) as typeof this.materials;
    this.materials.cyan.emissive.setHex(0x379b9c);this.materials.cyan.emissiveIntensity=.65;
    this.materials.yellow.emissive.setHex(0x5b3613);this.materials.yellow.emissiveIntensity=.2;
    if(modern) {this.materials.concrete.color.setHex(0xb0bab9);this.materials.paving.color.setHex(0x7d9095);this.materials.asphalt.color.setHex(0x455a64);this.materials.roof.color.setHex(0x597d87);}
    this.current=this.root;this.collectors.set(this.root,buckets(this.root));
  }
  zone(name:string) {this.current=new THREE.Group();this.current.name=name;this.root.add(this.current);this.collectors.set(this.current,buckets(this.current));}
  use(group:THREE.Group) {this.current=group;if(!this.collectors.has(group)) this.collectors.set(group,buckets(group));}
  private add(geometry:THREE.BufferGeometry,position:Vec3,size:Vec3,mat:MaterialName,rotation:Vec3=[0,0,0],kind='detail') {
    temp.position.set(...position);temp.rotation.set(...rotation);temp.scale.set(...size);temp.updateMatrix();
    const clone=geometry.clone().applyMatrix4(temp.matrix);
    this.collectors.get(this.current)!.add(`${kind}-${mat}`,this.materials[mat],clone);
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,mat:MaterialName,rotation:Vec3=[0,0,0],kind='detail') {this.add(unitBox,[x,y,z],[w,h,d],mat,rotation,kind);}
  cylinder(x:number,y:number,z:number,r:number,h:number,mat:MaterialName,rotation:Vec3=[0,0,0],fine=false) {this.add(fine?unitRound:unitCylinder,[x,y,z],[r,h,r],mat,rotation);}
  beam(a:Vec3,b:Vec3,width:number,depth:number,mat:MaterialName) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.sub(start);temp.position.copy(start).addScaledVector(dir,.5);
    temp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());temp.scale.set(width,dir.length(),depth);temp.updateMatrix();
    this.collectors.get(this.current)!.add(`detail-${mat}`,this.materials[mat],unitBox.clone().applyMatrix4(temp.matrix));
  }
  hull(points:THREE.Vector2[],depth:number,position:Vec3,mat:MaterialName,rotation:Vec3=[0,0,0]) {
    const shape=new THREE.Shape(points);const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.6,bevelSize:.5,bevelSegments:1,steps:1});
    this.add(g,position,[1,1,1],mat,rotation);g.dispose();
  }
  collider(x:number,y:number,z:number,w:number,h:number,d:number,tag:WorldCollider['tag']='solid',rotation?:Vec3,id?:string) {
    const c:WorldCollider={id:id??`world-${++this.serial}`,center:[x,y,z],half:[w/2,h/2,d/2],tag};if(rotation)c.rotation=rotation;this.colliders.push(c);return c;
  }
  solid(x:number,y:number,z:number,w:number,h:number,d:number,mat:MaterialName,rotation:Vec3=[0,0,0]) {this.box(x,y,z,w,h,d,mat,rotation);this.collider(x,y,z,w,h,d,'solid',rotation);}
  floor(x:number,z:number,w:number,d:number,y=0,mat:MaterialName='concrete') {
    this.box(x,y-.35,z,w,.7,d,mat,[0,0,0],'ground');this.collider(x,y-.35,z,w,.7,d,'ground');
    this.surfaces.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,y,tag:'ground'});
  }
  bridge(x:number,z:number,w:number,d:number,y=8,mat:MaterialName='steel') {
    this.box(x,y-.3,z,w,.6,d,mat,[0,0,0],'bridge');this.collider(x,y-.3,z,w,.6,d,'bridge');
    this.surfaces.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,y,tag:'bridge'});
  }
  ramp(a:Vec3,b:Vec3,width:number,mat:MaterialName='concrete') {
    const dx=b[0]-a[0],dz=b[2]-a[2],dy=b[1]-a[1],length=Math.hypot(dx,dz),slope=Math.atan2(dy,length);
    const axis=Math.abs(dx)>Math.abs(dz)?'x':'z';
    const rot:Vec3=axis==='x'?[0,0,dx<0?-slope:slope]:[dz<0?slope:-slope,0,0];
    const size:Vec3=axis==='x'?[Math.hypot(length,dy),.65,width]:[width,.65,Math.hypot(length,dy)];
    const center:Vec3=[(a[0]+b[0])/2,(a[1]+b[1])/2-.3,(a[2]+b[2])/2];
    this.box(...center,...size,mat,rot,'ramp');this.collider(...center,...size,'ramp',rot);
    const start=axis==='x'?Math.min(a[0],b[0]):Math.min(a[2],b[2]);
    const ascending=(axis==='x'?a[0]:a[2])===start;
    this.surfaces.push({minX:Math.min(a[0],b[0])-(axis==='z'?width/2:0),maxX:Math.max(a[0],b[0])+(axis==='z'?width/2:0),minZ:Math.min(a[2],b[2])-(axis==='x'?width/2:0),maxZ:Math.max(a[2],b[2])+(axis==='x'?width/2:0),y:ascending?a[1]:b[1],endY:ascending?b[1]:a[1],axis,tag:'ramp'});
    for(const offset of [-width/2+.18,width/2-.18]) {
      const p1:Vec3=[a[0]+(axis==='z'?offset:0),a[1]+1.15,a[2]+(axis==='x'?offset:0)];
      const p2:Vec3=[b[0]+(axis==='z'?offset:0),b[1]+1.15,b[2]+(axis==='x'?offset:0)];
      this.beam(p1,p2,.12,.12,'yellow');
      for(let t=0;t<=1;t+=1/8) {const x=p1[0]+(p2[0]-p1[0])*t,z=p1[2]+(p2[2]-p1[2])*t,y=a[1]+dy*t;this.box(x,y+.55,z,.16,1.1,.16,'steel');}
    }
  }
  rail(a:Vec3,b:Vec3,solid=true,mat:MaterialName='steel') {
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),count=Math.ceil(length/3);
    this.beam([a[0],a[1]+1.1,a[2]],[b[0],b[1]+1.1,b[2]],.1,.1,mat);
    this.beam([a[0],a[1]+.48,a[2]],[b[0],b[1]+.48,b[2]],.07,.07,mat);
    for(let i=0;i<=count;i++) {const t=i/count;this.box(a[0]+dx*t,a[1]+.56,a[2]+dz*t,.1,1.12,.1,mat);}
    if(solid) this.collider((a[0]+b[0])/2,a[1]+.55,(a[2]+b[2])/2,Math.max(Math.abs(dx),.15),1.1,Math.max(Math.abs(dz),.15));
  }
  paint(x:number,z:number,w:number,d:number,mat:MaterialName='white',y=.028,angle=0) {this.box(x,y,z,w,.025,d,mat,[0,angle,0],'paint');}
  hazard(x:number,z:number,width:number,depth:number,y=.04,angle=0) {
    const s=Math.max(.7,width/16);for(let n=0;n<width/s;n++){const dx=(n+.5)*s-width/2;this.paint(x+dx*Math.cos(angle),z-dx*Math.sin(angle),s*.83,depth,n%2?'dark':'yellow',y,angle);}
  }
  road(a:Vec3,b:Vec3,width=14) {
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    this.paint((a[0]+b[0])/2,(a[2]+b[2])/2,width,length,'asphalt',.015,angle);
    for(const side of [-1,1]) this.paint((a[0]+b[0])/2+Math.cos(angle)*(width/2-.65)*side,(a[2]+b[2])/2-Math.sin(angle)*(width/2-.65)*side,.18,length,'white',.035,angle);
    for(let t=6;t<length-3;t+=10)this.paint(a[0]+dx*t/length,a[2]+dz*t/length,.15,4,'yellow',.042,angle);
  }
  crate(x:number,z:number,size=2.1,y=0) {
    this.solid(x,y+size/2,z,size,size,size,'wood');
    for(const side of [-1,1]) {this.box(x+side*size*.43,y+size/2,z,.12,size,.15,'dark');this.box(x,y+size/2,z+side*size*.49,size,.16,.07,'dark');}
    this.beam([x-size*.45,y+.14,z-size*.51],[x+size*.45,y+size-.14,z-size*.51],.14,.09,'brickLight');
  }
  barrel(x:number,z:number,y=0,mat:MaterialName='orange') {
    this.cylinder(x,y+.55,z,.4,1.1,mat);for(const h of [.2,.87])this.cylinder(x,y+h,z,.425,.055,'dark');
  }
  bollard(x:number,z:number) {this.cylinder(x,.36,z,.27,.7,'dark');this.cylinder(x,.65,z,.39,.14,'steel');}
  light(x:number,z:number,h=8,direction=1) {
    this.cylinder(x,h/2,z,.11,h,'dark');this.box(x+direction*.7,h-.15,z,1.6,.14,.13,'steel');this.box(x+direction*1.35,h-.24,z,.55,.16,.8,'yellow');
    this.box(x,.4,z,.38,.8,.38,'concrete');
    // Visible emissive fixture, no per-lamp dynamic point light.
  }
  sign(x:number,y:number,z:number,w:number,modern:boolean,number=1,rotation=0) {
    this.box(x,y,z,w,1.6,.17,modern?'dark':'green',[0,rotation,0]);
    this.box(x,y-.45,z+.095,w*.76,.08,.015,'white',[0,rotation,0]);
    for(let i=0;i<number;i++)this.box(x-w*.28+i*.4,y+.12,z+.102,.2,.55,.025,'yellow',[0,rotation,0]);
  }
  container(x:number,z:number,mat:MaterialName='red',y=0,length=12,rotation=0) {
    const group=new THREE.Group();group.name='corrugated-freight-container';const previous=this.current;this.root.add(group);this.use(group);
    this.box(0,y+1.45,0,length,2.9,2.6,mat);
    this.box(0,y+.08,0,length+.06,.16,2.68,'dark');this.box(0,y+2.82,0,length+.06,.16,2.68,'lightSteel');
    for(let xx=-length/2+.22;xx<length/2;xx+=.6)for(const side of [-1,1])this.box(xx,y+1.5,side*1.315,.1,2.52,.06,mat);
    for(const end of [-1,1])for(const zz of [-.55,.55]){this.box(end*(length/2+.045),y+1.46,zz,.05,2.5,.06,'lightSteel');this.box(end*(length/2+.07),y+1.1,zz,.08,.1,.38,'dark');}
    this.sign(0,y+1.5,1.36,2.1,this.modern,2);
    this.collectors.get(group)!.finish();this.collectors.delete(group);
    // Flatten container geometry into zone batches, retaining source component name in metadata.
    group.position.set(x,0,z);group.rotation.y=rotation;group.updateMatrix();
    for(const child of group.children){const m=child as THREE.Mesh;const key=`detail-${(m.material as THREE.Material).name.replace('harbor-','')}`;this.collectors.get(previous)!.add(key,m.material as THREE.Material,m.geometry.clone().applyMatrix4(group.matrix));m.geometry.dispose();}
    this.root.remove(group);this.current=previous;
    this.collider(x,y+1.45,z,length,2.9,2.6,'solid',[0,rotation,0]);
  }
  warehouse(x:number,z:number,w=58,d=48) {
    const wall=1.1,h=12,door=11;
    for(const side of [-1,1]) {
      const zz=z+side*d/2;for(const flank of [-1,1])this.solid(x+flank*(w+door)/4,h/2,zz,(w-door)/2,h,wall,'brick');
      this.solid(x,10.8,zz,door,2.4,wall,'brick');
      // Deep concrete portico frames and inset shutter guides.
      for(const xx of [-door/2,door/2])this.box(x+xx,5,zz+side*.7,.5,10,1.2,'concrete');
      this.box(x,10.15,zz+side*.8,door+1,.6,1.7,'steel');
      this.hazard(x,zz+side*1.4,door+1,.65);
      this.sign(x,11.25,zz+side*.65,6,false,side>0?3:2);
    }
    // Side doors interrupt the load-bearing brick panels.
    for(const side of [-1,1]) {
      const xx=x+side*w/2;for(const flank of [-1,1])this.solid(xx,6,z+flank*(d+10)/4,wall,12,(d-10)/2,'brick');
      this.solid(xx,10.7,z,wall,2.6,10,'brick');
      for(let zz=z-d/2+3;zz<z+d/2;zz+=6){this.box(xx+side*.12,6,zz,1.5,12,.6,'brickLight');this.box(xx+side*.76,8.7,zz,.07,2.2,3.1,'glass');}
    }
    // Sawtooth roof: five northlight bays, secondary beams, gutters.
    const bays=5,bay=d/bays;
    for(let i=0;i<bays;i++) {
      const zz=z-d/2+bay*(i+.5);
      this.box(x,12.8,zz,w+2,.36,bay+1,'roof',[.13,0,0],'roof');
      this.box(x,13.25,zz-bay*.48,w,.9,.12,'glass',[0,0,0],'roof');
      for(const xx of [-w*.35,0,w*.35])this.box(x+xx,12,zz,.3,.45,bay,'steel');
    }
    for(const xx of [-w/2,w/2])this.box(x+xx,12,z,.45,.4,d+3,'rust');
    // Passable interior aisles and stocked shelves flank the central hall.
    for(const side of [-1,1])for(const zz of [-d*.24,d*.24]) {
      const cx=x+side*w*.31,cz=z+zz;this.collider(cx,2,cz,7,4,8);
      for(const a of [-3.4,3.4])for(const b of [-3.8,3.8])this.box(cx+a,2.1,cz+b,.16,4.2,.16,'steel');
      for(const y of [.2,2.1,4]){this.box(cx,y,cz,7,.18,8,'wood');for(let q=0;q<3;q++)this.box(cx-2+q*2,y+.75,cz,1.55,1.4,5.5,q%2?'brickLight':'wood');}
    }
    // High loading galleries never cross the central circulation aisle.
    for(const side of [-1,1]) {this.box(x+side*(w/2-4),6,z,7,.3,d-4,'steel');this.rail([x+side*(w/2-8),6,z-d/2+2],[x+side*(w/2-8),6,z+d/2-2],false);}
    for(const side of [-1,1])this.light(x+side*(door/2+2),z+d/2+1,7,-side);
  }
  hall(x:number,z:number,w=72,d=50) {
    const h=16;
    for(const side of [-1,1])for(let zz=z-d/2;zz<=z+d/2;zz+=d/4) {
      this.solid(x+side*w/2,h/2,zz,1.3,h,1.8,'concrete');
      if(zz<z+d/2) {this.box(x+side*w/2,12,zz+d/8,.3,6,d/4-1.5,'glass');this.box(x+side*w/2,3,zz+d/8,.6,6,d/4-1.5,'lightSteel');this.collider(x+side*w/2,3,zz+d/8,.6,6,d/4-1.5);}
    }
    // Open end facades have two clear vehicle portals and a broad central entrance.
    for(const side of [-1,1]) {
      const zz=z+side*d/2;this.box(x,13.8,zz,w,4.4,.6,'lightSteel');this.box(x,13.9,zz+side*.4,w*.73,2.5,.08,'glass');
      for(const dx of [-w/2,-w*.25,w*.25,w/2])this.solid(x+dx,7,zz,1.3,14,1.6,'concrete');
      this.box(x,16.4,zz,w+2,.4,3,'white',[0,0,0],'roof');this.hazard(x,zz+side*1.3,w-3,.6);
      this.sign(x,11.5,zz+side*.5,8,true,3);
    }
    // Butterfly roof panels and exposed roof trusses are visibly distinct from old brick warehouses.
    for(const side of [-1,1]) {
      this.box(x+side*w/4,16.6,z,w/2+2,.42,d+4,'white',[0,0,side*-.055],'roof');
      for(let zz=z-d/2;zz<=z+d/2;zz+=10)this.beam([x,15.4,zz],[x+side*w/2,17.2,zz],.25,.28,'steel');
    }
    for(const side of [-1,1])for(const dz of [-d*.22,d*.22]) {
      const xx=x+side*w*.32,zz=z+dz;
      this.solid(xx,1,zz,9,2,8,'lightSteel');this.box(xx,2.05,zz,9,.1,8,'cyan');
      for(let n=-3;n<=3;n+=1.5)this.cylinder(xx+n,2.2,zz,.12,7.7,'steel',[Math.PI/2,0,0]);
      for(const a of [-5.5,5.5])this.box(xx+a,2,zz,.18,4,.18,'orange');
    }
    this.box(x,15.6,z,w*.94,.22,.5,'cyan');
  }
  gantry(x:number,z:number,width=28,height=24,modern=this.modern) {
    const mat:MaterialName=modern?'white':'orange';
    for(const side of [-1,1]) {
      const xx=x+side*width/2;this.solid(xx,height/2,z,1.3,height,3,mat);
      this.box(xx,.4,z,3,.8,8,'dark');for(const dz of [-2.4,2.4])this.cylinder(xx,.5,z+dz,.75,3.2,'steel',[0,0,Math.PI/2]);
      this.beam([xx,2,z-3],[xx,height-1,z],.5,.5,mat);this.beam([xx,2,z+3],[xx,height-1,z],.5,.5,mat);
    }
    this.box(x,height,z,width+4,2.8,2.1,mat);this.box(x,height-.4,z+1.2,width+4,.55,.15,'dark');
    for(let xx=x-width/2;xx<x+width/2;xx+=4)this.beam([xx,height-1.1,z+1.14],[xx+4,height+1.1,z+1.14],.15,.15,'steel');
    this.box(x+width*.2,height-1.8,z+2.1,4,3,3,'dark');this.box(x+width*.2,height-1.5,z+3.65,3.4,1.7,.1,'glass');
    for(const dx of [-1.5,1.5])this.beam([x+dx,height-1,z],[x+dx,7,z],.06,.06,'dark');
    this.box(x,7,z,5,.5,3.5,'orange');this.box(x,6.65,z,4,.15,3,'yellow');
  }
  crane(x:number,z:number,angle=0) {
    // Rotating dock crane is built as a distinct tower-and-jib silhouette.
    this.solid(x,2,z,8,4,8,'concrete');
    for(const dx of [-2.5,2.5])for(const dz of [-2.5,2.5])this.box(x+dx,15,z+dz,.55,26,.55,'rust');
    for(let y=4;y<28;y+=5)for(const side of [-1,1]){this.beam([x-2.5,y,z+side*2.5],[x+2.5,y+5,z+side*2.5],.22,.22,'orange');this.beam([x+side*2.5,y,z-2.5],[x+side*2.5,y+5,z+2.5],.22,.22,'orange');}
    this.box(x,28,z,7,2,7,'orange');this.box(x,30,z,4,3.4,4,'steel');this.box(x,30,z+2.06,3.5,2,.1,'glass');
    const dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
    const end:[number,number,number]=[x+dir.x*37,38,z+dir.z*37];
    for(const o of [-1,1])this.beam([x+o*1.1,30,z],[end[0]+o*.5,end[1],end[2]],.45,.45,'orange');
    this.beam([x,34,z],[end[0],end[1]+3,end[2]],.14,.14,'dark');
    for(let i=0;i<8;i++){const t=i/8,t2=(i+1)/8;this.beam([x+dir.x*37*t,30+8*t,z+dir.z*37*t],[x+dir.x*37*t2,33+8*t2,z+dir.z*37*t2],.2,.2,'rust');}
    this.beam(end,[end[0],6,end[2]],.08,.08,'dark');this.box(end[0],5.5,end[2],2,1,1.5,'yellow');
  }
  ship(x:number,z:number,length=53,y=-3.2,modern=false) {
    const points=[new THREE.Vector2(-length/2+6,-6),new THREE.Vector2(length/2-6,-6),new THREE.Vector2(length/2,0),new THREE.Vector2(length/2-6,6),new THREE.Vector2(-length/2+4,6),new THREE.Vector2(-length/2,-3)];
    this.hull(points,4,[x,y,z],modern?'dark':'rust',[-Math.PI/2,0,0]);
    this.collider(x,y+2,z,length-8,4,12);
    this.box(x,y+4.2,z,length-12,.7,10,'paving');
    this.solid(x-length*.23,y+7,z,9,5,8,modern?'white':'brickLight');this.box(x-length*.23,y+9.5,z,10,.55,9,'dark');
    for(let n=-3;n<=3;n+=2)this.box(x-length*.23+n,y+7.8,z+4.06,1.3,1.5,.08,'glass');
    this.cylinder(x-length*.27,y+12,z,1,5,'dark');this.cylinder(x+length*.12,y+11,z,.12,14,'steel');
    this.beam([x+length*.12,y+15,z],[x+length*.12,y+15,z+7],.12,.12,'steel');
    for(let dx=-length/2+7;dx<length/2-7;dx+=5){this.box(x+dx,y+5,z-5,.09,1.5,.09,'steel');this.box(x+dx,y+5,z+5,.09,1.5,.09,'steel');}
    for(const side of [-1,1])this.beam([x-length/2+7,y+5.7,z+side*5],[x+length/2-7,y+5.7,z+side*5],.08,.08,'steel');
  }
  utility(x:number,z:number,w=22,d=17,modern=this.modern) {
    const h=modern?7.8:6.2,mat:MaterialName=modern?'white':'brick';
    // Two opposing, legible doors; passages are really open.
    for(const side of [-1,1]){this.solid(x+side*w/2,h/2,z,.7,h,d,mat);for(const flank of [-1,1])this.solid(x+flank*(w+4)/4,h/2,z+side*d/2,(w-4)/2,h,.7,mat);this.solid(x,h-1,z+side*d/2,4,2,.7,mat);}
    this.box(x,h+.18,z,w+1,.36,d+1,modern?'lightSteel':'roof',[0,0,0],'roof');
    for(const side of [-1,1])this.box(x+side*w*.27,h*.55,z+d/2+.4,3,2,.08,'glass');
    this.sign(x,h-.5,z+d/2+.45,4.5,modern,2);this.box(x,h+1,z,4,1.5,3,'steel');
    for(const side of [-1,1]) {this.box(x+side*(w/2+1),1.6,z,1.3,3.2,4,'dark');for(let y=.5;y<3;y+=.3)this.box(x+side*(w/2+1.69),y,z,.1,.07,3.6,'lightSteel');}
  }
  battery(x:number,z:number,rotation=0) {
    this.solid(x,2.1,z,5,4.2,12,'white',[0,rotation,0]);
    // Each battery enclosure has service panels, spine, vents, amber emergency strip.
    const c=Math.cos(rotation),s=Math.sin(rotation);
    for(let zz=-4.5;zz<=4.5;zz+=3){const xx=x+2.54*c+zz*s,zp=z-2.54*s+zz*c;this.box(xx,2.15,zp,.07,3.1,2.65,'lightSteel',[0,rotation,0]);}
    this.box(x,4.22,z,5.1,.16,12.1,'dark',[0,rotation,0]);this.box(x,4.65,z,2.7,.7,4,'steel',[0,rotation,0]);
    for(const side of [-1,1])this.box(x+side*2.56*c,3.8,z-side*2.56*s,.06,.13,10,'cyan',[0,rotation,0]);
  }
  transformer(x:number,z:number) {
    this.solid(x,1.6,z,4,3.2,4,'steel');this.box(x,3.2,z,4.5,.3,4.5,'dark');
    for(let i=-1;i<=1;i++) {this.cylinder(x+i*1.25,4.2,z,.24,1.8,'lightSteel');for(let yy=3.6;yy<4.9;yy+=.22)this.cylinder(x+i*1.25,yy,z,.37,.1,'dark');}
    for(let zz=-1.5;zz<=1.5;zz+=.35)for(const side of [-1,1])this.box(x+side*2.05,1.6,z+zz,.5,2.7,.13,'lightSteel');
  }
  fence(a:Vec3,b:Vec3) {
    this.rail(a,b,true,'lightSteel');
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);for(let t=0;t<length;t+=.6){const x=a[0]+dx*t/length,z=a[2]+dz*t/length;this.box(x,a[1]+1.2,z,.035,2.4,.035,'steel');}
    this.beam([a[0],a[1]+2.4,a[2]],[b[0],b[1]+2.4,b[2]],.055,.055,'steel');
  }
  pipe(a:Vec3,b:Vec3,r=.24,mat:MaterialName='steel') {
    const start=new THREE.Vector3(...a),dir=new THREE.Vector3(...b).sub(start);temp.position.copy(start).addScaledVector(dir,.5);temp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());temp.scale.set(r,dir.length(),r);temp.updateMatrix();
    this.collectors.get(this.current)!.add(`detail-${mat}`,this.materials[mat],unitCylinder.clone().applyMatrix4(temp.matrix));
  }
  finish() {for(const collector of this.collectors.values())collector.finish();this.collectors.clear();return this.root;}
}
