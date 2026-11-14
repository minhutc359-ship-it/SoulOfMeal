# Adventure expansion

## Asset provenance and motion

- Orchard and Spice Garden backgrounds, the four enemy portraits, seven shop illustrations and the app emblem were generated for Soul of Meal. The README describes their player-facing entry points.
- Guide pages are compressed copies of the five original project images in `references/original_user_images/guide_*.png`.
- The five existing character rigs keep their original parts atlases. Nineteen additional Vị Linh reuse their original transparent project portraits with three articulated attachments and a skill socket. Joint ratios and complete clip timelines live in `client/src/render/spiritRig.js`. These are editable browser rigs from flattened art. Separate arms, hands, weapons and directional art remain an artist task. Art review on devices is pending.
- The four field enemies use the same articulated portrait renderer. Hit timing, energy and combat outcomes are driven by simulation.

## Map and save checks

- The ten exploration maps share one map registry and swept collision implementation. Each interaction has a walkable approach from its map spawn. Large terrain edges use convex polygons and the innermost standing areas remain walkable.
- The side route enters both gardens from the forest. Clearing each local patrol grants its reward once and leaves story quest flags intact. Old saves already fighting a story boss remain at that boss after the extra wave is added.
- To check the installable build, load the website over HTTPS, add the game from the browser's menu, and open it from the new icon. Check app launch, safe areas and landscape rotation on both Android and iOS hardware.
