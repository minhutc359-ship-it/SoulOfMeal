const BUILD_ID = /^[0-9a-f]{32}$/;

export function pinnedContentRelease(page) {
  const match = page.pathname.match(/^(.*\/)releases\/([0-9a-f]{32})\/client\/(?:index\.html)?$/);
  return match ? { root: new URL(match[1], page), build: match[2] } : null;
}

export async function activeContentRelease(root, request = globalThis.fetch) {
  const signal = AbortSignal.timeout(6000);
  const response = await request(new URL('release.json', root), { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Release pointer is unavailable');
  const release = await response.json();
  if (release?.schema !== 1 || typeof release.build !== 'string' || !BUILD_ID.test(release.build)) {
    throw new Error('Invalid release pointer');
  }
  const version = new URL('releases/' + release.build + '/', root);
  const manifest = await request(new URL('release-build.json', version), { cache: 'no-cache', signal });
  if (!manifest.ok || (await manifest.json())?.build !== release.build) {
    throw new Error('Release files are unavailable');
  }
  return { build: release.build, entry: new URL('client/', version) };
}
