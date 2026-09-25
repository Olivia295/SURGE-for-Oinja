import type {GameSettings} from '../ui/types';
import type {InputFrame,SkillId} from './types';
import type {PerspectiveCamera,Vector3} from 'three';
export const defaults:Record<string,string>={forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',grapple:'KeyQ',shield:'KeyE',cannon:'KeyR',lightning:'KeyF',mist:'KeyC',barrier:'KeyV',interact:'KeyX',map:'Tab',resetCamera:'KeyZ',beginnerRight:'KeyQ',beginnerLeft:'KeyE'};
export class Input{
 keys=new Set<string>(); yaw=0; pitch=.38; fire=false;aiming=false;drag=false;pendingJump=false;settings:GameSettings;
 constructor(public canvas:HTMLCanvasElement,settings:GameSettings){this.settings=settings;}
 down(code:string){this.keys.add(code);if(code===this.binding('jump'))this.pendingJump=true;}
 up(code:string){this.keys.delete(code);}
 clear(){this.keys.clear();this.fire=false;this.pendingJump=false;this.drag=false;}
 binding(action:string){return this.settings.keybinds?.[action]??defaults[action];}
 moveMouse(dx:number,dy:number){this.yaw-=dx*.0022*this.settings.sensitivity;this.pitch=Math.max(.08,Math.min(.95,this.pitch+dy*.0017*this.settings.sensitivity*(this.settings.invertY?-1:1)));}
 frame(aim:{x:number;y:number;z:number}):InputFrame{
 const a=(this.keys.has(this.binding('right'))?1:0)-(this.keys.has(this.binding('left'))?1:0);const b=(this.keys.has(this.binding('forward'))?1:0)-(this.keys.has(this.binding('backward'))?1:0);
 const x=a*Math.cos(this.yaw)-b*Math.sin(this.yaw),z=-a*Math.sin(this.yaw)-b*Math.cos(this.yaw);
 const jump=this.pendingJump;this.pendingJump=false;return {x,z,aim,jump,fire:this.fire};
 }
}
