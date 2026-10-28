import { getDb } from "./db";

export type ClaimPersistResult = { inserted: number; skipped: number; linked: number };

type FlowRow = { id: number; title: string; trigger_desc: string | null };
type StepRow = { flow_id: number; seq: number; title: string; file_path: string | null; start_line: number | null };
type EvRow = { id: number; file_path: string; start_line: number | null; note: string | null };

/** 证据定位键：file_path:start_line（与 evidence 落库口径一致） */
function locKey(file: string | null, line: number | null): string | null {
  if (!file || !line) return null;
  return file + ":" + line;
}

/**
 * 结论层落库（claims + claim_evidence）。
 * 结论不是证据的同义复述，而是「多条证据合起来说明了什么」：
 *  - 业务流程级结论（derivation=inferred）：端到端链路由哪些步骤组成，挂到该流程所有能对上证据行的步骤上；
 *  - 未覆盖端点结论（derivation=direct_extraction）：有静态证据但没有任何业务流程引用它。
 * review_state 的判定规则是确定的：只有当流程每一步都能对上一条证据行时才 supported，否则 draft。
 * 按版本整体替换：先删链接与依赖，再删结论，最后插入（幂等）。
 */
export function persistClaims(projectId: number, analysisVersion: string): ClaimPersistResult {
  const db = getDb();
  const flows = db
    .prepare(
      "SELECT id, title, trigger_desc FROM flows WHERE project_id = ? AND analysis_version = ? ORDER BY id"
    )
    .all(projectId, analysisVersion) as FlowRow[];
  const steps = db
    .prepare(
      "SELECT s.flow_id, s.seq, s.title, s.file_path, s.start_line FROM flow_steps s JOIN flows f ON f.id = s.flow_id WHERE f.project_id = ? AND f.analysis_version = ? ORDER BY s.flow_id, s.seq"
    )
    .all(projectId, analysisVersion) as StepRow[];
  const evs = db
    .prepare(
      // lockfile 阶段的依赖行不是端点，不生成「未进入业务流」结论
      "SELECT id, file_path, start_line, note FROM evidence WHERE project_id = ? AND analysis_version = ? AND stage != 'lockfile' ORDER BY file_path, start_line"
    )
    .all(projectId, analysisVersion) as EvRow[];

  const evByLoc = new Map<string, EvRow>();
  for (const e of evs) {
    const k = locKey(e.file_path, e.start_line);
    if (k) evByLoc.set(k, e);
  }

  const delLinks = db.prepare(
    "DELETE FROM claim_evidence WHERE claim_id IN (SELECT id FROM claims WHERE project_id = ? AND analysis_version = ?)"
  );
  const delDeps = db.prepare(
    "DELETE FROM claim_dependencies WHERE claim_id IN (SELECT id FROM claims WHERE project_id = ? AND analysis_version = ?) OR depends_on_claim_id IN (SELECT id FROM claims WHERE project_id = ? AND analysis_version = ?)"
  );
  const delClaims = db.prepare("DELETE FROM claims WHERE project_id = ? AND analysis_version = ?");
  const insClaim = db.prepare(
    "INSERT INTO claims (project_id, analysis_version, content, derivation, review_state, confidence, subject_type, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insLink = db.prepare(
    "INSERT OR IGNORE INTO claim_evidence (claim_id, evidence_id, support_role) VALUES (?, ?, ?)"
  );

  let inserted = 0;
  let skipped = 0;
  let linked = 0;
  db.transaction(() => {
    delLinks.run(projectId, analysisVersion);
    delDeps.run(projectId, analysisVersion, projectId, analysisVersion);
    delClaims.run(projectId, analysisVersion);

    const usedEvidence = new Set<number>();

    for (const f of flows) {
      const own = steps.filter((s) => s.flow_id === f.id);
      if (own.length === 0) {
        skipped++; // 没有步骤的流程不足以支撑一条结论
        continue;
      }
      const titles = own.map((s) => s.title).join(" → ");
      const content = "业务流程「" + f.title + "」共 " + own.length + " 步：" + titles;
      const supported = own.every((s) => evByLoc.has(locKey(s.file_path, s.start_line) ?? ""));
      const info = insClaim.run(
        projectId,
        analysisVersion,
        content,
        "inferred",
        supported ? "supported" : "draft",
        0.8,
        "flow",
        f.id
      );
      const claimId = Number(info.lastInsertRowid);
      inserted++;
      for (const s of own) {
        const ev = evByLoc.get(locKey(s.file_path, s.start_line) ?? "");
        if (!ev) continue;
        insLink.run(claimId, ev.id, "step:" + s.seq);
        usedEvidence.add(ev.id);
        linked++;
      }
    }

    for (const e of evs) {
      if (usedEvidence.has(e.id)) continue;
      const where = locKey(e.file_path, e.start_line) ?? e.file_path;
      const content =
        "端点 " + (e.note ?? "(未标注)") + " 定义于 " + where + "，未进入任何确定性业务流程";
      const info = insClaim.run(
        projectId,
        analysisVersion,
        content,
        "direct_extraction",
        "supported",
        1.0,
        "evidence",
        e.id
      );
      insLink.run(Number(info.lastInsertRowid), e.id, "defines");
      inserted++;
      linked++;
    }
  })();
  return { inserted, skipped, linked };
}
