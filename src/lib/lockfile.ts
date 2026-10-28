/**
 * lockfile 依赖解析：读 package-lock.json / pnpm-lock.yaml，抽直接依赖版本。
 * 写 evidence 表（origin='static_analyzer'，note='dep:react@18.2.0'）。
 */
import { getDb } from "./db";
import fs from "node:fs";
import path from "node:path";

export type LockfileResult = { deps: number };

export function runLockfileScan(projectId: number, version: string, root: string): LockfileResult {
  const db = getDb();
  let deps: { name: string; version: string }[] = [];

  // 先试 package-lock.json（npm）
  const lockPath = path.join(root, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      const pkgs = lock.packages ?? {};
      for (const [key, meta] of Object.entries(pkgs)) {
        if (key === "") continue; // 根包
        const name = key.replace("node_modules/", "");
        const v = (meta as { version?: string }).version;
        if (v) deps.push({ name, version: v });
      }
    } catch { /* 解析失败静默 */ }
  }

  // 回退：无 lockfile 时从 package.json 读直接依赖
  if (deps.length === 0) {
    const pkgPath = path.join(root, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
          deps.push({ name, version });
        }
      } catch { /* 解析失败静默 */ }
    }
  }
  if (deps.length === 0) return { deps: 0 };

  const ins = db.prepare(
    "INSERT INTO evidence (project_id, analysis_version, file_path, start_line, origin, note, stage) VALUES (?, ?, 'package-lock.json', 0, 'static_analyzer', ?, 'lockfile')"
  );
  const tx = db.transaction(() => {
    for (const d of deps.slice(0, 200)) { // 上限 200 个依赖
      ins.run(projectId, version, `dep:${d.name}@${d.version}`);
    }
  });
  tx();
  return { deps: deps.length };
}
