import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { materializeSplashAssets } from '../build/materializeSplashAssets.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t, path = 'cards/sample.webp') {
  const source = mkdtempSync(join(tmpdir(), 'som-source-'));
  const output = mkdtempSync(join(tmpdir(), 'som-art-'));
  t.after(() => { rmSync(source, { recursive: true, force: true }); rmSync(output, { recursive: true, force: true }); });
  const content = Buffer.from('original artwork bytes');
  const pack = gzipSync(JSON.stringify({ schema: 1, entries: [{ path, content: content.toString('base64') }] }));
  const manifest = { schema: 1, packs: [{ file: 'splash-001.json.gz', bytes: pack.length, sha256: digest(pack), entries: 1 }], files: [{ path, bytes: content.length, sha256: digest(content) }] };
  writeFileSync(join(source, 'splash-001.json.gz'), pack);
  writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest));
  return { source, output, content, manifest };
}

test('source packs restore exact art bytes, repair damage, and preserve unrelated files', t => {
  const f = fixture(t);
  writeFileSync(join(f.output, 'manifest.json'), 'runtime manifest');
  assert.deepEqual(materializeSplashAssets(f), { files: 1, restored: 1 });
  assert.deepEqual(readFileSync(join(f.output, 'cards/sample.webp')), f.content);
  assert.deepEqual(materializeSplashAssets(f), { files: 1, restored: 0 });
  writeFileSync(join(f.output, 'cards/sample.webp'), 'damaged');
  assert.equal(materializeSplashAssets(f).restored, 1);
  assert.equal(readFileSync(join(f.output, 'manifest.json'), 'utf8'), 'runtime manifest');
});

test('corrupt or incomplete sources fail before writing any artwork', t => {
  const f = fixture(t);
  f.manifest.files.push({ path: 'previews/missing.webp', bytes: f.content.length, sha256: digest(f.content) });
  writeFileSync(join(f.source, 'manifest.json'), JSON.stringify(f.manifest));
  assert.throws(() => materializeSplashAssets(f), /Incomplete/);
  assert.equal(existsSync(join(f.output, 'cards/sample.webp')), false);
  writeFileSync(join(f.source, 'splash-001.json.gz'), 'damaged pack');
  assert.throws(() => materializeSplashAssets(f), /Corrupt splash pack/);
  assert.equal(existsSync(join(f.output, 'cards/sample.webp')), false);
});

test('source manifests cannot write paths outside the artwork directory', t => {
  const f = fixture(t, '../outside.webp');
  assert.throws(() => materializeSplashAssets(f), /Invalid or duplicate splash asset path/);
});
