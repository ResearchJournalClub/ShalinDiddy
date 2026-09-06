'use strict';
/* ============================================================
   Pixel Peaks — procedural audio (WebAudio, no asset files)
   ============================================================ */
const Sfx=(()=>{
  let ctx=null,master=null,musicGain=null,noiseBuf=null;
  let muted=false,musicStarted=false,timer=null,step=0,nextT=0;

  function ensure(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      ctx=new AC();
      master=ctx.createGain();master.gain.value=0.5;master.connect(ctx.destination);
      musicGain=ctx.createGain();musicGain.gain.value=0.28;musicGain.connect(master);
      noiseBuf=ctx.createBuffer(1,ctx.sampleRate*0.25|0,ctx.sampleRate);
      const d=noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    if(ctx.state==='suspended')ctx.resume();
    return true;
  }
  function blip(f,dur,type,vol,slide){
    if(!ensure())return;
    const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t+dur);
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g);g.connect(master);
    o.start(t);o.stop(t+dur+0.03);
  }
  function noise(dur,vol,freq){
    if(!ensure())return;
    const t=ctx.currentTime,s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    s.buffer=noiseBuf;f.type='lowpass';f.frequency.value=freq||1400;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);
    s.start(t);s.stop(t+dur);
  }

  /* ---- music: C–Am–F–G chiptune loop, 132 BPM eighths ---- */
  const mtof=m=>440*Math.pow(2,(m-69)/12);
  const LEAD=[ // 32 eighth-notes (4 bars), 0 = rest
    72,76,79,76, 72,0,67,0,
    69,72,76,72, 69,0,64,0,
    65,69,72,69, 77,0,76,0,
    74,71,67,71, 74,76,79,0];
  const BASS=[36,36,36,36, 33,33,33,33, 29,29,29,29, 31,31,31,31]; // quarter roots
  const STEP_DUR=60/132/2;
  function note(f,t,dur,type,vol){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g);g.connect(musicGain);
    o.start(t);o.stop(t+dur+0.05);
  }
  function schedule(){
    if(!ctx||ctx.state!=='running')return;
    while(nextT<ctx.currentTime+0.3){
      const s=step%32;
      if(LEAD[s])note(mtof(LEAD[s]),nextT,0.2,'square',0.05);
      if(s%2===0)note(mtof(BASS[(s/2)%16]),nextT,0.42,'triangle',0.09);
      nextT+=STEP_DUR;step++;
    }
  }

  return{
    unlock(){if(ensure())this.music();},
    music(){
      if(!ensure()||musicStarted)return;
      musicStarted=true;step=0;nextT=ctx.currentTime+0.1;
      timer=setInterval(schedule,120);
    },
    toggleMute(){muted=!muted;if(master)master.gain.value=muted?0:0.5;return muted;},
    jump(){blip(340,0.18,'square',0.10,720);},
    wallJump(){blip(460,0.14,'square',0.11,880);setTimeout(()=>blip(740,0.12,'triangle',0.08,980),30);},
    coin(streak=0){
      const scale=[1150,1318,1480,1720,1975,2200];
      const base=scale[Math.min(streak,scale.length-1)];
      blip(base,0.06,'square',0.09);
      setTimeout(()=>blip(base*1.4,0.1,'square',0.08),45);
    },
    gem(){[880,1108,1318,1760].forEach((f,i)=>setTimeout(()=>blip(f,0.15,'triangle',0.13),i*70));},
    stomp(combo=0){
      const mult=Math.min(2.2,1+combo*0.2);
      blip(280*mult,0.11,'square',0.15,90*mult);
      noise(0.08,0.10,900);
      if(combo>1)setTimeout(()=>blip(520*mult,0.12,'triangle',0.12,700),40);
    },
    hurt(){blip(220,0.28,'sawtooth',0.16,70);},
    spring(superSpring=false){
      const f=superSpring?280:200,slide=superSpring?1350:900;
      blip(f,0.24,'square',0.14,slide);
      if(superSpring)setTimeout(()=>blip(600,0.18,'triangle',0.12,1200),60);
    },
    parry(){blip(1400,0.12,'triangle',0.18,1900);noise(0.05,0.12,3000);setTimeout(()=>blip(1800,0.15,'sine',0.12),30);},
    skid(){noise(0.06,0.07,600);},
    pop(){blip(480,0.08,'sine',0.12,880);},
    land(){noise(0.07,0.11,500);blip(120,0.08,'sine',0.12,60);},
    check(){[523,784].forEach((f,i)=>setTimeout(()=>blip(f,0.15,'triangle',0.12),i*90));},
    clear(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>blip(f,0.18,'square',0.11),i*110));},
    die(){[400,300,200,120].forEach((f,i)=>setTimeout(()=>blip(f,0.2,'sawtooth',0.13),i*130));},
    shoot(){blip(880,0.12,'square',0.08,220);},
    fire(){blip(220,0.1,'sawtooth',0.08,90);noise(0.06,0.06,800);},
    sword(){blip(560,0.09,'square',0.10,120);noise(0.06,0.08,2000);},
    bump(){blip(150,0.1,'square',0.14,320);noise(0.06,0.08,700);},
    pipe(){blip(300,0.35,'sine',0.14,60);setTimeout(()=>blip(200,0.3,'sine',0.12,900),220);},
    buy(){[660,880,1320].forEach((f,i)=>setTimeout(()=>blip(f,0.12,'triangle',0.12),i*80));},
    ui(){blip(660,0.06,'square',0.06);}
  };
})();
