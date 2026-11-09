# Prompt Library — original sprite production

All prompts are *templates*, not asset files. Substitute bracketed identity fields after identity-lock approval. Prefer **no text in image**; caption frames in documentation, not in sprite pixels.

## 1. Identity / clean turnaround
> Original high-quality 2D anime chibi character concept for the fantasy culinary RPG Soul of Meal. [NAME] is a [ROLE] associated with [FOOD MOTIF], [ELEMENT]. Identity lock: [HAIR], [EYES], [COSTUME], [ACCESSORY], [WEAPON IN HAND]. 2.6-head high chibi proportion, solid recognizable silhouette, expressive face, clean elegant stylized outlines, consistent anatomy, crisp cel shading, production model sheet with isolated full-body front, 3/4, side, and back views. Neutral pose, aligned head heights, no scene background, no logos, no text, no labels, no watermarks. Artwork must be original, not imitation of any copyrighted named character.

## 2. Single key pose
> Exact same original character identity and costume as the approved turnaround [REFERENCE]. Full-body [POSE / ACTION PHASE] key pose, [CAMERA DIRECTION], [WEAPON HAND], [FOOT POSITION], [EMOTION], crisp chibi anime RPG production quality. Keep hair ornaments, garment patterns, facial proportions, weapon scale and color scheme exactly stable. Isolated transparent RGBA-style plain background, no typography, no border, no duplicates, generous empty padding, hands and entire weapon visible.

## 3. Uniform animation spritesheet (small batches)
> Generate an evenly divided 4-column × 2-row grid of **eight equal square cells**, depicting consecutive motion frames of the SAME [CHARACTER] [ANIMATION]. Every cell shows one complete full-body figure, same style, same scale, same ground line, identical character identity and handedness. Each frame a natural next motion phase: [FRAME-BY-FRAME NOTES]. Keep hair ornament and weapon unchanged; unchanged stationary elements should match exactly. Cells have no gutters, no captions, no borders, no labels; no overlapping into neighboring cells. Transparent background; if alpha unavailable, isolated flat chroma for human cleanup. Bright crisp readable anime chibi pixel-clean art. Crop safe in every cell.

## 4. Bún Bò Hỏa Linh specific identity
> An original energetic red-haired chibi female fiery cooking warrior with amber eyes, red-orange side ponytail, spice-flower hair clip, chef-inspired fantasy outfit red/cream/gold, asymmetric red sash and a short flame sword. Small bowl-of-noodles motif integrated into her design, not a floating photograph. Fire swirls are an optional separate VFX layer; standard idle/walk poses should have **no fire overlays**. Keep identical face, sash, blade direction and footwear in every frame. No text, no logos, no border, no other characters.

## 5. Suggested per-frame motion prompts
- idle 8f: rest → inhale → settle → blink → exhale → settle → subtle hair sway → loop seam.
- walk 8f: left-contact → down → passing → up → right-contact → down → passing → up; fixed vertical ground reference.
- attack_a 12f: focus → wind-up → lean → launch → sword arc start → accelerate → contact-ready → hit pose → follow-through → recoil → settle → recover.
- skill 16f: anticipation → magical energy at hand → aimed pose → charge → charge peak → release → projectile socket frame → follow-through → recoil → idle prep.

## 6. Negative constraints
No words, subtitles, numbering, menu panels, screenshots, cut-off limbs, mismatched accessories, unequal scale, shifting shoe geometry, six-finger hands, merged limbs, frame duplicate, painted background, photo realism, hard black outlines inconsistent with anime style, unauthorized IP copy.
