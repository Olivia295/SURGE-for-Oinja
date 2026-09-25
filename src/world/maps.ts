import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HarborKit } from './modeling';
import type { EventSite, MapId, MapWorld, NavEdge, NavWaypoint, Surface, Vec3, WorldCollider, Zone } from './types';
export type { MapId, MapWorld, WorldCollider, Zone, EventSite, NavWaypoint, NavEdge } from './types';

interface DynamicPiece { object:THREE.Object3D; kind:'gate'|'bridge'|'fan'|'rotor'|'water'; id:string; amount:number; progress?:number; collider?:WorldCollider; colliders?:WorldCollider[]; surfaces?:Surface[] }
interface BuildData { kit:HarborKit; zones:Zone[]; anchors:MapWorld['anchors']; events:EventSite[]; dynamics:DynamicPiece[]; bounds:MapWorld['bounds']; spawn:Vec3; pit:{minX:number;maxX:number;minZ:number;maxZ:number}; }

function ground(kit:HarborKit,bounds:MapWorld['bounds'],pit:BuildData['pit']) {
  const {minX,maxX,minZ,maxZ}=bounds;
  kit.zone('00 — terrain, quay and sea');
  kit.floor((minX+pit.minX)/2,(minZ+maxZ)/2,pit.minX-minX,maxZ-minZ);
  kit.floor((maxX+pit.maxX)/2,(minZ+maxZ)/2,maxX-pit.maxX,maxZ-minZ);
  kit.floor((pit.minX+pit.maxX)/2,(minZ+pit.minZ)/2,pit.maxX-pit.minX,pit.minZ-minZ);
  kit.floor((pit.minX+pit.maxX)/2,(maxZ+pit.maxZ)/2,pit.maxX-pit.minX,maxZ-pit.maxZ);
  kit.floor((pit.minX+pit.maxX)/2,(pit.minZ+pit.maxZ)/2,pit.maxX-pit.minX,pit.maxZ-pit.minZ,-5,'paving');
  // Thick dock walls are actual solid silhouettes; ramp ends remain open.
  for(const x of [pit.minX,pit.maxX])kit.solid(x,-2.5,(pit.minZ+pit.maxZ)/2,1,5,pit.maxZ-pit.minZ,'concrete');
  const rampX=(pit.minX+pit.maxX)/2;
  kit.ramp([rampX,0,pit.minZ],[rampX,-5,pit.minZ+32],16);
  kit.ramp([rampX,-5,pit.maxZ-32],[rampX,0,pit.maxZ],16);
  for(const x of [pit.minX+1,pit.maxX-1]) {kit.rail([x,0,pit.minZ],[x,0,pit.maxZ],true,'yellow');}
  for(let z=pit.minZ+8;z<pit.maxZ;z+=12)for(const x of [pit.minX+1.2,pit.maxX-1.2])kit.box(x,-2.4,z,.3,3.7,1.4,'rust');
  // Quay retaining walls, seawall safety railings and mooring hardware.
  for(const x of [minX,maxX])kit.box(x,-3,(minZ+maxZ)/2,3,6,maxZ-minZ+5,'paving');
  for(const z of [minZ,maxZ])kit.box((minX+maxX)/2,-3,z,maxX-minX,6,3,'paving');
  kit.rail([minX+.8,0,minZ+.8],[maxX-.8,0,minZ+.8]);kit.rail([minX+.8,0,maxZ-.8],[maxX-.8,0,maxZ-.8]);
  kit.rail([minX+.8,0,minZ+.8],[minX+.8,0,maxZ-.8]);kit.rail([maxX-.8,0,minZ+.8],[maxX-.8,0,maxZ-.8]);
  for(let x=minX+10;x<maxX;x+=16) {kit.bollard(x,maxZ-4);kit.paint(x,maxZ-6,3.5,.4,'yellow');}
  // Underwater island skirt prevents bright voids from showing at the horizon.
  kit.box(0,-10,0,maxX-minX,8,maxZ-minZ,'dark',[0,0,0],'ground');
  // Ocean is outside the quay footprint: a single full plane would incorrectly flood the dry dock.
  kit.box((minX-1150)/2,-1.3,0,1150+minX,.25,2300,'water',[0,0,0],'water');
  kit.box((maxX+1150)/2,-1.3,0,1150-maxX,.25,2300,'water',[0,0,0],'water');
  kit.box(0,-1.3,(minZ-1150)/2,maxX-minX,.25,1150+minZ,'water',[0,0,0],'water');
  kit.box(0,-1.3,(maxZ+1150)/2,maxX-minX,.25,1150-maxZ,'water',[0,0,0],'water');
  for(let z=maxZ+15;z<maxZ+230;z+=13)for(let x=-450;x<450;x+=42){const offset=Math.sin(x+z)*12;kit.paint(x+offset,z,15+Math.cos(z)*5,.17,'foam',-1.14,.03);}
}
function streets(kit:HarborKit,modern:boolean) {
  kit.zone('01 — ground loops, lane markings and signs');
  const A:Vec3=[-110,0,-64],B:Vec3=[10,0,-76],C:Vec3=[125,0,-64],F:Vec3=[50,0,106];
  kit.road(A,[-110,0,-155]);kit.road([-110,0,-155],[130,0,-155]);kit.road([130,0,-155],C);
  kit.road(A,[-64,0,-64]);kit.road([-64,0,-64],[-64,0,-35]);kit.road([-64,0,-35],[48,0,-35]);
  kit.road([48,0,-35],[48,0,80]);kit.road([48,0,80],F);
  kit.road([48,0,-35],[172,0,-35]);kit.road([172,0,-35],[172,0,106]);kit.road([172,0,106],F);
  kit.road(F,[-110,0,modern?170:160]);kit.road([-110,0,-64],[-110,0,modern?-14:-10]);
  kit.road([-185,0,-150],[-185,0,165],12);kit.road([-185,0,165],[-110,0,modern?170:160],12);
  // Painted work bays and crosswalks create scale and readable ground direction.
  for(const [cx,cz] of [[50,122],[148,106],[-63,-64],[-185,38]]) {
    for(let n=-3;n<=3;n++)kit.paint(cx+n*1.2,cz,.6,6,'white');
  }
  for(const [cx,cz] of [[42,141],[68,141],[130,135],[-42,-42],[-173,-140]]) {
    for(const side of [-1,1])kit.paint(cx+side*4,cz,.15,12,'yellow');kit.paint(cx,cz+6,8,.15,'yellow');
  }
  // Subtle slab joints avoid a textureless plane without noisy texture assets.
  for(let x=-220;x<=220;x+=24)kit.paint(x,-170,.07,38,'paving',.021);
  for(let z=-170;z<=170;z+=24)kit.paint(208,z,32,.07,'paving',.021);
  for(const [x,z,h] of [[-70,-38,8],[67,-42,9],[151,95,9],[33,124,8],[-168,145,8],[-170,-85,9],[138,-133,9],[190,35,10]]) kit.light(x,z,h);
}
function pavingDetails(kit:HarborKit,modern:boolean) {
  // Paint-only relief: ground remains a single continuous collision surface.
  kit.zone('plaza paving — expansion joints, drainage and working aprons');
  kit.paint(44,140,66,34,modern?'asphalt':'paving',.008);
  kit.paint(120,153,71,32,'paving',.007);
  for(let x=-46;x<=190;x+=8)for(let z=44;z<=188;z+=8){
    // Hairline recessed expansion joints establish human-scale slabs in the play camera.
    kit.paint(x,z,7.94,.045,'dark',.03);kit.paint(x-4,z-4,.045,7.94,'dark',.03);
    if((Math.round(x)+Math.round(z))%40===0)kit.paint(x,z-3.4,1.8,.11,'gravel',.032);
  }
  for(const [x,z,length] of [[12,146,66],[88,128,48],[185,137,80],[44,84,30]]){
    kit.paint(x,z,.6,length,'dark',.036);
    for(let offset=-length/2;offset<length/2;offset+=.4)kit.paint(x,z+offset,.58,.075,'steel',.05);
    kit.paint(x-.39,z,.12,length,'paving',.052);kit.paint(x+.39,z,.12,length,'paving',.052);
  }
  for(const [x,z] of [[52,141],[41,118],[69,161],[11,72],[171,119]]){
    kit.cylinder(x,.032,z,.75,.05,'dark',undefined,true);kit.cylinder(x,.063,z,.64,.012,'steel',undefined,true);
    for(let k=-.4;k<=.4;k+=.2)kit.paint(x+k,z,.065,.87,'dark',.075);
  }
  // Marked service bays surround fork trucks without adding collision clutter.
  for(const [x,z] of [[32,131],[76,123]]){
    for(const side of [-1,1])kit.paint(x+side*3.1,z,.12,7,'yellow',.051);
    kit.paint(x,z+3.5,6.3,.12,'yellow',.051);kit.hazard(x,z-3.8,6.2,.4,.055);
  }
  for(const [x,z] of [[43,137],[49,165],[145,100]]){
    kit.paint(x,z,.35,3,'white',.053);kit.paint(x-.7,z-1.4,.28,1.8,'white',.054,-.75);kit.paint(x+.7,z-1.4,.28,1.8,'white',.054,.75);
  }
}
function anchor(kit:HarborKit,list:MapWorld['anchors'],id:string,x:number,y:number,z:number,zoneId:string) {
  kit.box(x,y,z,.8,.8,.8,'yellow');kit.cylinder(x,y,z,.7,.12,'cyan',[Math.PI/2,0,0],true);
  list.push({id,position:[x,y,z],zoneId});
}
function elevated(d:BuildData,modern:boolean) {
  const {kit}=d;
  kit.zone(modern?'E — elevated concrete pipe corridor':'E — riveted maintenance truss');
  const y=8,x1=-10,x2=120,z=-18;
  kit.bridge((x1+x2)/2,z,x2-x1,8,y,modern?'concrete':'steel');
  kit.bridge(-10,41,8,118,y,modern?'concrete':'steel');
  kit.bridge(42,-18,20,15,y,modern?'concrete':'steel');
  kit.ramp([-58,0,z],[-10,y,z],8,modern?'concrete':'steel');
  kit.ramp([120,y,z],[168,0,z],8,modern?'concrete':'steel');
  kit.ramp([-10,y,100],[-10,0,148],8,modern?'concrete':'steel');
  for(let x=0;x<=120;x+=24)for(const side of [-1,1]) {
    kit.solid(x,3.8,z+side*2.8,modern?1.3:.65,7.6,modern?1.5:.65,modern?'concrete':'rust');
    if(!modern)kit.beam([x-3,.6,z-2.8],[x+3,7.6,z+2.8],.18,.18,'rust');
  }
  for(let zz=8;zz<=90;zz+=27)for(const side of [-1,1])kit.solid(-10+side*2.8,3.8,zz,.8,7.6,.8,modern?'concrete':'rust');
  // Leave the intersection and ramp transitions clear of collision rails.
  for(const side of [-1,1])kit.rail([x1+5,y,z+side*3.75],[x2,y,z+side*3.75],true,modern?'lightSteel':'yellow');
  kit.rail([-13.75,y,-10],[-13.75,y,90]);kit.rail([-6.25,y,-10],[-6.25,y,100]);
  if(modern) {
    // Enclosed translucent service corridor has alternating open bays and an overhead utility spine.
    for(let x=5;x<120;x+=12) {
      for(const side of [-1,1])kit.box(x,y+3.1,z+side*3.65,.25,6.2,.25,'white');
      kit.box(x,y+6.25,z,.25,.25,8.1,'white');
      if(x>24&&x<90)for(const side of [-1,1])kit.box(x+5,y+2.65,z+side*3.8,10,3.3,.09,'glass');
    }
    kit.box(56,y+6.5,z,132,.18,8.3,'lightSteel',[0,0,0],'roof');
    for(const zz of [-1.7,1.7])kit.pipe([-5,y+5.9,z+zz],[122,y+5.9,z+zz],.28,'cyan');
    for(let zz=0;zz<95;zz+=18){kit.box(-10,y+4.5,zz,8,.22,.3,'white');for(const side of [-1,1])kit.box(-10+side*3.7,y+2.3,zz,.3,4.6,.3,'white');}
    kit.solid(32,6.2,9,7,12.4,7,'white');kit.box(32,10.5,12.6,5,3,.12,'glass');kit.box(32,13,9,8,.6,8,'dark');
  } else {
    for(let x=-5;x<120;x+=12)for(const side of [-1,1]) {
      kit.box(x,y+1.9,z+side*4,.2,3.8,.2,'rust');kit.beam([x,y+.2,z+side*4],[x+12,y+3.6,z+side*4],.17,.17,'rust');
      kit.beam([x,y+3.6,z+side*4],[x+12,y+.2,z+side*4],.13,.13,'steel');
    }
    for(const side of [-1,1])kit.box(56,y+3.8,z+side*4,132,.28,.28,'rust');
    // A walk-through control hut at deck level, with a framed front and back portal.
    const cx=43,cz=-18;for(const side of [-1,1])kit.solid(cx,y+2.6,cz+side*6.5,12,5.2,.4,'green');
    for(const side of [-1,1])for(const dz of [-5.1,5.1])kit.solid(cx+side*6,y+2.6,cz+dz,.4,5.2,2.7,'green');
    kit.box(cx,y+5.4,cz,13,.4,14,'roof',[0,0,0],'roof');kit.box(cx,y+2.5,cz+6.74,8,1.6,.06,'glass');
    kit.box(47,y+1,-22,2,2,1,'dark');kit.box(47,y+1.85,-21.4,1.6,.7,.08,'cyan');
  }
  anchor(kit,d.anchors,'E-west',-10,11,-18,'E');anchor(kit,d.anchors,'E-east',120,11,-18,'E');anchor(kit,d.anchors,'E-south',-10,11,94,'E');
  optionalBridge(d,modern);
  d.events.push({id:'bridge',position:[42,8,-18],zoneId:'E',kind:'bridge',name:modern?'重置转运通道':'放下检修桥'});
}
function optionalBridge(d:BuildData,modern:boolean) {
  const kit=d.kit,previous=kit.current,part=new THREE.Group();part.name='event-lift-bridge';kit.root.add(part);kit.use(part);
  const c=kit.colliders.length,s=kit.surfaces.length;
  kit.ramp([-62,0,98],[-14,8,98],8,modern?'concrete':'steel');
  if(!modern)for(const side of [-1,1])kit.beam([-62,.2,98+side*3.8],[-14,8.2,98+side*3.8],.35,.35,'rust');
  const colliders=kit.colliders.slice(c),surfaces=kit.surfaces.slice(s);for(const c of colliders)c.enabled=false;for(const s of surfaces)s.enabled=false;
  part.position.set(-14,8,98);part.rotation.z=-Math.PI*.44;part.userData.bridgePivot=[-14,8,98];
  d.dynamics.push({object:part,kind:'bridge',id:'bridge',amount:0,progress:0,colliders,surfaces});kit.use(previous);
}
function forklift(kit:HarborKit,x:number,z:number,modern:boolean) {
  const body=modern?'white':'orange';
  kit.solid(x,.72,z,2.5,1.25,4,body);kit.box(x,.7,z-1.9,2.6,1.3,.2,'dark');
  for(const side of [-1,1])for(const dz of [-1.15,1.2]){kit.cylinder(x+side*1.28,.52,z+dz,.5,.3,'dark',[0,0,Math.PI/2],true);kit.cylinder(x+side*1.46,.52,z+dz,.22,.045,'steel',[0,0,Math.PI/2]);}
  for(const side of [-1,1])for(const dz of [-.8,.8])kit.box(x+side*1.05,2,z+dz,.11,2.4,.11,'dark');
  kit.box(x,3.17,z,2.4,.18,2.5,body);kit.box(x,1.6,z+.25,.9,.7,1.1,'dark');
  for(const side of [-1,1]){kit.box(x+side*.77,2,z-2.15,.22,3.8,.25,'steel');kit.box(x+side*.77,.2,z-3,.25,.14,2.6,'steel');}
  kit.box(x,3.77,z-2.15,1.8,.2,.28,'steel');kit.cylinder(x,3.45,z+.7,.13,.3,'yellow');
}
function foreground(kit:HarborKit,modern:boolean) {
  forklift(kit,32,131,modern);forklift(kit,76,123,modern);
  for(const [x,z] of [[30,124],[65,133],[21,143]]){
    kit.crate(x,z,1.8);kit.crate(x+2,z,1.8);kit.box(x+1,.09,z,4.6,.18,2.4,'wood');
  }
  for(const [x,z] of [[59,144],[62,144],[66,121]])kit.barrel(x,z,0,modern?'white':'orange');
  // Cable reels have large side discs and recessed spindles, readable next to the player.
  for(const [x,z] of [[28,140],[69,121]]){
    kit.cylinder(x,.85,z,.6,1.4,'dark',[0,0,Math.PI/2],true);
    for(const dx of [-.8,.8])kit.cylinder(x+dx,.85,z,.85,.16,'wood',[0,0,Math.PI/2],true);
    kit.collider(x,.8,z,1.8,1.6,1.7);
  }
  kit.light(29,143,6);kit.light(73,136,6,-1);
}
function eventTerminal(kit:HarborKit,x:number,y:number,z:number) {
  kit.box(x,y+.6,z,1.3,1.2,.9,'dark');kit.box(x,y+1.45,z,1.7,.7,1,'steel',[.16,0,0]);kit.box(x,y+1.53,z+.52,1.35,.45,.06,'cyan');
  kit.cylinder(x,y+.05,z,1.65,.08,'cyan',undefined,true);
}
function gate(d:BuildData,modern:boolean) {
  const {kit}=d;kit.zone('route events — powered shortcut gate');
  const x=-51,z=20;
  // The gate occupies an optional, short cross-link, never a required loop.
  kit.fence([-69,0,z],[-58.6,0,z]);kit.fence([-43.4,0,z],[-20,0,z]);
  for(const dx of [-7,7])kit.solid(x+dx,3.6,z,1.1,7.2,2,modern?'white':'steel');
  kit.box(x,7,z,15,.8,2.1,modern?'white':'steel');
  const group=new THREE.Group();group.name='event-gate';const old=kit.current;kit.root.add(group);kit.use(group);
  for(const dx of [-5,-2.5,0,2.5,5])kit.box(x+dx,3,z,.3,6,.3,modern?'lightSteel':'rust');
  for(const y of [1,3,5])kit.box(x,y,z,13,.32,.3,modern?'lightSteel':'rust');kit.box(x,3,z,13,5.8,.12,modern?'glass':'dark');
  kit.use(old);const collider=kit.collider(x,3,z,13,6,.5,'dynamic',undefined,'shortcut-gate');
  d.dynamics.push({object:group,kind:'gate',id:'power',amount:0,collider});
}
function oldHarbor():BuildData {
  const kit=new HarborKit(false);
  const d:BuildData={kit,bounds:{minX:-240,maxX:240,minZ:-200,maxZ:200},spawn:[43,0,145],pit:{minX:-149,maxX:-71,minZ:-8,maxZ:147},zones:[
    {id:'A',name:'旧轨堆场',center:[-110,0,-64],radius:65,description:'宽装卸面 · 折线货柜巷 · 低矮货台'},
    {id:'B',name:'红砖货仓',center:[10,0,-91],radius:54,description:'贯通中廊 · 侧仓绕行 · 上层挑台'},
    {id:'C',name:'临时配电场',center:[122,0,-72],radius:55,description:'设备庭 · 配电房通廊 · 检修平台'},
    {id:'D',name:'干船坞',center:[-110,-5,92],radius:58,description:'下沉坞底 · 船体两侧 · 双向坡道'},
    {id:'E',name:'铆接检修桥',center:[43,8,-18],radius:54,description:'桥上长线 · 控制屋 · 桥下短环'},
    {id:'F',name:'临海装卸广场',center:[50,0,106],radius:74,description:'中央作业面 · 港务侧院 · 滨海回环'},
  ],anchors:[],events:[],dynamics:[]};
  ground(kit,d.bounds,d.pit);pavingDetails(kit,false);streets(kit,false);
  kit.zone('A — freight stacks, rail sidings and maintenance shed');
  const colors=['red','green','blue','rust'] as const;
  for(let row=0;row<5;row++)for(let col=0;col<3;col++) {
    const x=-171+col*20,z=-121+row*13;kit.container(x,z,colors[(row+col)%4]);
    if((row+col)%3!==1)kit.container(x,z,colors[(row+col+1)%4],2.92);
  }
  for(const x of [-98,-80])for(const z of [-117,-99])kit.container(x,z,colors[z===-117?1:2],0,12,Math.PI/2);
  // Disused sidings run beside a narrow repair shelter and never create collision trip hazards.
  for(const x of [-204,-199])kit.box(x,.045,-68,.14,.09,138,'steel');
  for(let z=-134;z<2;z+=2.5)kit.box(-201.5,.026,z,7,.08,.35,'wood');
  kit.box(-199,7.5,-122,24,.3,27,'roof',[0,0,.04],'roof');
  for(const x of [-210,-188])for(const z of [-134,-111])kit.solid(x,3.7,z,.45,7.4,.45,'rust');
  kit.gantry(-150,-35,38,20,false);
  kit.solid(-178,.7,-20,29,1.4,16,'concrete');kit.ramp([-178,0,0],[-178,1.4,-12],6);
  for(const [x,z] of [[-175,-24],[-183,-24],[-81,-61],[-72,-78]])kit.crate(x,z,2);
  anchor(kit,d.anchors,'A-crane',-131,12,-35,'A');
  kit.zone('B — brick northlight warehouse, annexes and loading court');
  kit.warehouse(10,-96,64,48);
  kit.utility(-52,-126,19,22,false);
  kit.box(-38,9,-106,5,.6,30,'steel');
  for(const [x,z] of [[-39,-94],[-43,-82],[45,-111],[50,-115],[40,-136]])kit.crate(x,z,2.4);
  kit.container(54,-111,'green',0,12,Math.PI/2);kit.container(55,-132,'rust');
  // Exterior fire stair architecture, a raised loading ledge, gutters and roof ventilators.
  kit.solid(-30,.6,-83,8,1.2,17,'concrete');
  for(let i=0;i<11;i++)kit.box(-28+i*.5,.6+i*.5,-113,.7,1.2+i,3,'steel');
  for(const x of [-10,9,27])kit.cylinder(x,14.5,-90,.65,2.3,'rust');
  anchor(kit,d.anchors,'B-roof',-22,10,-72,'B');
  kit.zone('C — improvised power compound and patched service building');
  kit.utility(125,-113,32,23,false);
  for(const [x,z] of [[93,-74],[112,-75],[145,-76],[157,-103]])kit.transformer(x,z);
  for(const x of [86,107,151])kit.solid(x,.3,-58,9,.6,9,'concrete');
  for(const x of [87,97,150])kit.container(x,-128,'green',0,8,Math.PI/2);
  for(const z of [-142,-46]){kit.fence([80,0,z],[110,0,z]);kit.fence([132,0,z],[169,0,z]);}
  kit.fence([174,0,-141],[174,0,-82]);kit.fence([77,0,-121],[77,0,-81]);
  for(const x of [86,161]){kit.solid(x,4.8,-94,.4,9.6,.4,'rust');kit.pipe([x,9.4,-130],[x,9.4,-51],.15);}
  for(let xx=88;xx<160;xx+=3)kit.pipe([xx,7,-96],[xx,7,-108],.065,'dark');
  kit.box(116,5.8,-63,20,.25,12,'roof',[0,0,0],'roof');for(const x of [106,126])for(const z of [-68,-58])kit.solid(x,2.8,z,.24,5.6,.24,'steel');
  eventTerminal(kit,127,0,-58);d.events.push({id:'power',position:[127,0,-55],zoneId:'C',kind:'power',name:'恢复作业电路'});
  anchor(kit,d.anchors,'C-platform',148,9,-53,'C');
  kit.zone('D — dry dock, hull restoration and working platforms');
  kit.ship(-110,65,53,-3.8,false);
  for(const x of [-145,-75])for(let z=30;z<112;z+=16){kit.box(x,-4.4,z,3,1.2,7,'wood');kit.box(x,-3.65,z,4,.3,8,'steel');}
  kit.paint(-140,93,8,26,'water',-4.93);
  for(const x of [-156,-64]){kit.box(x,.1,74,.2,.1,129,'steel');kit.box(x+2,.1,74,.2,.1,129,'steel');}
  kit.gantry(-110,126,96,25,false);
  for(const z of [37,110])for(const x of [-145,-76])kit.barrel(x,z,-5,'rust');
  kit.sign(-148,2,70,5,false,4,Math.PI/2);
  anchor(kit,d.anchors,'D-north',-70,8,25,'D');anchor(kit,d.anchors,'D-south',-70,8,115,'D');
  elevated(d,false);
  kit.zone('F — waterfront operations plaza and harbor master office');
  foreground(kit,false);
  kit.utility(113,105,28,26,false);
  kit.solid(113,9.5,105,23,6,21,'brickLight');kit.box(113,12.8,105,26,.6,24,'roof',[0,0,0],'roof');
  for(const zz of [96,104,112])kit.box(124.7,9.5,zz,.09,3,4,'glass');
  for(const xx of [104,112,120])kit.box(xx,9.5,115.65,4,3,.1,'glass');
  kit.crane(154,154,Math.PI*.34);kit.crane(-25,176,Math.PI*.7);
  // Foreground spawn equipment establishes scale; open center remains combat-readable.
  for(const [x,z] of [[11,130],[14,130],[78,145],[82,147],[90,117],[22,94]])kit.crate(x,z,2.2);
  for(const [x,z] of [[12,123],[80,139],[95,141],[10,93]])kit.barrel(x,z);
  kit.container(74,171,'blue');kit.container(87,174,'rust');
  for(const z of [40,76,150])kit.light(190,z,10,-1);
  kit.paint(51,106,27,26,'paving',.023);for(const side of [-1,1])kit.hazard(51,106+side*14,29,.6);
  eventTerminal(kit,19,0,91);d.events.push({id:'supply',position:[19,0,88],zoneId:'F',kind:'supply',name:'回收储电箱'});
  anchor(kit,d.anchors,'F-crane',154,12,154,'F');
  gate(d,false);
  kit.zone('distant harbor — vessels, breakwater and lighthouse');
  kit.ship(50,271,110,-1.8,false);kit.ship(-305,35,90,-2,false);
  kit.box(290,-2,145,22,4,280,'paving');
  kit.cylinder(287,13,249,5,28,'white',undefined,true);kit.cylinder(287,22,249,5.15,3,'red',undefined,true);kit.cylinder(287,29,249,6,3,'dark',undefined,true);kit.cylinder(287,29,249,4.8,2.4,'yellow',undefined,true);kit.cylinder(287,32,249,6.4,.9,'roof',undefined,true);
  for(let i=0;i<11;i++){const x=-250+i*47,z=-285-Math.sin(i)*20,h=8+(i%4)*5;kit.box(x,h/2,z,25,h,32,i%2?'steel':'brick');kit.box(x,h,z,28,.6,35,'roof');}
  return d;
}
function newHarbor():BuildData {
  const kit=new HarborKit(true);
  const d:BuildData={kit,bounds:{minX:-250,maxX:250,minZ:-210,maxZ:210},spawn:[43,0,151],pit:{minX:-148,maxX:-68,minZ:-12,maxZ:158},zones:[
    {id:'A',name:'自动货柜区',center:[-110,0,-64],radius:69,description:'纵向货运道 · 塔脚横穿带 · 机器侧院'},
    {id:'B',name:'转运大厅',center:[8,0,-101],radius:58,description:'明亮中庭 · 支柱绕行 · 双翼通廊'},
    {id:'C',name:'模块储能站',center:[126,0,-78],radius:62,description:'并列机组 · 检修前场 · 外圈维护路'},
    {id:'D',name:'冷却检修庭',center:[-108,-5,104],radius:62,description:'渠侧通路 · 下沉设备台 · 双坡道'},
    {id:'E',name:'管廊与高架',center:[43,8,-18],radius:64,description:'高架直段 · 封闭管廊 · 维护塔'},
    {id:'F',name:'工业中庭',center:[50,0,110],radius:78,description:'中央作业面 · 调度楼穿堂 · 外围半环'},
  ],anchors:[],events:[],dynamics:[]};
  ground(kit,d.bounds,d.pit);pavingDetails(kit,true);streets(kit,true);
  kit.zone('A — automated vertical freight towers and sorting gantries');
  for(const x of [-194,-152,-78])for(const z of [-124,-94]) {
    for(let level=0;level<4;level++)kit.container(x,z,level%2?'white':'blue',level*2.93,12);
    for(const dx of [-7.2,7.2])for(const dz of [-2.1,2.1])kit.solid(x+dx,6.4,z+dz,.45,12.8,.45,'lightSteel');
    kit.box(x,12.9,z,16,.5,6,'white');
  }
  for(const x of [-177,-131,-60])kit.gantry(x,-143,25,24,true);
  for(const x of [-210,-168]){kit.box(x,.06,-81,.2,.12,134,'steel');kit.box(x+4,.06,-81,.2,.12,134,'steel');}
  // Sorting islands and roller beds create crossing lanes beneath tall load modules.
  for(const z of [-53,-32]) {
    kit.solid(-171,.8,z,20,1.6,5,'lightSteel');for(let x=-180;x<-161;x+=1)kit.cylinder(x,1.7,z,.18,4.6,'dark',[Math.PI/2,0,0]);
    kit.box(-171,3.8,z,22,.4,6,'cyan');for(const x of [-182,-160])kit.solid(x,1.9,z,.45,3.8,.45,'white');
  }
  for(const [x,z] of [[-212,-55],[-74,-47],[-139,-39]])kit.crate(x,z,2.2);
  anchor(kit,d.anchors,'A-transfer',-131,13,-143,'A');
  kit.zone('B — wide-span butterfly-roof transfer terminal');
  kit.hall(8,-103,76,52);
  // Two independent wings, accessible central forecourt, glazed office mezzanine.
  kit.utility(-49,-131,21,20,true);kit.utility(64,-131,18,24,true);
  for(const x of [-41,55]) {kit.box(x,4,-89,14,.25,27,'white',[0,0,0],'roof');for(const z of [-101,-78])kit.solid(x,2,z,.3,4,.3,'steel');}
  kit.box(8,7,-129,37,1.1,10,'white');kit.box(8,9.5,-130,36,4,8,'glass');kit.box(8,11.7,-130,38,.35,10,'white',[0,0,0],'roof');
  for(const x of [-30,46])kit.light(x,-68,10);
  anchor(kit,d.anchors,'B-canopy',-31,8,-75,'B');
  kit.zone('C — modular battery farm and thermal exchange plant');
  for(const x of [91,113,144,167])for(const z of [-129,-101])kit.battery(x,z);
  kit.utility(127,-53,30,16,true);
  for(const x of [94,156]){kit.transformer(x,-64);kit.solid(x,.25,-64,8,.5,9,'concrete');}
  for(const x of [83,181]) {kit.pipe([x,3,-143],[x,3,-45],.55,'lightSteel');for(const z of [-139,-107,-75,-47])kit.solid(x,1.4,z,.35,2.8,.35,'steel');}
  for(const z of [-147,-38]){kit.fence([81,0,z],[115,0,z]);kit.fence([138,0,z],[184,0,z]);}
  kit.fence([188,0,-147],[188,0,-86]);
  eventTerminal(kit,127,0,-77);d.events.push({id:'power',position:[127,0,-80],zoneId:'C',kind:'power',name:'恢复分区供电'});
  anchor(kit,d.anchors,'C-storage',155,8,-45,'C');
  kit.zone('D — cooling channels, crossovers and service platforms');
  // Separate lower water channels are physically excluded from navigation.
  for(const x of [-137,-79]) {
    kit.box(x,-4.8,72,15,.08,90,'water');
    kit.collider(x,-3.6,72,15,2.8,90,'solid',undefined,`cooling-channel-${x}`);
    kit.rail([x+(x<-108?8.3:-8.3),-5,27],[x+(x<-108?8.3:-8.3),-5,117],true,'lightSteel');
    for(const z of [34,65,96]){kit.pipe([x,-3.8,z],[x,-3.8,z+12],1,'lightSteel');kit.cylinder(x,-3.8,z+12,1.4,.5,'steel',[Math.PI/2,0,0]);}
  }
  kit.bridge(-108,70,34,8,-3,'concrete');kit.ramp([-108,-5,45],[-108,-3,66],10);kit.ramp([-108,-3,74],[-108,-5,95],10);
  for(const x of [-119,-97])for(const z of [46,97]){kit.solid(x,-3.5,z,5,3,7,'white');kit.box(x,-1.93,z,5,.15,7,'cyan');kit.cylinder(x,-1.5,z,1.6,.7,'dark');}
  kit.gantry(-108,134,99,22,true);
  for(const z of [35,110])kit.box(-108,-4.9,z,20,.08,.2,'yellow');
  anchor(kit,d.anchors,'D-north',-68,7,26,'D');anchor(kit,d.anchors,'D-south',-68,7,120,'D');
  elevated(d,true);
  kit.zone('F — dispatch atrium, architectural canopy and robot loading plaza');
  foreground(kit,true);
  // Open ground-level undercroft; inhabited-looking upper volume, no fake entry wall.
  const cx=113,cz=105;for(const dx of [-15,15])for(const dz of [-16,16])kit.solid(cx+dx,6,cz+dz,2.2,12,2.2,'concrete');
  kit.box(cx,10,cz,36,1.1,39,'white');kit.box(cx,16,cz,32,11,35,'lightSteel');kit.collider(cx,16,cz,32,11,35);
  for(const side of [-1,1]){kit.box(cx+side*16.1,16,cz,.1,8,33,'glass');kit.box(cx,16,cz+side*17.6,30,8,.1,'glass');}
  for(let xx=-14;xx<=14;xx+=7)kit.box(cx+xx,16,cz+17.8,.16,8,.2,'white');
  kit.box(cx,22,cz,37,.8,40,'white',[0,0,0],'roof');kit.box(cx,22.5,cz,15,.6,25,'dark');
  kit.sign(cx,8,cz+18,9,true,3);
  kit.box(50,.1,109,42,.18,35,'paving');for(const side of [-1,1])kit.hazard(50,109+side*18,43,.7);
  // A broad cantilever canopy frames the sea without enclosing the battle space.
  for(const x of [18,72]){kit.solid(x,6.8,167,1.2,13.6,1.2,'white');kit.beam([x,8,167],[x,13.4,180],.55,.55,'lightSteel');}
  kit.box(45,13.8,170,64,.5,24,'white',[0,0,0],'roof');kit.box(45,13.45,170,60,.15,.6,'cyan');
  kit.gantry(182,143,38,39,true);kit.gantry(185,62,36,35,true);
  for(const [x,z] of [[17,133],[77,143],[81,146],[146,127],[149,130]])kit.crate(x,z,2.2);
  for(const [x,z] of [[18,128],[89,144],[153,125]])kit.barrel(x,z,0,'white');
  kit.container(158,184,'white');kit.container(170,188,'blue');
  eventTerminal(kit,18,0,98);d.events.push({id:'supply',position:[18,0,95],zoneId:'F',kind:'supply',name:'吊运补给舱'});
  anchor(kit,d.anchors,'F-canopy',18,12,167,'F');
  gate(d,true);
  kit.zone('offshore horizon — automated cranes, wind farm and shipping');
  kit.ship(80,286,135,-1.5,true);
  for(const [x,z] of [[-340,280],[-235,325],[225,361],[330,286],[425,375]]) {
    kit.cylinder(x,21,z,1.4,45,'white');kit.box(x,43,z,3,3,7,'white');
    const rotor=new THREE.Group();rotor.name=`wind-rotor-${x}`;rotor.position.set(x,44,z+4);const saved=kit.current;kit.root.add(rotor);kit.use(rotor);
    kit.cylinder(0,0,0,1.2,2,'white',[Math.PI/2,0,0],true);
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3;kit.beam([Math.sin(a)*2,Math.cos(a)*2,0],[Math.sin(a)*21,Math.cos(a)*21,0],.9,.25,'white');}
    kit.use(saved);d.dynamics.push({object:rotor,kind:'rotor',id:`rotor-${x}`,amount:0});
  }
  for(let i=0;i<7;i++){const x=-220+i*67;kit.box(x,10,-300,35,20,40,'white');kit.box(x,20.5,-300,38,.6,44,'steel');kit.cylinder(x,28,-300,3,16,'lightSteel');}
  return d;
}

function surfaceHeight(s:Surface,x:number,z:number) {
  if(s.endY===undefined||!s.axis)return s.y;
  const t=s.axis==='x'?(x-s.minX)/(s.maxX-s.minX):(z-s.minZ)/(s.maxZ-s.minZ);
  return s.y+(s.endY-s.y)*THREE.MathUtils.clamp(t,0,1);
}
function inSurface(s:Surface,x:number,z:number) {return s.enabled!==false&&x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ;}
function makeNavigation(d:BuildData,walkable:MapWorld['walkableAt'],heightAt:MapWorld['heightAt']):MapWorld['nav'] {
  // A sparse occupancy graph follows real authored floor and obstacle geometry.
  // Neighbor edges are checked at sub-metre intervals to prohibit diagonal corner cuts.
  const waypoints:NavWaypoint[]=[],edges:NavEdge[]=[],grid=new Map<string,NavWaypoint>(),step=12;
  for(let x=d.bounds.minX+10;x<d.bounds.maxX-8;x+=step)for(let z=d.bounds.minZ+10;z<d.bounds.maxZ-8;z+=step) {
    const upperRamp=d.kit.surfaces.some(s=>s.tag==='ramp'&&Math.max(s.y,s.endY??s.y)>0&&inSurface(s,x,z));
    if(upperRamp)continue;
    const y=heightAt(x,z,0);if(!walkable(x,z,y,.8))continue;
    const point:NavWaypoint={id:`g${x}:${z}`,position:[x,y,z],layer:y<-1?-1:0};grid.set(`${x}:${z}`,point);waypoints.push(point);
  }
  const connect=(a:NavWaypoint,b:NavWaypoint)=> {
    const dist=Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2]);const n=Math.ceil(dist/1.2);
    for(let t=0;t<=n;t++) {const f=t/n,x=a.position[0]+(b.position[0]-a.position[0])*f,z=a.position[2]+(b.position[2]-a.position[2])*f;
      const expected=a.position[1]+(b.position[1]-a.position[1])*f,y=heightAt(x,z,expected);if(Math.abs(y-expected)>.55||!walkable(x,z,y,.6))return;
    }
    edges.push({from:a.id,to:b.id,enabled:true});
  };
  for(const a of waypoints) for(const [dx,dz] of [[step,0],[0,step],[step,step],[-step,step]]) {const b=grid.get(`${a.position[0]+dx}:${a.position[2]+dz}`);if(b)connect(a,b);}
  // Explicit small-step elevated and ramp nodes connect upper and lower paths without teleporting floors.
  const chains:Vec3[][]=[[],[],[],[],[]];
  for(let x=-58;x<=-10;x+=4)chains[0].push([x,(x+58)/6,-18]);
  for(let x=-10;x<=120;x+=5)chains[1].push([x,8,-18]);
  for(let x=120;x<=168;x+=4)chains[2].push([x,8-(x-120)/6,-18]);
  for(let z=-18;z<=100;z+=4)chains[3].push([-10,8,z]);chains[3].push([-10,8,100]);
  for(let z=100;z<=148;z+=4)chains[4].push([-10,8-(z-100)/6,z]);
  if(d.dynamics.some(p=>p.kind==='bridge'&&(p.progress??0)>=1)){const optional:Vec3[]=[];for(let x=-62;x<=-14;x+=4)optional.push([x,(x+62)/6,98]);optional.push([-10,8,98]);chains.push(optional);}
  const upper:NavWaypoint[]=[];
  for(let c=0;c<chains.length;c++)for(let j=0;j<chains[c].length;j++) {
    const n:NavWaypoint={id:`e${c}:${j}`,position:chains[c][j],layer:1,zoneId:'E'};upper.push(n);waypoints.push(n);if(j>0)edges.push({from:`e${c}:${j-1}`,to:n.id,enabled:true});
  }
  for(const n of upper) {
    for(const other of upper){if(n.id>=other.id)continue;if(new THREE.Vector3(...n.position).distanceTo(new THREE.Vector3(...other.position))<1)edges.push({from:n.id,to:other.id,enabled:true});}
    if(n.position[1]<.4) {
      const near=Array.from(grid.values()).sort((a,b)=>Math.hypot(a.position[0]-n.position[0],a.position[2]-n.position[2])-Math.hypot(b.position[0]-n.position[0],b.position[2]-n.position[2])).slice(0,6);
      for(const other of near)connect(n,other);
    }else for(const other of grid.values())if(Math.abs(other.position[1]-n.position[1])<1&&Math.hypot(other.position[0]-n.position[0],other.position[2]-n.position[2])<9)connect(n,other);
  }
  return {waypoints,edges};
}

/** Build original editable parametric environment; used by authoring and export. */
export function buildMap(id:MapId):MapWorld {
  const d=id==='new-harbor'?newHarbor():oldHarbor(),surfaces=d.kit.surfaces,colliders=d.kit.colliders;
  const group=d.kit.finish();
  for(const p of d.dynamics)if(p.kind==='bridge')p.object.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.translate(14,-8,-98);});
  group.userData={mapId:id,units:'metres',up:'Y',originalAsset:true};
  const heightAt:MapWorld['heightAt']=(x,z,currentY) => {
    const matches=surfaces.filter(s=>inSurface(s,x,z));
    if(!matches.length)return 0;
    // Ground is selected under a deck; caller's current feet elevation keeps the deck when on it.
    const groundSurfaces=matches.filter(s=>s.tag==='ground');
    let y=groundSurfaces.length?Math.max(...groundSurfaces.map(s=>s.y)):0;
    for(const s of matches) {
      if(s.tag==='ground')continue;
      const sy=surfaceHeight(s,x,z);
      if(s.tag==='ramp') {
        // Lower dock slopes replace the floor; upper ramps are traversed when feet reach them.
        if(sy<=.1||currentY===undefined||Math.abs((currentY??0)-sy)<2.1)y=Math.max(y,sy);
      } else if(currentY!==undefined&&currentY>=sy-1.5)y=Math.max(y,sy);
    }
    return y;
  };
  const walkableAt:MapWorld['walkableAt']=(x,z,currentY,radius=.55)=> {
    const b=d.bounds;if(x<b.minX+radius||x>b.maxX-radius||z<b.minZ+radius||z>b.maxZ-radius)return false;
    const y=currentY??heightAt(x,z);
    for(const c of colliders) {
      if(c.enabled===false||c.tag==='ground'||c.tag==='bridge'||c.tag==='ramp')continue;
      if(y+1.7<c.center[1]-c.half[1]||y+.12>c.center[1]+c.half[1])continue;
      let dx=x-c.center[0],dz=z-c.center[2];const angle=c.rotation?.[1]??0;
      if(angle){const a=dx*Math.cos(angle)-dz*Math.sin(angle);dz=dx*Math.sin(angle)+dz*Math.cos(angle);dx=a;}
      if(Math.abs(dx)<c.half[0]+radius&&Math.abs(dz)<c.half[2]+radius)return false;
    }
    return true;
  };
  const nav=makeNavigation(d,walkableAt,heightAt),index=new Map(nav.waypoints.map((w,i)=>[w.id,i]));
  const neighbors:number[][]=Array.from({length:nav.waypoints.length},()=>[]);
  for(const edge of nav.edges){const a=index.get(edge.from)!,b=index.get(edge.to)!;neighbors[a].push(b);neighbors[b].push(a);}
  const rebuildNavigation=()=>{const next=makeNavigation(d,walkableAt,heightAt);nav.waypoints.splice(0,nav.waypoints.length,...next.waypoints);nav.edges.splice(0,nav.edges.length,...next.edges);index.clear();nav.waypoints.forEach((w,i)=>index.set(w.id,i));neighbors.length=0;nav.waypoints.forEach(()=>neighbors.push([]));for(const edge of nav.edges){const a=index.get(edge.from)!,b=index.get(edge.to)!;neighbors[a].push(b);neighbors[b].push(a);}};
  const findPath:MapWorld['findPath']=(from,to)=> {
    const nearest=(p:Vec3)=>{let result=0,best=Infinity;nav.waypoints.forEach((n,i)=>{const dist=Math.hypot(n.position[0]-p[0],(n.position[1]-p[1])*4,n.position[2]-p[2]);if(dist<best){best=dist;result=i;}});return result;};
    const start=nearest(from),goal=nearest(to);if(start===goal)return [to];
    const previous=new Int32Array(nav.waypoints.length).fill(-1),queue=[start];previous[start]=start;
    for(let q=0;q<queue.length&&previous[goal]===-1;q++){const a=queue[q];for(const b of neighbors[a])if(previous[b]===-1){previous[b]=a;queue.push(b);}}
    if(previous[goal]===-1)return [];
    const path:Vec3[]=[to];for(let i=goal;i!==start;i=previous[i])path.push([...nav.waypoints[i].position]);path.reverse();return path;
  };
  const occluders:THREE.Object3D[]=[];group.traverse(o=>{if(o.userData.cameraFade)occluders.push(o);});
  let disposed=false;
  const world:MapWorld={id,group,bounds:d.bounds,spawn:new THREE.Vector3(...d.spawn),zones:d.zones,colliders,anchors:d.anchors,nav,eventSites:d.events,occluders,
    theme:id==='old-harbor'?{background:0x779496,fog:0x8ca5a3,fogNear:165,fogFar:625,ambient:0xb9ced0,sun:0xffd8ad,sunPosition:[-130,190,80],exposure:1.18}:{background:0x90b4c5,fog:0xa5c4cf,fogNear:195,fogFar:680,ambient:0xd8e7ed,sun:0xfff0d3,sunPosition:[-100,240,-60],exposure:1.06},
    heightAt,walkableAt,findPath,
    openShortcut(shortcutId,immediate=false) {
      for(const p of d.dynamics)if(p.id===shortcutId&&(p.kind==='gate'||p.kind==='bridge')){
        p.amount=1;if(p.collider)p.collider.enabled=false;
        // Loading a completed event restores its final terrain before the saved actor is resumed.
        if(immediate){
          if(p.kind==='gate')p.object.position.y=7;
          if(p.kind==='bridge'){p.progress=1;p.object.rotation.z=0;p.colliders?.forEach(c=>c.enabled=true);p.surfaces?.forEach(s=>s.enabled=true);}
        }
      }
      rebuildNavigation();
    },
    update(time,dt) {
      for(const p of d.dynamics){if(p.kind==='gate')p.object.position.y=THREE.MathUtils.damp(p.object.position.y,p.amount*7,1.1,dt);if(p.kind==='rotor')p.object.rotation.z=time*.15;
        if(p.kind==='bridge'&&p.amount>0&&(p.progress??0)<1){p.progress=Math.min(1,(p.progress??0)+dt/8);p.object.rotation.z=-(1-p.progress)*Math.PI*.44;if(p.progress===1){p.colliders?.forEach(c=>c.enabled=true);p.surfaces?.forEach(s=>s.enabled=true);rebuildNavigation();}}}
    },
    dispose() {if(disposed)return;disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();},
  };
  return world;
}

/** Load the generated glTF 2.0 shipping asset while keeping exact authoring collision/navigation metadata. */
export async function loadMap(id:MapId,onProgress?:(ratio:number)=>void):Promise<MapWorld> {
  const world=buildMap(id);
  try {
    const gltf=await new GLTFLoader().loadAsync(`/assets/environment/${id}.glb`,e=>{if(e.total)onProgress?.(e.loaded/e.total);});
    // Runtime dynamic parts keep their original meshes so event references remain stable.
    const original=new Map<string,THREE.Object3D>();for(const o of world.group.children)if(o.name==='event-gate'||o.name==='event-lift-bridge'||o.name.startsWith('wind-rotor-'))original.set(o.name,o);
    world.occluders.length=0;
    const originalMaterials=new Set<THREE.Material>(),retainedMaterials=new Set<THREE.Material>();
    for(const child of original.values())child.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>retainedMaterials.add(m));});
    const geoms=new Set<THREE.BufferGeometry>();for(const child of [...world.group.children])if(!original.has(child.name)){child.traverse(o=>{if(o instanceof THREE.Mesh){geoms.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>originalMaterials.add(m));}});world.group.remove(child);}
    geoms.forEach(g=>g.dispose());for(const mat of originalMaterials)if(!retainedMaterials.has(mat))mat.dispose();
    const content=gltf.scene.children.length===1?gltf.scene.children[0]:gltf.scene;
    for(const child of [...content.children])if(!original.has(child.name)){world.group.add(child);child.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=!o.name.includes('ground')&&!o.name.includes('paint')&&!o.name.includes('water');o.receiveShadow=true;if(o.name.includes('roof')){o.userData.cameraFade=true;world.occluders.push(o);}}});}
    // Original small repeating material textures preserve metre-scaled surface detail at gameplay distance.
    const textureNames=['brick','concrete','asphalt','rust','wood'];const textures=await Promise.all(textureNames.map(async name=>{const t=await new THREE.TextureLoader().loadAsync(`/assets/environment/${name}.png`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return [name,t] as const;}));
    const textureMap=Object.fromEntries(textures);const materialTexture:Record<string,string>={brick:'brick',brickLight:'brick',concrete:'concrete',paving:'concrete',asphalt:'asphalt',rust:'rust',wood:'wood'};
    world.group.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m instanceof THREE.MeshStandardMaterial){const key=m.name.replace('harbor-','');if(materialTexture[key]){m.map=textureMap[materialTexture[key]];m.needsUpdate=true;}}}
      if(o.name.includes('paint')){o.material=mats.map(m=>{const paint=m.clone();paint.polygonOffset=true;paint.polygonOffsetFactor=-3;paint.polygonOffsetUnits=-4;return paint;});if(!Array.isArray(o.geometry.groups)||o.geometry.groups.length===0)o.material=(o.material as THREE.Material[])[0];}
    }});
    const dispose=world.dispose;world.dispose=()=>{textures.forEach(([,t])=>t.dispose());dispose();};
    onProgress?.(1);return world;
  } catch(error) {world.dispose();throw new Error(`地图资源加载失败 (${id})：${error instanceof Error?error.message:String(error)}`);}
}
