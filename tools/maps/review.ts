import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadMap } from '../../src/world/maps';
import type { MapId } from '../../src/world/types';
const params=new URLSearchParams(location.search),id=(params.get('map')??'old-harbor') as MapId;
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,2200);camera.position.set(250,290,330);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(-7,0,-12);controls.update();
const map=await loadMap(id);scene.add(map.group);const theme=map.theme;scene.background=new THREE.Color(theme.background);scene.fog=new THREE.Fog(theme.fog,theme.fogNear+100,theme.fogFar+300);renderer.toneMappingExposure=theme.exposure;
scene.add(new THREE.HemisphereLight(0xd0e1e5,0x5c645e,2.3));const sun=new THREE.DirectionalLight(theme.sun,3);sun.position.set(...theme.sunPosition);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-240;sun.shadow.camera.right=240;sun.shadow.camera.top=240;sun.shadow.camera.bottom=-240;sun.shadow.camera.near=1;sun.shadow.camera.far=600;sun.shadow.bias=-.00025;scene.add(sun);
const name=id==='old-harbor'?'潮锈旧港 / TIDEBREAK DOCKS':'霁电新港 / CLEAR CURRENT TERMINAL';document.querySelector('#label span')!.textContent=name;
const viewpoints:Record<string,{position:number[];target:number[]}>= {
 overview:{position:[265,295,355],target:[-5,-4,-10]},
 A:{position:[-90,19,-18],target:[-143,5,-92]},
 B:{position:[17,13,-34],target:[10,5,-94]},
 C:{position:[58,16,-47],target:[132,3,-88]},
 D:{position:[-33,25,150],target:[-110,-2,66]},
 E:{position:[87,15,7],target:[16,9,-18]},
 F:{position:[40,11,160],target:[80,3,90]},
};
const view=params.get('view')??'overview';const v=viewpoints[view]??viewpoints.overview;camera.position.fromArray(v.position);controls.target.fromArray(v.target);controls.update();document.querySelector('#meta')!.textContent=`原创港区环境 · ${view==='overview'?'总体鸟瞰':view+' 区'} · 六区 / 多环路 / 可步行高架`;
(window as any).mapReview={map,renderer,scene,camera,controls,ready:true,setView:(name:string)=>{const v=viewpoints[name];camera.position.fromArray(v.position);controls.target.fromArray(v.target);controls.update();renderer.render(scene,camera);}};
const clock=new THREE.Clock();function frame(){const dt=Math.min(clock.getDelta(),.05);map.update(clock.elapsedTime,dt);renderer.render(scene,camera);requestAnimationFrame(frame);}frame();
