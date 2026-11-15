import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const client = fileURLToPath(new URL('..', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const assetPath = /^(?:card-back|(?:cards|previews)\/[a-z0-9_-]+)\.webp$/;

/** Restore the original bytes; source packs never change runtime artwork URLs. */
export function materializeSplashAssets({
  source = resolve(client, 'source-art/splash'),
  output = resolve(client, 'assets/splash'),
} = {}) {
  const manifest = JSON.parse(readFileSync(resolve(source, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.packs)) {
    throw new Error('Unsupported splash source manifest');
  }
  const expected = new Map();
  for (const file of manifest.files) {
    if (!assetPath.test(file.path) || expected.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('Invalid or duplicate splash asset path: ' + file.path);
    }
    expected.set(file.path, file);
  }
  const decoded = new Map();
  for (const pack of manifest.packs) {
    if (!/^splash-\d{3}\.json\.gz$/.test(pack.file)) throw new Error('Invalid splash pack path');
    const bytes = readFileSync(resolve(source, pack.file));
    if (bytes.length !== pack.bytes || digest(bytes) !== pack.sha256) throw new Error('Corrupt splash pack: ' + pack.file);
    const payload = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString('utf8'));
    if (payload.schema !== 1 || !Array.isArray(payload.entries) || payload.entries.length !== pack.entries) throw new Error('Invalid splash pack: ' + pack.file);
    for (const entry of payload.entries) {
      const file = expected.get(entry.path);
      if (!file || decoded.has(entry.path) || typeof entry.content !== 'string') throw new Error('Unknown or duplicate splash asset: ' + entry.path);
      const content = Buffer.from(entry.content, 'base64');
      if (content.length !== file.bytes || digest(content) !== file.sha256) throw new Error('Corrupt splash asset: ' + entry.path);
      decoded.set(entry.path, content);
    }
  }
  if (decoded.size !== expected.size) throw new Error('Incomplete splash source packs');

  // Validate the entire source set before replacing any existing local image.
  let restored = 0;
  for (const [path, bytes] of decoded) {
    const target = resolve(output, path);
    if (existsSync(target) && digest(readFileSync(target)) === expected.get(path).sha256) continue;
    mkdirSync(dirname(target), { recursive: true });
    const temporary = target + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(temporary, bytes);
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }
    restored++;
  }
  return { files: decoded.size, restored };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = materializeSplashAssets();
  console.log(`Splash assets verified: ${result.files}; restored: ${result.restored}.`);
}
