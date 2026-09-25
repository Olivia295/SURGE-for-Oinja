import RAPIER from '@dimforge/rapier3d-compat';
import {Euler,Quaternion} from 'three';
import type {MapWorld} from '../world/types';
import type {Vec,WorldQueries} from '../game/types';
import {vec,add,sub,norm,dist,mul} from '../game/math';
let ready:Promise<void>|undefined;
export async function initPhysics(){ready??=RAPIER.init();await ready;}
export class Physics implements WorldQueries{
 // Preserve controller contact height; resetting to an authored floor embeds the capsule on slopes.
 private verticalSpeed=0;private lastMove:Vec|null=null;
 world:RAPIER.World; player:RAPIER.Collider; controller:RAPIER.KinematicCharacterController;colliders=new Map<string,RAPIER.Collider>();
 constructor(public map:MapWorld){
 this.world=new RAPIER.World({x:0,y:-15,z:0});
 for(const c of map.colliders){const desc=RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.center).setFriction(.2);if(c.rotation){const q=new Quaternion().setFromEuler(new Euler(...c.rotation));desc.setRotation(q);}const col=this.world.createCollider(desc);col.setEnabled(c.enabled!==false);this.colliders.set(c.id,col);}
 this.player=this.world.createCollider(RAPIER.ColliderDesc.capsule(.53,.31).setTranslation(map.spawn.x,map.spawn.y+.86,map.spawn.z));
 this.controller=this.world.createCharacterController(.02);this.controller.setNormalNudgeFactor(.01);this.controller.enableAutostep(.45,.25,true);this.controller.enableSnapToGround(.35);this.controller.setMaxSlopeClimbAngle(Math.PI*.27);this.world.step();
 }
 move(pos:Vec,delta:Vec,dt?:number):Vec{
 let movement=delta;
 if(dt!==undefined){
  const step=Math.min(.1,Math.max(0,dt));
  if(this.lastMove&&dist(pos,this.lastMove)>.5)this.verticalSpeed=0;
  // A small downward velocity keeps contact; airborne motion uses seconds, not frames.
  this.verticalSpeed=this.controller.computedGrounded()&&this.verticalSpeed<=0?-.6:Math.max(-30,this.verticalSpeed-24*step);
  movement={x:delta.x,y:delta.y+this.verticalSpeed*step,z:delta.z};
 }
 this.player.setTranslation({x:pos.x,y:pos.y+.86,z:pos.z});this.world.step();
 this.controller.computeColliderMovement(this.player,movement);const v=this.controller.computedMovement();const p=add(pos,v);
 p.x=Math.max(this.map.bounds.minX+1,Math.min(this.map.bounds.maxX-1,p.x));p.z=Math.max(this.map.bounds.minZ+1,Math.min(this.map.bounds.maxZ-1,p.z));
 this.player.setTranslation({x:p.x,y:p.y+.86,z:p.z});
 if(dt!==undefined&&this.controller.computedGrounded()&&this.verticalSpeed<0)this.verticalSpeed=0;
 this.lastMove={...p};return p;
 }
 floor(x:number,z:number,y=0){return this.map.heightAt(x,z,y);}
 clear(a:Vec,b:Vec){const d=sub(b,a),len=Math.hypot(d.x,d.y,d.z);if(len<.04)return true;const hit=this.world.castRay(new RAPIER.Ray(a,norm(d)),Math.max(0,len-.08),true,undefined,undefined,this.player);return !hit;}
 valid(x:number,z:number){return this.map.walkableAt(x,z);}
 route(a:Vec,b:Vec){const path=this.map.findPath([a.x,a.y,a.z],[b.x,b.y,b.z]);const node=path.find(n=>Math.hypot(n[0]-a.x,n[2]-a.z)>.35);return node?vec(...node):b;}
 anchor(aim:Vec,from:Vec){const look=norm(sub(aim,add(from,vec(0,1,0))));let score=0,best:Vec|null=null;for(const a of this.map.anchors){const p=vec(...a.position),len=dist(p,from);if(len>22||len<2)continue;const delta=norm(sub(p,add(from,vec(0,1,0)))),dot=delta.x*look.x+delta.y*look.y+delta.z*look.z;if(dot>.82&&dot>score&&this.clear(add(from,vec(0,1,0)),add(p,mul(delta,-.5)))){score=dot;best=p;}}return best;}
 spawnPoint(from:Vec,angle:number,distance:number){for(let i=0;i<12;i++){const a=angle+i*.52,p=vec(from.x+Math.cos(a)*distance,0,from.z+Math.sin(a)*distance);p.y=this.map.heightAt(p.x,p.z,from.y);if(this.map.walkableAt(p.x,p.z,p.y,.8)&&Math.abs(p.y-from.y)<9)return p;}return null;}
 syncShortcuts(){for(const c of this.map.colliders){const col=this.colliders.get(c.id);if(col)col.setEnabled(c.enabled!==false);}}
 dispose(){this.world.free();}
}
