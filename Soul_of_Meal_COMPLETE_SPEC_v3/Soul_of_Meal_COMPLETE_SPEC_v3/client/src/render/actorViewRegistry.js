export class ActorViewRegistry {
  #views = new Map();

  upsert(view) {
    if (!view || typeof view.actorId !== 'string' || !view.actorId) return null;
    const previous = this.#views.get(view.actorId);
    const next = { ...previous, ...view };
    this.#views.set(view.actorId, next);
    return next;
  }

  get(actorId) {
    return this.#views.get(actorId) ?? null;
  }

  values() {
    return [...this.#views.values()];
  }

  retain(actorIds) {
    const keep = new Set(actorIds);
    for (const actorId of this.#views.keys()) {
      if (!keep.has(actorId)) this.#views.delete(actorId);
    }
  }

  clear() {
    this.#views.clear();
  }
}