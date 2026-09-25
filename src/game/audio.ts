type AudioMode='menu'|'playing'|'paused'|'result';

/** Original, sample-free score and effects. Audio is initialized only by start(). */
export class GameAudio {
 context:AudioContext|null=null;
 master:GainNode|null=null;
 volume=.6;
 last=new Map<string,number>();
 private music:GainNode|null=null;
 private effects:GainNode|null=null;
 private ambient:GainNode|null=null;
 private noiseBuffer:AudioBuffer|null=null;
 private sea:AudioBufferSourceNode|null=null;
 private scheduler:ReturnType<typeof setInterval>|null=null;
 private musicVolume=.4;
 private effectsVolume=.8;
 private mode:AudioMode='menu';
 private beat=0;
 private nextBeat=0;
 private readonly eighth=60/92/2;
 private readonly visibility=()=>this.refreshMix();

 start(){
  if(!this.context){
   const Context=globalThis.AudioContext??(globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!Context)return;
   try{this.context=new Context();}catch{return;}
   const ctx=this.context;
   this.master=ctx.createGain();this.master.gain.value=this.volume;
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=16;limiter.ratio.value=4;limiter.attack.value=.006;limiter.release.value=.22;
   this.master.connect(limiter);limiter.connect(ctx.destination);
   this.music=ctx.createGain();this.effects=ctx.createGain();this.ambient=ctx.createGain();
   this.music.connect(this.master);this.effects.connect(this.master);this.ambient.connect(this.music);
   const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const channel=buffer.getChannelData(0);
   let seed=18473,soft=0;
   for(let i=0;i<channel.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;soft=.965*soft+.035*(seed/4294967296*2-1);channel[i]=soft*3;}
   this.noiseBuffer=buffer;
   this.sea=ctx.createBufferSource();this.sea.buffer=buffer;this.sea.loop=true;
   const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=380;low.Q.value=.4;
   this.sea.connect(low);low.connect(this.ambient);this.sea.start();
   this.nextBeat=ctx.currentTime+.12;
   this.scheduler=setInterval(()=>this.schedule(),50);
   if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
  }
  this.refreshMix();
  if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
 }
 setVolume(v:number){this.volume=this.clamp(v);this.refreshMix();}
 setMusicVolume(v:number){this.musicVolume=this.clamp(v);this.refreshMix();}
 setEffectsVolume(v:number){this.effectsVolume=this.clamp(v);this.refreshMix();}
 setMode(mode:AudioMode){
  if(this.mode!==mode){this.mode=mode;if(this.context)this.nextBeat=this.context.currentTime+.08;}
  this.refreshMix();
 }
 private clamp(v:number){return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
 private hidden(){return typeof document!=='undefined'&&document.hidden;}
 private refreshMix(){
  const ctx=this.context;if(!ctx||!this.master)return;
  const hidden=this.hidden();const now=ctx.currentTime;
  this.master.gain.setTargetAtTime(hidden?0:this.volume,now,.09);
  this.effects?.gain.setTargetAtTime(this.effectsVolume,now,.05);
  const musicScale=this.mode==='paused'?.10:this.mode==='playing'?1:this.mode==='result'?.58:.42;
  this.music?.gain.setTargetAtTime(this.musicVolume*musicScale,now,.28);
  this.ambient?.gain.setTargetAtTime(this.mode==='playing'?.045:.075,now,.5);
  if(hidden)this.nextBeat=now+.1;
 }
 private tone(freq:number,end:number,time:number,duration:number,peak:number,type:OscillatorType,bus:GainNode,attack=.006){
  const ctx=this.context!;const osc=ctx.createOscillator();const gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(22,freq),time);osc.frequency.exponentialRampToValueAtTime(Math.max(22,end),time+duration);
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+Math.min(attack,duration*.3));gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(gain);gain.connect(bus);osc.start(time);osc.stop(time+duration+.02);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 private noise(time:number,duration:number,peak:number,freq:number,bus:GainNode,attack=.004){
  if(!this.noiseBuffer||!this.context)return;const ctx=this.context;
  const source=ctx.createBufferSource();source.buffer=this.noiseBuffer;
  const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.55;
  const gain=ctx.createGain();gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+Math.min(attack,duration*.3));gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  source.connect(filter);filter.connect(gain);gain.connect(bus);source.start(time,(time*.317)%2);source.stop(time+duration+.02);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
 private note(midi:number,time:number,duration:number,peak:number,bus:GainNode){
  const f=440*2**((midi-69)/12);this.tone(f,f*.999,time,duration,peak,'sine',bus,.015);
  this.tone(f*2,f*2,time,duration*.36,peak*.14,'sine',bus,.003);
 }
 private schedule(){
  const ctx=this.context,bus=this.music;if(!ctx||!bus)return;
  if(ctx.state!=='running'||this.hidden()||this.mode==='paused'){this.nextBeat=ctx.currentTime+.12;return;}
  if(this.nextBeat<ctx.currentTime-.2)this.nextBeat=ctx.currentTime+.04;
  while(this.nextBeat<ctx.currentTime+.18){
   if(this.musicVolume>0&&this.volume>0)this.musicStep(this.beat,this.nextBeat,bus);
   this.beat=(this.beat+1)%128;this.nextBeat+=this.eighth;
  }
 }
 private musicStep(step:number,time:number,bus:GainNode){
  // Four original harmonic regions: Dm9, Bbmaj7, Fmaj7, C(add9).
  const roots=[38,34,41,36];const chords=[[50,53,57,60],[46,50,53,57],[53,57,60,64],[48,52,55,62]];
  const region=Math.floor(step/32)%4;const root=roots[region];const chord=chords[region];const beat=step%8;
  const active=this.mode==='playing';
  if(step%16===0){for(const n of [chord[0],chord[1],chord[2]])this.note(n,time,this.eighth*14,.025,bus);}
  if(beat===0||active&&beat===4){this.note(root,time,this.eighth*(beat===0?3.4:2.4),active?.105:.055,bus);}
  if(active){
   if(beat===0||beat===4)this.tone(110,39,time,.23,.18,'sine',bus);
   if(beat===2||beat===6){this.noise(time,.12,.15,1250,bus);this.tone(150,90,time,.10,.038,'triangle',bus);}
   if(beat%2===1)this.noise(time,.045,.055,2900,bus);
   if(step%16===14)this.noise(time,.075,.042,1850,bus);
  }
  // Sparse rounded notes leave room for spatial warnings and combat transients.
  if((active&&[1,3,6].includes(beat))||!active&&step%8===3){
   const index=[0,2,1,3][Math.floor(step/2)%4];const note=chord[index];
   this.note(note,time,.72,active?.047:.040,bus);
   this.note(note,time+.245,.62,active?.009:.007,bus);
  }
 }
 play(kind:string){
  const ctx=this.context,bus=this.effects;if(!ctx||!bus||ctx.state!=='running'||this.hidden()||this.effectsVolume<=0)return;
  const now=ctx.currentTime;const limit=kind==='hit'?.08:kind==='bubble'?.065:.035;
  if(now-(this.last.get(kind)??-10)<limit)return;this.last.set(kind,now);
  const tone=(f:number,e:number,d:number,a:number,type:OscillatorType='sine',offset=0)=>this.tone(f,e,now+offset,d,a,type,bus);
  const noise=(d:number,a:number,f:number,offset=0)=>this.noise(now+offset,d,a,f,bus);
  switch(kind){
   case 'punch':tone(140,48,.15,.16,'triangle');noise(.085,.15,580);break;
   case 'hit':tone(190,80,.10,.055,'triangle');noise(.055,.065,740);break;
   case 'bubble':tone(270,520,.11,.095);tone(520,190,.14,.045,'sine',.05);break;
   case 'lightning':noise(.15,.25,1050);tone(440,170,.18,.095,'triangle');noise(.075,.13,1800,.065);break;
   case 'grapple':tone(280,120,.23,.10,'triangle');noise(.13,.16,1400);tone(520,320,.075,.055,'sine',.12);break;
   case 'shield':tone(185,115,.30,.15,'triangle');tone(315,290,.28,.055);noise(.18,.12,550);break;
   case 'cannon':tone(92,29,.38,.25,'triangle');tone(51,28,.5,.13);noise(.27,.33,340);break;
   case 'mist':noise(.70,.20,550);tone(245,115,.48,.06);break;
   case 'barrier':for(const n of [50,57,60])this.note(n,now,1.5,.055,bus);noise(.65,.085,330);break;
   case 'level':for(const [i,n] of [62,65,69,74].entries())this.note(n,now+i*.095,.40,i===3?.065:.075,bus);break;
   case 'heal':for(const [i,n] of [62,69,65].entries())this.note(n,now+i*.075,.32,.065,bus);break;
   case 'hurt':tone(118,52,.23,.15,'triangle');tone(123,55,.20,.065,'triangle');noise(.14,.15,450);break;
   case 'boss':tone(49,36,1.25,.24,'triangle');tone(73.4,55,1.25,.09);noise(.9,.23,210);break;
   case 'charge':for(let i=0;i<3;i++)tone(120+i*24,190+i*20,.12,.11,'triangle',i*.14);noise(.4,.1,680);break;
   case 'victory':for(const [i,n] of [50,57,62,65,69].entries())this.note(n,now+i*.12,.8,.075,bus);break;
   case 'defeat':tone(146.8,73.4,.8,.10,'triangle');tone(110,55,1,.06);break;
   case 'jump':tone(170,300,.16,.065);break;
   case 'land':noise(.13,.13,320);tone(85,42,.17,.095,'triangle');break;
   case 'step':noise(.065,.055,280);break;
   case 'click':tone(330,290,.06,.045);break;
   default:tone(240,180,.12,.065);
  }
 }
 dispose(){
  if(this.scheduler!==null)clearInterval(this.scheduler);this.scheduler=null;
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);
  this.sea?.stop();this.sea?.disconnect();this.sea=null;
  if(this.context)void this.context.close().catch(()=>{});
  this.context=null;this.master=null;this.music=null;this.effects=null;this.ambient=null;this.noiseBuffer=null;this.last.clear();
 }
}
