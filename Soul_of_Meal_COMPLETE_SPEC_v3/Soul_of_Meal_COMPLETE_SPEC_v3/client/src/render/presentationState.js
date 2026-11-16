// Presentation may outlive the deterministic action that produced the result.
// Held death poses are settled once their last frame has been reached.
export function actionAnimating(animation) {
  return Boolean(animation && !animation.loop && !animation.missingClip
    && animation.motionPhase != null && animation.motionPhase < 1
    && animation.requestedClipId !== 'victory');
}

export function tcgPresentationPending(matchId, now, { effects, cards, impacts, cues }) {
  return effects.pending(matchId) || cards.pending()
    || [...impacts.values(), ...cues].some(cue => cue?.matchId === matchId && cue.expires > now);
}
