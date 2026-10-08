import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import test from "node:test";

type LockedPackage = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as LockedPackage;
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as { packages: Record<string, LockedPackage> };

test("lockfile 與 package.json 的直接依賴一致", () => {
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[""].devDependencies, manifest.devDependencies);
});

test("lockfile 包含所有必要的間接依賴與 peer dependencies", () => {
  function resolves(owner: string, name: string) {
    let directory = owner;
    while (directory && directory !== ".") {
      if (lock.packages[`${directory}/node_modules/${name}`]) return true;
      directory = posix.dirname(directory);
    }
    return Boolean(lock.packages[`node_modules/${name}`]);
  }

  const missing: string[] = [];
  for (const [owner, entry] of Object.entries(lock.packages)) {
    const required = new Set([
      ...Object.keys(entry.dependencies ?? {}),
      ...(owner === "" ? Object.keys(entry.devDependencies ?? {}) : []),
      ...Object.keys(entry.peerDependencies ?? {}).filter((name) => !entry.peerDependenciesMeta?.[name]?.optional),
    ]);
    for (const name of required) {
      if (!resolves(owner, name)) missing.push(`${owner || "project"} -> ${name}`);
    }
  }
  assert.deepEqual(missing, [], "缺少 lockfile 紀錄；請修復後使用乾淨目錄執行 npm ci 驗證。");
});
