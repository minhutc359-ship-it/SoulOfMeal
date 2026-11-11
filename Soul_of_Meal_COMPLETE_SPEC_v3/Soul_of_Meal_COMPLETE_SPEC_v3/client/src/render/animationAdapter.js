import { ClipPlayer, validateAnimationManifest } from './clipPlayer.js';
import { ActorViewRegistry } from './actorViewRegistry.js';
import { createAnimationManifestRegistry, loadAnimationManifest, resolveCharacterManifest } from './animationManifest.js';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail;
    }
  };
}

const PRESENTATION_CUES = Object.freeze({
  quest_accepted: 'quest_accepted',
  quest_completed: 'quest_completed',
  chest_opened: 'reward_reveal',
  route_changed: 'scene_transition',
  battle_started: 'battle_intro',
  wave_completed: 'wave_transition',
  boss_phase_changed: 'boss_phase',
  trap_revealed: 'trap_reveal',
  unit_summoned: 'unit_summon',
  card_played: 'card_play',
  chess_unit_bought: 'chess_purchase',
  chess_unit_placed: 'chess_place',
  chess_units_merged: 'chess_merge',
  chess_combat_started: 'chess_battle_intro',
  chess_combat_finished: 'chess_battle_result',
  battle_finished: 'battle_result',
});

export function normalizePresentationEvent(detail) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  if (typeof detail.type !== 'string' || !detail.type) return null;
  if (!Number.isInteger(detail.seq) || detail.seq < 0) return null;
  const payload = detail.payload && typeof detail.payload === 'object' && !Array.isArray(detail.payload) ? detail.payload : {};
  return {
    ...detail,
    payload,
    battle_id: detail.battle_id ?? payload.battle_id ?? null,
    source_id: detail.source_id ?? payload.source_id ?? null,
    target_id: detail.target_id ?? payload.target_id ?? null,
    action_seq: detail.action_seq ?? payload.action_seq ?? null,
  };
}

export class AnimationAdapter extends EventTarget {
  constructor({ eventTarget = null, manifests = {}, reducedMotion = false, onWarning = () => {} } = {}) {
    super();
    this.eventTarget = eventTarget;
    const registry = createAnimationManifestRegistry(manifests);
    this.manifests = Object.fromEntries(registry.entries());
    for (const [characterId, manifest] of Object.entries(manifests ?? {})) {
      const resolved = resolveCharacterManifest(registry, characterId);
      if (resolved && resolved.character_id === characterId) this.manifests[characterId] = resolved;
      else if (manifest && typeof manifest === 'object') {
        const validation = validateAnimationManifest(manifest);
        if (!validation.valid) onWarning(`Rejected animation manifest ${characterId}: ${validation.errors.join('; ') || 'character ID mismatch'}`);
      }
    }
    this.reducedMotion = reducedMotion;
    this.onWarning = onWarning;
    this.views = new ActorViewRegistry();
    this.players = new Map();
    this.manifestRegistry = createAnimationManifestRegistry(this.manifests);
    this.warnedManifests = new Set();
    this.seenSequences = new Set();
    this.sequenceOrder = [];
    this.handleEvent = this.handleEvent.bind(this);
    this.eventTarget?.addEventListener('game-event', this.handleEvent);
  }

  registerActor({ actorId, characterId = actorId, direction = 'S', ...view }) {
    const actorView = this.views.upsert({ actorId, characterId, direction, ...view });
    if (!actorView) return null;
    const currentPlayer = this.players.get(actorId);
    if (!currentPlayer || currentPlayer.characterId !== characterId) {
      this.players.set(actorId, {
        characterId,
        clip: new ClipPlayer(this.manifests[characterId] ?? null, { direction, reducedMotion: this.reducedMotion }),
        motion: 'idle',
      });
      if (!this.manifests[characterId] && !this.warnedManifests.has(characterId)) {
        this.warnedManifests.add(characterId);
        this.onWarning(`Missing animation manifest: ${characterId}`);
      }
    } else {
      currentPlayer.clip.setDirection(direction);
      currentPlayer.clip.reducedMotion = this.reducedMotion;
    }
    return actorView;
  }

  syncMotion(actorId, { x, y, direction, speed = 0, alive = true } = {}) {
    const view = this.views.get(actorId);
    const player = this.players.get(actorId);
    if (!view || !player) return null;
    this.views.upsert({ actorId, x, y, direction: direction ?? view.direction, alive });
    if (!alive) {
      player.clip.play('defeat', { restart: false });
      player.motion = 'defeat';
      return this.getActorState(actorId);
    }
    const motion = speed >= 2.5 ? 'run' : speed > 0.05 ? 'walk' : 'idle';
    player.motion = motion;
    player.clip.setDirection(direction ?? view.direction ?? 'S');
    player.clip.play(motion, { restart: false });
    return this.getActorState(actorId);
  }

  handleEvent(eventOrDetail) {
    const detail = eventOrDetail?.detail ?? eventOrDetail;
    const event = normalizePresentationEvent(detail);
    if (!event || !this.#remember(event.seq)) return false;
    const actions = [];
    const payload = event.payload;

    const cue = PRESENTATION_CUES[event.type];
    if (cue) actions.push({ cue, reason: event.type, payload });

    if (event.type === 'actor_spawned') {
      const actorId = payload.actor_id ?? event.source_id;
      if (actorId) {
        this.registerActor({ actorId, characterId: payload.character_id ?? actorId, alive: true });
        actions.push({ actorId, clipId: 'idle', reason: 'actor_spawned' });
      }
    } else if (event.type === 'cast_started' || event.type === 'attack_started') {
      const actorId = event.source_id ?? payload.actor_id;
      const abilityId = payload.ability_id ?? '';
      const clipId = payload.clip_id ?? (/ultimate|ult/i.test(abilityId) ? 'ultimate_01' : 'skill_01');
      if (actorId && this.#play(actorId, clipId, event.type === 'attack_started')) actions.push({ actorId, clipId, reason: event.type });
    } else if (event.type === 'hit_resolved') {
      const sourceId = event.source_id;
      const targetId = event.target_id;
      const sourceKind = payload.source_kind ?? payload.effect_kind;
      const sourceClip = sourceKind === 'ultimate' ? 'ultimate_01' : 'attack_a';
      if (sourceId && !payload.timed && this.#play(sourceId, sourceClip, false, sourceKind !== 'ultimate')) {
        actions.push({ actorId: sourceId, clipId: sourceClip, reason: event.type });
      }
      if (targetId && targetId !== sourceId && this.#play(targetId, 'hit')) actions.push({ actorId: targetId, clipId: 'hit', reason: event.type });
      this.dispatchEvent(new CustomEvent('presentation-hit', { detail: { ...event, actions } }));
    } else if (event.type === 'actor_died') {
      const actorId = payload.actor_id ?? event.target_id;
      if (actorId && this.#play(actorId, 'defeat', true)) actions.push({ actorId, clipId: 'defeat', reason: event.type });
    } else if (event.type === 'battle_finished' || event.type === 'chess_combat_finished') {
      const won = payload.winner_team === 'player' || payload.winner === 'player' || payload.won === true;
      for (const view of this.views.values()) {
        if (view.team === 'player' && view.alive !== false) {
          const clipId = won ? 'victory' : 'defeat';
          if (this.#play(view.actorId, clipId, !won)) actions.push({ actorId: view.actorId, clipId, reason: event.type });
        }
      }
    }

    this.dispatchEvent(new CustomEvent('presentation-event', { detail: { event, actions } }));
    return true;
  }

  advance(deltaMs) {
    for (const player of this.players.values()) player.clip.advance(deltaMs);
  }

  getActorState(actorId) {
    const view = this.views.get(actorId);
    const player = this.players.get(actorId);
    if (!view || !player) return null;
    return { ...view, motion: player.motion, animation: player.clip.snapshot() };
  }

  retainActors(actorIds) {
    const keep = new Set(actorIds);
    this.views.retain(keep);
    for (const actorId of this.players.keys()) {
      if (!keep.has(actorId)) this.players.delete(actorId);
    }
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = Boolean(reducedMotion);
    for (const player of this.players.values()) player.clip.reducedMotion = this.reducedMotion;
  }

  destroy() {
    this.eventTarget?.removeEventListener('game-event', this.handleEvent);
    this.players.clear();
    this.views.clear();
    this.seenSequences.clear();
    this.sequenceOrder = [];
  }

  #play(actorId, clipId, force = false, restart = true) {
    return this.players.get(actorId)?.clip.play(clipId, { force, restart }) ?? false;
  }

  #remember(seq) {
    if (this.seenSequences.has(seq)) return false;
    this.seenSequences.add(seq);
    this.sequenceOrder.push(seq);
    if (this.sequenceOrder.length > 512) this.seenSequences.delete(this.sequenceOrder.shift());
    return true;
  }
}