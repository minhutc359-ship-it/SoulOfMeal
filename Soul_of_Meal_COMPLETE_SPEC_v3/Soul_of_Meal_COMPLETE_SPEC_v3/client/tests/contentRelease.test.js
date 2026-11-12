import assert from 'node:assert/strict';
import test from 'node:test';
import { activeContentRelease, pinnedContentRelease } from '../src/core/contentRelease.js';

const build = '123456789abcdef0'.repeat(2);
const root = new URL('https://game.example/som/');

test('published content resolves to one immutable directory on the same origin', async () => {
  const visited = [];
  const active = await activeContentRelease(root, async (url, options) => {
    visited.push([url.pathname, options.cache]);
    return Response.json({ schema: 1, build });
  });
  assert.equal(active.build, build);
  assert.equal(active.entry.href, root.href + 'releases/' + build + '/client/');
  assert.deepEqual(visited, [
    ['/som/release.json', 'no-store'],
    ['/som/releases/' + build + '/release-build.json', 'no-cache'],
  ]);
  assert.deepEqual(pinnedContentRelease(active.entry), { root, build });
  assert.deepEqual(pinnedContentRelease(new URL('index.html', active.entry)), { root, build });
  assert.equal(pinnedContentRelease(new URL('client/', root)), null);
});

test('a malformed pointer or missing build marker cannot open a partially published release', async () => {
  await assert.rejects(activeContentRelease(root, async () => Response.json({ schema: 1, build: '../outside' })), /Invalid release pointer/);
  await assert.rejects(activeContentRelease(root, async url => url.pathname.endsWith('/release.json')
    ? Response.json({ schema: 1, build }) : new Response('', { status: 404 })), /Release files are unavailable/);
});
