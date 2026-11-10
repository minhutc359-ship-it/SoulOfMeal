if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail;
    }
  };
}

export class GameEventBus extends EventTarget {
  #sequence = 0;
  #tick = 0;

  setTick(tick) {
    this.#tick = tick;
  }

  emit(type, payload = {}, context = {}) {
    const detail = {
      ...context,
      tick: context.tick ?? this.#tick,
      seq: this.#sequence++,
      type,
      payload,
    };
    this.dispatchEvent(new CustomEvent('game-event', { detail }));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('soul:game-event', { detail }));
    return detail;
  }

  reset(sequence = 0, tick = 0) {
    this.#sequence = sequence;
    this.#tick = tick;
  }
}

export const gameEvents = new GameEventBus();