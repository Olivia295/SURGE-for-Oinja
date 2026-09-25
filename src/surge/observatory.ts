/** Original game-only setting, not an extension of Oinja's narrative canon. */
import * as THREE from 'three';
import {HarborKit} from '../world/modeling';
import type {MapWorld,Vec3,WorldCollider} from '../world/types';
import type {EventDefinition,HarborResult} from './types';
import {harborNavigation} from './world-navigation';
type Gate={id:string;object:THREE.Group;collider:WorldCollider;progress:number;open:boolean};
const BOUNDS={minX:-90,maxX:90,minZ:-90,maxZ:90},DECK=5;
const SITES:EventDefinition[]=[
 {id:'obs-forge-home',kind:'forge',title:'迎潮装配台',description:'在前庭组装一套可投入战斗的支援装置。',pos:{x:0,y:0,z:63},reward:'titan'},
 {id:'obs-forge-lab',kind:'forge',title:'光学维修台',description:'保护检修台，完成观测设备的回路校准。',pos:{x:-21,y:0,z:-56},reward:'prism'},
 {id:'obs-relay-array',kind:'relay',title:'天线馈电站',description:'接通天线阵列，同时开启东侧实验廊门。',pos:{x:60,y:0,z:-48},reward:'tempest'},
 {id:'obs-relay-ring',kind:'relay',title:'环廊校准器',description:'恢复高架信号回路，开启温室南侧通道。',pos:{x:-32,y:5,z:-16},reward:'prism'},
 {id:'obs-convoy-greenhouse',kind:'convoy',title:'温室补给车',description:'陪同补给设备穿过温室外的开放庭院。',pos:{x:-54,y:0,z:-25},reward:'medic'},
 {id:'obs-convoy-court',kind:'convoy',title:'庭院储能车',description:'把储能设备安全送过迎潮前庭。',pos:{x:0,y:0,z:43},reward:'titan'},
 {id:'obs-crane-antenna',kind:'crane',title:'反射器吊架',description:'完成观测反射器的重型吊装。',pos:{x:42,y:0,z:-62},reward:'crusher'},
 {id:'obs-crane-water',kind:'crane',title:'水庭闸机',description:'恢复镜水庭院的检修设备。',pos:{x:64,y:0,z:40},reward:'orbital'},
 {id:'obs-conveyor-west',kind:'conveyor',title:'种植分拣台',description:'重启温室的植物与储能物资分拣线。',pos:{x:-62,y:0,z:30},reward:'crusher'},
 {id:'obs-conveyor-east',kind:'conveyor',title:'仪器输送线',description:'让校准仪器沿着实验庭院重新流动起来。',pos:{x:46,y:0,z:8},reward:'tempest'},
 {id:'obs-cache-upper',kind:'cache',title:'高台观测箱',description:'清除守卫，取回高架上的备用观测装置。',pos:{x:31,y:5,z:18},reward:'orbital'},
 {id:'obs-cache-garden',kind:'cache',title:'花园应急柜',description:'回收花园保管的应急支援器材。',pos:{x:-49,y:0,z:61},reward:'medic'},
];
function paving(seed:number){const size=128,data=new Uint8Array(size*size*4);let s=seed>>>0;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){s=(Math.imul(s,1664525)+1013904223)>>>0;const i=(z*size+x)*4,n=x%32<2||z%32<2?140:(x*3+z+Math.floor(z/11))%73<2?184:210+(s>>>28);data[i]=n;data[i+1]=n+2;data[i+2]=n;data[i+3]=255;}
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
function arch(k:HarborKit,x:number,z:number,width=8,height=4.8){
 for(const side of [-1,1]){k.solid(x+side*width/2,height/2,z,.55,height,.75,'white');k.box(x+side*width/2,.2,z,1,.4,1.2,'paving');}
 for(let i=0;i<12;i++){const a=i/12*Math.PI,b=(i+1)/12*Math.PI;k.beam([x+Math.cos(a)*width/2,height-.6+Math.sin(a)*width*.3,z],[x+Math.cos(b)*width/2,height-.6+Math.sin(b)*width*.3,z],.5,.65,'concrete');}}
function plant(k:HarborKit,x:number,z:number,tall=false){k.solid(x,.36,z,2.2,.72,2.2,'concrete');k.box(x,.75,z,1.9,.1,1.9,'dark');
 if(tall){k.cylinder(x,2,z,.14,2.5,'wood');for(const [dy,r] of [[0,1.25],[.7,1],[1.3,.7]])k.cylinder(x,3.1+dy,z,r,1.1,'green',undefined,true);}
 else for(const [dx,dz] of [[-.4,-.35],[.4,-.35],[0,.4]])k.cylinder(x+dx,1.05,z+dz,.48,.55,'green');}
function bench(k:HarborKit,x:number,z:number){k.box(x,.6,z,3.2,.22,.85,'wood');k.box(x,1.1,z-.36,3.2,.65,.16,'green');for(const side of [-1,1])k.box(x+side*1.2,.28,z,.3,.56,.8,'white');}
function pool(k:HarborKit,x:number,z:number,w:number,d:number){
 // Raised, visibly bounded water is an obstacle rather than a hidden floor or kill volume.
 k.solid(x,.36,z,w,.72,d,'concrete');k.box(x,.735,z,w-.65,.08,d-.65,'water');
 for(const side of [-1,1]){k.box(x+side*(w/2-.1),.8,z,.2,.16,d,'white');k.box(x,.8,z+side*(d/2-.1),w,.16,.2,'white');}
 for(let zz=z-d/2+2;zz<z+d/2-1;zz+=3.5)k.paint(x,zz,w*.55,.05,'foam',.784);}
function pavilion(k:HarborKit,x:number,z:number,w:number,d:number,h:number,glass=false){
 const door=7.8;for(const side of [-1,1]){for(const flank of [-1,1]){
  k.solid(x+flank*(w+door)/4,h/2,z+side*d/2,(w-door)/2,h,.5,glass?'glass':'white');
  k.solid(x+side*w/2,h/2,z+flank*(d+door)/4,.5,h,(d-door)/2,glass?'glass':'white');}
  k.box(x,h-.5,z+side*d/2,w,.8,.65,'concrete');k.box(x+side*w/2,h-.5,z,.65,.8,d,'concrete');}
 if(glass){const slope=Math.atan2(2.7,w/2);for(const side of [-1,1])k.box(x+side*w*.25,h+1.25,z,Math.hypot(w/2,2.7)+.4,.1,d+1,'glass',[0,0,-side*slope],'roof');
  for(let zz=z-d/2;zz<=z+d/2+.01;zz+=3.5){k.beam([x-w/2,h-.1,zz],[x,h+2.6,zz],.14,.17,'green');k.beam([x,h+2.6,zz],[x+w/2,h-.1,zz],.14,.17,'green');}k.box(x,h+2.65,z,.25,.22,d+1.1,'rust');
  for(const side of [-1,1])for(const dz of [-d*.3,d*.3]){k.solid(x+side*(w/2-2),.45,z+dz,2.2,.9,4,'concrete');for(const off of [-1,0,1])k.cylinder(x+side*(w/2-2),1.2,z+dz+off,.55,1.1,'green');}
 }else{k.box(x,h+.15,z,w+1.4,.4,d+1.4,'roof',undefined,'roof');for(const side of [-1,1])k.box(x+side*(w/2+.25),h+.65,z,.25,1,d+1,'green');
  for(const dx of [-w*.3,w*.3])for(const side of [-1,1]){k.box(x+dx,h*.58,z+side*(d/2+.28),2.4,2.2,.08,'dark');k.box(x+dx,h*.58,z+side*(d/2+.34),2,1.85,.05,'glass');}}
 k.paint(x,z,door,d+2,'paving',.035);k.paint(x,z,w+2,door,'paving',.036);}
function antenna(k:HarborKit,x:number,z:number,r:number){
 k.solid(x,.5,z,4.3,1,4.3,'white');k.cylinder(x,4.4,z,.55,7.7,'green');for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])k.beam([x+Math.cos(a)*2,.9,z+Math.sin(a)*2],[x,7,z],.22,.22,'rust');
 const profile=[];for(let i=0;i<=12;i++){const rr=r*i/12;profile.push(new THREE.Vector2(rr,rr*rr/(r*2.7)));}
 const material=k.materials.white.clone();material.side=THREE.DoubleSide;material.metalness=.35;material.roughness=.45;const dish=new THREE.Mesh(new THREE.LatheGeometry(profile,24),material);dish.position.set(x,7,z);dish.name='parabolic-observation-dish';dish.castShadow=true;dish.receiveShadow=true;dish.userData.cameraFade=true;k.current.add(dish);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;for(let j=0;j<5;j++){const r1=r*j/5,r2=r*(j+1)/5;k.beam([x+Math.cos(a)*r1,6.96+r1*r1/(r*2.7),z+Math.sin(a)*r1],[x+Math.cos(a)*r2,6.96+r2*r2/(r*2.7),z+Math.sin(a)*r2],.12,.12,'rust');}}
 k.cylinder(x,9+r/3,z,.08,5,'cyan');k.cylinder(x,11.5+r/3,z,.38,.35,'orange');}
function instruments(k:HarborKit){
 const x=-12,z=42;k.solid(x,.45,z,4.4,.9,4.4,'concrete');k.cylinder(x,1.45,z,.48,1.5,'green');
 for(const [rx,ry,rz,radius,mat] of [[0,0,0,2.05,'rust'],[Math.PI/2,0,0,2.1,'green'],[.45,.7,.55,1.75,'rust']] as [number,number,number,number,'rust'|'green'][]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.075,6,40),k.materials[mat]);ring.position.set(x,3.6,z);ring.rotation.set(rx,ry,rz);ring.castShadow=true;ring.receiveShadow=true;k.current.add(ring);}
 k.cylinder(x,3.6,z,.55,1.1,'yellow',undefined,true);k.beam([x-1.9,1.7,z],[x+1.9,5.5,z],.07,.07,'green');
 const tx=12;k.solid(tx,.4,z,3.8,.8,3.8,'concrete');for(const dx of [-1.2,1.2])k.beam([tx+dx,.8,z-.8],[tx,3,z],.16,.16,'green');k.beam([tx,.8,z+1.2],[tx,3,z],.16,.16,'green');
 k.cylinder(tx,3.35,z,.57,3.9,'white',[Math.PI/3,0,-.15],true);k.cylinder(tx+.22,4.34,z+1.66,.64,.22,'green',[Math.PI/3,0,-.15],true);k.cylinder(tx+.24,4.4,z+1.77,.5,.05,'glass',[Math.PI/3,0,-.15],true);
 for(const side of [-1,1])k.box(tx+side*.72,3,z,.2,.4,1.5,'rust');
}
function terminal(k:HarborKit,s:EventDefinition){const{x,y,z}=s.pos;k.paint(x,z,4.8,4.8,'paving',y+.04);for(const sign of [-1,1])k.paint(x+sign*2.4,z,.11,4.8,'cyan',y+.065);
 const px=s.kind==='cache'&&y>0?x-1.8:x+3.4,pz=y>0?z-3.8:z-2;k.box(px,y+.7,pz,1.1,1.4,.8,'green');k.box(px,y+1.5,pz,1.25,.3,.9,'rust',[.2,0,0]);k.box(px,y+1.55,pz+.46,.85,.22,.04,'cyan');
 if(s.kind==='forge')for(const side of [-1,1]){k.box(x+side*3.6,y+.7,z+1.5,1.6,1.4,1.3,'white');k.box(x+side*3.6,y+1.45,z+1.5,1.7,.15,1.4,'green');}
 if(s.kind==='conveyor'){k.box(x-4,y+.75,z,1.6,1.5,5.5,'green');for(let zz=-2.2;zz<=2.2;zz+=.6)k.cylinder(x-4,y+1.55,z+zz,.16,1.4,'lightSteel',[0,0,Math.PI/2]);}
 if(s.kind==='cache'&&y===0){k.crate(x-3.5,z,1.35);k.box(x-3.5,.75,z+.7,.85,.3,.05,'cyan');}}
function gate(k:HarborKit,gates:Gate[],id:string,x:number,z:number){const prior=k.current,group=new THREE.Group();group.name=`observatory-gate-${id}`;k.root.add(group);k.use(group);k.box(x,1.9,z,7.4,3.8,.25,'green');for(let dx=-3;dx<=3;dx+=1)k.box(x+dx,1.9,z+.15,.08,3.7,.07,'yellow');const collider=k.collider(x,1.9,z,7.4,3.8,.25,'dynamic',undefined,`observatory-gate-${id}`);gates.push({id,object:group,collider,progress:0,open:false});k.use(prior);}

export async function createObservatory(seed:number):Promise<HarborResult>{
 const k=new HarborKit(true),gates:Gate[]=[],sites=SITES.map(s=>({...s,pos:{...s.pos}})),texture=paving(seed);k.root.name='Oinja · 潮汐观测庭 / Tidal Observatory';
 k.materials.concrete.color.setHex(0xc9d0c5);k.materials.paving.color.setHex(0xabbcb3);k.materials.white.color.setHex(0xf0e8d3);k.materials.green.color.setHex(0x3e7668);k.materials.roof.color.setHex(0x5b9082);k.materials.rust.color.setHex(0xae7854);k.materials.steel.color.setHex(0x365c66);k.materials.glass.color.setHex(0x80b3ad);k.materials.glass.roughness=.28;k.materials.dark.color.setHex(0x234653);k.materials.water.color.setHex(0x377d8c);k.materials.foam.color.setHex(0x9ccbd0);k.materials.cyan.color.setHex(0x9df0d6);k.materials.cyan.emissive.setHex(0x477f6d);k.materials.cyan.emissiveIntensity=.42;k.materials.orange.color.setHex(0xe8ad60);k.materials.yellow.color.setHex(0xe9d3a0);k.materials.concrete.map=texture;k.materials.paving.map=texture;
 k.zone('01 — limestone ground, rills and connected promenades');k.floor(0,0,180,180,0,'concrete');
 for(const x of [-80,-23,23,80])k.paint(x,0,8,172,'paving',.028);for(const z of [-82,-44,-24,44,78])k.paint(0,z,172,8,'paving',.03);k.paint(0,58,46,30,'paving',.032);k.paint(0,-42,44,14,'paving',.032);
 for(const x of [-27.5,27.5])for(let z=-80;z<=80;z+=5){k.paint(x,z,.22,3.5,'green',.057);k.paint(x+.45,z,.09,3.5,'rust',.059);}
 for(const z of [-87,87]){k.rail([-87,0,z],[87,0,z],true,'white');for(let x=-78;x<88;x+=13)k.box(x,.35,z,1.2,.7,1.2,'green');}for(const x of [-87,87])k.rail([x,0,-87],[x,0,87],true,'white');
 pool(k,0,9,30,22);pool(k,49,54,9,23);pool(k,75,54,8,23);for(const[x,z]of[[-20,26],[20,26],[-20,-8],[20,-8],[-82,47],[82,-25],[-42,73],[43,76]])plant(k,x,z,true);
 k.zone('02 — tidefront arrival court');pavilion(k,-24,68,15,15,5.5);pavilion(k,25,69,15,14,5.2);arch(k,0,80,14,5.8);
 for(const x of [-34,35]){k.cylinder(x,3,73,.6,6,'white');k.cylinder(x,6.4,73,1.3,.8,'green');k.cylinder(x,7.2,73,.24,1.4,'yellow');}for(const[x,z]of[[-12,74],[12,74],[-13,48],[13,48]]){bench(k,x,z);plant(k,x+(x<0?-3.4:3.4),z);}
 for(let i=0;i<12;i++){const a=i*Math.PI/6;k.paint(Math.cos(a)*12,56+Math.sin(a)*12,1.6,.16,'rust',.055,a);}k.paint(0,56,8,.16,'green',.056);k.paint(0,56,.16,8,'green',.057);instruments(k);
 k.zone('03 — conservatory and botanical supply walk');pavilion(k,-62,-49,24,28,5.4,true);arch(k,-62,-34,8.4,5.5);gate(k,gates,'obs-relay-ring',-62,-35);pavilion(k,-66,48,19,13,4.8,true);
 for(const[x,z]of[[-78,-31],[-46,-61],[-77,65],[-46,46],[-73,27],[-51,17]])plant(k,x,z,true);for(const z of [-16,14,67]){bench(k,-81,z);k.light(-81,z-3,5.5);}
 for(const x of [-73,-69]){k.box(x,1,28,1.3,2,6,'green');for(const y of [.45,1.15,1.85]){k.box(x,y,28,1.6,.12,6.2,'wood');for(const zz of [-2,0,2])k.cylinder(x,y+.25,28+zz,.4,.38,'green');}}
 k.zone('04 — meridian dome and optical instruments');k.solid(0,2.9,-66,23,5.8,23,'white');
 for(const x of [-6,0,6]){k.box(x,3.2,-54.2,2.3,3.9,.12,'green');k.box(x,3.2,-54.1,1.85,3.45,.09,'glass');k.box(x,3.2,-54.02,.13,3.6,.08,'rust');k.box(x,3.2,-53.98,2,.14,.08,'rust');}
 for(const x of [-11.9,11.9])for(const z of [-75,-69,-63,-57]){k.box(x,3.4,z,.15,2.3,1.9,'glass');k.box(x,3.4,z,.18,.12,2.1,'rust');}
 const dome=new THREE.Mesh(new THREE.SphereGeometry(12.7,24,12,0,Math.PI*2,0,Math.PI/2),k.materials.roof);dome.position.set(0,5.8,-66);dome.name='copper-observatory-dome';dome.castShadow=true;dome.receiveShadow=true;dome.userData.cameraFade=true;k.current.add(dome);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;for(let j=0;j<8;j++){const t1=j/8*Math.PI/2,t2=(j+1)/8*Math.PI/2;k.beam([Math.cos(a)*Math.cos(t1)*12.8,5.8+Math.sin(t1)*12.8,-66+Math.sin(a)*Math.cos(t1)*12.8],[Math.cos(a)*Math.cos(t2)*12.8,5.8+Math.sin(t2)*12.8,-66+Math.sin(a)*Math.cos(t2)*12.8],.1,.1,'rust');}}
 k.cylinder(0,19.5,-66,.45,3,'green');k.cylinder(0,21.3,-66,.7,.4,'yellow');for(const x of [-22,22]){arch(k,x,-75,6,3.8);k.cylinder(x,2,-70,.35,4,'green');k.cylinder(x,4.3,-70,.8,1.6,'white',[0,0,Math.PI/3]);}for(const[x,z]of[[-37,-68],[28,-61],[17,-82]])plant(k,x,z);k.box(-26,1.1,-57,3,2.2,2,'white');k.box(-26,2.25,-57,3.4,.15,2.3,'green');
 k.zone('05 — antenna yard and instrument laboratory');antenna(k,64,-66,10);antenna(k,80,-39,4.5);antenna(k,43,-76,4);
 for(const x of [53,72]){k.solid(x,1.35,-37,3,2.7,6,'white');for(let z=-39;z<=-35;z+=1)k.box(x+1.55,1.35,z,.1,2,.2,'green');k.box(x,2.78,-37,3.1,.15,6.1,'rust');}pavilion(k,65,16,20,12,5.2);gate(k,gates,'obs-relay-array',65,22);
 for(const[x,z]of[[48,-14],[81,13],[48,-53],[33,-70]])plant(k,x,z);k.paint(64,-48,20,.18,'rust',.052);for(let x=43;x<80;x+=4)k.paint(x,-45,1.1,.12,'green',.055);
 k.zone('06 — mirrorwater garden and sluice colonnade');for(const x of [42,82])for(const z of [35,45,58,69]){k.solid(x,2.1,z,.5,4.2,.5,'white');k.box(x,4.3,z,1.2,.3,1.2,'green');}for(const x of [42,82])k.box(x,4.6,52,.8,.25,40,'rust');for(const z of [35,69]){arch(k,62,z,13,4.5);k.paint(62,z,15,.2,'rust',.06);}for(const z of [45,60]){bench(k,60,z);plant(k,65,z);}k.solid(83,1.2,44,2,2.4,3,'white');k.cylinder(81.8,2.1,44,1.1,.2,'green',[0,0,Math.PI/2]);k.beam([81.65,1.3,44],[81.65,2.9,44],.1,.1,'rust');
 k.zone('07 — elevated rectangular promenade and two accessible ramps');k.bridge(0,-32,72,8,DECK,'white');k.bridge(0,28,72,8,DECK,'white');k.bridge(-32,-2,8,60,DECK,'white');k.bridge(32,-2,8,60,DECK,'white');k.ramp([-70,0,0],[-36,DECK,0],10,'paving');k.ramp([36,DECK,0],[70,0,0],10,'paving');
 for(const x of [-32,32])for(const z of [-27,23]){k.solid(x,2.1,z,.65,4.2,.65,'white');k.beam([x-2,3.6,z],[x+2,3.6,z],.3,.3,'green');}
 for(const x of [-36.1,36.1]){k.rail([x,DECK,-32],[x,DECK,-5.4],true,'green');k.rail([x,DECK,5.4],[x,DECK,28],true,'green');}for(const x of [-27.9,27.9])k.rail([x,DECK,-27.8],[x,DECK,23.8],true,'green');for(const z of [-36.1,32.1])k.rail([-35.8,DECK,z],[35.8,DECK,z],true,'green');for(const z of [-27.9,23.9])k.rail([-27.8,DECK,z],[27.8,DECK,z],true,'green');for(const x of [-18,0,18])for(const z of [-32,28])k.paint(x,z,2,.14,'rust',DECK+.05);
 k.zone('08 — readable equipment and distant coastal landscape');for(const s of sites)terminal(k,s);for(const[x,z]of[[-79,-76],[30,-81],[-30,81],[77,79],[-16,-37],[15,39]])k.light(x,z,6);for(const x of [-80,80])for(const z of [-78,78])plant(k,x,z,true);k.box(0,-2.1,0,550,.2,550,'water',undefined,'water');
 for(let i=0;i<13;i++){const x=-124+i*20,z=-116-(i%3)*15,h=6+(i%4)*3;k.box(x,h/2-1,z,12,h,12,'white');k.box(x,h-.5,z,13,.4,13,'roof');for(const dx of [-3,0,3])k.box(x+dx,h*.6,z+6.05,1.4,2,.1,'glass');}for(const x of [-116,116])for(const z of [-66,0,67]){k.cylinder(x,0,z,12,3,'concrete',undefined,true);k.cylinder(x,4,z,5,8,'green',undefined,true);}
 const group=k.finish(),zones:MapWorld['zones']=[
  {id:'A',name:'迎潮前庭',center:[0,0,56],radius:29,description:'开放集散 · 装配支援 · 多向绕行'},
  {id:'B',name:'铜绿温室',center:[-62,0,-49],radius:31,description:'四门温室 · 种植分拣 · 棚下回路'},
  {id:'C',name:'星轨观测台',center:[0,0,-46],radius:29,description:'铜顶观测台 · 环形外院 · 光学校准'},
  {id:'D',name:'天线实验场',center:[60,0,-48],radius:29,description:'抛物反射器 · 仪器实验 · 馈电设施'},
  {id:'E',name:'高架环廊',center:[0,5,-32],radius:39,description:'完整高架环路 · 双宽缓坡 · 桥下通路'},
  {id:'F',name:'镜水花园',center:[64,0,40],radius:30,description:'反射水庭 · 柱廊 · 检修闸机'},
 ],spawn=new THREE.Vector3(0,0,56),chains:Vec3[][]=[];
 const chain=(a:Vec3,b:Vec3)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2),points:Vec3[]=[];for(let i=0;i<=n;i++){const t=i/n;points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}chains.push(points);};
 chain([-70,0,0],[-36,5,0]);chain([-36,5,0],[-32,5,0]);chain([32,5,0],[36,5,0]);chain([36,5,0],[70,0,0]);chain([-32,5,-32],[32,5,-32]);chain([32,5,-32],[32,5,28]);chain([32,5,28],[-32,5,28]);chain([-32,5,28],[-32,5,-32]);
 const navigation=harborNavigation(BOUNDS,k.colliders,k.surfaces,chains,[[0,0,56],...sites.map(s=>[s.pos.x,s.pos.y,s.pos.z] as Vec3),...zones.map(z=>z.center)]),occluders:THREE.Object3D[]=[];group.traverse(o=>{if(o.userData.cameraFade)occluders.push(o);});let disposed=false;
 group.userData={originalAsset:true,gameOnlySetting:true,seed,source:'src/surge/observatory.ts',units:'metres',up:'Y',interactiveSiteIds:sites.map(s=>s.id)};
 const world:MapWorld={id:'tidal-observatory',group,bounds:BOUNDS,spawn,zones,colliders:k.colliders,nav:navigation.nav,occluders,anchors:[{id:'obs-west-ring',position:[-32,7,0],zoneId:'E'},{id:'obs-east-ring',position:[32,7,0],zoneId:'E'}],eventSites:sites.map(s=>({id:s.id,position:[s.pos.x,s.pos.y,s.pos.z],zoneId:zones.reduce((a,b)=>Math.hypot(a.center[0]-s.pos.x,a.center[2]-s.pos.z)<Math.hypot(b.center[0]-s.pos.x,b.center[2]-s.pos.z)?a:b).id,kind:s.kind==='relay'?'power':s.kind==='crane'?'bridge':'supply',name:s.title})),theme:{background:0x88a3ad,fog:0xb5c9ca,fogNear:145,fogFar:390,ambient:0xb6d1d7,sun:0xffe6bc,sunPosition:[-65,155,95],exposure:1.12},heightAt:navigation.heightAt,walkableAt:navigation.walkableAt,findPath:navigation.findPath,
  openShortcut(id,immediate=false){for(const g of gates)if(g.id===id){g.open=true;g.collider.enabled=false;if(immediate){g.progress=1;g.object.position.y=4.5;}navigation.rebuild();}},
  update(_time,dt){for(const g of gates)if(g.open&&g.progress<1){g.progress=Math.min(1,g.progress+dt/1.8);const t=g.progress;g.object.position.y=(t*t*(3-2*t))*4.5;}},
  dispose(){if(disposed)return;disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();group.clear();},
 };return {world,sites};
}
