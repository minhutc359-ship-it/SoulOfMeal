import assert from 'node:assert/strict';
import test from 'node:test';
import { MusicCrossfade } from '../src/core/musicCrossfade.js';
import { GameAudio } from '../src/core/audio.js';
const track = () => ({ fadeGain:1, audio:{volume:.6,paused:false,pause(){this.paused=true;}} });

test('music mixes both sources over time and releases the old loop at completion',()=>{
  let time=0,callback;
  const mixer=new MusicCrossfade({now:()=>time,schedule:fn=>(callback=fn,1),cancel:()=>{}});
  const first=track(),next=track();mixer.start(first,next,()=>.6,()=>{});
  assert.equal(first.audio.paused,false);assert.equal(next.audio.volume,0);
  time=400;callback();assert.equal(first.audio.volume,.3);assert.equal(next.audio.volume,.3);
  time=800;callback();assert.equal(first.audio.paused,true);assert.equal(next.audio.volume,.6);assert.equal(mixer.current,null);
});

test('rapid scene changes retain the mixed gains and do not leave retired music playing',()=>{
  let time=0,callback;
  const mixer=new MusicCrossfade({now:()=>time,schedule:fn=>(callback=fn,1),cancel:()=>{}});
  const first=track(),second=track(),third=track();mixer.start(first,second,()=>.6,()=>{});
  time=200;callback();mixer.start(second,third,()=>.6,()=>{});
  time=600;callback();assert.ok(Math.abs(first.audio.volume+second.audio.volume+third.audio.volume-.6)<1e-9);
  time=1000;callback();assert.equal(first.audio.paused,true);assert.equal(second.audio.paused,true);assert.equal(third.audio.paused,false);
});

test('hiding or muting finishes retired tracks without modifying unrelated ambience',()=>{
  const mixer=new MusicCrossfade({now:()=>0,schedule:()=>1,cancel:()=>{}});
  const first=track(),next=track(),ambience=track();mixer.start(first,next,()=>.6,()=>{});mixer.finish();
  assert.equal(first.audio.paused,true);assert.equal(next.fadeGain,1);assert.equal(ambience.audio.volume,.6);assert.equal(ambience.audio.paused,false);
});

test('game music crossfades into the shared boss scene and restores the prior mode, respecting mute',t=>{
  const prior=globalThis.Audio;t.after(()=>{globalThis.Audio=prior;});
  globalThis.Audio=class extends EventTarget {constructor(path){super();this.path=path;this.volume=1;}canPlayType(){return 'probably';}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}};
  let time=0,callback;
  const settings={music:70,sfx:80,ambience:50};
  const game=new GameAudio(settings,{now:()=>time,schedule:fn=>(callback=fn,1),cancel:()=>{}});
  game.unlock();game.setScene('forest');const forest=game.loops.music;
  game.setScene('epic_boss_battle');assert.equal(game.loops.music.path,'battle_theme.ogg');assert.equal(forest.audio.paused,false);
  time=400;callback();assert.ok(game.loops.music.audio.volume>0);assert.ok(forest.audio.volume>0);
  game.setScene('forest');time=1200;callback();assert.equal(game.loops.music.path,'forest_theme.ogg');assert.equal(forest.audio.paused,true);
  settings.music=0;game.setSettings(settings);assert.equal(game.loops.music.audio.paused,true);
});
