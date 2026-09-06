'use strict';
/* ============================================================
   PIXEL PEAKS v3 — rooms, pipes, turrets, mystery blocks,
   sword + bow, shop & skins. Vanilla JS, no assets.
   ←→/A D move · Shift sprint · Space/W/↑ jump · ▼ / S down(pipes)
   J sword · K bow · Enter confirm · Tab select · P pause · M mute
   ============================================================ */
const TILE=16,VW=480,VH=270,STEP=1/60;
const GRAV=1500,MAXFALL=430;
const PCFG={w:11,h:14,accel:1650,airAccel:1050,fric:1850,
  iceAccel:500,iceFric:210,maxRun:118,sprintRun:166,
  jumpV:334,sprintJumpV:374,jumpCut:90,coyote:0.09,buffer:0.12,
  springV:640,stompV:300,stompVHold:430,
  swordCd:0.28,swordLen:0.18,bowCd:0.38,arrowSp:310,
  spikeCd:1.0,
  // celeste-style movement & juice extensions
  wallSlideV:95,wallJumpVx:205,wallJumpVy:335,wallJumpLock:0.14,wallCoyote:0.10,
  apexFloat:0.09,apexBonus:38,diveV:420,diveBounceV:300,
  parryWindow:0.14,parryRadius:26,
  stompChainVy:330,stompChainVyHold:430,
  camLookahead:26,camLerpUp:3.4,camLerpDown:7.5};
const cvs=document.getElementById('game');
const ctx=cvs.getContext('2d');
ctx.imageSmoothingEnabled=false;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const rand=(a,b)=>a+Math.random()*(b-a);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const $=id=>document.getElementById(String(id).replace(/^#/,''));
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){}}
};
const ownedSkins=()=>{try{return JSON.parse(store.get('pp_owned','[]'));}catch(e){return[];}};

/* ---------- shop skins ---------- */
const SKINS=[
  {id:'hero', name:'Forest Hero',  price:0,   p:['#3fae5f','#2e8a48','#f2c79a','#e8553f'], scarf:'#ff6b6b'},
  {id:'sky',  name:'Sky Skater',   price:20,  p:['#4f8fe0','#2e6ac0','#f2c79a','#3b6fd8'], scarf:'#7ef29a'},
  {id:'blaze',name:'Blaze Runner', price:35,  p:['#e05540','#a83229','#f2c79a','#c23e2c'], scarf:'#ffd23e'},
  {id:'gold', name:'Golden Hero',  price:55,  p:['#e8b23e','#b5862a','#ffdf9a','#fff2ae'], scarf:'#ff6b6b'},
  {id:'violet',name:'Violet Trick',price:70,  p:['#8a5fd0','#5a3fa0','#e9d8ff','#7a4fd0'], scarf:'#9fe8ff'},
  {id:'snow', name:'Arctic Fox',   price:90,  p:['#e8f4fb','#a9cce8','#f2c79a','#ffffff'], scarf:'#ff9aa5'},
  {id:'ember',name:'Ember Soul',   price:120, p:['#ff7a3d','#c94f1a','#ffe9c9','#ffb23e'], scarf:'#fff2ae'}
];
const skin=id=>SKINS.find(s=>s.id===id)||SKINS[0];

// ---------- input ----------
const Input={
  left:false,right:false,jump:false,sprint:false,down:false,
  sword:false,bow:false,_jp:false,_sp:false,_bp:false,
  consumeJump(){const p=this._jp;this._jp=false;return p;},
  consumeSword(){const p=this._sp;this._sp=false;return p;},
  consumeBow(){const p=this._bp;this._bp=false;return p;},
  press(){this.jump=true;this._jp=true;},
  release(){this.jump=false;},
  clearHeld(){this.jump=false;this.sword=false;this.bow=false;}
};
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
  Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyZ:'jump',
  ArrowDown:'down',KeyS:'down',
  ShiftLeft:'sprint',ShiftRight:'sprint'};
addEventListener('keydown',e=>{
  const k=KEYMAP[e.code];
  if(k){
    e.preventDefault();
    if(e.repeat)return;
    if(k==='jump'){if(!Input.jump)Input.press();}
    else if(k==='sword'){if(!Input.sword)Input._sp=true;}
    else if(k==='bow'){if(!Input.bow)Input._bp=true;}
    else Input[k]=true;
  }else{
    if(e.repeat)return;
    if(e.code==='KeyJ'||e.code==='KeyX')Input._sp=true;
    else if(e.code==='KeyK'||e.code==='KeyC')Input._bp=true;
  }
  if(e.repeat)return;
  if(e.code==='Enter'||e.code==='NumpadEnter'||e.code==='Space'){Sfx.unlock();Game.confirm();}
  if(e.code==='Tab'){e.preventDefault();Sfx.unlock();Game.toggleSelect();}
  if(e.code==='KeyM')showMini(Sfx.toggleMute()?'SOUND OFF':'SOUND ON',0.9);
  if(e.code==='KeyP'||e.code==='Escape'){if(Game.state==='select'){Game.state='title';showTitle();}else Game.togglePause();}
  if(e.code==='KeyR'&&(Game.state==='play'||Game.state==='pause'))Game.startLevel(Game.levelIndex);
  if(Game.state==='select'){
    if(e.code==='ArrowLeft'||e.code==='KeyA')Game.moveSel(-1,0);
    if(e.code==='ArrowRight'||e.code==='KeyD')Game.moveSel(1,0);
    if(e.code==='ArrowUp'||e.code==='KeyW')Game.moveSel(0,-1);
    if(e.code==='ArrowDown'||e.code==='KeyS')Game.moveSel(0,1);
  }
});
addEventListener('keyup',e=>{
  const k=KEYMAP[e.code];
  if(k){e.preventDefault();if(k==='jump')Input.release();else if(k==='sword')Input.sword=false;else if(k==='bow')Input.bow=false;else Input[k]=false;}
});
addEventListener('blur',()=>{ // never leave keys stuck when the tab loses focus
  Input.left=Input.right=Input.down=Input.sprint=false;
  Input.release();Input.clearHeld();
});
addEventListener('pointerdown',()=>Sfx.unlock());

// ---------- touch controls ----------
const touchDiv=$('touch');
if(('ontouchstart' in window)||navigator.maxTouchPoints>0)touchDiv.style.display='flex';
touchDiv.querySelectorAll('.btn').forEach(b=>{
  const k=b.dataset.k;
  const dn=e=>{e.preventDefault();Sfx.unlock();
    if(k==='jump')Input.press();
    else if(k==='sword')Input._sp=true;
    else if(k==='bow')Input._bp=true;
    else Input[k]=true;
    b.classList.add('on');};
  const up=e=>{e.preventDefault();
    if(k==='jump')Input.release();
    else if(k==='sword'||k==='bow'){b.classList.remove('on');}
    else Input[k]=false;
    b.classList.remove('on');};
  b.addEventListener('pointerdown',dn);
  b.addEventListener('pointerup',up);
  b.addEventListener('pointerleave',up);
  b.addEventListener('pointercancel',up);
});

// ---------- fill-screen scaling (like Emberfall) ----------
function fit(){
  const s=Math.min(innerWidth/VW,innerHeight/VH);
  cvs.style.width=Math.round(VW*s)+'px';
  cvs.style.height=Math.round(VH*s)+'px';
}
addEventListener('resize',fit);fit();

// ---------- particles ----------
const particles=[];
function puff(x,y,n,colors,spd,grav,life){
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2),s=rand(spd*0.3,spd);
    if(particles.length>240)particles.shift();
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-spd*0.3,g:grav,
      life:rand(life*0.5,life),t:0,c:colors[(Math.random()*colors.length)|0],sz:rand(1,2.5)});
  }
}
function dust(x,y,dir){
  if(particles.length>240)return;
  particles.push({x,y,vx:-dir*rand(10,30),vy:rand(-30,-8),g:120,
    life:rand(0.2,0.4),t:0,c:'rgba(255,255,255,0.8)',sz:rand(1,2)});
}
function streak(x,y,dir){ // fast horizontal dash/skid streak
  for(let i=0;i<4;i++){
    if(particles.length>240)break;
    particles.push({x:x+rand(-3,3),y:y+rand(-4,4),vx:-dir*rand(50,110),vy:rand(-8,8),
      g:0,life:rand(0.12,0.22),t:0,c:'rgba(255,255,255,0.75)',sz:2});
  }
}
function landPuff(x,y,big){ // directional landing burst
  const n=big?10:6,spd=big?110:70;
  for(let i=0;i<n;i++){
    if(particles.length>240)break;
    const a=rand(0,Math.PI);
    particles.push({x:x+rand(-4,4),y,vx:Math.cos(a)*spd*(Math.random()<0.5?-1:1)*0.6,
      vy:-rand(20,60),g:260,life:rand(0.2,0.38),t:0,
      c:['#ffffff','#e8f0f8','#cfd8e8'][(Math.random()*3)|0],sz:rand(1,2.2)});
  }
}
function wallSlideFx(x,y,dir){ // scraping dust hugging the wall
  if(particles.length>240)return;
  particles.push({x:x+rand(-1,1),y:y+rand(-3,3),vx:-dir*rand(15,40),vy:rand(20,60),
    g:150,life:rand(0.15,0.3),t:0,c:'rgba(230,238,250,0.85)',sz:1.5});
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.t+=dt;
    if(p.t>=p.life){particles.splice(i,1);continue;}
    p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  updateFloaters(dt);
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,1-p.t/p.life);
    ctx.fillStyle=p.c;
    ctx.fillRect(p.x-p.sz/2,p.y-p.sz/2,p.sz,p.sz);
  }
  ctx.globalAlpha=1;
}

// ---------- floating text (+1, CHECKPOINT, etc) ----------
const floaters=[];
function floater(x,y,txt,color){
  if(floaters.length>24)floaters.shift();
  floaters.push({x,y,txt,c:color,t:0,life:0.9});
}
function updateFloaters(dt){
  for(let i=floaters.length-1;i>=0;i--){
    const f=floaters[i];f.t+=dt;f.y-=28*dt;
    if(f.t>=f.life)floaters.splice(i,1);
  }
}
function drawFloaters(){
  ctx.font='700 9px "Trebuchet MS",sans-serif';ctx.textAlign='center';
  for(const f of floaters){
    const a=f.t<f.life*0.7?1:1-(f.t-f.life*0.7)/(f.life*0.3);
    ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=f.c;
    ctx.fillText(f.txt,f.x,f.y);
  }
  ctx.globalAlpha=1;ctx.textAlign='left';
}

// ---------- tile physics ----------
function tileAt(room,tx,ty){
  if(tx<0||tx>=room.w)return '#';
  if(ty<0||ty>=room.h)return ' ';
  return room.tiles[ty][tx];
}
const isSolid=t=>t==='#'||t==='I'||t==='T';
function moveX(e,room,dt){
  e.x+=e.vx*dt;e.hitWall=false;
  const y0=Math.floor(e.y/TILE),y1=Math.floor((e.y+e.h-0.01)/TILE);
  if(e.vx>0){
    const tx=Math.floor((e.x+e.w)/TILE);
    for(let ty=y0;ty<=y1;ty++)if(isSolid(tileAt(room,tx,ty))){e.x=tx*TILE-e.w-0.01;e.vx=0;e.hitWall=true;break;}
  }else if(e.vx<0){
    const tx=Math.floor(e.x/TILE);
    for(let ty=y0;ty<=y1;ty++)if(isSolid(tileAt(room,tx,ty))){e.x=(tx+1)*TILE+0.01;e.vx=0;e.hitWall=true;break;}
  }
}
function moveY(e,room,dt,prevBottom){
  e.y+=e.vy*dt;e.grounded=false;e.groundTile=' ';
  const x0=Math.floor((e.x+1)/TILE),x1=Math.floor((e.x+e.w-1)/TILE);
  if(e.vy>0){
    const ty=Math.floor((e.y+e.h)/TILE);
    for(let tx=x0;tx<=x1;tx++){
      const t=tileAt(room,tx,ty);
      if(isSolid(t)||(t==='-'&&prevBottom<=ty*TILE+2&&!(e.dropT>0))){
        e.y=ty*TILE-e.h;e.vy=0;e.grounded=true;e.groundTile=t;break;
      }
    }
  }else if(e.vy<0){
    const ty=Math.floor(e.y/TILE);
    for(let tx=x0;tx<=x1;tx++)if(isSolid(tileAt(room,tx,ty))){e.y=(ty+1)*TILE;e.vy=0;break;}
  }
}

// ---------- entities ----------
class Platform{
  constructor(x,y,axis){
    this.x0=x;this.y0=y;this.x=x;this.y=y;this.w=56;this.h=8;
    this.axis=axis;this.t=0;this.dx=0;this.dy=0;this.prevY=y;
  }
  update(dt){
    this.t+=dt;this.prevY=this.y;
    const ox=this.x,oy=this.y;
    if(this.axis==='h')this.x=this.x0+Math.sin(this.t*1.1)*48;
    else this.y=this.y0+Math.sin(this.t*1.1)*36;
    this.dx=this.x-ox;this.dy=this.y-oy;
  }
}
class Walker{
  constructor(x,y){this.x=x;this.y=y;this.w=13;this.h=11;this.vx=-28;this.vy=0;
    this.dead=false;this.t=Math.random()*6;this.hitWall=false;this.grounded=false;this.hp=1;this.air=false;}
  update(dt,room){
    this.t+=dt;
    this.vy=Math.min(this.vy+GRAV*dt,MAXFALL);
    // keep a persistent facing dir: moveX zeroes vx on a bonk, and -0 === 0,
    // so the old `vx=-vx` flip froze walkers against the first wall they met
    if(!this.dir)this.dir=this.vx<0?-1:1;
    this.vx=this.dir*28;
    moveX(this,room,dt);
    if(this.hitWall)this.dir=-this.dir;   // wall → turn around
    moveY(this,room,dt,this.y+this.h);
    if(this.grounded){
      const ahead=this.dir>0?this.x+this.w+2:this.x-2;
      const tx=Math.floor(ahead/TILE),ty=Math.floor((this.y+this.h+2)/TILE);
      const t=tileAt(room,tx,ty);
      if(!isSolid(t)&&t!=='-')this.dir=-this.dir;   // ledge → turn around
    }
    this.vx=this.dir*28;
  }
  hurt(){if(--this.hp<=0)this.dead=true;}
}
class Flyer{
  constructor(x,y){this.baseX=x+2;this.baseY=y+2;this.x=this.baseX;this.y=this.baseY;
    this.w=12;this.h=10;this.t=Math.random()*6;this.dead=false;this.hp=1;this.air=true;}
  update(dt){
    this.t+=dt;
    this.y=this.baseY+Math.sin(this.t*2.2)*14;
    this.x=this.baseX+Math.sin(this.t*0.8)*10;
  }
  hurt(){if(--this.hp<=0)this.dead=true;}
}
class Turret{
  constructor(x,y){this.x=x;this.y=y;this.w=14;this.h=14;
    this.hp=2;this.cool=rand(1.2,2);this.dead=false;this.t=rand(0,3);this.flash=0;this.dir=-1;}
  update(dt,room){
    if(this.dead)return;
    this.t+=dt;this.cool-=dt;this.flash=Math.max(0,this.flash-dt);
    if(this.cool<=0){
      const p=Game.player;
      // classic cannon: only fires horizontally, at targets near its own height
      if(p&&Game.state==='play'&&Game.room===room
        &&Math.abs((p.y+p.h)-(this.y+this.h))<22){
        const dir=p.x+p.w/2<this.x+7?-1:1;
        this.dir=dir;
        room.projectiles.push(new Projectile(this.x+7+dir*9,this.y+5,dir*80,0,false));
        Sfx.fire();
        this.cool=2.4+Math.random()*0.8;
      }
    }
  }
  hurt(){if(--this.hp<=0){this.dead=true;Game.earn(2);}}
}
class Projectile{ // enemy shots + player arrows share fields
  constructor(x,y,vx,vy,friendly){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.w=6;this.h=6;
    this.dead=false;this.t=0;this.friendly=!!friendly;}
  update(dt,room){
    this.t+=dt;
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    if(this.friendly&&Math.random()<0.3)puff(this.x,this.y,1,['#f5e8cf'],8,0,0.18);
    if(this.t>4||this.x<-20||this.x>room.w*TILE+20||this.y<-20||this.y>room.h*TILE+20)this.dead=true;
    // tile collision
    const tx=Math.floor((this.x)/TILE),ty=Math.floor((this.y)/TILE);
    if(ty>=0&&ty<room.h&&isSolid(tileAt(room,tx,ty))){
      puff(this.x,this.y,4,['#ffffff','#c9ccd8'],40,300,0.25);
      this.dead=true;
    }
  }
}

// ---------- level & room building ----------
function buildRoom(map){
  const h=map.length,w=Math.max(...map.map(r=>r.length));
  const room={h,w,tiles:[],coins:[],spikes:[],springs:[],platforms:[],enemies:[],
    checkpoints:[],projectiles:[],usedBoxes:new Set(),spawn:null,flag:null,bake:null};
  for(let y=0;y<h;y++){
    const row=map[y],arr=new Array(w).fill(' ');
    for(let x=0;x<w;x++){
      const c=x<row.length?row[x]:' ';arr[x]=c;
      const px=x*TILE,py=y*TILE;
      switch(c){
        case 'P':room.spawn={x:px+2,y:py+TILE-PCFG.h};arr[x]=' ';break;
        case 'o':room.coins.push({x:px+8,y:py+8,taken:false,anim:rand(0,6),gem:false});arr[x]=' ';break;
        case 'G':room.coins.push({x:px+8,y:py+8,taken:false,anim:0,gem:true});arr[x]=' ';break;
        case 'W':room.enemies.push(new Walker(px+1,py+4));arr[x]=' ';break;
        case 'V':room.enemies.push(new Flyer(px+2,py+2));arr[x]=' ';break;
        case 'X':room.enemies.push(new Turret(px+1,py-2));arr[x]=' ';break;
        case '^':room.spikes.push({tx:x,ty:y});break;
        case 'M':room.platforms.push(new Platform(px-20,py,'h'));arr[x]=' ';break;
        case 'N':room.platforms.push(new Platform(px-20,py,'v'));arr[x]=' ';break;
        case 'S':room.springs.push({tx:x,ty:y,anim:0});arr[x]=' ';break;
        case 'C':room.checkpoints.push({x:px+8,y:py+TILE,active:false});arr[x]=' ';break;
        case 'F':room.flag={x:px+8,y:py+TILE};arr[x]=' ';break;
        case 'B':break; // mystery block — stays in tile grid
        case 'T':break; // pipe — stays in tile grid
      }
    }
    room.tiles.push(arr);
  }
  return room;
}
function parseLevel(i){
  const def=LEVELS[i];
  const rooms=def.maps.map(buildRoom);
  const lv={index:i,name:def.name,world:def.world,worldName:WORLDS[def.world].name,
    theme:THEMES[WORLDS[def.world].theme],rooms,cur:0,done:false,pipes:def.pipes};
  lv.spawn=rooms[0].spawn;
  rooms.forEach(r=>bakeRoom(r,lv));
  return lv;
}

// ---------- baked tile art (drawn once per room) ----------
function bakeRoom(room,lv){
  const c=document.createElement('canvas');
  c.width=room.w*TILE;c.height=room.h*TILE;
  const g=c.getContext('2d');
  const th=lv.theme;
  for(let y=0;y<room.h;y++)for(let x=0;x<room.w;x++){
    const t=room.tiles[y][x];
    if(t===' ')continue;
    const px=x*TILE,py=y*TILE;
    const v=(x*7+y*13)%3;
    if(t==='#'||t==='I'||t==='T'){
      const ice=t==='I',pipe=t==='T';
      const topExposed=!isSolid(tileAt(room,x,y-1));
      let body,bodyHi,bodyLo,cap='#fff';
      if(pipe){body='#3fae5f';bodyHi='#57c977';bodyLo='#2a8a48';cap='#6fe08a';}
      else if(ice){body=th.iceBody;bodyLo=th.iceDark;bodyHi='#ffffff';cap=th.iceCap;}
      else{body=th.body;bodyLo=th.lo;bodyHi=th.hi;cap=th.cap;}
      g.fillStyle=body;g.fillRect(px,py,16,16);
      g.fillStyle=bodyLo;g.fillRect(px,py+14,16,2);g.fillRect(px+14,py,2,16);
      g.fillStyle=bodyHi;g.fillRect(px,py,2,14);
      // brick / rubble details
      if(!ice&&!pipe){
        if(v===0){g.fillStyle=bodyLo;g.fillRect(px+3,py+6,4,2);g.fillRect(px+9,py+11,4,2);}
        if(v===1){g.fillStyle=bodyLo;g.fillRect(px+9,py+5,3,2);}
        g.fillStyle=bodyHi;g.fillRect(px+4,py+7,1,1);
      }
      if(ice){g.fillStyle='rgba(255,255,255,0.35)';g.fillRect(px+2,py+7,2,6);}
      if(topExposed){
        g.fillStyle=cap;g.fillRect(px,py,16,5);
        g.fillStyle=th.capHi;g.fillRect(px,py,16,2);
        if(!ice&&!pipe){g.fillStyle=th.capLo;g.fillRect(px+2+(v%2)*4,py+3,3,2);}
      }
    }else if(t==='-'){
      g.fillStyle=th.wood;g.fillRect(px,py,16,6);
      g.fillStyle=th.lo;g.fillRect(px,py+4,16,2);
      g.fillStyle='rgba(255,255,255,0.28)';g.fillRect(px,py,16,1);
    }else if(t==='^'){
      g.fillStyle=th.lo;g.fillRect(px+1,py+12,14,4);
      g.fillStyle='#c9ccd8';
      for(let i=0;i<2;i++){
        g.beginPath();g.moveTo(px+1+i*8,py+13);g.lineTo(px+5+i*8,py+3);g.lineTo(px+9+i*8,py+13);
        g.closePath();g.fill();
      }
      g.fillStyle='#84889c';g.fillRect(px+1,py+12,14,2);
    }else if(t==='B'){
      // treasure chest (randomized loot inside) — closed: wood + gold bands
      // and lock; opened: lid flipped up showing the dark interior
      const used=room.usedBoxes.has(x+','+y);
      if(used){
        g.fillStyle='#5c442e';g.fillRect(px+1,py+6,14,9);
        g.fillStyle='#171008';g.fillRect(px+2,py+6,12,4);
        g.fillStyle='#6e4420';g.fillRect(px+1,py+1,14,4);
        g.fillStyle='#8a5a30';g.fillRect(px+2,py+2,12,1);
        g.fillStyle='#c9a13e';g.fillRect(px+1,py+4,14,1);
        g.fillStyle='#8a6a2e';g.fillRect(px+1,py+1,1,14);g.fillRect(px+14,py+1,1,14);
      }else{
        g.fillStyle='#8a5a2e';g.fillRect(px+1,py+6,14,9);
        g.fillStyle='#a97448';g.fillRect(px+2,py+8,12,2);
        g.fillStyle='#6e4420';g.fillRect(px+1,py+2,14,4);
        g.fillStyle='#8a5a30';g.fillRect(px+2,py+3,12,1);
        g.fillStyle='#f5c75e';g.fillRect(px+1,py+5,14,2);
        g.fillStyle='#c9a13e';g.fillRect(px+1,py+2,1,13);g.fillRect(px+14,py+2,1,13);
        g.fillStyle='#ffdf8a';g.fillRect(px+7,py+6,2,4);
        g.fillStyle='#8a5a15';g.fillRect(px+7,py+9,2,1);
      }
    }
  }
  room.bake=c;
}

// ---------- parallax backgrounds (pre-rendered per theme) ----------
function hillBand(g,baseY,amp,freq,color,phase){
  g.fillStyle=color;g.beginPath();g.moveTo(0,VH);
  for(let x=0;x<=VW;x+=8){
    const y=VH-baseY-Math.sin(x/VW*Math.PI*2*freq+phase)*amp
      -Math.sin(x/VW*Math.PI*2*freq*2.7+phase*2)*amp*0.35;
    g.lineTo(x,y);
  }
  g.lineTo(VW,VH);g.closePath();g.fill();
}
function cloudBlob(g,x,y,s){
  g.beginPath();
  g.arc(x,y,7*s,0,7);g.arc(x+8*s,y-3*s,9*s,0,7);g.arc(x+17*s,y,7*s,0,7);
  g.fill();
}
function mkCanvas(){const c=document.createElement('canvas');c.width=VW;c.height=VH;return c;}
function ensureArt(th){
  if(th._grad)return;
  th._grad=ctx.createLinearGradient(0,0,0,VH);
  th._grad.addColorStop(0,th.sky[0]);th._grad.addColorStop(1,th.sky[1]);
  if(th.stars)th._stars=mkStars(th.stars);
  const l1=mkCanvas(),g1=l1.getContext('2d');
  if(th.deco==='crystal'){
    for(let i=0;i<26;i++){
      const x=(i*97+31)%VW,y=18+(i*53)%120;
      g1.fillStyle=i%3?'rgba(160,140,230,0.8)':'rgba(220,210,255,0.9)';
      g1.fillRect(x,y,2,2);g1.fillRect(x+3,y+4,1,1);
    }
    hillBand(g1,64,30,1,th.far,0);
  }else if(th.deco==='ember'){
    g1.fillStyle='rgba(255,122,77,0.4)';
    for(let i=0;i<14;i++)g1.fillRect((i*89+17)%VW,16+(i*61)%100,2,2);
    hillBand(g1,84,34,1,th.far,0);
  }else if(th.deco==='mesa'||th.deco==='dunes'){
    g1.fillStyle=th.far;
    for(let i=0;i<5;i++){
      const x=(i*97)%VW;
      g1.beginPath();g1.moveTo(x-14,VH);g1.lineTo(x,VH-52-(i%3)*16);g1.lineTo(x+14,VH);
      g1.closePath();g1.fill();
    }
    hillBand(g1,60,20,1,th.far,0);
  }else if(th.deco==='cloud'){
    g1.fillStyle=th.cloud;
    for(let i=0;i<5;i++)cloudBlob(g1,(i*109+30)%VW,40+(i*41)%54,0.7+(i%2)*0.4);
    hillBand(g1,96,26,1,th.far,0);
  }else{
    g1.fillStyle=th.cloud;
    for(let i=0;i<4;i++)cloudBlob(g1,(i*127+40)%VW,30+(i*37)%46,0.8+(i%2)*0.4);
    hillBand(g1,84,34,1,th.far,0);
  }
  const l2=mkCanvas(),g2=l2.getContext('2d');
  hillBand(g2,46,26,2,th.near,1.3);
  if(th.deco==='crystal'){
    g2.fillStyle=th.near;
    for(let i=0;i<7;i++){
      const x=(i*71+23)%VW;
      g2.beginPath();g2.moveTo(x,VH);g2.lineTo(x+7,VH-26-(i*13)%22);g2.lineTo(x+14,VH);
      g2.closePath();g2.fill();
    }
  }
  if(th.deco==='dunes'){ // cactus silhouettes
    g2.fillStyle=th.near;
    for(let i=0;i<4;i++){
      const x=(i*131+17)%VW;
      g2.fillRect(x,VH-22,3,22);g2.fillRect(x-4,VH-14,4,4);g2.fillRect(x+3,VH-18,4,4);
    }
  }
  th._l1=l1;th._l2=l2;
  { // soft vignette on every theme (deeper for dark ones)
    const v=mkCanvas(),gv=v.getContext('2d');
    const dark=th.deco==='crystal'||th.deco==='ember'||!!th.stars;
    const rg=gv.createRadialGradient(VW/2,VH/2,VH*0.45,VW/2,VH/2,VH*0.98);
    rg.addColorStop(0,'rgba(0,0,0,0)');rg.addColorStop(1,dark?'rgba(0,0,0,0.45)':'rgba(0,0,0,0.22)');
    gv.fillStyle=rg;gv.fillRect(0,0,VW,VH);
    th._vig=v;
  }
}
function mkStars(n){
  const c=mkCanvas(),g=c.getContext('2d');
  for(let i=0;i<n*40;i++){
    g.fillStyle='rgba(255,255,255,'+(0.5+Math.random()*0.5)+')';
    g.fillRect((i*97+13)%VW,(i*53+7)%(VH*0.6),2,2);
  }
  return c;
}
function drawLayer(img,off){
  const o=((off%VW)+VW)%VW;
  ctx.drawImage(img,-o,0);
  ctx.drawImage(img,VW-o,0);
}
function drawBackground(lv,camX){
  const th=lv.theme;ensureArt(th);
  ctx.fillStyle=th._grad;ctx.fillRect(0,0,VW,VH);
  if(th._stars){
    ctx.globalAlpha=0.75+0.25*Math.sin(Game.time*1.7);
    ctx.drawImage(th._stars,0,0);ctx.globalAlpha=1;
  }
  if(th.sun){
    ctx.fillStyle=th.sun.g;
    ctx.beginPath();ctx.arc(th.sun.x,th.sun.y,th.sun.r*2.4+Math.sin(Game.time*1.2)*1.5,0,7);ctx.fill();
    ctx.fillStyle=th.sun.c;
    ctx.beginPath();ctx.arc(th.sun.x,th.sun.y,th.sun.r,0,7);ctx.fill();
    if(th.sun.moon){ctx.fillStyle=th.sky[2];ctx.beginPath();ctx.arc(th.sun.x-5,th.sun.y-3,th.sun.r-2,0,7);ctx.fill();}
  }
  drawLayer(th._l1,camX*0.25+(th.deco==='cloud'?Game.time*5:0));
  drawLayer(th._l2,camX*0.5);
  if(th.amb==='snow'){
    ctx.fillStyle='rgba(255,255,255,0.85)';
    for(let i=0;i<30;i++){
      const x=((i*97+Game.time*14*(1+(i%3)))%VW+VW)%VW;
      const y=(i*53+Game.time*26)%VH;
      ctx.fillRect(x,y,2,2);
    }
  }else if(th.amb==='embers'){
    for(let i=0;i<18;i++){
      const x=((i*89+Math.sin(Game.time*1.4+i)*12)%VW+VW)%VW;
      const y=VH-((i*67+Game.time*30)%(VH-30));
      ctx.fillStyle=i%3?'rgba(255,122,60,0.7)':'rgba(255,200,80,0.8)';
      ctx.fillRect(x,y,2,2);
    }
  }else if(th.amb==='fireflies'){
    for(let i=0;i<14;i++){
      const x=((i*71+Math.sin(Game.time*0.8+i*2)*20)%VW+VW)%VW;
      const y=30+((i*43+Game.time*10)%(VH-70));
      ctx.fillStyle='rgba(158,232,255,0.75)';ctx.fillRect(x,y,2,2);
    }
  }else if(th.amb==='desert'){ // heat shimmer specks
    for(let i=0;i<10;i++){
      const x=((i*83+Game.time*4)%VW+VW)%VW;
      ctx.fillStyle='rgba(255,240,200,0.5)';ctx.fillRect(x,60+(i*37)%60,2,2);
    }
  }
}

// ---------- sprite drawing ----------
function drawSpring(s){
  const x=s.tx*TILE,y=s.ty*TILE,ext=s.anim>0;
  ctx.fillStyle='#565b6e';ctx.fillRect(x+2,y+12,12,4);
  ctx.fillStyle='#9aa0b5';
  if(ext){ctx.fillRect(x+5,y+6,6,2);ctx.fillRect(x+5,y+9,6,2);}
  else ctx.fillRect(x+5,y+9,6,2);
  ctx.fillStyle=ext?'#ffd23e':'#c9553f';
  ctx.fillRect(x+1,ext?y+4:y+7,14,3);
}
function drawFlag(f,t,room){
  if(!f)return;
  ctx.fillStyle='rgba(255,210,62,'+(0.05+0.03*Math.sin(t*2.4))+')';
  ctx.fillRect(f.x-14,f.y-64,28,64);
  ctx.fillStyle='#c8ccd8';ctx.fillRect(f.x-1,f.y-46,2,46);
  ctx.fillStyle='#e8b23e';ctx.fillRect(f.x-2,f.y-48,4,3);
  const wv=Math.sin(t*4)*1.5;
  ctx.fillStyle='#e8553f';ctx.fillRect(f.x+1,f.y-44+wv,13,8);
  ctx.fillStyle='#c23e2c';ctx.fillRect(f.x+1,f.y-40+wv,13,2);
}
function drawCheckpoint(cp,t){
  if(cp.active){
    ctx.fillStyle='rgba(87,217,119,'+(0.12+0.06*Math.sin(t*3.2))+')';
    ctx.beginPath();ctx.arc(cp.x,cp.y-22,12+Math.sin(t*3.2)*2,0,7);ctx.fill();
  }
  ctx.fillStyle='#c8ccd8';ctx.fillRect(cp.x-1,cp.y-30,2,30);
  ctx.fillStyle=cp.active?'#57d977':'#8a8fa3';
  ctx.beginPath();
  ctx.moveTo(cp.x+1,cp.y-29);
  ctx.lineTo(cp.x+11,cp.y-25+Math.sin(t*3));
  ctx.lineTo(cp.x+1,cp.y-21);
  ctx.closePath();ctx.fill();
}
function drawCoin(c){
  if(c.taken)return;
  ctx.save();ctx.translate(c.x,c.y);
  if(c.gem){
    ctx.translate(0,Math.sin(Game.time*2+c.x)*2);
    ctx.fillStyle='rgba(77,227,209,'+(0.16+0.08*Math.sin(Game.time*3+c.x))+')';
    ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.fill();
    ctx.fillStyle='#2bbfae';
    ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(6,0);ctx.lineTo(0,7);ctx.lineTo(-6,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7ff0e3';
    ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3.5,0);ctx.lineTo(0,1.5);ctx.lineTo(-3.5,0);ctx.closePath();ctx.fill();
  }else{
    ctx.scale(Math.max(0.15,Math.abs(Math.cos(c.anim*4))),1);
    ctx.fillStyle='#d9a015';ctx.beginPath();ctx.arc(0,0,5,0,7);ctx.fill();
    ctx.fillStyle='#ffd23e';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill();
    ctx.fillStyle='#fff3c4';ctx.fillRect(-1,-2,2,4);
  }
  ctx.restore();
}
function drawWalker(e){
  if(e.dead)return;
  const x=Math.round(e.x),y=Math.round(e.y);
  const wob=Math.sin(e.t*10),st=Math.sin(e.t*12)>0;
  ctx.fillStyle='#1c5420';
  ctx.fillRect(x+1,y+e.h-2+(st?0:1),4,2);
  ctx.fillRect(x+e.w-5,y+e.h-2+(st?1:0),4,2);
  ctx.fillStyle='#43a843';ctx.fillRect(x,y+1+wob*0.5,e.w,e.h-3);
  ctx.fillStyle='#7ed46a';ctx.fillRect(x+2,y+e.h-5,e.w-4,3);
  const d=e.vx>0?1:0;
  ctx.fillStyle='#ffffff';ctx.fillRect(x+2,y+3,3,3);ctx.fillRect(x+e.w-5,y+3,3,3);
  ctx.fillStyle='#12300f';ctx.fillRect(x+2+d,y+4,2,2);ctx.fillRect(x+e.w-5+d,y+4,2,2);
  ctx.fillStyle='#1c5420';ctx.fillRect(x+2,y+2,3,1);ctx.fillRect(x+e.w-5,y+2,3,1);
}
function drawFlyer(e){
  if(e.dead)return;
  const x=Math.round(e.x),y=Math.round(e.y);
  const w=Math.sin(e.t*16)*3;
  ctx.fillStyle='#4a2f86';
  ctx.fillRect(x-3,y+2+w,4,3);ctx.fillRect(x+e.w-1,y+2+w,4,3);
  ctx.fillStyle='#7a4fd0';ctx.fillRect(x,y,e.w,e.h-2);
  ctx.fillStyle='#9a75e8';ctx.fillRect(x+2,y+e.h-4,e.w-4,2);
  ctx.fillStyle='#4a2f86';ctx.fillRect(x+3,y-2,2,3);ctx.fillRect(x+e.w-5,y-2,2,3);
  ctx.fillStyle='#ffffff';ctx.fillRect(x+2,y+2,3,3);ctx.fillRect(x+e.w-5,y+2,3,3);
  ctx.fillStyle='#1a1030';ctx.fillRect(x+3,y+3,1,2);ctx.fillRect(x+e.w-4,y+3,1,2);
}
function drawTurret(e){
  if(e.dead)return;
  const x=Math.round(e.x),y=Math.round(e.y);
  const aim=e.dir||-1;
  ctx.fillStyle='#3c4256';ctx.fillRect(x+2,y+10,10,4);
  ctx.fillStyle='#5a6178';ctx.fillRect(x+1,y+3,12,8);
  ctx.fillStyle='#77809c';ctx.fillRect(x+1,y+3,12,2);
  ctx.fillStyle=e.flash>0?'#ffffff':'#2c3142';
  ctx.beginPath();ctx.arc(x+7,y+7,3,0,7);ctx.fill();
  // barrel pointing where it last fired
  ctx.fillStyle='#e8b23e';
  ctx.fillRect(aim>0?x+12:x-2,y+6,4,2);
  // charge glow as it's about to fire
  if(e.cool<0.5){ctx.fillStyle='rgba(255,120,80,'+(0.5-e.cool)+')';ctx.fillRect(aim>0?x+13:x-3,y+5,3,4);}
}
function drawProjectile(p){
  if(p.dead)return;
  ctx.save();ctx.translate(p.x,p.y);
  if(p.parried){ // parried fireball: blazing cyan comet
    ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.fillStyle='rgba(120,240,255,0.4)';ctx.beginPath();ctx.arc(-2,0,6,0,7);ctx.fill();
    ctx.fillStyle='#4de3ff';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill();
    ctx.fillStyle='#e8fbff';ctx.fillRect(-1,-1,3,3);
  }else if(p.friendly){ // arrow
    ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.fillStyle='#c9a15e';ctx.fillRect(-7,-1,8,2);
    ctx.fillStyle='#f5e8cf';ctx.fillRect(-8,-2,2,4);
    ctx.fillStyle='#e8553f';ctx.fillRect(1,-2,3,4);
  }else{ // enemy fireball
    ctx.fillStyle='rgba(255,150,60,0.4)';ctx.beginPath();ctx.arc(0,0,5,0,7);ctx.fill();
    ctx.fillStyle='#ff7a3d';ctx.beginPath();ctx.arc(0,0,3.5,0,7);ctx.fill();
    ctx.fillStyle='#ffe9a8';ctx.fillRect(-1,-1,2,2);
  }
  ctx.restore();
}
const SKIN=()=>skin(store.get('pp_equip','hero'));
function drawPlayer(p){
  if(!p||p.hidden)return;
  if(p.invuln>0&&p.invuln<90&&((p.invuln*12)|0)%2===0)return;
  const sk=SKIN().p, scarf=SKIN().scarf;
  const landing=p.squash>0.001,jumping=p.squash<-0.001;
  const sy=landing?0.8:(jumping?1.15:(!p.grounded?1.05:1));
  const sx=landing?1.2:(jumping?0.85:1);
  const lean=clamp(p.vx*0.0011,-0.13,0.13)*(p.grounded?1:0.55);
  ctx.save();
  ctx.translate(Math.round(p.x+p.w/2),Math.round(p.y+p.h));
  ctx.rotate(lean);
  ctx.scale(p.facing*sx,sy);
  const st=Math.abs(p.vx)>10&&p.grounded&&Math.sin(p.walkT*16)>0;
  // scarf trail
  const tail=Math.sin(p.walkT*16)*(p.sprinting?2.5:1.2);
  for(let i=0;i<5;i++){
    ctx.fillStyle=scarf;
    ctx.globalAlpha=0.42-i*0.08;
    ctx.fillRect(-9-i*4,-15+Math.sin(p.walkT*12+i*0.9)*2-tail*(1-i*0.18),4,2);
  }
  ctx.globalAlpha=1;
  // legs
  ctx.fillStyle='#4a3b2e';
  if(p.grounded){ctx.fillRect(-4,-3,3,3);ctx.fillRect(1,-3-(st?1:0),3,3+(st?1:0));}
  else if(p.wallSlide){ // braced against the wall, knees bent
    ctx.fillRect(-4,-2,3,3);ctx.fillRect(1,-6,3,3);
  }
  else{ctx.fillRect(-4,-4,3,3);ctx.fillRect(1,-2,3,3);}
  // arms
  ctx.fillStyle=sk[0];
  ctx.fillRect(-5,-10,3,4);ctx.fillRect(2,-10,3,4);
  // torso
  ctx.fillStyle=sk[0];ctx.fillRect(-5,-12,10,8);
  ctx.fillStyle=sk[1];ctx.fillRect(-5,-5,10,2);
  // head
  ctx.fillStyle=sk[2];ctx.fillRect(-4,-18,9,6);
  ctx.fillStyle=sk[3];ctx.fillRect(-5,-20,10,3);ctx.fillRect(-5,-18,3,2);
  if(p.blink>0){ctx.fillStyle='#241a12';ctx.fillRect(1,-15,2,1);}
  else{ctx.fillStyle='#241a12';ctx.fillRect(1,-16,2,2);}
  ctx.restore();
  // sword swing: arcing slash with fading trail
  if(p.swordT>0){
    const k=1-p.swordT/PCFG.swordLen;
    const a0=-1.15,a1=1.15;
    ctx.save();
    ctx.translate(p.x+p.w/2,p.y+p.h/2);
    ctx.scale(p.facing,1);
    for(let i=0;i<5;i++){
      const tt=Math.max(0,k-i*0.09);
      const ang=a0+tt*(a1-a0);
      ctx.strokeStyle='rgba(159,232,255,'+(0.5-i*0.09)+')';
      ctx.lineWidth=3-i*0.4;
      ctx.beginPath();ctx.arc(0,0,13+i*1.2,ang-0.5,ang+0.12);ctx.stroke();
    }
    const ang=a0+k*(a1-a0);
    ctx.strokeStyle='#e8fbff';ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang)*7,Math.sin(ang)*7);
    ctx.lineTo(Math.cos(ang)*19,Math.sin(ang)*19);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- player ----------
class Player{
  constructor(x,y){
    this.w=PCFG.w;this.h=PCFG.h;this.x=x;this.y=y;this.vx=0;this.vy=0;this.facing=1;
    this.grounded=false;this.groundTile=' ';this.coyote=0;this.jumpBuf=0;
    this.plat=null;this.prevBottom=y+this.h;this.invuln=0;
    this.walkT=0;this.squash=0;this.hearts=3;this.dustT=0;this.landT=0;
    this.sprinting=false;this.skid=false;
    this.swordT=0;this.swordCd=0;this.bowCd=0;
    this.spikeCd=0;this.warped=false;
    // movement-juice state
    this.wallDir=0;this.wallSlide=false;this.wallCoyote=0;
    this.apexT=0;this.diveT=0;this.stompCombo=0;this.skidT=0;this.wallFxT=0;
    this.jumpLock=0;
    this.hidden=false;this.blinkT=rand(2.2,4.5);this.blink=0;
  }
  touchWall(room,dir){ // probe a 2px strip beside the body for a climbable wall
    const x=dir>0?this.x+this.w+1:this.x-3;
    const tx=Math.floor(x/TILE);
    const y0=Math.floor((this.y+2)/TILE),y1=Math.floor((this.y+this.h-3)/TILE);
    for(let ty=y0;ty<=y1;ty++){
      const t=tileAt(room,tx,ty);
      if(t==='#'||t==='I')return tx*TILE+(dir>0?0:TILE); // x of wall face
    }
    return null;
  }
  update(dt,room,lv){
    this.warped=false;
    if(this.plat){this.x+=this.plat.dx;this.y+=this.plat.dy;}
    const onIce=this.groundTile==='I';
    const move=(Input.right?1:0)-(Input.left?1:0);
    const effMove=this.jumpLock>0?0:move; // no steering during wall-jump burst
    this.sprinting=Input.sprint&&move!==0&&this.grounded;
    const maxRun=this.sprinting?PCFG.sprintRun:PCFG.maxRun;
    if(effMove!==0){
      const acc=this.grounded?(onIce?PCFG.iceAccel:(this.sprinting?PCFG.accel*1.18:PCFG.accel)):PCFG.airAccel;
      this.vx=clamp(this.vx+effMove*acc*dt,-maxRun,maxRun);
      this.facing=effMove;
      if(this.grounded){
        this.walkT+=dt*(this.sprinting?1.6:1.05);
        this.dustT-=dt;
        if(this.dustT<=0&&(this.sprinting||(onIce&&Math.abs(this.vx)>70))){
          dust(this.x+this.w/2,this.y+this.h,-move);
          this.dustT=this.sprinting?0.05:0.09;
        }
      }
    }else{
      const fr=(this.grounded?(onIce?PCFG.iceFric:PCFG.fric):400)*dt;
      if(Math.abs(this.vx)<=fr)this.vx=0;else this.vx-=fr*Math.sign(this.vx);
    }
    // skid: hard direction change while grounded at speed
    if(this.grounded&&move!==0&&Math.sign(this.vx)!==0&&Math.sign(this.vx)!==move&&Math.abs(this.vx)>70){
      this.skidT=0.1;
      if(Math.random()<0.5)dust(this.x+this.w/2+move*4,this.y+this.h,-move);
    }
    if(this.skidT>0)this.skidT-=dt;
    // coyote + jump buffer
    this.coyote=this.grounded?PCFG.coyote:this.coyote-dt;
    if(Input.consumeJump())this.jumpBuf=PCFG.buffer;else this.jumpBuf-=dt;
    // drop through one-way platforms: ▼ + jump while standing on a '-' tile
    if(this.grounded&&Input.down&&this.groundTile==='-'&&this.jumpBuf>0){
      const footY=this.y+this.h;
      const ty=Math.floor((footY+2)/TILE);
      // confirm the support under both feet is one-way platform (no solid ground)
      const x0=Math.floor((this.x+1)/TILE),x1=Math.floor((this.x+this.w-1)/TILE);
      let oneway=true;
      for(let tx=x0;tx<=x1;tx++){
        const t=tileAt(room,tx,ty);
        if(isSolid(t)){oneway=false;break;}
      }
      if(oneway){
        this.grounded=false;this.vy=60;this.jumpBuf=0;this.plat=null;
        this.dropT=0.18; // ignore '-' landings briefly
        Sfx.pop();
        puff(this.x+this.w/2,footY,5,['#ffffff','#dfe9f5'],40,300,0.25);
      }
    }
    if(this.dropT>0)this.dropT-=dt;
    // ---- wall slide + wall jump (celeste-style) ----
    const wasWall=this.wallDir;
    this.wallSlide=false;
    if(!this.grounded&&!onIce){ // can't wall-slide off ice walls
      const pushDir=move!==0?move:this.facing;
      const wl=this.touchWall(room,-1),wr=this.touchWall(room,1);
      const slideDir=move!==0?(move<0&&wl!=null?-1:(move>0&&wr!=null?1:0))
                    :(this.vy>40?pushDir:0);
      if(slideDir!==0&&this.vy>0){
        const wall=slideDir<0?wl:wr;
        if(wall!=null){
          this.wallDir=slideDir;this.wallSlide=true;
          this.vy=Math.min(this.vy,PCFG.wallSlideV);
          this.wallCoyote=PCFG.wallCoyote;
          this.wallFxT-=dt;
          if(this.wallFxT<=0){wallSlideFx(slideDir>0?this.x+this.w:this.x,this.y+this.h-3,slideDir);this.wallFxT=0.05;}
        }
      }
      // wall coyote: remember last wall even after leaving it (with expiry)
      if(!this.wallSlide&&wasWall!==0&&this.wallCoyote>0)this.wallDir=wasWall;
    }
    if(!this.wallSlide){
      this.wallCoyote=Math.max(0,this.wallCoyote-dt);
      if(this.wallCoyote<=0&&this.wallDir!==0)this.wallDir=0;
    }
    if(this.wallSlide)this.facing=this.wallDir;
    const canWallJump=this.wallCoyote>0&&this.wallDir!==0&&!this.grounded;
    if(this.jumpBuf>0&&this.coyote>0){
      this.vy=-(this.sprinting&&Input.sprint?PCFG.sprintJumpV:PCFG.jumpV);
      this.jumpBuf=0;this.coyote=0;this.grounded=false;this.plat=null;
      Sfx.jump();
      puff(this.x+this.w/2,this.y+this.h,5,['#ffffff','#dfe9f5'],40,300,0.3);
    }else if(this.jumpBuf>0&&canWallJump){
      // leap away from the wall with a burst of speed
      const away=-this.wallDir;
      this.vx=away*PCFG.wallJumpVx;this.vy=-PCFG.wallJumpVy;
      this.jumpBuf=0;this.wallCoyote=0;this.wallDir=0;this.facing=away;
      this.grounded=false;this.plat=null;this.jumpLock=PCFG.wallJumpLock;
      this.squash=-0.12; // stretch
      Sfx.wallJump();
      puff(this.x+(away>0?this.w:0),this.y+this.h/2,7,['#ffffff','#dfe9f5'],70,300,0.3);
    }
    // horizontal lock right after a wall jump so the burst isn't instantly cancelled
    if(this.jumpLock>0){this.jumpLock-=dt;}
    // apex float: brief reduced gravity + speed boost at the top of the arc
    let gMul=1;
    if(this.wallSlide)gMul=0.35;
    else if(!this.grounded&&Math.abs(this.vy)<60&&this.apexT<PCFG.apexFloat){
      this.apexT+=dt;
      gMul=0.5; // floaty apex
      if(effMove!==0)this.vx=clamp(this.vx+effMove*PCFG.apexBonus*dt*6,-maxRun-PCFG.apexBonus,maxRun+PCFG.apexBonus);
    }else if(!this.grounded)this.apexT=Math.max(0,this.apexT-dt*2);
    if(!Input.jump&&this.vy<-PCFG.jumpCut)this.vy=-PCFG.jumpCut;
    this.vy=Math.min(this.vy+GRAV*gMul*dt,this.wallSlide?PCFG.wallSlideV:MAXFALL);
    moveX(this,room,dt);
    this.x=clamp(this.x,0,room.w*TILE-this.w);
    const prevBottom=this.y+this.h;this.prevBottom=prevBottom;
    const wasGround=this.grounded;
    const impactV=this.vy;
    moveY(this,room,dt,prevBottom);
    if(this.grounded&&!wasGround){
      // landing juice scales with impact speed
      this.squash=impactV>300?0.18:0.12;
      this.landT=0;
      landPuff(this.x+this.w/2,this.y+this.h,impactV>320);
      if(impactV>320)Sfx.land();
      this.stompCombo=0;this.diveT=0;this.wallDir=0;this.wallCoyote=0;
      this.apexT=0;
    }
    this.landT+=dt;
    // moving platforms
    this.plat=null;
    if(this.vy>=0){
      for(const pl of room.platforms){
        if(this.x+this.w>pl.x+1&&this.x<pl.x+pl.w-1){
          const bottom=this.y+this.h;
          if(prevBottom<=pl.prevY+4&&bottom>=pl.y&&bottom<=pl.y+pl.h+8){
            this.y=pl.y-this.h;this.vy=0;this.grounded=true;this.plat=pl;
          }
        }
      }
    }
    // mystery boxes (bonk from below)
    if(this.vy<0||this.vx!==0){
      const hx0=Math.floor((this.x+2)/TILE),hx1=Math.floor((this.x+this.w-2)/TILE);
      const hy=Math.floor(this.y/TILE);
      for(let tx=hx0;tx<=hx1;tx++){
        if(hy>=0&&tileAt(room,tx,hy)==='B'&&!room.usedBoxes.has(tx+','+hy)){
          this.y=(hy+1)*TILE+0.01;this.vy=60;
          Game.openBox(room,tx,hy);
        }
      }
    }
    // springs
    for(const s of room.springs){
      if(this.vy>=0&&overlap(this,{x:s.tx*TILE+2,y:s.ty*TILE+6,w:12,h:10})){
        const superS=this.vy>350;
        this.vy=-PCFG.springV;
        this.grounded=false;this.plat=null;s.anim=0.25;
        Sfx.spring(superS);
        if(superS)this.squash=-0.15; // big stretch
        puff(s.tx*TILE+8,s.ty*TILE+6,8,['#ffe28a','#ffffff'],70,400,0.35);
      }
    }
    // spikes — sharp: every touch costs a heart (with brief recovery)
    if(this.spikeCd>0)this.spikeCd-=dt;
    for(const sp of room.spikes){
      if(overlap(this,{x:sp.tx*TILE+3,y:sp.ty*TILE+7,w:10,h:9})){
        if(this.spikeCd<=0){Game.hurt(sp.tx*TILE+8);this.spikeCd=PCFG.spikeCd;}
      }
    }
    // pipes — press ▼ while grounded near a pipe
    if(Input.down&&this.grounded){
      const footTx=Math.floor((this.x+this.w/2)/TILE);
      const footTy=Math.floor((this.y+this.h+1)/TILE);
      for(const pipe of lv.pipes){
        if(pipe.from.r!==lv.cur)continue;
        const px=pipe.from.tx*TILE,py=pipe.from.ty*TILE;
        const nearX=this.x+this.w>px-4&&this.x<px+TILE+4;
        const feetNear=this.y+this.h>=py-2&&this.y+this.h<=py+TILE+12;
        const onThis=footTx===pipe.from.tx&&footTy===pipe.from.ty;
        if(nearX&&(feetNear||onThis)){Game.warp(pipe);this.warped=true;break;}
      }
    }
    // weapons
    if(this.swordCd>0)this.swordCd-=dt;
    if(this.bowCd>0)this.bowCd-=dt;
    if(this.swordT>0)this.swordT-=dt;
    if(Input.consumeSword()&&Game.weapons.sword&&this.swordCd<=0){
      this.swordT=PCFG.swordLen;this.swordCd=PCFG.swordCd;
      Sfx.sword();
      // damage enemies in front
      const hb={x:this.x+(this.facing>0?this.w:2)-18,y:this.y-2,w:18,h:this.h+4};
      if(this.facing>0)hb.x=this.x+this.w+2;
      for(const e of room.enemies){
        if(e.dead)continue;
        if(overlap(hb,e)&&!(e instanceof Turret&&this.grounded&&e.y+6>=this.prevBottom)){
          hitEnemy(e,room);
          if(e instanceof Turret)e.flash=0.1;
        }
      }
      for(const pr of room.projectiles)if(!pr.friendly&&overlap(hb,pr)){
        // parry: swing at an incoming fireball to send it right back
        pr.friendly=true;
        pr.vx=this.facing*PCFG.arrowSp*1.1;pr.vy=0;
        pr.parried=true;
        Sfx.parry();
        puff(pr.x,pr.y,8,['#9fe8ff','#ffffff','#ffe28a'],90,200,0.35);
        Game.shake=Math.max(Game.shake,2);
        showMini('PARRY!',0.6);
      }
    }
    if(Input.consumeBow()&&Game.weapons.bow&&this.bowCd<=0){
      this.bowCd=PCFG.bowCd;
      room.projectiles.push(new Projectile(
        this.x+this.w/2+this.facing*8,this.y+this.h/2,
        this.facing*PCFG.arrowSp,0,true));
      Sfx.shoot();
      puff(this.x+this.w/2+this.facing*10,this.y+this.h/2,4,['#f5e8cf','#9fe8ff'],50,100,0.2);
    }
    if(this.invuln>0)this.invuln-=dt;
    if(this.squash>0)this.squash=Math.max(0,this.squash-dt*1.8);
    else if(this.squash<0)this.squash=Math.min(0,this.squash+dt*0.8);
    this.blinkT-=dt;
    if(this.blinkT<=0){this.blink=0.13;this.blinkT=rand(2.2,4.5);}
    if(this.blink>0)this.blink-=dt;
    if(this.y>room.h*TILE+24)Game.pitFall();
  }
}
function hitEnemy(e,room){
  if(e.dead)return;
  e.hurt();
  if(e.dead){
    Sfx.stomp();
    Game.shake=3;
    puff(e.x+e.w/2,e.y+e.h/2,12,['#ffffff','#ffd23e'],90,500,0.45);
    if(!(e instanceof Turret)){Game.earn(1);floater(e.x+e.w/2,e.y,'+1','#ffd23e');}
  }
}

// ---------- game state ----------
function wOff(w){let n=0;for(let i=0;i<w;i++)n+=WORLDS[i].lvls.length;return n;}
function lvWorld(i){let w=0;while(w<WORLDS.length-1&&i>=wOff(w+1))w++;return w;}
const Game={
  state:'title',levelIndex:0,lv:null,player:null,
  weapons:{sword:false,bow:false},
  camX:0,shake:0,time:0,clearT:0,banner:0,fade:0,
  zoom:1,flash:0,dmgFlash:0,freeze:0,dieT:0,
  coinStreak:0,coinStreakT:0,
  selW:0,selL:0,respawn:{x:0,y:0},
  bank:(()=>parseInt(store.get('pp_bank','0'),10)||0)(),
  get room(){return this.lv?this.lv.rooms[this.lv.cur]:null;},
  startLevel(i){
    this.levelIndex=i;
    this.lv=parseLevel(i);
    this.lv.cur=0;
    this.player=new Player(this.lv.spawn.x,this.lv.spawn.y);
    this.respawn={x:this.lv.spawn.x,y:this.lv.spawn.y};
    this.camX=clamp(this.lv.spawn.x-VW*0.42,0,this.lv.rooms[0].w*TILE-VW);
    this.camY=this.lv.rooms[0].h*TILE-VH;
    this.state='play';this.banner=2.6;this.fade=1;
    this.zoom=1.1;this.flash=0;this.dmgFlash=0;this.freeze=0;
    Input._jp=false;Input._sp=false;Input._bp=false;Input.jump=false;
    hudCache={};
    showBanner('LEVEL '+(Math.floor(i/4)+1)+'-'+((i%4)+1),this.lv.name.toUpperCase());
    $('#hud').classList.remove('hidden');
    hideScreen();
    Sfx.music();
  },
  toggleSelect(){
    if(this.state==='title'){this.state='select';showSelect();}
    else if(this.state==='select'){this.state='title';showTitle();}
  },
  moveSel(dw,dl){
    this.selW=clamp(this.selW+dw,0,7);
    this.selL=clamp(this.selL+dl,0,WORLDS[this.selW].lvls.length-1);
    Sfx.ui();
    showSelect();
  },
  togglePause(){
    if(this.state==='play'){
      this.state='pause';
      showPause();
    }else if(this.state==='pause'){this.state='play';hideScreen();}
  },
  confirm(){
    if(this.state==='title')this.startLevel(0);
    else if(this.state==='select')this.startLevel(wOff(this.selW)+this.selL);
    else if(this.state==='clear'){
      if(this.levelIndex+1<LEVELS.length)this.startLevel(this.levelIndex+1);
      else this.state='win',showWin();
    }
    else if(this.state==='over')this.startLevel(this.levelIndex);
    else if(this.state==='win'){this.state='title';showTitle();}
  },
  warp(pipe){
    const to=pipe.to;
    this.lv.cur=to.r;
    const p=this.player;
    p.plat=null;p.x=to.tx*TILE+2;p.y=to.ty*TILE-p.h;p.vx=0;p.vy=0;p.invuln=0;p.grounded=false;
    this.shake=3;this.fade=1;
    const room=this.room;
    this.camX=clamp(p.x-VW*0.42,0,room.w*TILE-VW);
    this.camY=room.h*TILE-VH;
    Sfx.pipe();
  },
  openBox(room,tx,ty){
    room.usedBoxes.add(tx+','+ty);
    bakeRoom(room,this.lv);
    Sfx.bump();
    puff(tx*TILE+8,ty*TILE+8,8,['#ffd23e','#fff'],60,200,0.4);
    const p=this.player;
    const opens=(this.boxOpens=(this.boxOpens||0)+1);
    const weighted=opts=>{ // [weight,kind] pairs → weighted random pick
      let tot=0;for(const o of opts)tot+=o[0];
      let r=Math.random()*tot;
      for(const o of opts){r-=o[0];if(r<=0)return o[1];}
      return opts[opts.length-1][1];
    };
    const giveSword=()=>{
      this.weapons.sword=true;
      $('touch').querySelector('[data-k=sword]').style.display='flex';
      showMini('SWORD UNLOCKED — PRESS J OR ⚔',1.8);Sfx.gem();
    };
    const giveBow=()=>{
      this.weapons.bow=true;
      $('touch').querySelector('[data-k=bow]').style.display='flex';
      showMini('BOW UNLOCKED — PRESS K OR ➶',1.8);Sfx.gem();
    };
    // first chest of a run always teaches melee; the bow is force-fed by the
    // third so it can never be missed; everything else is a random drop of
    // hearts (when hurt), the bow, or coins
    if(opens===1&&!this.weapons.sword){giveSword();return;}
    if(opens>=3&&!this.weapons.bow){giveBow();return;}
    const opts=[];
    if(!this.weapons.bow)opts.push([3,'bow']);
    if(p.hearts<3)opts.push([3,'heart']);
    opts.push([4,'coins']);
    const got=weighted(opts);
    if(got==='bow')giveBow();
    else if(got==='heart'){p.hearts++;showMini('+1 UP ♥',1.2);Sfx.gem();}
    else{this.earn(5);showMini('+5 COINS',1.2);Sfx.coin();}
  },
  earn(n){
    this.bank+=n;
    store.set('pp_bank',String(this.bank));
  },
  buy(id){
    const s=skin(id);
    if(ownedSkins().includes(id)||id==='hero')return;
    if(this.bank<s.price){showMini('NOT ENOUGH COINS',1.2);Sfx.hurt();return;}
    this.bank-=s.price;
    store.set('pp_bank',String(this.bank));
    const ow=ownedSkins();ow.push(id);
    store.set('pp_owned',JSON.stringify(ow));
    store.set('pp_equip',id);
    Sfx.buy();showShop();
  },
  equip(id){store.set('pp_equip',id);Sfx.coin();showShop();},
  hurt(fromX){
    const p=this.player;
    if(!p||p.invuln>0||this.state!=='play')return;
    p.hearts--;Sfx.hurt();this.shake=6;this.freeze=0.06;this.dmgFlash=1;
    puff(p.x+p.w/2,p.y+p.h/2,14,['#ff6b6b','#ffd23e','#ffffff'],110,500,0.5);
    if(p.hearts<=0){this.die();return;}
    p.invuln=1.6;p.vy=-220;p.vx=(p.x+p.w/2<fromX?-1:1)*170;p.grounded=false;
  },
  die(){
    const p=this.player;
    Sfx.die();this.shake=7;this.freeze=0.12;this.dmgFlash=1;
    puff(p.x+p.w/2,p.y+p.h/2,22,['#ff6b6b','#ffd23e','#ffffff'],140,400,0.7);
    p.hidden=true;p.invuln=99;
    this.state='dying';this.dieT=0.85;
  },
  pitFall(){
    const p=this.player;
    if(!p||this.state!=='play')return;
    p.hearts--;Sfx.hurt();this.shake=5;this.dmgFlash=1;
    if(p.hearts<=0){this.die();return;}
    this.lv.cur=0;
    p.x=this.respawn.x;p.y=this.respawn.y;p.vx=0;p.vy=0;p.invuln=1.4;p.plat=null;
    this.fade=0.7;
    this.camX=clamp(p.x-VW*0.42,0,this.room.w*TILE-VW);
    this.camY=this.room.h*TILE-VH;
  },
  complete(){
    if(this.state!=='play')return;
    this.state='clear';this.clearT=0;Sfx.clear();
    this.flash=0.7;this.zoom=1.06;
    puff(this.lv.rooms[0].flag.x,this.lv.rooms[0].flag.y-30,30,['#ffd23e','#ff6b6b','#7ef29a','#ffffff'],140,300,0.9);
    showClear();
  }
};

// ---------- world rendering ----------
function drawWorld(lv,showPlayer){
  const room=lv.rooms[lv.cur],p=Game.player;
  const camY=(Game.camY===undefined?room.h*TILE-VH:Game.camY);
  const camX=Math.round(Game.camX);
  let ox=0,oy=0;
  if(Game.shake>0){ox=rand(-1,1)*Game.shake;oy=rand(-1,1)*Game.shake*0.6;}
  ctx.save();
  if(Game.zoom>1.001){ // subtle camera zoom pulses (level start, stomp chains, clear)
    const z=Game.zoom;
    ctx.translate(VW/2,VH/2);ctx.scale(z,z);ctx.translate(-VW/2,-VH/2);
  }
  drawBackground(lv,camX);
  ctx.translate(-camX+ox,-camY+oy);
  ctx.drawImage(room.bake,0,0);
  for(const s of room.springs)drawSpring(s);
  for(const cp of room.checkpoints)drawCheckpoint(cp,Game.time);
  drawFlag(room.flag,Game.time,room);
  for(const pl of room.platforms){
    ctx.fillStyle='#6b7285';ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
    ctx.fillStyle='#9aa3b8';ctx.fillRect(pl.x,pl.y,pl.w,2);
    ctx.fillStyle='#4a4f5e';ctx.fillRect(pl.x,pl.y+pl.h-2,pl.w,2);
    ctx.fillStyle='#e8b23e';
    ctx.fillRect(pl.x+pl.w/2-2,pl.y+1,4,2);
    ctx.fillRect(pl.x+pl.w/2-2,pl.y+pl.h-3,4,2);
  }
  for(const c of room.coins)drawCoin(c);
  for(const e of room.enemies){
    if(e.dead)continue;
    if(e instanceof Turret)drawTurret(e);else if(e instanceof Flyer)drawFlyer(e);else drawWalker(e);
  }
  for(const pr of room.projectiles)drawProjectile(pr);
  if(showPlayer!==false&&p)drawPlayer(p);
  drawParticles();
  drawFloaters();
  ctx.restore();
  if(lv.theme._vig)ctx.drawImage(lv.theme._vig,0,0);
  if(lv.theme.lava)drawLava();
  if(Game.dmgFlash>0){ // red hit flash
    ctx.fillStyle='rgba(255,50,50,'+(0.30*Game.dmgFlash)+')';
    ctx.fillRect(0,0,VW,VH);
  }
  if(Game.flash>0){ // white flash on level clear
    ctx.fillStyle='rgba(255,255,255,'+(0.55*Game.flash)+')';
    ctx.fillRect(0,0,VW,VH);
  }
}
function drawLava(){
  const t=Game.time;
  ctx.fillStyle='#ff5a2a';
  ctx.beginPath();ctx.moveTo(0,VH);
  for(let x=0;x<=VW;x+=8)ctx.lineTo(x,VH-9+Math.sin(x*0.07+t*2.2)*2);
  ctx.lineTo(VW,VH);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,200,80,0.35)';
  ctx.beginPath();ctx.moveTo(0,VH);
  for(let x=0;x<=VW;x+=8)ctx.lineTo(x,VH-11+Math.sin(x*0.09+t*1.7+2)*2);
  ctx.lineTo(VW,VH);ctx.closePath();ctx.fill();
}

// ---------- DOM text ----------
let bannerT=0,miniT=0;
function showBanner(a,b){
  const bEl=$('#banner');
  bEl.innerHTML=a+'<div style="font-size:16px;color:#9fd8ff;font-weight:700">'+b+'</div>';
  bEl.classList.remove('hidden');
  bEl.style.animation='none';void bEl.offsetWidth;bEl.style.animation='';
  bannerT=Game.banner;
}
function showMini(txt,dur){
  const m=$('#minitext');
  m.textContent=txt;
  m.classList.remove('hidden');
  m.style.animation='none';void m.offsetWidth;m.style.animation='';
  miniT=dur;bannerT=Math.max(bannerT,dur);
}
function tickDOM(dt){
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('#banner').classList.add('hidden');}
  if(miniT>0){miniT-=dt;if(miniT<=0)$('#minitext').classList.add('hidden');}
}
let hudCache={};
function updateHUD(){
  if(!Game.lv)return;
  const p=Game.player,lv=Game.lv;
  if($('#hud').classList.contains('hidden'))return;
  const hearts=p?clamp(p.hearts,0,3):3;
  if(hudCache.h!==hearts){
    const prev=hudCache.h;hudCache.h=hearts;
    let html='';
    for(let i=0;i<3;i++)html+='<span class="ht'+(i<hearts?'':' off')+'">'+(i<hearts?'♥':'♡')+'</span>';
    $('#hudHearts').innerHTML=html;
    if(prev!==undefined){ // pop on gain, jolt on loss
      const el=$('#hudHearts');
      el.classList.remove('bump','jolt');void el.offsetWidth;
      el.classList.add(hearts<prev?'jolt':'bump');
    }
  }
  if(hudCache.c!==Game.bank){
    hudCache.c=Game.bank;
    const el=$('#hudCoins');el.textContent='❋ '+Game.bank;
    el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');
  }
  const w=[];
  if(Game.weapons.sword)w.push('⚔ J');
  if(Game.weapons.bow)w.push('↗ K');
  const ws=w.join('   ');
  if(hudCache.w!==ws){hudCache.w=ws;$('#hudWeps').textContent=ws;}
  const wn=WORLDS[lv.world].lvls.length,li=lv.index-wOff(lv.world);
  let dots='';
  for(let d=0;d<wn;d++)dots+='<i class="'+(d===li?'cur':(d<li?'done':''))+'"></i>';
  const lvlTxt='LEVEL '+(lv.world+1)+'-'+(li+1)+'<span class="dots">'+dots+'</span>';
  if(hudCache.l!==lvlTxt){hudCache.l=lvlTxt;$('#hudLevel').innerHTML=lvlTxt;}
  const nm=lv.worldName+' · '+lv.name;
  if(hudCache.n!==nm){hudCache.n=nm;$('#hudName').textContent=nm;}
}

// ---------- simulation (fixed 60 Hz) ----------
function step(dt){
  Game.time+=dt;
  const lv=Game.lv,room=lv.rooms[lv.cur],p=Game.player;
  if(Game.banner>0)Game.banner-=dt;
  if(Game.fade>0)Game.fade-=dt*1.6;
  for(const pl of room.platforms)pl.update(dt);
  for(const s of room.springs)if(s.anim>0)s.anim-=dt;
  p.update(dt,room,lv);
  if(p.warped){updateHUD();return;}
  // enemies
  for(const e of room.enemies){
    if(e.dead)continue;
    if(e instanceof Turret)e.update(dt,room);
    else if(e instanceof Flyer)e.update(dt);
    else e.update(dt,room);
    if(e.dead)continue;
    if(e instanceof Turret)continue;
    if(overlap(p,e)){
      if(p.vy>0&&p.prevBottom<=e.y+7){
        e.dead=true;
        p.stompCombo++;
        Sfx.stomp(p.stompCombo);
        Game.shake=3+p.stompCombo;
        Game.freeze=0.04;
        if(p.stompCombo>1)Game.zoom=Math.max(Game.zoom,1.045);
        puff(e.x+e.w/2,e.y+e.h/2,10+p.stompCombo*3,['#ffffff','#ffd23e'],80,500,0.45);
        if(p.stompCombo>1){
          Game.earn(p.stompCombo); // combo bonus: 2nd stomp = 2 coins, 3rd = 3...
          showMini('STOMP x'+p.stompCombo,0.8);
        }
        // chained stomps: holding jump launches you higher for combo pursuit
        p.vy=Input.jump?-(p.stompCombo>1?PCFG.stompChainVyHold:PCFG.stompVHold)
                       :-(p.stompCombo>1?PCFG.stompChainVy:PCFG.stompV);
        p.y=e.y-p.h-1;
        Game.earn(1);
        // every 3rd stomp rewards a heart (max 3)
        p.stomps=(p.stomps||0)+1;
        if(p.stomps%3===0&&p.hearts<3){
          p.hearts++;
          Sfx.check();
          floater(e.x+e.w/2,e.y-14,'+1 ♥','#ff8fa3');
          puff(e.x+e.w/2,e.y,8,['#ff8fa3','#ffffff'],70,200,0.5);
        }
      }else Game.hurt(e.x+e.w/2);
    }
  }
  for(const e of room.enemies)if(!e.dead&&e instanceof Turret&&overlap(p,e))Game.hurt(e.x+7);
  // projectiles
  for(let i=room.projectiles.length-1;i>=0;i--){
    const pr=room.projectiles[i];
    if(pr.dead)continue;
    pr.update(dt,room);
    if(pr.dead)continue;
    if(pr.friendly){
      for(const e of room.enemies){
        if(!e.dead&&overlap(pr,e)){pr.dead=true;hitEnemy(e,room);}
      }
      for(const pr2 of room.projectiles)
        if(!pr2.friendly&&pr2!==pr&&!pr2.dead&&overlap(pr,pr2)){pr.dead=true;pr2.dead=true;}
    }else if(overlap(pr,p)&&p.invuln<=0){
      Game.hurt(pr.x);pr.dead=true;
    }
  }
  // coins
  if(Game.coinStreakT>0){Game.coinStreakT-=dt;if(Game.coinStreakT<=0)Game.coinStreak=0;}
  for(const c of room.coins){
    if(c.taken)continue;
    c.anim+=dt;
    if(overlap(p,{x:c.x-7,y:c.y-7,w:14,h:14})){
      c.taken=true;
      if(c.gem){Game.earn(5);Sfx.gem();puff(c.x,c.y,14,['#4de3d1','#ffffff','#9ff5ea'],100,200,0.6);floater(c.x,c.y-10,'+5','#7ff0e3');}
      else{
        Game.earn(1);
        Sfx.coin(Math.min(Game.coinStreak,5));
        Game.coinStreak=(Game.coinStreak||0)+1;Game.coinStreakT=1.2;
        puff(c.x,c.y,6,['#ffd23e','#ffffff'],60,300,0.4);
        floater(c.x,c.y-10,'+1','#ffd23e');
      }
    }
  }
  // checkpoints
  for(const cp of room.checkpoints){
    if(!cp.active&&Math.abs(p.x+p.w/2-cp.x)<14&&p.y+p.h>cp.y-40&&p.y<cp.y){
      cp.active=true;
      Game.respawn={x:cp.x-5,y:cp.y-PCFG.h};
      Sfx.check();
      puff(cp.x,cp.y-24,14,['#7ef29a','#ffffff'],75,120,0.6);
      floater(cp.x,cp.y-40,'CHECKPOINT','#7ef29a');
      Game.zoom=Math.max(Game.zoom,1.03);
    }
  }
  // goal flag (main room only)
  if(lv.cur===0&&room.flag&&!lv.done&&overlap(p,{x:room.flag.x-8,y:room.flag.y-48,w:16,h:48})){
    lv.done=true;Game.complete();
  }
  updateParticles(dt);
  Game.shake=Math.max(0,Game.shake-16*dt);
  // camera: forward lookahead, faster snap downward (landing), gentle upward drift
  const lookX=p.x+p.w/2-VW*0.42+p.facing*PCFG.camLookahead;
  const target=clamp(lookX,0,room.w*TILE-VW);
  Game.camX+=(target-Game.camX)*Math.min(1,dt*6);
  const floorY=room.h*TILE-VH;
  let camYTarget=floorY;
  // look up when high above the floor line so jumps stay on-screen
  if(p.y<floorY-90)camYTarget=floorY-(floorY-90-p.y)*0.55;
  if(Game.camY===undefined)Game.camY=floorY;
  const lerp=p.y<Game.camY-4?PCFG.camLerpUp:PCFG.camLerpDown;
  Game.camY+=(camYTarget-Game.camY)*Math.min(1,dt*lerp);
  Game.camY=clamp(Game.camY,floorY-VH*0.35,floorY);
  updateHUD();
}

// ---------- DOM screens ----------
const scr=$('screen');
function hideScreen(){scr.classList.add('hidden');}
function showPanel(html){scr.innerHTML=html;scr.classList.remove('hidden');}
function showTitle(){
  $('#hud').classList.add('hidden');
  showPanel(`<div id="panel">
    <h1>PIXEL PEAKS</h1>
    <h2>8 WORLDS · 32 LEVELS · SECRET PIPES · COIN SHOP</h2>
    <p><span class="keys">← →</span> MOVE&nbsp; <span class="keys">SHIFT</span> SPRINT&nbsp; <span class="keys">SPACE</span> JUMP&nbsp; <span class="keys">▼</span> PIPES</p>
    <p><span class="keys">J</span> SWORD&nbsp; <span class="keys">K</span> BOW&nbsp; BONK <span class="keys">?</span> BLOCKS</p>
    <p>STOMP GOOMBAS · DODGE TURRETS · EARN COINS FOR SKINS</p>
    <p>BANK: <span style="color:#ffd23e">❋ ${Game.bank}</span></p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.startLevel(0)">▶ START</button>
      <button class="sbtn" onclick="Game.toggleSelect()">WORLDS</button>
      <button class="sbtn" onclick="showShop()">SHOP ❋</button>
    </div>
  </div>`);
}
function showSelect(){
  const cells=WORLDS.map((wd,wi)=>{
    const dots=wd.lvls.map((l,li)=>{
      const n=wOff(wi)+li;
      const isSel=Game.selW===wi&&Game.selL===li;
      return `<span class="wdot ${isSel?'on':''}" onclick="Game.selW=${wi};Game.selL=${li};Game.startLevel(${n})"></span>`;
    }).join('');
    return `<div class="wcell ${Game.selW===wi?'sel':''}" onclick="Game.selW=${wi};Game.selL=Math.min(Game.selL,WORLDS[${wi}].lvls.length-1);Game.startLevel(${wOff(wi)}+Game.selL)">
      <b>${wi+1}</b><div>${dots}</div><span class="wtitle">${wd.name}</span></div>`;
  }).join('');
  showPanel(`<div id="panel">
    <h2>CHOOSE A WORLD</h2>
    <div class="wgrid">${cells}</div>
    <p style="margin-top:10px;font-size:13px;color:#9aa4d8">ARROWS + ENTER to play · click any level dot to jump straight in</p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.startLevel(wOff(Game.selW)+Game.selL)">▶ PLAY LEVEL ${Game.selW+1}-${Game.selL+1}</button>
      <button class="sbtn" onclick="Game.state='title';showTitle()">◀ BACK</button>
      <button class="sbtn" onclick="showShop()">SHOP ❋ ${Game.bank}</button>
    </div>
  </div>`);
}
function showShop(){
  const ow=ownedSkins(),eq=store.get('pp_equip','hero');
  const cells=SKINS.map(s=>{
    const owned=ow.includes(s.id)||s.id==='hero';
    const wearing=eq===s.id;
    const sw=`linear-gradient(180deg,${s.p[0]},${s.p[1]})`;
    const cls=owned?`scell owned${wearing?' equip':''}`:'scell';
    const act=`onclick="${wearing?'':(owned?'Game.equip(\''+s.id+'\')':'Game.buy(\''+s.id+'\')')}"`;
    const sub=wearing?'<span class="tag">✓ WORN</span>':(owned?'<span class="tag">CLICK TO WEAR</span>':`<div class="price">❋ ${s.price}</div>`);
    return `<div class="${cls}" ${act}><div class="swatch" style="background:${sw}"></div><b>${s.name}</b>${sub}</div>`;
  }).join('');
  showPanel(`<div id="panel">
    <h2>APPAREL SHOP</h2>
    <p>Your bank: <span style="color:#ffd23e;font-weight:700">❋ ${Game.bank}</span> — coins persist across runs</p>
    <div class="sgrid">${cells}</div>
    <div class="srow">
      <button class="sbtn" onclick="Game.state='title';showTitle()">◀ BACK</button>
      <button class="sbtn" onclick="Game.toggleSelect()">WORLDS</button>
    </div>
  </div>`);
}
function showPause(){
  showPanel(`<div id="panel">
    <h2>PAUSED</h2>
    <p>LEVEL ${lvWorld(Game.levelIndex)+1}-${Game.levelIndex-wOff(lvWorld(Game.levelIndex))+1} · ${Game.lv.name}</p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.togglePause()">▶ RESUME</button>
      <button class="sbtn" onclick="Game.startLevel(Game.levelIndex)">↻ RESTART</button>
      <button class="sbtn" onclick="Game.state='select';showSelect()">WORLDS</button>
      <button class="sbtn" onclick="Game.state='title';showTitle()">TITLE</button>
    </div>
  </div>`);
}

function showClear(){
  const more=Game.levelIndex+1<LEVELS.length;
  showPanel(`<div id="panel">
    <h1 style="font-size:30px;color:#7ef29a">LEVEL CLEAR!</h1>
    <p>BANK: <span style="color:#ffd23e;font-weight:700">❋ ${Game.bank}</span></p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.confirm()">${more?'NEXT LEVEL ▶':'FINISH ▶'}</button>
      <button class="sbtn" onclick="Game.state='select';showSelect()">WORLDS</button>
      <button class="sbtn" onclick="showShop()">SHOP ❋</button>
    </div>
  </div>`);
}
function showOver(){
  showPanel(`<div id="panel">
    <h1 style="color:#ff6b6b">GAME OVER</h1>
    <p>That was a fall. The mountain waits.</p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.confirm()">↻ RETRY</button>
      <button class="sbtn" onclick="Game.state='select';showSelect()">WORLDS</button>
      <button class="sbtn" onclick="Game.state='title';showTitle()">TITLE</button>
    </div>
  </div>`);
}
function showWin(){
  $('#hud').classList.add('hidden');
  showPanel(`<div id="panel">
    <h1>YOU WIN!</h1>
    <p>All 8 worlds conquered. Bank: <span style="color:#ffd23e;font-weight:700">❋ ${Game.bank}</span></p>
    <p>Spend it in the shop — then go play the secrets.</p>
    <div class="srow">
      <button class="sbtn primary" onclick="Game.confirm()">TITLE</button>
      <button class="sbtn" onclick="Game.state='select';showSelect()">WORLDS</button>
    </div>
  </div>`);
}

// ---------- render ----------
function render(){
  const st=Game.state;
  if(st==='play'||st==='pause'||st==='clear'||st==='over'||st==='dying')drawWorld(Game.lv);
  else drawWorld(Game.lv,false);
  if(Game.fade>0){
    ctx.fillStyle='rgba(8,10,24,'+clamp(Game.fade,0,1)+')';
    ctx.fillRect(0,0,VW,VH);
  }
}

// ---------- main loop ----------
let last=performance.now(),acc=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000;last=now;
  if(dt>0.25)dt=0.25;
  tickDOM(dt);
  // effect timers always decay
  if(Game.freeze>0)Game.freeze-=dt;
  if(Game.dmgFlash>0)Game.dmgFlash=Math.max(0,Game.dmgFlash-dt*2.5);
  if(Game.flash>0)Game.flash=Math.max(0,Game.flash-dt*2.2);
  Game.zoom+=(1-Game.zoom)*Math.min(1,dt*3.2);
  if(Game.state==='dying'){ // brief death beat, then the game-over panel
    Game.time+=dt;updateParticles(dt);
    if(Game.dieT>0){Game.dieT-=dt;if(Game.dieT<=0){Game.state='over';showOver();}}
  }else if(Game.state==='play'){
    if(Game.freeze<=0){ // hit-stop: tiny freeze for impact, then resume
      acc+=dt;
      let n=0;
      while(acc>=STEP&&n<5){step(STEP);acc-=STEP;n++;}
      if(n===5)acc=0;
    }
  }else{
    Game.time+=dt;
    if(Game.state!=='pause')updateParticles(dt);
    if(Game.banner>0)Game.banner-=dt;
    if(Game.fade>0)Game.fade-=dt*1.6;
    if(Game.state==='title'&&Game.lv){
      Game.camX=(Game.camX+dt*10)%Math.max(1,Game.lv.rooms[0].w*TILE-VW);
    }
  }
  render();
}

// ---------- boot ----------
Game.lv=parseLevel(0);
requestAnimationFrame(frame);
showTitle();