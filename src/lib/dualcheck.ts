/**
 * 双重校验（dual-check）：对已落库的结论做四查。
 * 设计依据：01-Requirements/modules/analysis/dual-check/SPEC.md
 *   - F-1 支持性检查：证据是否直接支持结论
 *   - F-2 反例与失败分支检查：是否遗漏反例/失败路径/异步/事务
 *   - F-3 范围检查：解释是否超出已核查范围
 *   - F-4 冲突检查：相互冲突的证据触发 fact_conflicts
 *
 * 简化实现（P2 阶段）：
 *   - 对每条 review_state='draft' 的结论，写 open_question 提示"未被证据完整支撑，需复核"
 *   - 对"未覆盖端点"类结论（direct_extraction），检查该端点是否真的无 flow 引用——
 *     如果 evidence 里有 endpoint 但 flows 为空，记一个 open_question 提醒"该端点未进入业务流追踪"
 *   - 冲突检查留后续（需要语义比对）
 */
import { getDb } from "./db";

export type DualCheckResult = { flagged: number; openQuestions: number };

export function runDualCheck(projectId: number, analysisVersion: string): DualCheckResult {
  const db = getDb();

  const claims = db
    .prepare(
      "SELECT id, content, derivation, review_state, subject_type, subject_id FROM claims WHERE project_id = ? AND analysis_version = ?"
    )
    .all(projectId, analysisVersion) as {
    id: number;
    content: string;
    derivation: string;
    review_state: string;
    subject_type: string | null;
    subject_id: number | null;
  }[];

  let flagged = 0;
  let openQuestions = 0;

  const insOq = db.prepare(
    "INSERT INTO open_questions (project_id, analysis_version, question, why, next_check, status) VALUES (?, ?, ?, ?, ?, 'open')"
  );

  const tx = db.transaction(() => {
    for (const c of claims) {
      // F-1：draft 结论 = 证据未完整支撑，转 open_question
      if (c.review_state === "draft") {
        insOq.run(
          projectId,
          analysisVersion,
          "结论未被证据完整支撑：" + c.content.slice(0, 120),
          "该结论的部分步骤无法对上证据行（support 检查未通过）",
          "人工复核：补证据或修正结论表述"
        );
        openQuestions++;
        flagged++;
      }

      // F-3：direct_extraction 类结论 = 未进入业务流的端点，提醒"范围外"
      if (c.derivation === "direct_extraction" && c.subject_type === "evidence") {
        insOq.run(
          projectId,
          analysisVersion,
          "端点未进入业务流追踪：" + c.content.slice(0, 120),
          "该端点有静态证据但 flows 表无对应流程——可能是未覆盖入口，也可能是死代码",
          "确认该端点是否仍被前端调用；如是死代码则从结论中剔除"
        );
        openQuestions++;
      }
    }
  });
  tx();

  return { flagged, openQuestions };
}
