/**
 * 回归评测雏形（P0）：
 * 1) 清理并重新导入 fixture#1  2) 校验文件清单/端点/符号/栈与 expected.json 一致
 * 3) 写 regression_results；任何解析器/提示词/数据模型变更后必须运行本脚本。
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { importFromPath } from "../src/lib/ingest";
import { extractFromFile } from "../src/lib/scan";
import { extractSymbolsTs } from "../src/lib/symbols";

const FIXTURE_ROOT = path.join(process.cwd(), "fixtures", "fixture1-todo-clip");
const SLUG = "regression-fixture1";

function cleanup() {
  const db = getDb();
  const p = db.prepare("SELECT id FROM projects WHERE slug = ?").get(SLUG) as { id: number } | undefined;
  if (!p) return;
  const pid = p.id;
  db.prepare("DELETE FROM run_files WHERE project_id = ?").run(pid);
  db.prepare("DELETE FROM files WHERE project_id = ?").run(pid);
  db.prepare("DELETE FROM analysis_runs WHERE project_id = ?").run(pid);
  db.prepare("DELETE FROM projects WHERE id = ?").run(pid);
}

function main(): boolean {
  const expected = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "fixtures", "fixture1-expected.json"), "utf8")
  ) as {
    fileCount: number;
    files: string[];
    endpoints: string[];
    symbols: string[];
    stackContains: string[];
  };
  const failures: string[] = [];

  cleanup();
  const imported = importFromPath(SLUG, "回归-fixture1", FIXTURE_ROOT);
  if (imported.fileCount !== expected.fileCount) {
    failures.push(`文件数不符：实际 ${imported.fileCount}，预期 ${expected.fileCount}`);
  }

  // 端点抽取（从磁盘现读）
  const gotEndpoints = new Set<string>();
  for (const rel of expected.files) {
    const abs = path.join(FIXTURE_ROOT, rel);
    if (!fs.existsSync(abs) || !/\.(ts|tsx|js|py|java)$/.test(rel)) continue;
    const { endpoints } = extractFromFile(rel, fs.readFileSync(abs, "utf8"));
    for (const e of endpoints) gotEndpoints.add(`${e.method} ${e.path}`);
  }
  for (const ep of expected.endpoints) {
    if (!gotEndpoints.has(ep)) failures.push(`端点缺失：${ep}`);
  }

  // ts-morph 符号
  const symbols = extractSymbolsTs(
    FIXTURE_ROOT,
    expected.files.filter((f) => /\.tsx?$/.test(f))
  );
  const names = new Set(symbols.map((s) => s.name));
  for (const s of expected.symbols) {
    if (!names.has(s)) failures.push(`符号缺失：${s}`);
  }

  // 技术栈
  const project = getDb().prepare("SELECT stack FROM projects WHERE slug = ?").get(SLUG) as {
    stack: string;
  };
  const stack = JSON.parse(project.stack) as { languages: string[]; frameworks: string[] };
  const all = new Set([...stack.languages, ...stack.frameworks]);
  for (const t of expected.stackContains) {
    if (!all.has(t)) failures.push(`栈缺失：${t}`);
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO regression_results (fixture, passed, failures) VALUES (?, ?, ?)"
  ).run("fixture1-todo-clip", failures.length === 0 ? 1 : 0, JSON.stringify(failures));

  if (failures.length === 0) {
    console.log("回归 PASS：fixture1 全部检查通过");
    return true;
  }
  console.error(`回归 FAIL（${failures.length}）：`);
  for (const f of failures) console.error(" -", f);
  return false;
}

process.exit(main() ? 0 : 1);
