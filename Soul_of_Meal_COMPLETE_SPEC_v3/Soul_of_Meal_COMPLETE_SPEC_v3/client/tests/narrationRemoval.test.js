import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile,readdir } from 'node:fs/promises';
import test from 'node:test';
import { CHAPTER_DIALOGUES } from '../src/modes/adventureStory.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';

test('the client contains no speech engine or voice bundle while retaining written chapter dialogue',async()=>{
  assert.equal(existsSync(new URL('../assets/audio/voice',import.meta.url)),false);
  async function inspect(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      const file=new URL(entry.name+(entry.isDirectory()?'/':''),folder);
      if(entry.isDirectory())await inspect(file);
      else if(/\.(js|ts)$/.test(entry.name))assert.doesNotMatch(await readFile(file,'utf8'),/speechSynthesis|SpeechSynthesisUtterance|new GameVoice/);
    }
  }
  await inspect(new URL('../src/',import.meta.url));
  assert.ok(Object.keys(CHAPTER_DIALOGUES).length>=3);
});

test('new and restored saves omit the retired narration setting while preserving music preferences and progress',()=>{
  const save=createDefaultSave();assert.equal(Object.hasOwn(save.settings,'voice'),false);
  save.settings.voice=80;save.settings.music=35;save.player.gold=456;
  const restored=migrateSave(JSON.parse(JSON.stringify(save)));
  assert.equal(Object.hasOwn(restored.settings,'voice'),false);
  assert.equal(restored.settings.music,35);assert.equal(restored.player.gold,456);
});
