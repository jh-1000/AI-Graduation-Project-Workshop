/**
 * 回归评测雏形（P0）：
 * 1) 清理并重新导入 fixture#1  2) 校验文件清单/端点/符号/栈与 expected.json 一致
 * 3) 符号与静态证据落库（symbols / evidence），并从库里回读断言
 * 4) 写 regression_results；任何解析器/提示词/数据模型变更后必须运行本脚本。
 */
import fs from "node:fs";
import path from "node:path";
import { deleteProjectData, getDb } from "../src/lib/db";
import { importFromPath } from "../src/lib/ingest";
import { extractFromFile, isTextFile } from "../src/lib/scan";
import { extractSymbolsTs } from "../src/lib/symbols";
import { persistEvidence, persistSymbols } from "../src/lib/evidence";
import { detectFlows, persistFlows } from "../src/lib/flows";
import { persistClaims } from "../src/lib/claims";

const FIXTURE_ROOT = path.join(process.cwd(), "fixtures", "fixture1-todo-clip");
const SLUG = "regression-fixture1";

function cleanup() {
  const db = getDb();
  const p = db.prepare("SELECT id FROM projects WHERE slug = ?").get(SLUG) as { id: number } | undefined;
  if (!p) return;
  deleteProjectData(p.id);
}

function main(): boolean {
  const expected = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "fixtures", "fixture1-expected.json"), "utf8")
  ) as {
    fileCount: number;
    files: string[];
    endpoints: string[];
    symbols: string[];
    symbolLocations: Record<string, { file: string; line: number }>;
    stackContains: string[];
    flows: {
      slug: string;
      steps: { title: string; file: string | null; line: number | null; note: string | null }[];
    }[];
  };
  const failures: string[] = [];

  cleanup();
  const imported = importFromPath(SLUG, "回归-fixture1", FIXTURE_ROOT);
  if (imported.fileCount !== expected.fileCount) {
    failures.push(`文件数不符：实际 ${imported.fileCount}，预期 ${expected.fileCount}`);
  }

  // 端点/路由抽取（从磁盘现读，口径与 worker evidence 阶段一致）
  const gotEndpoints = new Set<string>();
  const endpoints: ReturnType<typeof extractFromFile>["endpoints"] = [];
  const routes: ReturnType<typeof extractFromFile>["routes"] = [];
  const contents = new Map<string, string>();
  for (const rel of expected.files) {
    const abs = path.join(FIXTURE_ROOT, rel);
    if (!fs.existsSync(abs) || !isTextFile(rel)) continue;
    const text = fs.readFileSync(abs, "utf8");
    contents.set(rel, text);
    const got = extractFromFile(rel, text);
    endpoints.push(...got.endpoints);
    routes.push(...got.routes);
    for (const e of got.endpoints) gotEndpoints.add(`${e.method} ${e.path}`);
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
  for (const [name, loc] of Object.entries(expected.symbolLocations)) {
    const hit = symbols.find((s) => s.name === name);
    if (!hit) {
      failures.push(`符号位置无法校验（符号未抽到）：${name}`);
    } else if (hit.file !== loc.file || hit.line !== loc.line) {
      failures.push(`符号位置不符：${name} 实际 ${hit.file}:${hit.line}，预期 ${loc.file}:${loc.line}`);
    }
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

  // 落库并从库里回读断言（这一条证明证据真的进了产品数据模型，而不只是内存比对）
  const db = getDb();
  const run = db
    .prepare("SELECT version FROM analysis_runs WHERE id = ?")
    .get(imported.runId) as { version: string };
  const ps = persistSymbols(imported.projectId, run.version, symbols);
  const pe = persistEvidence(imported.projectId, run.version, endpoints, routes);

  const dbSymbols = db
    .prepare(
      "SELECT name, file_id, line, identify_by, precision, analysis_version FROM symbols WHERE project_id = ?"
    )
    .all(imported.projectId) as {
    name: string;
    file_id: number;
    line: number | null;
    identify_by: string;
    precision: string;
    analysis_version: string | null;
  }[];
  if (dbSymbols.length !== ps.inserted) {
    failures.push(`symbols 行数不符：库内 ${dbSymbols.length}，写入 ${ps.inserted}`);
  }
  const dbNames = new Set(dbSymbols.map((s) => s.name));
  for (const s of expected.symbols) {
    if (!dbNames.has(s)) failures.push(`symbols 未落库：${s}`);
  }
  for (const s of dbSymbols) {
    if (s.identify_by !== "ts-morph" || s.precision !== "exact") {
      failures.push(`symbols 标注不符：${s.name} identify_by=${s.identify_by} precision=${s.precision}`);
    }
    if (s.analysis_version !== run.version) {
      failures.push(`symbols 版本不符：${s.name} analysis_version=${s.analysis_version}，应为 ${run.version}`);
    }
  }

  const dbEvidence = db
    .prepare(
      "SELECT file_path, start_line, end_line, content_hash, origin, processing, freshness, note FROM evidence WHERE project_id = ? AND analysis_version = ?"
    )
    .all(imported.projectId, run.version) as {
    file_path: string;
    start_line: number | null;
    end_line: number | null;
    content_hash: string | null;
    origin: string;
    processing: string;
    freshness: string;
    note: string | null;
  }[];
  if (dbEvidence.length !== pe.inserted) {
    failures.push(`evidence 行数不符：库内 ${dbEvidence.length}，写入 ${pe.inserted}`);
  }
  const evidenceNotes = new Set(dbEvidence.map((e) => e.note ?? ""));
  for (const ep of expected.endpoints) {
    if (!evidenceNotes.has(`endpoint: ${ep}`)) failures.push(`evidence 未覆盖端点：${ep}`);
  }
  for (const e of dbEvidence) {
    if (e.origin !== "static_analyzer" || e.processing !== "extracted" || e.freshness !== "current") {
      failures.push(`evidence 标注不符：${e.note} origin=${e.origin} processing=${e.processing} freshness=${e.freshness}`);
    }
    if (e.content_hash === "") failures.push(`evidence content_hash 为空串（应为快照值或 NULL）：${e.note}`);
  }

  // 业务流程：确定性追踪（不需要模型密钥），落库后按 expected.flows 逐步骤校验
  const drafts = detectFlows(endpoints, contents);
  const pf = persistFlows(imported.projectId, run.version, drafts);
  for (const want of expected.flows) {
    const got = drafts.find((d) => d.slug === want.slug);
    if (!got) {
      failures.push(`业务流程缺失：${want.slug}`);
      continue;
    }
    if (got.steps.length !== want.steps.length) {
      failures.push(`流程 ${want.slug} 步骤数不符：实际 ${got.steps.length}，预期 ${want.steps.length}`);
    }
    want.steps.forEach((s, i) => {
      const actual = got.steps[i];
      if (!actual) return;
      if (actual.title !== s.title || actual.file !== s.file || actual.line !== s.line) {
        failures.push(
          `流程 ${want.slug} 第 ${i + 1} 步不符：实际 ${actual.title}@${actual.file}:${actual.line}，预期 ${s.title}@${s.file}:${s.line}`
        );
      }
    });
  }
  const dbFlows = db
    .prepare("SELECT id, slug FROM flows WHERE project_id = ? AND analysis_version = ?")
    .all(imported.projectId, run.version) as { id: number; slug: string }[];
  if (dbFlows.length !== pf.inserted) {
    failures.push(`flows 行数不符：库内 ${dbFlows.length}，写入 ${pf.inserted}`);
  }
  const dbSteps = db
    .prepare(
      "SELECT s.flow_id, s.seq, s.title, s.file_path, s.start_line FROM flow_steps s WHERE s.project_id = ? ORDER BY s.flow_id, s.seq"
    )
    .all(imported.projectId) as {
    flow_id: number;
    seq: number;
    title: string;
    file_path: string | null;
    start_line: number | null;
  }[];
  if (dbSteps.length === 0) failures.push("flow_steps 未落库");

  // 结论层：把证据 + 流程合起来表述成带 derivation / review_state 的结论（确定性，不需要模型密钥）
  // fixture1 的预期：2 条流程结论（各自只有 1 步能对上证据行 → 都必须是 draft）
  //                + 1 条「未被流程引用的端点」结论（GET /api/tasks 不参与写入流程 → supported）
  const pc = persistClaims(imported.projectId, run.version);
  if (pc.inserted !== 3) failures.push(`claims 行数不符：实际 ${pc.inserted}，预期 3`);
  if (pc.skipped !== 0) failures.push(`claims 不应有跳过：实际 ${pc.skipped}`);
  if (pc.linked !== 3) failures.push(`claim_evidence 行数不符：实际 ${pc.linked}，预期 3`);

  const dbClaims = db
    .prepare(
      "SELECT id, content, derivation, review_state, subject_type, subject_id FROM claims WHERE project_id = ? AND analysis_version = ? ORDER BY id"
    )
    .all(imported.projectId, run.version) as {
    id: number;
    content: string;
    derivation: string;
    review_state: string;
    subject_type: string | null;
    subject_id: number | null;
  }[];
  if (dbClaims.length !== pc.inserted) {
    failures.push(`claims 库内行数不符：库内 ${dbClaims.length}，写入 ${pc.inserted}`);
  }
  const flowClaims = dbClaims.filter((c) => c.subject_type === "flow");
  const evClaims = dbClaims.filter((c) => c.subject_type === "evidence");
  if (flowClaims.length !== 2) failures.push(`流程结论数不符：实际 ${flowClaims.length}，预期 2`);
  if (evClaims.length !== 1) failures.push(`证据结论数不符：实际 ${evClaims.length}，预期 1`);
  for (const c of flowClaims) {
    if (c.derivation !== "inferred") failures.push(`流程结论 derivation 不符：${c.derivation}`);
    // 关键业务规则：流程只要有一步骤对不上证据行，结论就不能标 supported
    if (c.review_state !== "draft") {
      failures.push(`流程结论 review_state 应为 draft（步骤未被证据完整支撑）：实际 ${c.review_state} —— ${c.content}`);
    }
    if (!c.content.startsWith("业务流程「")) failures.push(`流程结论文案不符：${c.content.slice(0, 40)}`);
  }
  for (const c of evClaims) {
    if (c.derivation !== "direct_extraction") failures.push(`证据结论 derivation 不符：${c.derivation}`);
    if (c.review_state !== "supported") failures.push(`证据结论 review_state 应为 supported：实际 ${c.review_state}`);
    // GET /api/tasks 定义在 src/server/index.ts:7，不参与任何写入流程
    if (!c.content.includes("GET /api/tasks") || !c.content.includes("src/server/index.ts:7")) {
      failures.push(`证据结论未指向 GET /api/tasks@src/server/index.ts:7：${c.content}`);
    }
  }

  const dbLinks = db
    .prepare(
      "SELECT ce.claim_id, ce.support_role, e.file_path, e.start_line FROM claim_evidence ce JOIN claims c ON c.id = ce.claim_id JOIN evidence e ON e.id = ce.evidence_id WHERE c.project_id = ? AND c.analysis_version = ? ORDER BY ce.claim_id"
    )
    .all(imported.projectId, run.version) as {
    claim_id: number;
    support_role: string | null;
    file_path: string;
    start_line: number | null;
  }[];
  if (dbLinks.length !== pc.linked) {
    failures.push(`claim_evidence 库内行数不符：库内 ${dbLinks.length}，写入 ${pc.linked}`);
  }
  const roles = dbLinks.map((l) => l.support_role).sort();
  // post-api-tasks 的端点步是第 4 步、patch-api-tasks 的端点步是第 1 步、证据结论挂 defines
  if (roles.join(",") !== "defines,step:1,step:4") {
    failures.push(`claim_evidence support_role 不符：实际 ${roles.join(",")}，预期 defines,step:1,step:4`);
  }
  for (const l of dbLinks) {
    if (l.start_line === null) failures.push(`claim_evidence 指向的证据缺行号：${l.file_path}`);
  }

  // 幂等：同版本再跑一次，结论数不增不减（按版本整体替换）
  const pc2 = persistClaims(imported.projectId, run.version);
  if (pc2.inserted !== pc.inserted || pc2.linked !== pc.linked) {
    failures.push(
      `claims 重跑不幂等：第二次 inserted=${pc2.inserted} linked=${pc2.linked}，第一次 inserted=${pc.inserted} linked=${pc.linked}`
    );
  }
  const afterRerun = (
    db.prepare("SELECT COUNT(*) AS n FROM claims WHERE project_id = ? AND analysis_version = ?").get(
      imported.projectId,
      run.version
    ) as { n: number }
  ).n;
  if (afterRerun !== pc.inserted) {
    failures.push(`claims 重跑后行数漂移：库内 ${afterRerun}，预期 ${pc.inserted}`);
  }

  db.prepare(
    "INSERT INTO regression_results (fixture, passed, failures) VALUES (?, ?, ?)"
  ).run("fixture1-todo-clip", failures.length === 0 ? 1 : 0, JSON.stringify(failures));

  if (failures.length === 0) {
    console.log(
      `回归 PASS：fixture1 全部检查通过（symbols=${ps.inserted} evidence=${pe.inserted} flows=${pf.inserted} steps=${dbSteps.length} claims=${pc.inserted} links=${pc.linked} skipped=${ps.skipped + pe.skipped}）`
    );
    return true;
  }
  console.error(`回归 FAIL（${failures.length}）：`);
  for (const f of failures) console.error(" -", f);
  return false;
}

process.exit(main() ? 0 : 1);