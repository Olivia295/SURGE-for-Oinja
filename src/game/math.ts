import type {Vec} from './types';
export const vec=(x=0,y=0,z=0):Vec=>({x,y,z});
export const copy=(v:Vec)=>({...v});
export const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
export const norm=(v:Vec)=>{const d=Math.hypot(v.x,v.y,v.z)||1;return{x:v.x/d,y:v.y/d,z:v.z/d};};
export const add=(a:Vec,b:Vec)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a:Vec,b:Vec)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a:Vec,s:number)=>vec(a.x*s,a.y*s,a.z*s);
export const yawTo=(a:Vec,b:Vec)=>Math.atan2(-(b.x-a.x),-(b.z-a.z));
export const forward=(yaw:number)=>vec(-Math.sin(yaw),0,-Math.cos(yaw));
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function segmentDistance(p:Vec,a:Vec,b:Vec){const dx=b.x-a.x,dz=b.z-a.z;const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export class Random {constructor(public state=123456789){} next(){let t=this.state+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);this.state>>>=0;return((t^t>>>14)>>>0)/4294967296;} pick<T>(a:T[]):T{return a[Math.floor(this.next()*a.length)];}}
