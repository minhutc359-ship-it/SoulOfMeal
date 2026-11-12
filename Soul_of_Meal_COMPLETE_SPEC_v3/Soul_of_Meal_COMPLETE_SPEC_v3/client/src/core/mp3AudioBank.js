// Legacy browsers can unlock one Web Audio context from the title gesture.
// The bundle contains MP3 copies of the built-in Ogg cues and loops.
export function createCompatibilityBank(directory) {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context || typeof Audio === 'undefined' || new Audio().canPlayType('audio/ogg; codecs="vorbis"')) return null;
  return new Mp3AudioBank(directory, Context);
}

class Mp3AudioBank {
  constructor(directory, Context) {
    this.directory = directory;
    this.Context = Context;
    this.buffers = new Map();
  }

  unlock() {
    try {
      this.context ??= new this.Context();
      if (this.context.state !== 'running') void this.context.resume().catch(() => {});
      if (!this.bundle) {
        this.bundle = this.load();
        void this.bundle.then(({ index }) => {
          for (const path of Object.keys(index)) if (path.startsWith('sfx_')) void this.buffer(path).catch(() => {});
        }).catch(() => {});
      }
    } catch {
      // The game stays playable if the browser blocks Web Audio.
    }
  }

  async load() {
    const response = await fetch(this.directory + 'compatibility.bin');
    if (!response.ok) throw new Error('Missing compatibility audio');
    const data = await response.arrayBuffer();
    const size = new DataView(data).getUint32(0, true);
    const base = size + 4;
    const index = JSON.parse(new TextDecoder().decode(data.slice(4, base)));
    return { data, index, base };
  }

  buffer(path) {
    if (!this.buffers.has(path)) this.buffers.set(path, this.decode(path));
    return this.buffers.get(path);
  }

  async decode(path) {
    const { data, index, base } = await this.bundle.catch(() => ({}));
    let bytes;
    if (index && Object.hasOwn(index, path)) {
      const [offset, length] = index[path];
      bytes = data.slice(base + offset, base + offset + length);
    } else {
      const response = await fetch(this.directory + path);
      if (!response.ok) throw new Error('Missing audio track');
      bytes = await response.arrayBuffer();
    }
    return this.context.decodeAudioData(bytes);
  }

  create(path) {
    return new BufferTrack(this, path);
  }
}

class BufferTrack extends EventTarget {
  constructor(bank, path) {
    super();
    this.bank = bank;
    this.path = path;
    this.level = 1;
    this.offset = 0;
    this.attempt = 0;
  }

  get volume() {
    return this.level;
  }

  set volume(value) {
    this.level = value;
    if (this.gain) this.gain.gain.value = value;
  }

  async play() {
    if (this.source) return;
    const attempt = ++this.attempt;
    const context = this.bank.context;
    if (!context) throw new DOMException('Audio context unavailable', 'NotAllowedError');
    let buffer;
    try {
      buffer = await this.bank.buffer(this.path);
    } catch {
      throw new DOMException('Unable to decode audio', 'EncodingError');
    }
    if (attempt !== this.attempt) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = this.level;
    source.buffer = buffer;
    source.loop = this.loop ?? false;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.source !== source) return;
      this.source = this.gain = null;
      this.offset = 0;
      this.dispatchEvent(new Event('ended'));
    };
    this.source = source;
    this.gain = gain;
    this.startedAt = context.currentTime;
    source.start(0, this.offset);
  }

  pause() {
    ++this.attempt;
    if (!this.source) return;
    const source = this.source;
    this.offset = (this.offset + this.bank.context.currentTime - this.startedAt) % source.buffer.duration;
    this.source = this.gain = null;
    source.stop();
  }
}
