import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {MapWorld} from '../world/types';
import type {RunState,Settings,Vec,Mob,FX,Drone} from './types';
import {MachineLibrary} from './machines';
import {RenderPool} from './render-pool';
import {ENCOUNTERS} from './encounters';

type Actor={root:THREE.Object3D;mixer:THREE.AnimationMixer;actions:Map<string,THREE.AnimationAction>;clip:string;death:number;lastHp:number;flash:number;};
type FadedMesh={mesh:THREE.Mesh;original:THREE.Material|THREE.Material[];materials:THREE.Material[];baseOpacity:number[];baseTransparent:boolean[];baseDepth:boolean[];opacity:number;};
const ENEMIES=['crawler','rammer','gunner','bulwark','weaver'] as const;
const GOLD=0xffd387,CYAN=0xa4f5ed,VIOLET=0xcca3ff,RED=0xff7959;
const flat:[number,number,number]=[-Math.PI/2,0,0];
const at=(p:Vec,y=0):Vec=>({x:p.x,y:p.y+y,z:p.z});
const clamp=THREE.MathUtils.clamp;

/** Render adapter only: it never advances simulation, health, movement or event progress. */
export class SurgeRenderer{
 readonly renderer:THREE.WebGLRenderer;
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(48,1,.15,500);
 readonly actors=new Map<number,Actor>();
 readonly assets=new Map<string,GLTF>();
 private hero:Actor|null=null;
 private world:MapWorld|null=null;
 private settings:Settings;
 private actorGroup=new THREE.Group();
 private machineGroup=new THREE.Group();
 private machines=new MachineLibrary();
 private drones=new Map<number,{root:THREE.Group;kind:Drone['kind']}>();
 private loader=new GLTFLoader();
 private tools=new Map<string,THREE.Object3D>();
 private loaded=false;
 private loading:Promise<void>|null=null;
 private disposed=false;
 private cameraReady=false;
 private look=new THREE.Vector3();
 private desired=new THREE.Vector3();
 private smoothLook=new THREE.Vector3();
 private previousPlayer=new THREE.Vector3();
 private stepPlayer=new THREE.Vector3();
 private stepYaw=0;
 private stepTime=-1;
 private visualPlayer=new THREE.Vector3();
 private visualYaw=0;
 private movementSpeed=0;
 private canvasRect={left:0,top:0,width:1,height:1};
 private tmp=new THREE.Vector3();
 private wrist=new THREE.Vector3();
 private toolLook=new THREE.Matrix4();
 private toolTarget=new THREE.Vector3();
 private menuTime=0;
 private lastSimulationTime=0;
 private lastSync=false;
 private syncFlash=0;
 private actionLock=0;
 private heroAction='';
 private previousActionTime=0;
 private ambient=new THREE.HemisphereLight(0xd8edec,0x646175,2.1);
 private sun=new THREE.DirectionalLight(0xffe3b3,3.3);
 private rim=new THREE.DirectionalLight(0xd7c8ff,1.4);
 private occlusionRay=new THREE.Raycaster();
 private faded:FadedMesh[]=[];
 private fadeHits=new Set<THREE.Object3D>();
 private occlusionTick=0;
 private contact:RenderPool;
 private rings:RenderPool;
 private discs:RenderPool;
 private arcs:RenderPool;
 private segments:RenderPool;
 private sparks:RenderPool;
 private bullets:RenderPool;
 private loot:RenderPool;
 private healLoot:RenderPool;
 private beacons:RenderPool;
 private arrows:RenderPool;
 private pools:RenderPool[];
 private labelLayer=document.createElement('div');
 private labels=new Map<number,HTMLDivElement>();
 private arcHeadings=new Map<number,number>();
 private resizeHandler=()=>this.resize();
 private canvas:HTMLCanvasElement;
 constructor(canvas:HTMLCanvasElement,settings:Settings){
  this.canvas=canvas;this.settings={...settings};
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  this.scene.background=new THREE.Color(0xa5c5c9);this.scene.fog=new THREE.Fog(0xa5c5c9,75,220);
  this.sun.position.set(25,45,20);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:130});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.065;this.rim.position.set(-25,30,-20);
  this.scene.add(this.ambient,this.sun,this.sun.target,this.rim,this.actorGroup,this.machineGroup);
  this.contact=new RenderPool(new THREE.CircleGeometry(1,24),450);this.contact.mesh.renderOrder=0;
  this.rings=new RenderPool(new THREE.RingGeometry(.89,1,48),400);
  this.discs=new RenderPool(new THREE.CircleGeometry(1,40),180);
  this.arcs=new RenderPool(new THREE.RingGeometry(.83,1,36,1,Math.PI*.1,Math.PI*.8),160,{additive:true});
  this.segments=new RenderPool(new THREE.CylinderGeometry(.5,.5,1,5),2600,{additive:true});
  this.sparks=new RenderPool(new THREE.IcosahedronGeometry(1,0),1600,{additive:true});
  this.bullets=new RenderPool(new THREE.IcosahedronGeometry(1,1),1500);
  this.loot=new RenderPool(new THREE.OctahedronGeometry(1,0),3000);
  this.healLoot=new RenderPool(new THREE.BoxGeometry(1,1,1),256);
  this.beacons=new RenderPool(new THREE.CylinderGeometry(.5,.5,1,8),64,{additive:true});
  const arrow=new THREE.Shape();arrow.moveTo(0,-.6);arrow.lineTo(.48,.08);arrow.lineTo(.18,.03);arrow.lineTo(.18,.58);arrow.lineTo(-.18,.58);arrow.lineTo(-.18,.03);arrow.lineTo(-.48,.08);arrow.closePath();
  this.arrows=new RenderPool(new THREE.ShapeGeometry(arrow),80);
  this.pools=[this.contact,this.rings,this.discs,this.arcs,this.segments,this.sparks,this.bullets,this.loot,this.healLoot,this.beacons,this.arrows];this.pools.forEach(p=>this.scene.add(p.mesh));
  this.labelLayer.setAttribute('aria-hidden','true');this.labelLayer.dataset.surgeCombat='true';Object.assign(this.labelLayer.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'3',contain:'layout style paint'});document.body.append(this.labelLayer);
  window.addEventListener('resize',this.resizeHandler);this.applySettings(settings);
 }
 async load(progress:(n:number,label:string)=>void){
  if(this.loaded){progress(1,'港区准备就绪');return;}
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   const items=[['hero','characters/oinja'],...ENEMIES.map(k=>[k,'enemies/'+k]),...['shield','cannon','grapple'].map(k=>['tool-'+k,'characters/tool_'+k])];let done=0;
   const results=await Promise.allSettled(items.map(async([key,path])=>{
    const gltf=await this.loader.loadAsync('/assets/'+path+'.glb');
    if(this.disposed){this.disposeAsset(gltf);return;}
    gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=key!=='hero';}});
    this.assets.set(key,gltf);progress(++done/items.length,'载入角色、机械敌群与支援系统');
   }));
   const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
   if(this.disposed)return;
   this.hero=this.makeActor('hero');this.hero.root.scale.setScalar(1.3);this.actorGroup.add(this.hero.root);
   for(const key of ['shield','cannon','grapple']){const tool=this.assets.get('tool-'+key)!.scene;tool.visible=false;this.scene.add(tool);this.tools.set(key,tool);}
   this.loaded=true;progress(1,'港区准备就绪');
  })();
  try{await this.loading;}catch(error){this.assets.forEach(asset=>this.disposeAsset(asset));this.assets.clear();this.loading=null;throw error;}
 }
 /** Compile first-use actors and effects while the loading overlay is still present. */
 async warmup(){
  if(!this.loaded||this.disposed)return;
  const group=new THREE.Group(),actors:Actor[]=[],spawn=this.world?.spawn??{x:0,y:0,z:0};
  this.scene.add(group);this.follow(spawn,0,true);
  try{
   ENEMIES.forEach((key,i)=>{const actor=this.makeActor(key);actors.push(actor);actor.root.position.set(spawn.x+(i-2)*2,spawn.y,spawn.z-3);group.add(actor.root);});
   for(const kind of ['drone','titan','medic','prism'] as const){const root=this.machines.create(kind);root.position.set(spawn.x,spawn.y+1,spawn.z-5);group.add(root);}
   for(const pool of this.pools){pool.reset();pool.add(spawn,.01,0xffffff,1);pool.finish();}
   this.scene.updateMatrixWorld(true);await this.renderer.compileAsync(this.scene,this.camera);
   // Populate shadow variants and GPU buffers without exposing temporary actors in the playfield.
   const scissor=this.renderer.getScissor(new THREE.Vector4()),scissorTest=this.renderer.getScissorTest();
   try{this.renderer.setScissor(0,0,1,1);this.renderer.setScissorTest(true);this.renderer.render(this.scene,this.camera);}finally{this.renderer.setScissor(scissor);this.renderer.setScissorTest(scissorTest);}
  }finally{group.removeFromParent();actors.forEach(actor=>this.disposeActor(actor));this.pools.forEach(pool=>{pool.reset();pool.finish();});this.cameraReady=false;}
 }
 /** Retain just the preceding fixed-step pose; no RunState cloning or mutation. */
 captureStep(state:RunState){this.stepPlayer.set(state.player.x,state.player.y,state.player.z);this.stepYaw=state.yaw;this.stepTime=state.time;}
 setWorld(world:MapWorld){
  if(this.world===world)return;
  this.clear();this.restoreOcclusion();if(this.world){this.scene.remove(this.world.group);this.world.dispose();}
  this.world=world;this.scene.add(world.group);this.scene.background=new THREE.Color(world.theme.background);this.scene.fog=new THREE.Fog(world.theme.fog,Math.max(70,world.theme.fogNear),Math.max(160,world.theme.fogFar));
  this.ambient.color.setHex(world.theme.ambient);this.sun.color.setHex(world.theme.sun);this.renderer.toneMappingExposure=clamp(world.theme.exposure,.95,1.35);
  const seen=new Set<THREE.Mesh>();for(const root of world.occluders)root.traverse(o=>{if(!(o instanceof THREE.Mesh)||seen.has(o))return;seen.add(o);const originals=Array.isArray(o.material)?o.material:[o.material];const materials=originals.map(m=>{const copy=m.clone();copy.transparent=true;return copy;});this.faded.push({mesh:o,original:o.material,materials,baseOpacity:materials.map(m=>m.opacity),baseTransparent:originals.map(m=>m.transparent),baseDepth:materials.map(m=>m.depthWrite),opacity:1});o.material=Array.isArray(o.material)?materials:materials[0];});
  this.cameraReady=false;
 }
 applySettings(settings:Settings){this.settings={...settings,cameraDistance:clamp(settings.cameraDistance||26,22,30)};this.renderer.shadowMap.enabled=settings.quality!=='low';const size=settings.quality==='high'?2048:1024;if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}this.resize();}
 resize(){if(this.disposed)return;const width=this.canvas.clientWidth||window.innerWidth,height=this.canvas.clientHeight||window.innerHeight;this.camera.aspect=width/Math.max(1,height);this.camera.fov=clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(32))/this.camera.aspect)),35,65);this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.settings.quality==='high'?1.75:this.settings.quality==='low'?1:1.5));this.renderer.setSize(width,height,false);this.canvasRect=this.canvas.getBoundingClientRect();}
 clear(){
  for(const actor of this.actors.values()){actor.root.removeFromParent();this.disposeActor(actor);}this.actors.clear();
  for(const drone of this.drones.values())drone.root.removeFromParent();this.drones.clear();
  this.pools.forEach(p=>{p.reset();p.finish();});this.labels.forEach(l=>l.remove());this.labels.clear();this.arcHeadings.clear();this.tools.forEach(t=>t.visible=false);
  this.cameraReady=false;this.stepTime=-1;this.movementSpeed=0;this.heroAction='';this.previousActionTime=0;this.actionLock=0;this.lastSimulationTime=0;this.lastSync=false;this.syncFlash=0;
  if(this.hero)this.play(this.hero,'idle');
 }
 render(state:RunState|null,dt:number,alpha=1){
  if(this.disposed)return;
  const frameDt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.menuTime+=frameDt;
  const playing=state?.phase==='playing',motionDt=state?playing?frameDt:0:frameDt,time=state?.time??this.menuTime;
  let p:Vec=state?.player??this.world?.spawn??{x:0,y:0,z:0};
  this.visualYaw=state?.yaw??Math.PI+.25;
  if(state&&playing&&this.stepTime>=0&&state.time-this.stepTime<=.11){
   const blend=clamp(alpha,0,1),span=Math.max(1/60,state.time-this.stepTime);
   this.movementSpeed=Math.hypot(p.x-this.stepPlayer.x,p.z-this.stepPlayer.z)/span;
   this.visualPlayer.set(p.x,p.y,p.z).lerp(this.stepPlayer,1-blend);p=this.visualPlayer;
   this.visualYaw=this.stepYaw+Math.atan2(Math.sin(state.yaw-this.stepYaw),Math.cos(state.yaw-this.stepYaw))*blend;
  }else{this.movementSpeed=Math.hypot(p.x-this.previousPlayer.x,p.z-this.previousPlayer.z)/Math.max(frameDt,.001);if(!playing)this.stepTime=-1;}
  if(state&&state.time<this.lastSimulationTime-.1)this.clear();this.lastSimulationTime=state?.time??0;
  this.follow(p,frameDt,!!state);this.pools.forEach(pool=>pool.reset());
  if(this.hero)this.drawHero(state,p,motionDt,frameDt);
  if(state){
   this.drawEnemies(state,motionDt);this.drawMachines(state,motionDt);this.drawShots(state);this.drawDrops(state);this.drawFields(state);this.drawEffects(state);this.drawEvents(state);this.drawEncounter(state);
   this.drawSync(state,frameDt,p);this.drawLabels(state);
  }else{
   if(this.actors.size||this.drones.size){for(const a of this.actors.values()){a.root.removeFromParent();this.disposeActor(a);}this.actors.clear();this.drones.forEach(d=>d.root.removeFromParent());this.drones.clear();}
   this.labelLayer.style.display='none';this.tools.forEach(t=>t.visible=false);
   this.rings.add(at(p,.04),1.35,GOLD,.6,flat);this.rings.add(at(p,.035),1.55,VIOLET,.18,flat);
  }
  this.contact.add(at(p,.022),[.77,.56,1],0x1a2030,.3,flat);
  this.world?.update(time,motionDt);this.fadeOcclusion(p,frameDt,state?1:2/1.3);
  if(state&&playing&&this.settings.shake&&!this.settings.reducedMotion){const hurt=Math.max(0,.2-(state.time-state.lastHurt));const shake=Math.min(.13,hurt*.38+this.syncFlash*.026);this.camera.position.x+=Math.sin(time*89)*shake;this.camera.position.y+=Math.cos(time*73)*shake*.55;}
  this.pools.forEach(pool=>pool.finish());this.renderer.render(this.scene,this.camera);this.previousPlayer.set(p.x,p.y,p.z);
 }
 private follow(p:Vec,dt:number,inRun:boolean){
  const distance=this.settings.cameraDistance;const height=distance*.669,back=distance*.743;
  this.look.set(p.x,p.y+.8,p.z-1.2);this.desired.set(p.x,p.y+.8+height,p.z-1.2+back);
  if(!inRun){const previewDistance=20;this.look.set(p.x-5.6,p.y+1.5,p.z);this.desired.set(this.look.x,this.look.y+previewDistance*.5,this.look.z+previewDistance*.866);}
  if(!this.cameraReady){this.camera.position.copy(this.desired);this.smoothLook.copy(this.look);this.previousPlayer.set(p.x,p.y,p.z);this.cameraReady=true;}else{const rate=1-Math.exp(-10*dt);this.camera.position.lerp(this.desired,rate);this.smoothLook.lerp(this.look,rate);}
  this.camera.lookAt(this.smoothLook);this.sun.position.set(p.x+23,p.y+42,p.z+17);this.sun.target.position.set(p.x,p.y,p.z);
 }
 private drawHero(state:RunState|null,p:Vec,dt:number,frameDt:number){
  const hero=this.hero!;hero.root.position.set(p.x,p.y,p.z);hero.root.rotation.y=this.visualYaw;hero.root.scale.setScalar(state?1.3:2);
  const speed=this.movementSpeed;let clip='idle';
  if(state){
   if(state.phase==='paused'||state.phase==='upgrade')clip=hero.clip;else if(state.phase==='lost')clip='death';else if(state.phase==='won')clip='victory';else if(state.dashTime>0)clip='run';else{
    // A new attack may trigger a short pose; sustained fields and equipped skills never hold it.
    const key=state.action;const oldAction=this.heroAction;this.actionLock=Math.max(0,this.actionLock-dt);
    if(state.actionTime>0&&(key!==oldAction||state.actionTime>this.previousActionTime+.025)){this.heroAction=key;this.actionLock=Math.min(.34,state.actionTime);}
    if(state.actionTime<=0){this.heroAction='';this.actionLock=0;}
    this.previousActionTime=state.actionTime;
    clip=this.actionLock>0?this.actionClip(key):speed>.5?'run':'idle';
   }
  }
  this.play(hero,clip);hero.mixer.timeScale=clip==='run'?(state?.dashTime?1.8:clamp(speed/6,.8,1.35)):1;hero.mixer.update(dt);
  if(state?.invulnerable&&Math.floor(state.time*18)%2===0)this.rings.add(at(p,.055),.95,CYAN,.85,flat);
  const halo=state?.syncTime?VIOLET:GOLD;this.rings.add(at(p,.04),.8,halo,.7,flat);
  if(state&&state.shield>0){this.rings.add(at(p,.045),1.06,CYAN,.65,flat);for(let j=0;j<6;j++){const a=j*Math.PI/3+state.time*.65;this.sparks.add({x:p.x+Math.sin(a),y:p.y+.65,z:p.z+Math.cos(a)},.06,CYAN,.65);}}
  if(state?.dashTime){const fw={x:Math.sin(state.yaw),z:Math.cos(state.yaw)};for(let j=0;j<5;j++){const length=(j+1)*.43;this.rings.add({x:p.x+fw.x*length,y:p.y+.06,z:p.z+fw.z*length},.78-j*.085,VIOLET,.4-j*.065,flat);}}
  let toolKey='';if(state&&this.actionLock>0)toolKey=state.action==='cannon'?'cannon':state.action==='shield'?'shield':state.action==='hook'||state.action==='grapple'?'grapple':'';
  this.tools.forEach((tool,key)=>tool.visible=key===toolKey);if(toolKey){const bone=hero.root.getObjectByName('R_hand');if(bone){hero.root.updateMatrixWorld(true);bone.getWorldPosition(this.wrist);this.toolTarget.copy(this.wrist).add(this.tmp.set(-Math.sin(state!.yaw),0,-Math.cos(state!.yaw)));this.toolLook.lookAt(this.wrist,this.toolTarget,new THREE.Vector3(0,1,0));const tool=this.tools.get(toolKey)!;tool.position.copy(this.wrist);tool.quaternion.setFromRotationMatrix(this.toolLook);tool.scale.setScalar(toolKey==='shield'?1.9:1.6);}}
 }
 private actionClip(action:string){return ({fist:'punch',punch:'punch',cast:'cast',heavy:'heavy',chain:'cast',lightning:'cast',bubble:'bubble',shield:'shield',drone:'cast',mist:'mist',hook:'grapple',grapple:'grapple',cannon:'cannon',sync:'cast',burst:'cast',dash:'run'} as Record<string,string>)[action]??'cast';}
 private makeActor(key:string):Actor{
  const gltf=this.assets.get(key);if(!gltf)throw new Error('Model not loaded: '+key);const root=clone(gltf.scene),mixer=new THREE.AnimationMixer(root),actions=new Map<string,THREE.AnimationAction>();for(const clip of gltf.animations)actions.set(clip.name,mixer.clipAction(clip));
  const actor:Actor={root,mixer,actions,clip:'',death:0,lastHp:0,flash:0};this.play(actor,'idle');return actor;
 }
 private play(actor:Actor,name:string){
  if(actor.clip===name)return;const next=actor.actions.get(name)??actor.actions.get('idle');if(!next)return;
  actor.actions.get(actor.clip)?.fadeOut(.09);next.reset().setLoop(name==='death'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.clampWhenFinished=name==='death';next.fadeIn(.09).play();actor.clip=name;
 }
 private drawEnemies(state:RunState,dt:number){
  const alive=new Set<number>();for(const e of state.enemies){if(e.hp<=0)continue;alive.add(e.id);let actor=this.actors.get(e.id);if(!actor){if(!this.assets.has(e.kind))continue;actor=this.makeActor(e.kind);actor.lastHp=e.hp;this.actors.set(e.id,actor);this.actorGroup.add(actor.root);}
   actor.death=0;const scale=e.boss?2.4:e.elite?1.23:1;actor.root.scale.setScalar(scale);actor.root.position.set(e.pos.x,e.pos.y,e.pos.z);actor.root.rotation.y=e.yaw;
   if(e.hp<actor.lastHp)actor.flash=.12;actor.lastHp=e.hp;actor.flash=Math.max(0,actor.flash-dt);
   this.play(actor,e.stun>0?'hit':e.state==='windup'?'windup':e.state==='attack'?'attack':'move');actor.mixer.timeScale=e.slow>0?.68:1;actor.mixer.update(dt);
   const radius=e.boss?2.7:e.kind==='bulwark'?1.05:e.kind==='weaver'?.85:.6;this.contact.add(at(e.pos,.017),[radius,radius*.7,1],0x252739,.21,flat);
   if(e.elite||e.boss){this.rings.add(at(e.pos,.05),radius*1.2,e.boss?RED:GOLD,.72,flat);this.drawHealth(e,scale);}
   if(e.mark>0)this.rings.add(at(e.pos,.06),radius*1.03,CYAN,.7,flat);
   if(actor.flash>0){this.discs.add(at(e.pos,.055),radius,0xffffff,actor.flash*1.8,flat);}
   if(e.state==='windup')this.drawWindup(e,state.time,radius);
  }
  let dying=0;for(const [id,actor] of this.actors)if(!alive.has(id)){dying++;actor.death+=dt||0;this.play(actor,'death');actor.mixer.update(dt);actor.root.position.y-=dt*.65;if(actor.death>=.46||dying>24){actor.root.removeFromParent();this.disposeActor(actor);this.actors.delete(id);}}
 }
 private drawHealth(e:Mob,scale:number){
  const y=e.pos.y+(e.boss?5:2.1)*scale/(e.boss?2.4:1);const width=e.boss?3.8:1.65,ratio=clamp(e.hp/e.maxHp,0,1);const a={x:e.pos.x-width/2,y,z:e.pos.z},b={x:e.pos.x+width/2,y,z:e.pos.z};this.segments.line(a,b,.095,0x17263a,.85);this.segments.line(a,{x:a.x+width*ratio,y,z:a.z},.072,e.boss?RED:GOLD,.95);
 }
 private drawWindup(e:Mob,time:number,radius:number){
  const pulse=this.settings.reducedMotion?.7:.6+.2*Math.sin(time*18);this.rings.add(at(e.pos,.06),radius*1.35,RED,.86,flat);
  if(e.kind==='rammer'){
   const a=at(e.pos,.075),b=at(e.target,.075),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,nx=-dz/length*.67,nz=dx/length*.67;
   this.segments.line({x:a.x+nx,y:a.y,z:a.z+nz},{x:b.x+nx,y:b.y,z:b.z+nz},.065,RED,pulse);this.segments.line({x:a.x-nx,y:a.y,z:a.z-nz},{x:b.x-nx,y:b.y,z:b.z-nz},.065,RED,pulse);
   for(let i=1;i<=3;i++){const f=i/4;this.arrows.add({x:a.x+dx*f,y:a.y,z:a.z+dz*f},.65,RED,pulse,[-Math.PI/2,0,Math.atan2(-dx,-dz)+Math.PI]);}
  }else if(e.kind==='gunner')this.segments.line(at(e.pos,.65),at(e.target,.12),.045,RED,pulse);
  else if(e.kind==='weaver'||e.boss){this.rings.add(at(e.target,.06),e.boss?5:3.1,RED,pulse,flat);this.discs.add(at(e.target,.045),e.boss?5:3.1,RED,.055,flat);}
  else{this.arcs.add(at(e.pos,.07),e.kind==='bulwark'?3.1:1.4,RED,.72,[-Math.PI/2,0,e.yaw]);}
 }
 private drawMachines(state:RunState,dt:number){
  const present=new Set<number>();for(const d of state.drones){present.add(d.id);let entry=this.drones.get(d.id);if(!entry||entry.kind!==d.kind){entry?.root.removeFromParent();entry={kind:d.kind,root:this.machines.create(d.kind)};this.drones.set(d.id,entry);this.machineGroup.add(entry.root);}
   const floating=d.kind!=='titan',floor=this.world?.heightAt(d.pos.x,d.pos.z,state.player.y)??state.player.y;const floorPos={x:d.pos.x,y:floor,z:d.pos.z};entry.root.position.set(d.pos.x,d.pos.y,d.pos.z);entry.root.rotation.y=d.yaw;entry.root.rotation.z=d.kind==='titan'?Math.sin(state.time*5+d.id)*.025:0;
   this.contact.add(at(floorPos,.02),d.kind==='titan'?1.02:.55,0x173445,.2,flat);const color=d.kind==='medic'?0x7aefc0:d.kind==='prism'?VIOLET:d.kind==='titan'?GOLD:CYAN;this.rings.add(at(floorPos,.035),d.kind==='titan'?1.15:.57,color,.26,flat);
   if(floating)this.beacons.add({x:d.pos.x,y:floor+.65,z:d.pos.z},[.13,1.2,.13],color,.16);
  }
  for(const [id,d] of this.drones)if(!present.has(id)){d.root.removeFromParent();this.drones.delete(id);}
 }
 private drawShots(state:RunState){
  for(const s of state.shots){const enemy=s.owner==='enemy',radius=clamp(s.radius,enemy?.12:.12,enemy?.32:.75);this.bullets.add(s.pos,radius,enemy?RED:s.color,.95);this.sparks.add(s.pos,radius*.45,0xffffff,.8);
   const len=Math.hypot(s.vel.x,s.vel.y,s.vel.z)||1,trail=enemy?.58:s.weapon==='cannon'?1.5:.65;this.segments.line(s.pos,{x:s.pos.x-s.vel.x/len*trail,y:s.pos.y-s.vel.y/len*trail,z:s.pos.z-s.vel.z/len*trail},radius*(enemy?.7:.6),enemy?0xffad78:s.color,.56);
  }
 }
 private drawDrops(state:RunState){
  for(const d of state.drops){const bob=this.settings.reducedMotion?0:Math.sin(state.time*3+d.id)*.05;const p=at(d.pos,.27+bob);
   if(d.type==='xp'){const size=clamp(.16+Math.log2(1+d.amount)*.035,.17,.38);this.loot.add(p,[size,size*1.25,size],d.amount>=8?GOLD:CYAN,.95,[0,state.time*.8+d.id,0]);}
   else{this.healLoot.add(p,[.5,.12,.15],0xa5f4c1,.98);this.healLoot.add(p,[.15,.12,.5],0xa5f4c1,.98);this.rings.add(at(d.pos,.035),.42,0xa5f4c1,.45,flat);}
  }
 }
 private drawFields(state:RunState){
  for(const f of state.fields){const danger=f.type==='danger',color=danger?RED:f.color;const alpha=Math.min(1,f.ttl)* (danger?.17:f.type==='mist'?.09:.12);this.discs.add(at(f.pos,.035),f.radius,color,alpha,flat);this.rings.add(at(f.pos,.055),f.radius,color,danger?.85:.48,flat);
   if(f.type==='mist')for(let i=0;i<8;i++){const a=i*Math.PI/4+state.time*.23,r=f.radius*(.5+.32*Math.sin(i*2.4));this.sparks.add({x:f.pos.x+Math.cos(a)*r,y:f.pos.y+.2+(i%3)*.28,z:f.pos.z+Math.sin(a)*r},.09,color,.35);}
   if(danger){this.rings.add(at(f.pos,.06),f.radius*(.87+.07*Math.sin(state.time*7)),color,.38,flat);}
  }
 }
 private drawEffects(state:RunState){const arcs=new Set<number>();for(const fx of state.fx){if(fx.type==='arc')arcs.add(fx.id);this.drawFX(fx,state);}for(const id of this.arcHeadings.keys())if(!arcs.has(id))this.arcHeadings.delete(id);}
 private drawFX(fx:FX,state:RunState){
  const progress=clamp(1-fx.ttl/Math.max(fx.duration,.001),0,1),fade=1-progress,radius=Math.max(.12,fx.radius);if(fade<=0)return;
  if(fx.type==='bolt'&&fx.end){
   const parts=7,dx=fx.end.x-fx.pos.x,dy=fx.end.y-fx.pos.y,dz=fx.end.z-fx.pos.z,length=Math.hypot(dx,dz)||1;let prev=fx.pos;
   for(let i=1;i<=parts;i++){const t=i/parts,jitter=i===parts?0:Math.sin(fx.id*3.14+i*9.7)*Math.min(.45,length*.055),next={x:fx.pos.x+dx*t-dz/length*jitter,y:fx.pos.y+dy*t+Math.sin(i*4)*jitter*.35,z:fx.pos.z+dz*t+dx/length*jitter};this.segments.line(prev,next,.1+radius*.012,fx.color,fade*.72);this.segments.line(prev,next,.035,0xf4ffff,fade);prev=next;}
   this.sparks.add(fx.end,.14+radius*.03,fx.color,fade);
  }else if(fx.type==='arc'){
   const yaw=fx.yaw??(fx.end?Math.atan2(fx.pos.x-fx.end.x,fx.pos.z-fx.end.z):(this.arcHeadings.get(fx.id)??state.yaw));this.arcHeadings.set(fx.id,yaw);const scale=radius*(.6+progress*.45);this.arcs.add(at(fx.pos,.14),scale,fx.color,fade*.64,[-Math.PI/2,0,yaw]);this.arcs.add(at(fx.pos,.19),scale*.94,0xfff3d2,fade*.2,[-Math.PI/2,0,yaw]);
   for(let i=0;i<5;i++){const a=yaw+(i-2)*.25;this.sparks.add({x:fx.pos.x-Math.sin(a)*scale,y:fx.pos.y+.25+Math.sin(i)*.14,z:fx.pos.z-Math.cos(a)*scale},.07,fx.color,fade);}
  }else if(fx.type==='warning'){
   if(fx.end)this.segments.line(at(fx.pos,.07),at(fx.end,.07),.08,RED,.7);else{this.rings.add(at(fx.pos,.06),radius,RED,.8,flat);this.discs.add(at(fx.pos,.04),radius,RED,.08,flat);}
  }else if(fx.type==='hit'){
   for(let i=0;i<4;i++){const angle=fx.id*1.7+i*Math.PI/2,reach=(.2+progress*.65)*radius;const p={x:fx.pos.x+Math.sin(angle)*reach,y:fx.pos.y+.35+progress*.65,z:fx.pos.z+Math.cos(angle)*reach};this.sparks.add(p,.065+radius*.025,fx.color,fade);}
  }else{
   const grow=fx.type==='heal'?.9+.1*progress:.3+progress*.85;this.rings.add(at(fx.pos,.08),radius*grow,fx.color,fade*.8,flat);if(fx.type==='heal')for(let i=0;i<4;i++){const angle=i*Math.PI/2+fx.id;this.sparks.add({x:fx.pos.x+Math.sin(angle)*radius*.6,y:fx.pos.y+.4+progress*1.3,z:fx.pos.z+Math.cos(angle)*radius*.6},.1,fx.color,fade);}
   else if(radius>2){this.rings.add(at(fx.pos,.06),radius*grow*.85,fx.color,fade*.24,flat);}
  }
 }
 private drawEvents(state:RunState){
  for(const event of state.events){if(event.state==='complete')continue;const active=event.state==='active',color=active?CYAN:GOLD,radius=active?2.4:1.3;this.rings.add(at(event.pos,.075),radius,color,.8,flat);this.rings.add(at(event.pos,.07),radius+.24,color,.28,flat);
   this.beacons.add(at(event.pos,2),[.13,3.9,.13],color,.32);this.sparks.add(at(event.pos,4.05),.18,color,.8);
   if(active){const ratio=clamp(event.progress/Math.max(event.goal,1),0,1);for(let i=0;i<16;i++){const a=i*Math.PI/8;this.sparks.add({x:event.pos.x+Math.cos(a)*(radius+.5),y:event.pos.y+.1,z:event.pos.z+Math.sin(a)*(radius+.5)},i/16<ratio?.1:.055,color,i/16<ratio?.8:.22);}}
  }
 }
 private drawEncounter(state:RunState){
  const e=state.encounter;if(!e||!['announced','offered','active'].includes(e.state))return;
  const color=ENCOUNTERS[e.kind].color,active=e.state==='active',pulse=this.settings.reducedMotion?1:.9+Math.sin(state.time*3)*.1;
  const next=e.kind==='battery-run'&&active?e.route?.[Math.min(Math.floor(e.progress),e.route.length-1)]:undefined;
  const center=next??e.pos;
  this.rings.add(at(center,.1),2.2*pulse,color,.8,flat);
  this.rings.add(at(center,.09),2.7,color,.3,flat);
  this.beacons.add(at(center,2.3),[.2,4.6,.2],color,.32);
  this.sparks.add(at(center,4.7),.4,color,.95,[0,state.time*.7,Math.PI/4]);
  if(e.state==='announced')return;
  if(active&&e.kind==='storm-hunt'){
   // The boundary belongs to the challenge; its translucent interior keeps enemies readable.
   this.rings.add(at(e.pos,.08),e.radius,color,.4,flat);
   this.discs.add(at(e.pos,.055),e.radius,color,.025,flat);
   const ratio=clamp(e.progress/e.goal,0,1);for(let i=0;i<24;i++){const a=i*Math.PI/12;this.sparks.add({x:e.pos.x+Math.cos(a)*e.radius,y:e.pos.y+.15,z:e.pos.z+Math.sin(a)*e.radius},i/24<ratio?.17:.07,color,i/24<ratio?.8:.25);}
  }
  if(active&&e.kind==='battery-run'&&e.route){
   for(let i=Math.floor(e.progress);i<e.route.length;i++){const p=e.route[i],isNext=i===Math.floor(e.progress);this.rings.add(at(p,.1),isNext?1.4:.7,color,isNext?.9:.3,flat);this.sparks.add(at(p,1.2),isNext?.5:.24,color,isNext?.9:.35,[0,state.time*.5,Math.PI/4]);}
  }
  if(active&&e.kind==='echo-hunt')for(const id of e.targetIds??[]){const target=state.enemies.find(m=>m.id===id&&m.hp>0);if(!target)continue;this.rings.add(at(target.pos,.12),1.8,color,.9,flat);this.sparks.add(at(target.pos,4.1),.32,color,.95,[0,0,Math.PI/4]);}
  if(active&&e.kind==='overload')this.rings.add(at(state.player,.12),1.75,color,.85,flat);
 }
 private drawSync(state:RunState,dt:number,p:Vec){
  const active=state.syncTime>0;if(active&&!this.lastSync)this.syncFlash=1;this.lastSync=active;this.syncFlash=Math.max(0,this.syncFlash-dt*1.8);
  if(!active&&this.syncFlash<=0)return;this.rings.add(at(p,.05),1.12+.05*Math.sin(state.time*6),VIOLET,.72,flat);
  for(let i=0;i<8;i++){const angle=state.time*.7+i*Math.PI/4,r=1.4;this.sparks.add({x:p.x+Math.sin(angle)*r,y:p.y+.15+(i%2)*.12,z:p.z+Math.cos(angle)*r},.09,i%2?GOLD:VIOLET,.8);}
  if(this.syncFlash>0){const progress=1-this.syncFlash;this.rings.add(at(p,.085),1.4+progress*8,GOLD,this.syncFlash*.85,flat);this.rings.add(at(p,.07),1.2+progress*6,VIOLET,this.syncFlash*.65,flat);}
 }
 private fadeOcclusion(p:Vec,dt:number,heightScale=1){
  if(!this.world||!this.faded.length)return;this.occlusionTick-=dt;
  if(this.occlusionTick<=0){this.occlusionTick=.09;this.fadeHits.clear();
   for(const side of [-.55,0,.55])for(const height of [.65,1.45,2.45]){this.tmp.set(p.x+side,p.y+height*heightScale,p.z).sub(this.camera.position);this.occlusionRay.set(this.camera.position,this.tmp.clone().normalize());this.occlusionRay.far=Math.max(0,this.tmp.length()-.5);for(const hit of this.occlusionRay.intersectObjects(this.world.occluders,true))this.fadeHits.add(hit.object);}
  }
  const rate=1-Math.exp(-14*dt);for(const f of this.faded){const goal=this.fadeHits.has(f.mesh)?.16:1;f.opacity=THREE.MathUtils.lerp(f.opacity,goal,rate);if(Math.abs(f.opacity-goal)<.01)f.opacity=goal;f.materials.forEach((m,i)=>{m.opacity=f.baseOpacity[i]*f.opacity;m.depthWrite=f.opacity>.95?f.baseDepth[i]:false;});f.mesh.castShadow=f.opacity>.55;}
 }
 private restoreOcclusion(){for(const f of this.faded){f.mesh.material=f.original;f.materials.forEach(m=>m.dispose());f.mesh.castShadow=true;}this.faded=[];this.fadeHits.clear();this.occlusionTick=0;}
 private drawLabels(state:RunState){
  this.labelLayer.style.display=this.settings.damageNumbers?'block':'none';const alive=new Set<number>();if(this.settings.damageNumbers){const rect=this.canvasRect;for(const fx of state.fx.filter(f=>f.amount!==undefined&&f.ttl>0).slice(-24)){alive.add(fx.id);let el=this.labels.get(fx.id);if(!el){el=document.createElement('div');el.textContent=Math.round(fx.amount!).toString();Object.assign(el.style,{position:'absolute',left:'0',top:'0',font:'700 14px system-ui',color:fx.amount!>=160?'#ffe2a1':'#f6ffff',textShadow:'0 1px 3px #21313d',whiteSpace:'nowrap',willChange:'transform'});this.labelLayer.append(el);this.labels.set(fx.id,el);}const rise=this.settings.reducedMotion?0:(1-fx.ttl/Math.max(fx.duration,.01))*.85;this.tmp.set(fx.pos.x,fx.pos.y+1.1+rise,fx.pos.z).project(this.camera);el.style.display=Math.abs(this.tmp.x)<1.15&&Math.abs(this.tmp.y)<1.15&&this.tmp.z>-1&&this.tmp.z<1?'block':'none';el.style.opacity=String(Math.min(1,fx.ttl*4));el.style.transform=`translate(${rect.left+(this.tmp.x*.5+.5)*rect.width}px,${rect.top+(-this.tmp.y*.5+.5)*rect.height}px) translate(-50%,-50%)`;}}
  for(const [id,el] of this.labels)if(!alive.has(id)){el.remove();this.labels.delete(id);}
 }
 private disposeActor(actor:Actor){actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.root);const skeletons=new Set<THREE.Skeleton>();actor.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());}
 private disposeAsset(gltf:GLTF){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 dispose(){
  if(this.disposed)return;this.clear();this.disposed=true;window.removeEventListener('resize',this.resizeHandler);this.labelLayer.remove();this.restoreOcclusion();if(this.hero){this.disposeActor(this.hero);this.hero.root.removeFromParent();this.hero=null;}this.world?.dispose();this.world=null;this.pools.forEach(p=>p.dispose());this.machines.dispose();this.assets.forEach(g=>this.disposeAsset(g));this.assets.clear();this.tools.clear();this.sun.shadow.map?.dispose();this.renderer.renderLists.dispose();this.scene.clear();this.renderer.dispose();
 }
}
