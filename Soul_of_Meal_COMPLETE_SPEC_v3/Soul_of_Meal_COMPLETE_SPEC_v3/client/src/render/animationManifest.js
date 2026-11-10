import { validateAnimationManifest } from './clipPlayer.js';

export function createAnimationManifestRegistry(manifests = {}) {
  const registry = new Map();
  for (const [characterId, manifest] of Object.entries(manifests ?? {})) {
    if (!manifest || typeof manifest !== 'object') continue;
    const validation = validateAnimationManifest(manifest);
    if (validation.valid && manifest.character_id === characterId) registry.set(characterId, manifest);
  }
  return registry;
}

export function resolveCharacterManifest(registry, characterId) {
  if (!registry || !(registry instanceof Map)) return null;
  if (!characterId) return null;
  return registry.get(characterId) ?? null;
}

export function loadAnimationManifest(manifest, { warn = () => {} } = {}) {
  if (!manifest || typeof manifest !== 'object') {
    warn('Animation manifest is missing or invalid.');
    return null;
  }
  const validation = validateAnimationManifest(manifest);
  if (!validation.valid) {
    warn(`Animation manifest rejected: ${validation.errors.join('; ')}`);
    return null;
  }
  return manifest;
}
