import * as THREE from 'three';
import { HarborKit } from '../world/modeling';
import type { MapWorld, Vec3, WorldCollider, Surface } from '../world/types';
import type { EventDefinition, HarborResult } from './types';
import { harborNavigation } from './world-navigation';

type Mat=keyof HarborKit['materials'];
type Dynamic={id:string;kind:'gate'|'bridge';object:THREE.Group;colliders:WorldCollider[];surfaces:Surface[];amount:number;progress:number};
const BOUNDS={minX:-90,maxX:90,minZ:-90,maxZ:90};
const SITES:EventDefinition[]=[
 {id:'relay-market',kind:'relay',title:'雨棚配电站',description:'恢复街区电路，开启工坊西侧货门。',pos:{x:-34,y:0,z:13},reward:'prism'},
 {id:'relay-north',kind:'relay',title:'桥脊继电器',description:'接通检修回路，开启北货场侧门。',pos:{x:4,y:5.5,z:-24},reward:'tempest'},
 {id:'convoy-west',kind:'convoy',title:'回栈接力车',description:'护送储电设备穿过货场。',pos:{x:-53,y:0,z:-42},reward:'titan'},
 {id:'convoy-south',kind:'convoy',title:'夜班运输队',description:'让码头的备用能源回到工坊。',pos:{x:-32,y:0,z:51},reward:'medic'},
 {id:'crane-dock',kind:'crane',title:'第七码头吊机',description:'完成吊装，放下跨渠检修桥。',pos:{x:43,y:0,z:43},reward:'orbital'},
 {id:'crane-yard',kind:'crane',title:'龙门起重架',description:'重新启动货场的重型吊装设施。',pos:{x:-47,y:0,z:-66},reward:'crusher'},
 {id:'forge-home',kind:'forge',title:'折线工坊',description:'保护工坊组装新的协作装置。',pos:{x:0,y:0,z:-5},reward:'titan'},
 {id:'forge-east',kind:'forge',title:'铜线维修棚',description:'为检修台争取稳定的工作时间。',pos:{x:51,y:0,z:2},reward:'prism'},
 {id:'conveyor-east',kind:'conveyor',title:'分拣输送线',description:'重新组织来货，让能源流动起来。',pos:{x:48,y:0,z:-48},reward:'crusher'},
 {id:'cache-market',kind:'cache',title:'雨棚储备箱',description:'取回小店保管的应急物资。',pos:{x:-63,y:0,z:20},reward:'medic'},
 {id:'cache-quay',kind:'cache',title:'候潮厅旧储藏间',description:'回收留下的兼容设备。',pos:{x:12,y:0,z:64},reward:'orbital'},
 {id:'relay-east',kind:'relay',title:'储电环线',description:'恢复东侧支线，打开仓库维护通道。',pos:{x:69,y:0,z:-39},reward:'tempest'},
];

function texture(seed:number,kind:'paver'|'brick'|'road') {
 const size=128,data=new Uint8Array(size*size*4);let s=seed>>>0;
 const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;let value=190+rand()*38;
  if(kind==='paver'){const offset=Math.floor(y/32)%2?16:0;if(y%32<2||(x+offset)%32<2)value=122+rand()*18;}
  if(kind==='brick'){const offset=Math.floor(y/16)%2?24:0;if(y%16<2||(x+offset)%48<2)value=125;else value=175+Math.floor(y/16)%3*13+rand()*28;}
  if(kind==='road')value=180+rand()*52-(x%43<2&&y%17<13?26:0);
  data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

function shop(k:HarborKit,x:number,z:number,w:number,d:number,h:number,mat:Mat='brick',color:Mat='green') {
 const door=Math.min(7,w*.52),wall=.5;
 for(const side of [-1,1]){
  const zz=z+side*d/2;for(const flank of [-1,1])k.solid(x+flank*(w+door)/4,h/2,zz,(w-door)/2,h,wall,mat);
  k.solid(x,h-.6,zz,door,1.2,wall,mat);
  k.solid(x+side*w/2,h/2,z,wall,h,d,mat);
  k.box(x,h+.15,z+side*d*.25,w+1.1,.28,d*.56,'roof',[side*.12,0,0],'roof');
  for(const dx of [-w*.34,w*.34]){k.box(x+dx,h*.52,zz+side*.28,2.1,1.75,.06,'dark');k.box(x+dx,h*.52,zz+side*.32,1.8,1.45,.05,'glass');k.box(x+dx,h*.52,zz+side*.36,.1,1.6,.08,'yellow');}
 }
 k.box(x,h-.85,z+d/2+.45,door+1,.85,.3,color);k.box(x,h-.77,z+d/2+.64,door*.7,.11,.025,'yellow');
 k.box(x,h-1.2,z+d/2+1.2,w+1.4,.17,2.2,color,[-.08,0,0],'roof');
 for(const dx of [-w/2+.8,w/2-.8])k.box(x+dx,(h-1.4)/2,z+d/2+2.1,.14,h-1.4,.14,'steel');
 // Shallow side-wall equipment leaves both portals and the interior route clear.
 k.box(x-w/2+.9,.8,z-1,1.1,1.6,3.2,'wood');k.box(x-w/2+.9,1.68,z-1,1.35,.12,3.4,'steel');
 for(const dz of [-d*.28,d*.28])k.box(x+w/2+.12,h*.65,z+dz,.18,2.1,1.8,color);
 k.paint(x,z,door,d+2,'paving',.035);
}
function plant(k:HarborKit,x:number,z:number,large=false){k.solid(x,.35,z,large?2.6:1.3,.7,large?2.1:1.1,'brickLight');if(large){k.cylinder(x,2.15,z,.18,3.8,'wood');k.cylinder(x,4.2,z,1.7,2.5,'green');k.cylinder(x+.65,4.9,z+.2,1.2,1.8,'green');}else{for(const dx of [-.3,0,.3])k.cylinder(x+dx,.9,z,.32,.8,'green');}}
function bench(k:HarborKit,x:number,z:number){k.box(x,.65,z,3,.17,.65,'wood');k.box(x,1.15,z-.35,3,.6,.13,'wood');for(const dx of [-1.1,1.1])k.box(x+dx,.32,z,.16,.65,.6,'steel');}
function terminal(k:HarborKit,site:EventDefinition){const {x,y,z}=site.pos;
 // All interaction centers reserve a 3 m unobstructed disc.
 k.paint(x,z,4.8,4.8,'dark',y+.045);for(const side of [-1,1]){k.paint(x+side*2.45,z,.12,4.9,'cyan',y+.065);k.paint(x,z+side*2.45,4.9,.12,'cyan',y+.065);}
 const px=x+3.6,pz=z-1.9;k.box(px,y+.6,pz,1.2,1.2,.85,'dark');k.box(px,y+1.38,pz,1.3,.5,.9,'steel',[.18,0,0]);k.box(px,y+1.47,pz+.47,.97,.27,.06,'cyan');
 k.cylinder(px,y+2.2,pz,.07,1.2,'steel');k.cylinder(px,y+2.87,pz,.22,.18,'orange');
 if(site.kind==='cache'){k.crate(x-3.8,z,1.35,y);k.crate(x-3.8,z+1.5,1.35,y);k.box(x-3.8,y+1.4,z,1,.12,.8,'cyan');}
 if(site.kind==='forge'){k.box(x-3.9,y+.7,z,1.1,1.4,3,'steel');k.box(x-3.9,y+1.46,z,1.4,.12,3.3,'orange');for(const zz of [-.9,.9])k.cylinder(x-3.9,y+1.68,z+zz,.21,.35,'cyan');}
}
function gate(k:HarborKit,dynamics:Dynamic[],id:string,x:number,z:number,axis:'x'|'z'='x'){
 const horizontal=axis==='x';for(const side of [-1,1])k.solid(x+(horizontal?side*4.1:0),2.5,z+(horizontal?0:side*4.1),.5,5,.5,'steel');
 k.box(x,5.1,z,horizontal?8.8:.65,.45,horizontal?.65:8.8,'orange');
 const old=k.current,group=new THREE.Group();group.name=`surge-gate-${id}`;k.root.add(group);k.use(group);
 k.box(x,2.25,z,horizontal?7.6:.3,4.5,horizontal?.3:7.6,'dark');
 for(const side of [-1,1])k.box(x+(horizontal?side*2.5:0),2.3,z+(horizontal?0:side*2.5),horizontal?.18:.35,4,horizontal?.35:.18,'orange');
 const collider=k.collider(x,2.25,z,horizontal?7.6:.35,4.5,horizontal?.35:7.6,'dynamic',undefined,`surge-gate-${id}`);
 dynamics.push({id,kind:'gate',object:group,colliders:[collider],surfaces:[],amount:0,progress:0});k.use(old);
}

/** Original dense harbor: all gameplay locations are reachable without any particular weapon. */
export async function createHarbor(seed:number):Promise<HarborResult>{
 const k=new HarborKit(false),dynamics:Dynamic[]=[],sites=SITES.map(s=>({...s,pos:{...s.pos}})),textures:THREE.Texture[]=[];
 k.root.name='Oinja · 旧港复流';
 k.materials.concrete.color.setHex(0x777381);k.materials.paving.color.setHex(0x807b82);k.materials.asphalt.color.setHex(0x323849);
 k.materials.dark.color.setHex(0x1d223c);k.materials.roof.color.setHex(0x33324a);k.materials.steel.color.setHex(0x3b5263);
 k.materials.brick.color.setHex(0xa9644d);k.materials.brickLight.color.setHex(0xc19078);k.materials.orange.color.setHex(0xf09a51);
 k.materials.cyan.color.setHex(0x71e5cd);k.materials.cyan.emissive.setHex(0x218577);k.materials.cyan.emissiveIntensity=.7;
 k.materials.yellow.color.setHex(0xffda87);k.materials.yellow.emissive.setHex(0xdf8e37);k.materials.yellow.emissiveIntensity=.22;
 const paver=texture(seed,'paver'),brick=texture(seed+1,'brick'),road=texture(seed+2,'road');textures.push(paver,brick,road);
 for(const key of ['concrete','paving'] as const)k.materials[key].map=paver;for(const key of ['brick','brickLight'] as const)k.materials[key].map=brick;k.materials.asphalt.map=road;
 k.zone('01 — masonry quays, cobbled streets and drainage');
 // Four ground rectangles leave a real 9 m wide maintenance channel at the quay.
 k.floor(-17,0,146,180,0,'concrete');k.floor(77.5,0,25,180,0,'concrete');k.floor(60.5,-32.5,9,115,0,'concrete');k.floor(60.5,76,9,28,0,'concrete');
 k.floor(60.5,43.5,9,37,-2.4,'dark');k.ramp([60.5,0,25],[60.5,-2.4,38],8.4,'concrete');k.ramp([60.5,-2.4,49],[60.5,0,62],8.4,'concrete');
 // The water is a shallow visible maintenance basin, with two sloped escape routes.
 k.box(60.5,-2.3,43.5,8.8,.05,36,'water',[0,0,0],'water');
 k.box(0,-3.5,30,700,.25,620,'water',[0,0,0],'water');
 for(const z of [101,112,132,159,180])for(let x=-105;x<145;x+=24)k.paint(x,z,10,.15,'foam',-3.34);
 const routes:Vec3[][]=[[[0,0,-84],[0,0,82]],[[-84,0,0],[82,0,0]],[[-74,0,-55],[76,0,-55]],[[-74,0,55],[51,0,55]],[[-74,0,-55],[-74,0,72]],[[76,0,-72],[76,0,72]], [[-39,0,-82],[-39,0,76]],[[29,0,-82],[29,0,80]]];
 for(const [a,b] of routes)k.road(a,b,8);
 for(let z=-80;z<=80;z+=10)for(const x of [-44,34]){k.paint(x,z,.55,7,'dark',.05);for(let i=-3;i<=3;i++)k.paint(x,z+i,.52,.08,'steel',.068);}
 for(const [x,z] of [[-15,-13],[16,13],[-54,36],[46,-63],[36,68],[-25,-67]]){k.paint(x,z,8,5,'paving',.05);for(const side of [-1,1])k.paint(x+side*4,z,.15,5,'orange',.071);}
 for(let i=-80;i<=80;i+=8){k.bollard(i,87);k.box(i,.8,90,1.3,1.6,1.1,'concrete');k.box(-89,.5,i,1.2,1,2,'concrete');}
 k.rail([-86,0,89],[86,0,89],true,'steel');k.rail([-89,0,-86],[-89,0,86],true,'steel');
 for(const x of [55.6,65.4])for(const [a,b] of [[26,38],[48,61]])k.rail([x,0,a],[x,0,b],true,'yellow');

 k.zone('02 — Foldline workshop square');
 k.paint(0,9,26,29,'paving',.026);for(const x of [-12,12])k.paint(x,9,.18,28,'orange',.054);
 shop(k,-15,-11,16,16,6.4,'brick','orange');shop(k,16,-11,15,16,5.4,'brickLight','green');
 shop(k,-17,28,17,15,6.7,'brick','green');shop(k,16,30,14,14,5.8,'brickLight','blue');
 for(const [x,z] of [[-11,17],[11,20],[-27,-10],[27,27]])plant(k,x,z,true);
 bench(k,-6,23);bench(k,7,23);k.light(-11,3,6);k.light(11,16,6,-1);
 for(const z of [-8,0,8])k.paint(-8,z,1.5,.3,'cyan',.072);
 k.box(-15,4.8,-1.8,10,1.1,.18,'dark');for(let i=0;i<6;i++)k.box(-18.5+i*1.4,4.9,-1.65,.75,.24,.06,'yellow');
 // Overhead pennants keep the home square distinct without blocking the camera.
 const homeGroup=k.current,bunting=new THREE.Group();bunting.name='workshop-camera-fade-pennants';k.root.add(bunting);k.use(bunting);
 k.beam([-12,7,17],[12,7,17],.035,.035,'dark');for(let i=0;i<9;i++)k.box(-10+i*2.5,6.7,17,.7,.7,.025,i%2?'orange':'cyan');k.use(homeGroup);
 gate(k,dynamics,'relay-market',-28,8,'z');gate(k,dynamics,'relay-east',34,-10,'z');

 k.zone('03 — rain-canopy market and salvage lane');
 shop(k,-58,-12,21,15,6.1,'brick','green');shop(k,-59,38,22,15,5.6,'brickLight','orange');
 for(const z of [5,17]){
  k.box(-53,3.3,z,11,.2,5.7,z===5?'green':'orange',[0,0,.04],'roof');
  for(const x of [-58,-48])for(const dz of [-2.4,2.4])k.box(x,1.6,z+dz,.12,3.2,.12,'steel');
  k.solid(-55,.65,z,4,1.3,1.8,'wood');for(let j=0;j<5;j++){k.box(-56.5+j*.7,1.48,z,.5,.3,.5,j%2?'orange':'green');}
 }
 for(const z of [-35,-31,60,68]){k.crate(-65,z,2);k.crate(-62.8,z,1.5);k.barrel(-67,z+2);}
 plant(k,-82,8,true);plant(k,-46,29);plant(k,-46,-5);bench(k,-81,33);
 k.light(-79,-13,7);k.light(-45,43,7,-1);k.sign(-59,4.5,46.1,7,false,3);

 k.zone('04 — railway return yard and gantry');
 for(const [x,z,c] of [[-64,-73,'blue'],[-25,-75,'rust'],[-56,-51,'red'],[-21,-47,'green']] as [number,number,Mat][])k.container(x,z,c,0,15);
 k.container(-64,-73,'rust',2.9,15);k.container(-25,-75,'blue',2.9,15);
 for(const x of [-57,-54])k.paint(x,-64,.13,36,'steel',.054);for(let z=-82;z<=-47;z+=2.4)k.paint(-55.5,z,4.7,.2,'wood',.032);
 k.gantry(-47,-67,26,12,false);k.box(-47,8.7,-67,7,1.6,2,'orange');k.pipe([-47,8,-67],[-47,4.7,-67],.065,'dark');
 shop(k,-12,-63,15,12,5.5,'brick','blue');shop(k,-78,-68,12,18,5.4,'brick','green');
 for(const [x,z] of [[-31,-63],[-34,-65],[-70,-42],[-23,-35]])k.crate(x,z,2.1);
 gate(k,dynamics,'relay-north',-34,-34,'x');k.light(-31,-48,8,-1);k.light(-68,-60,8);k.sign(-47,10,-65.8,8,false,4);

 k.zone('05 — battery court, conveyor and copper repair');
 shop(k,47,-72,23,14,6.5,'brick','orange');shop(k,76,-14,17,17,6.2,'brickLight','blue');
 for(const x of [40,57])k.battery(x,-33,0);k.transformer(77,-62);
 k.box(51,1.25,-57,27,.9,4,'steel');k.collider(51,1.25,-57,27,.9,4);
 for(let x=39;x<=63;x+=1.5)k.cylinder(x,1.79,-57,.3,3.6,'lightSteel',[Math.PI/2,0,0]);
 for(const x of [43,52,61]){k.box(x,2.35,-57,2,1.1,2,'wood');k.box(x,2.35,-55.95,1.6,.2,.05,'orange');}
 for(const x of [36,66]){k.solid(x,2.7,-57,.45,5.4,4.8,'orange');k.box(x,5.4,-57,.5,.5,5.3,'orange');}
 shop(k,52,17,21,15,5.7,'brick','green');plant(k,66,5,true);plant(k,38,15);k.light(35,-45,8);k.light(64,-5,7,-1);
 // Visible feeder paths terminate at actual facilities.
 for(const x of [40,57]){k.paint(x,-41,.13,10,'cyan',.069);k.paint((x+69)/2,-46,69-x,.13,'cyan',.07);}

 k.zone('06 — tidal quay and waiting hall');
 shop(k,-12,67,17,14,6.2,'brickLight','green');shop(k,12,78,19,12,6.5,'brick','blue');
 k.crane(42,68,Math.PI*.65);k.box(42,4,68,4.7,3,4.2,'orange');
 k.gantry(-32,54,22,9,false);k.box(-32,1.1,62,8,1.1,3.2,'steel');k.collider(-32,1.1,62,8,1.1,3.2);
 for(const x of [-35,-29])for(const z of [60.7,63.3])k.cylinder(x,.7,z,.7,.25,'dark',[Math.PI/2,0,0]);
 for(const [x,z] of [[-51,69],[-46,71],[35,31],[39,32],[73,58],[78,60]])k.crate(x,z,2);
 for(const x of [6,24,42,72])k.light(x,84,7,-1);
 for(const [x,z] of [[-23,76],[22,62],[80,76]])plant(k,x,z,true);
 bench(k,9,57);bench(k,20,57);k.sign(12,5.3,71.8,7,false,7);
 k.ship(11,120,42,-2.8,false);k.ship(-119,36,40,-2.8,false);
 // A raised quay bridge becomes a real walkable surface after the crane event.
 const previous=k.current,bridge=new THREE.Group();bridge.name='surge-bridge-crane-dock';k.root.add(bridge);k.use(bridge);
 const c0=k.colliders.length,s0=k.surfaces.length;k.bridge(60.5,43,17,7,0,'steel');
 k.rail([52,0,39.6],[69,0,39.6],true,'yellow');k.rail([52,0,46.4],[69,0,46.4],true,'yellow');
 const bridgeColliders=k.colliders.slice(c0),bridgeSurfaces=k.surfaces.slice(s0);bridgeColliders.forEach(c=>c.enabled=false);bridgeSurfaces.forEach(s=>s.enabled=false);
 dynamics.push({id:'crane-dock',kind:'bridge',object:bridge,colliders:bridgeColliders,surfaces:bridgeSurfaces,amount:0,progress:0});k.use(previous);

 k.zone('07 — bridge-spine maintenance loop');
 const deck=5.5;k.bridge(0,-24,84,7,deck,'steel');k.bridge(4,-24,11,10,deck,'steel');
 k.ramp([-70,0,-24],[-42,deck,-24],7,'steel');k.ramp([42,deck,-24],[70,0,-24],7,'steel');
 for(const x of [-42,-22,22,42])for(const side of [-1,1]){k.solid(x,2.5,-24+side*2.75,.55,5,.55,'steel');k.beam([x-2,.5,-24+side*2.75],[x+2,5,-24+side*2.75],.16,.16,'rust');}
 for(const z of [-27.4,-20.6]){k.rail([-41,deck,z],[-3,deck,z],true,'yellow');k.rail([11,deck,z],[41,deck,z],true,'yellow');}
 k.pipe([-39,8,-27.9],[39,8,-27.9],.22,'cyan');for(const x of [-36,-18,18,36])k.box(x,6.8,-27.9,.1,2.7,.1,'steel');
 k.sign(4,8,-28.1,7,false,2);k.light(-36,-24,8.8);k.light(36,-24,8.8,-1);

 k.zone('08 — terminals and street furnishings');
 for(const site of sites)terminal(k,site);
 let decor=(seed^0x6a09e667)>>>0;const rand=()=>{decor=(Math.imul(decor,1664525)+1013904223)>>>0;return decor/4294967296;};
 // Seeded color/stack variation stays within authored prop pockets, never the routes.
 for(const [x,z] of [[-83,55],[-84,-34],[84,-76],[83,16],[46,80],[-31,-81]]){k.barrel(x,z,0,rand()>.5?'orange':'blue');k.barrel(x+1.1,z+.4,0,'rust');for(let j=0;j<3;j++)k.box(x-1,1+j*.28,z,1.4,.2,1.4,'wood');}
 for(const [x,z] of [[-78,49],[-78,-45],[-10,-43],[24,47],[77,29],[19,-80]])k.light(x,z,7);
 k.zone('09 — distant skyline');
 k.box(0,-.9,-125,242,1.8,70,'paving',[0,0,0],'ground');k.box(108,-.9,-47,36,1.8,125,'paving',[0,0,0],'ground');
 for(let i=0;i<12;i++){const x=-106+i*18,z=-112-(i%3)*8,h=8+(i%4)*3;k.box(x,h/2,z,12,h,15,i%2?'brick':'blue');k.box(x,h,z,13,.5,16,'roof');for(let y=3;y<h-1;y+=3)for(const dx of [-3,0,3])k.box(x+dx,y,z+7.53,1.4,1.5,.06,'yellow');}
 k.cylinder(102,12,112,3,30,'brickLight');k.cylinder(102,26,112,3.8,3,'yellow');k.cylinder(102,28,112,4.1,1,'roof');
 const group=k.finish();bunting.traverse(o=>{if(o instanceof THREE.Mesh)o.userData.cameraFade=true;});
 // Original bridge authoring coordinates are retained in physics; visual pivot stays at its west hinge.
 bridge.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.translate(-52,0,-43);});bridge.position.set(52,0,43);bridge.rotation.z=Math.PI*.43;
 const zones:MapWorld['zones']=[
  {id:'A',name:'折线工坊',center:[0,0,10],radius:28,description:'中央集散 · 四向绕行 · 工坊支援'},
  {id:'B',name:'雨棚市场',center:[-57,0,14],radius:30,description:'檐下通道 · 小店内穿 · 民生储备'},
  {id:'C',name:'回栈货场',center:[-45,0,-59],radius:32,description:'货柜夹道 · 轨道横穿 · 接力吊运'},
  {id:'D',name:'铜线配电庭',center:[52,0,-36],radius:32,description:'储电阵列 · 分拣设备 · 维修棚'},
  {id:'E',name:'桥脊检修道',center:[4,5.5,-24],radius:27,description:'真实高架 · 双坡道 · 跨区捷径'},
  {id:'F',name:'第七码头',center:[25,0,53],radius:38,description:'候潮厅 · 吊机回路 · 落桥检修渠'},
 ];
 const spawn=new THREE.Vector3(0,0,12),chains:Vec3[][]=[];
 const chain=(a:Vec3,b:Vec3,spacing=2)=>{const count=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/spacing),list:Vec3[]=[];for(let i=0;i<=count;i++){const f=i/count;list.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]);}chains.push(list);};
 chain([-70,0,-24],[-42,5.5,-24]);chain([-42,5.5,-24],[42,5.5,-24]);chain([42,5.5,-24],[70,0,-24]);
 chain([60.5,0,25],[60.5,-2.4,38]);chain([60.5,-2.4,38],[60.5,-2.4,49]);chain([60.5,-2.4,49],[60.5,0,62]);
 // Disabled bridge surface fails segment validation until the crane has lowered it.
 chain([52,0,43],[69,0,43]);
 const navigation=harborNavigation(BOUNDS,k.colliders,k.surfaces,chains,[[spawn.x,spawn.y,spawn.z],...sites.map(s=>[s.pos.x,s.pos.y,s.pos.z] as Vec3),...zones.map(z=>z.center)]);
 const occluders:THREE.Object3D[]=[];group.traverse(o=>{if(o.userData.cameraFade)occluders.push(o);});
 let disposed=false;group.userData={originalAsset:true,seed,source:'src/surge/harbor.ts',units:'metres',up:'Y',interactiveSiteIds:sites.map(s=>s.id)};
 const world:MapWorld={id:'old-harbor',group,bounds:BOUNDS,spawn,zones,colliders:k.colliders,anchors:[{id:'spine-west',position:[-42,7,-24],zoneId:'E'},{id:'spine-east',position:[42,7,-24],zoneId:'E'}],nav:navigation.nav,
  eventSites:sites.map(s=>({id:s.id,position:[s.pos.x,s.pos.y,s.pos.z],zoneId:zones.reduce((a,b)=>Math.hypot(a.center[0]-s.pos.x,a.center[2]-s.pos.z)<Math.hypot(b.center[0]-s.pos.x,b.center[2]-s.pos.z)?a:b).id,kind:s.kind==='relay'?'power':s.kind==='crane'?'bridge':'supply',name:s.title})),occluders,
  theme:{background:0x302d49,fog:0x6c566a,fogNear:120,fogFar:360,ambient:0xa8a9d7,sun:0xffcf91,sunPosition:[-90,150,70],exposure:1.13},
  heightAt:navigation.heightAt,walkableAt:navigation.walkableAt,findPath:navigation.findPath,
  openShortcut(id,immediate=false){let changed=false;for(const d of dynamics)if(d.id===id){d.amount=1;if(d.kind==='gate'){d.colliders.forEach(c=>c.enabled=false);changed=true;}if(immediate){d.progress=1;if(d.kind==='gate')d.object.position.y=5.8;else{d.object.rotation.z=0;d.colliders.forEach(c=>c.enabled=true);d.surfaces.forEach(s=>s.enabled=true);changed=true;}}}if(changed)navigation.rebuild();},
  update(_time,dt){let changed=false;for(const d of dynamics){if(d.amount===0||d.progress===1)continue;d.progress=Math.min(1,d.progress+dt/(d.kind==='bridge'?3:1.6));const f=d.progress*d.progress*(3-2*d.progress);if(d.kind==='gate')d.object.position.y=f*5.8;else{d.object.rotation.z=(1-f)*Math.PI*.43;if(d.progress===1){d.colliders.forEach(c=>c.enabled=true);d.surfaces.forEach(s=>s.enabled=true);changed=true;}}}if(changed)navigation.rebuild();},
  dispose(){if(disposed)return;disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();},
 };
 return {world,sites};
}
