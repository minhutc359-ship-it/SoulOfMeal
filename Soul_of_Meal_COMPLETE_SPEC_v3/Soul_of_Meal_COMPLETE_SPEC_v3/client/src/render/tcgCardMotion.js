export class TcgCardMotion {
  #queue = [];
  #hand = new Set();
  #overlays = new Set();

  clear() {
    this.#queue = [];
    this.#hand.clear();
    for (const overlay of this.#overlays) overlay.remove();
    this.#overlays.clear();
  }

  collect(field, { kind, card, art, from, to }) {
    if (!field) return;
    const origin = (from ?? field).getBoundingClientRect();
    this.#queue.push({ kind, card, art, origin, to });
  }

  render(app, hand, reduced) {
    const handIds = new Set(hand.map(card => card.instance_id));
    if (!reduced) {
      let order = 0;
      for (const button of app.querySelectorAll('[data-card]')) {
        if (this.#hand.has(button.dataset.card)) continue;
        button.classList.add('tcg-new-card');
        button.style.setProperty('--deal-delay', Math.min(220, 55 * order++) + 'ms');
        const back = document.createElement('span');
        back.className = 'tcg-card-back tcg-deal-back';
        back.setAttribute('aria-hidden', 'true');
        back.textContent = '◆';
        button.append(back);
      }
    }
    this.#hand = handIds;
    const queue = this.#queue.splice(0);
    if (reduced) return;
    queue.forEach((item, index) => this.#fly(app, item, Math.min(index * 95, 285)));
  }

  #fly(app, { kind, card, art, origin, to }, delay) {
    const destination = (app.querySelector(to) ?? app.querySelector('.duel-mid'))?.getBoundingClientRect();
    if (!destination?.width) return;
    const x = origin.left + origin.width / 2;
    const y = origin.top + origin.height / 2;
    const dx = destination.left + destination.width / 2 - x;
    const dy = destination.top + destination.height / 2 - y;
    const flight = document.createElement('div');
    flight.className = 'tcg-card-flight tcg-flight-' + kind;
    flight.setAttribute('aria-hidden', 'true');
    flight.style.left = x + 'px';
    flight.style.top = y + 'px';
    flight.style.setProperty('--flight-x', dx + 'px');
    flight.style.setProperty('--flight-y', dy + 'px');
    flight.style.setProperty('--flight-delay', delay + 'ms');
    const faces = document.createElement('div');
    faces.className = 'tcg-flight-faces';
    const back = document.createElement('div');
    back.className = 'tcg-card-back';
    back.textContent = '◆';
    const front = document.createElement('div');
    front.className = 'tcg-flight-front';
    if (art) {
      const image = document.createElement('img');
      image.src = art;
      image.alt = '';
      front.append(image);
    }
    if (card) {
      const name = document.createElement('b');
      name.textContent = card.display_name;
      front.append(name);
    }
    faces.append(back, front);
    flight.append(faces);
    const cleanup = () => { flight.remove(); this.#overlays.delete(flight); };
    flight.addEventListener('animationend', event => { if (event.target === flight) cleanup(); });
    document.body.append(flight);
    this.#overlays.add(flight);
    setTimeout(cleanup, 1200 + delay);
  }
}
