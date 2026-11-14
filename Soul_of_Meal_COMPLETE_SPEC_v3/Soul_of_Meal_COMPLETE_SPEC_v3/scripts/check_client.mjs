import { readdir, readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
const root = resolve(import.meta.dirname, "..");
async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(child)));
    else result.push(child);
  }
  return result;
}
const files = (await walk(resolve(root, "client"))).filter((path) =>
  path.endsWith(".js"),
);
let count = 0;
for (const path of files) {
  const checked = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
  });
  if (checked.status !== 0) throw new Error(checked.stderr);
  const source = await readFile(path, "utf8");
  for (const [, target] of source.matchAll(
    /(?:from|import)\s*['"](\.[^'"]+)['"]/g,
  )) {
    if (target.includes("?"))
      throw new Error(`Duplicate module identity risk: ${path} -> ${target}`);
    await access(resolve(dirname(path), target));
    count++;
  }
}
const context = { self: {} };
vm.runInNewContext(
  await readFile(resolve(root, "client/offline-manifest.js"), "utf8"),
  context,
);
for (const file of context.self.SOUL_OFFLINE.files)
  await access(resolve(root, "client", file));
const manifest = JSON.parse(
  await readFile(resolve(root, "client/manifest.webmanifest"), "utf8"),
);
for (const icon of manifest.icons)
  await access(resolve(root, "client", icon.src));
console.log(
  `${files.length} JavaScript files parse; ${count} local imports resolve; ${context.self.SOUL_OFFLINE.files.length} offline URLs exist; app icons resolve.`,
);
