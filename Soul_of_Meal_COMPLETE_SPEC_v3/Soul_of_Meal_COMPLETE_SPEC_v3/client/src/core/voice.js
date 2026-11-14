import lines from './voiceLibrary.json' with { type: 'json' };

const SPEAKERS = {
  npc_lilia: { pitch: 1.12, rate: .94 },
  commander: { pitch: .85, rate: 1.03 },
  chr_banhbao_bachngoc: { pitch: 1.23, rate: 1.06 },
  chr_caphe_davu: { pitch: .91, rate: .92 },
  chr_bunbo_holinh: { pitch: 1.05, rate: 1.06 },
};

export class GameVoice {
  constructor(settings, engine = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioTrack = globalThis.Audio) {
    this.settings = settings;
    this.engine = engine;
    this.Utterance = Utterance;
    this.AudioTrack = AudioTrack;
    this.level = settings.voice;
    this.current = null;
    this.onPlaying = () => {};
  }

  available() {
    return this.engine?.getVoices().find(voice => /^vi(?:-|_|$)/i.test(voice.lang));
  }

  speak(text, speaker, { priority = false, clip } = {}) {
    const volume = Math.max(0, Math.min(1, Number(this.settings.voice) / 100));
    if (!volume || typeof text !== 'string' || !text.trim()) return false;
    if (this.current?.priority && !priority) return false;
    if (this.AudioTrack && Object.hasOwn(lines, clip) && lines[clip] === text) {
      this.stop();
      const audio = new this.AudioTrack('./assets/audio/voice/' + clip + '.mp3');
      audio.volume = volume * .76;
      const current = { audio, priority };
      this.current = current;
      this.onPlaying(true);
      const ended = () => {
        if (this.current !== current) return;
        this.current = null;
        this.onPlaying(false);
      };
      audio.addEventListener('ended', ended, { once: true });
      audio.play().catch(() => {
        if (this.current !== current) return;
        ended();
        this.speakDevice(text, speaker, volume, priority);
      });
      return true;
    }
    return this.speakDevice(text, speaker, volume, priority);
  }

  speakDevice(text, speaker, volume, priority) {
    const voice = this.available();
    if (!voice || !this.Utterance) return false;
    this.stop();
    const line = new this.Utterance(text);
    const { pitch = 1, rate = .99 } = SPEAKERS[speaker] ?? {};
    Object.assign(line, { voice, lang: voice.lang, pitch, rate, volume });
    this.current = { line, priority };
    this.onPlaying(true);
    line.onend = line.onerror = () => {
      if (this.current?.line !== line) return;
      this.current = null;
      this.onPlaying(false);
    };
    this.engine.speak(line);
    return true;
  }

  stop() {
    if (!this.current) return;
    const { audio } = this.current;
    this.current = null;
    if (audio) audio.pause();
    else this.engine.cancel();
    this.onPlaying(false);
  }

  setSettings(settings) {
    if (settings.voice !== this.level) this.stop();
    this.level = settings.voice;
    this.settings = settings;
  }
}
