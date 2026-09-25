import * as THREE from 'three';
import type { MapWorld, NavWaypoint, Surface, Vec3, WorldCollider } from '../world/types';

/** The navigation graph samples the same explicit surfaces and solids used by Rapier. */
export function harborNavigation(bounds:MapWorld['bounds'],colliders:WorldCollider[],surfaces:Surface[],chains:Vec3[][],destinations:Vec3[]) {
  const inside=(s:Surface,x:number,z:number)=>s.enabled!==false&&x>=s.minX-.001&&x<=s.maxX+.001&&z>=s.minZ-.001&&z<=s.maxZ+.001;
  const surfaceY=(s:Surface,x:number,z:number)=>s.endY===undefined?s.y:s.y+(s.endY-s.y)*THREE.MathUtils.clamp(s.axis==='x'?(x-s.minX)/(s.maxX-s.minX):(z-s.minZ)/(s.maxZ-s.minZ),0,1);
  const buckets=new Map<string,WorldCollider[]>(),cell=8;
  for(const c of colliders){const reach=Math.hypot(c.half[0],c.half[2])+2;for(let x=Math.floor((c.center[0]-reach)/cell);x<=Math.floor((c.center[0]+reach)/cell);x++)for(let z=Math.floor((c.center[2]-reach)/cell);z<=Math.floor((c.center[2]+reach)/cell);z++){const key=`${x}:${z}`,list=buckets.get(key)??[];list.push(c);buckets.set(key,list);}}
  // Ramp slabs rotate around X/Z. A Y-only footprint test cannot see their low
  // underside, and treating every ramp as empty sends ground routes into it.
  // Cache world-to-local axes; the capsule sweep keeps actual high underpasses.
  const ramps=new Map(colliders.filter(c=>c.tag==='ramp').map(c=>{
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(c.rotation??[0,0,0]))).invert();
    const e=new THREE.Matrix4().makeRotationFromQuaternion(rotation).elements;
    return [c,{e,up:[e[4],e[5],e[6]] as Vec3}] as const;
  }));
  const rampSweep=(c:WorldCollider,a:Vec3,b:Vec3,r:number)=>{
    const ramp=ramps.get(c)!;const {e,up}=ramp;
    const local=(p:Vec3):Vec3=>{const x=p[0]-c.center[0],y=p[1]-c.center[1],z=p[2]-c.center[2];return [e[0]*x+e[4]*y+e[8]*z,e[1]*x+e[5]*y+e[9]*z,e[2]*x+e[6]*y+e[10]*z];};
    const la=local(a),lb=local(b),support=c.half[1]-.2;
    // Authored top contact is walkable; only the volume below that plane blocks.
    if(la[1]>=support&&lb[1]>=support)return false;
    let enter=0,leave=1;
    const clip=(start:number,end:number,low:number,high:number)=>{
      const d=end-start;if(Math.abs(d)<1e-9){if(start<low||start>high)leave=-1;return;}
      const p=(low-start)/d,q=(high-start)/d;enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));
    };
    clip(la[1],lb[1],-Infinity,support);
    for(let i=0;i<3&&enter<=leave;i++){
      // Rapier capsule: radius .31, cylindrical half-height .53; extra horizontal
      // route clearance grows sideways without pretending its feet are lower.
      const padding=.31+.53*Math.abs(up[i])+Math.max(0,r-.31)*Math.sqrt(Math.max(0,1-up[i]*up[i]));
      clip(la[i]+up[i]*.86,lb[i]+up[i]*.86,-c.half[i]-padding,c.half[i]+padding);
    }
    return leave-enter>1e-7&&leave>1e-6&&enter<1-1e-6;
  };
  const heightAt:MapWorld['heightAt']=(x,z,currentY)=>{
    let y=-3;
    for(const s of surfaces)if(s.tag==='ground'&&inside(s,x,z))y=Math.max(y,s.y);
    for(const s of surfaces){if(s.tag==='ground'||!inside(s,x,z))continue;const sy=surfaceY(s,x,z);
      if(s.tag==='ramp'){if(sy<=0||currentY===undefined||Math.abs(currentY-sy)<1.25)y=Math.max(y,sy);}
      else if(currentY!==undefined&&currentY>=sy-1.15)y=Math.max(y,sy);
    }
    return y;
  };
  const walkableAt:MapWorld['walkableAt']=(x,z,currentY,radius=.55)=>{
    if(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius)return false;
    const y=currentY??heightAt(x,z,0);
    for(const c of buckets.get(`${Math.floor(x/cell)}:${Math.floor(z/cell)}`)??[]){
      if(c.enabled===false||c.tag==='ground')continue;
      if(c.tag==='ramp'){if(rampSweep(c,[x,y,z],[x,y,z],radius))return false;continue;}
      if(y+1.72<c.center[1]-c.half[1]||y+.12>c.center[1]+c.half[1])continue;
      let dx=x-c.center[0],dz=z-c.center[2];const angle=c.rotation?.[1]??0;if(angle){const a=dx*Math.cos(angle)-dz*Math.sin(angle);dz=dx*Math.sin(angle)+dz*Math.cos(angle);dx=a;}
      if(Math.abs(dx)<c.half[0]+radius&&Math.abs(dz)<c.half[2]+radius)return false;
    }
    return true;
  };
  // Sampling the floor is sufficient for ramps, but can miss a thin diagonal slice
  // of a crate corner. Sweep the mover's clearance box against every solid exactly.
  const crossesSolid=(a:Vec3,b:Vec3,r:number)=>{
    for(const c of colliders){
      if(c.enabled===false||c.tag==='ground')continue;
      if(c.tag==='ramp'){if(rampSweep(c,a,b,r))return true;continue;}
      if(Math.max(a[1],b[1])+1.72<c.center[1]-c.half[1]||Math.min(a[1],b[1])+.12>c.center[1]+c.half[1])continue;
      const angle=c.rotation?.[1]??0,co=Math.cos(angle),si=Math.sin(angle);
      const ax=(a[0]-c.center[0])*co-(a[2]-c.center[2])*si,az=(a[0]-c.center[0])*si+(a[2]-c.center[2])*co;
      const bx=(b[0]-c.center[0])*co-(b[2]-c.center[2])*si,bz=(b[0]-c.center[0])*si+(b[2]-c.center[2])*co;
      const hx=c.half[0]+r-1e-6,hz=c.half[2]+r-1e-6;
      if(Math.max(ax,bx)<-hx||Math.min(ax,bx)>hx||Math.max(az,bz)<-hz||Math.min(az,bz)>hz)continue;
      let enter=0,leave=1;
      for(const [start,end,low,high] of [[ax,bx,-hx,hx],[az,bz,-hz,hz],[a[1],b[1],c.center[1]-c.half[1]-1.72,c.center[1]+c.half[1]-.12]]){
        const d=end-start;
        if(Math.abs(d)<1e-9){if(start<low||start>high){leave=-1;break;}continue;}
        const p=(low-start)/d,q=(high-start)/d;enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));
        if(enter>leave)break;
      }
      if(leave-enter>1e-7&&leave>1e-6&&enter<1-1e-6)return true;
    }
    return false;
  };
  const segment=(a:Vec3,b:Vec3,r=.58)=>{
    if(crossesSolid(a,b,r))return false;
    const distance=Math.hypot(b[0]-a[0],b[2]-a[2]),steps=Math.max(1,Math.ceil(distance/.8));
    for(let i=0;i<=steps;i++){const f=i/steps,x=a[0]+(b[0]-a[0])*f,z=a[2]+(b[2]-a[2])*f,y=a[1]+(b[1]-a[1])*f;if(Math.abs(heightAt(x,z,y)-y)>.2||!walkableAt(x,z,y,r))return false;}
    return true;
  };
  const nav:MapWorld['nav']={waypoints:[],edges:[]};let adjacency:number[][]=[],flowGoal=-1,flow=new Int32Array(0);
  const rebuild=()=>{
    nav.waypoints.length=0;nav.edges.length=0;const grid=new Map<string,number>(),step=5;
    const add=(p:Vec3,id:string)=>{const index=nav.waypoints.length;nav.waypoints.push({id,position:p,layer:p[1]>1?1:p[1]<-.2?-1:0});return index;};
    for(let x=-85;x<=85;x+=step)for(let z=-85;z<=85;z+=step){
      if(surfaces.some(s=>s.tag==='ramp'&&inside(s,x,z)))continue;
      const y=heightAt(x,z,0);if(y<-.5||!walkableAt(x,z,y,.8))continue;grid.set(`${x}:${z}`,add([x,y,z],`ground:${x}:${z}`));
    }
    adjacency=Array.from({length:nav.waypoints.length},()=>[]);const edgeKeys=new Set<string>();
    const connect=(a:number,b:number)=>{if(a===b)return;const key=a<b?`${a}:${b}`:`${b}:${a}`;if(edgeKeys.has(key)||!segment(nav.waypoints[a].position,nav.waypoints[b].position))return;edgeKeys.add(key);nav.edges.push({from:nav.waypoints[a].id,to:nav.waypoints[b].id,enabled:true});(adjacency[a]??=[]).push(b);(adjacency[b]??=[]).push(a);};
    for(const [key,a] of grid){const [x,z]=key.split(':').map(Number);for(const [dx,dz] of [[step,0],[0,step],[step,step],[-step,step]]){const b=grid.get(`${x+dx}:${z+dz}`);if(b!==undefined)connect(a,b);}}
    const groundCount=nav.waypoints.length,special:number[]=[];
    for(let ci=0;ci<chains.length;ci++){let previous=-1;for(let j=0;j<chains[ci].length;j++){const p=chains[ci][j];if(!walkableAt(p[0],p[2],p[1],.6)||Math.abs(heightAt(p[0],p[2],p[1])-p[1])>.52){previous=-1;continue;}const n=add(p,`chain:${ci}:${j}`);special.push(n);adjacency[n]=[];if(previous>=0)connect(previous,n);previous=n;}}
    for(let i=0;i<destinations.length;i++){const p=destinations[i];if(walkableAt(p[0],p[2],p[1],.6)){const n=add(p,`site:${i}`);special.push(n);adjacency[n]=[];}}
    for(const a of special){const p=nav.waypoints[a].position;for(let b=0;b<nav.waypoints.length;b++){if(a===b)continue;const q=nav.waypoints[b].position;if((b<groundCount&&Math.abs(p[1]-q[1])>.12)||Math.abs(p[1]-q[1])>1.3||Math.hypot(p[0]-q[0],p[2]-q[2])>8)continue;connect(a,b);}}
    flowGoal=-1;flow=new Int32Array(nav.waypoints.length);
  };
  rebuild();
  const nearest=(p:Vec3,radius=.28)=>{
    let best=0,score=Infinity;const candidates:number[]=[];
    for(let i=0;i<nav.waypoints.length;i++){const n=nav.waypoints[i].position,d=(n[0]-p[0])**2+(n[2]-p[2])**2+(n[1]-p[1])**2*36;if(d<score){score=d;best=i;}if(d<144)candidates.push(i);}
    candidates.sort((a,b)=>{const d=(n:NavWaypoint)=>(n.position[0]-p[0])**2+(n.position[2]-p[2])**2+(n.position[1]-p[1])**2*36;return d(nav.waypoints[a])-d(nav.waypoints[b]);});
    return candidates.find(i=>segment(p,nav.waypoints[i].position,radius))??best;
  };
  const findPath:MapWorld['findPath']=(from,to)=>{
    const radius=walkableAt(from[0],from[2],from[1],.6)?.6:walkableAt(from[0],from[2],from[1],.55)?.55:.28;
    if(segment(from,to,radius))return [to];const start=nearest(from,radius),goal=nearest(to);
    // All enemies share a reverse flow field until the player's target cell changes.
    if(flowGoal!==goal){flowGoal=goal;flow.fill(-1);flow[goal]=goal;const queue=[goal];for(let i=0;i<queue.length;i++){const a=queue[i];for(const b of adjacency[a]??[])if(flow[b]===-1){flow[b]=a;queue.push(b);}}}
    if(flow[start]===-1)return [];const path:Vec3[]=[nav.waypoints[start].position];for(let n=start,guard=0;n!==goal&&guard++<nav.waypoints.length;){n=flow[n];path.push(nav.waypoints[n].position);}path.push(to);
    // Replanning must not send a mover back to the nearest grid point it just passed.
    // Remove the leading nodes only when a sampled, same-floor segment is actually clear.
    while(path.length>1&&segment(from,path[1],radius))path.shift();
    return path;
  };
  return {nav,heightAt,walkableAt,findPath,rebuild,segment};
}
