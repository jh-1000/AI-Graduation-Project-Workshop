import { getDb } from "./db";

export type RunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["paused", "completed", "failed", "queued"], // queued：心跳超时自动重排
  paused: ["running", "cancelled"],
  completed: [],
  failed: ["queued"], // 手动重试
  cancelled: ["queued"], // 手动重启
};

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new Error(`非法状态转换：${from} → ${to}`);
  }
}

export function nextVersion(projectId: number, kind: string): string {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM analysis_runs WHERE project_id = ? AND kind = ?")
    .get(projectId, kind) as { n: number };
  return `${kind}-v${row.n + 1}`;
}

export function createRun(projectId: number, kind: "scan" | "map", idemKey?: string): number {
  const db = getDb();
  if (idemKey) {
    const dup = db
      .prepare(
        "SELECT id FROM analysis_runs WHERE project_id = ? AND idem_key = ? AND status IN ('queued','running','paused')"
      )
      .get(projectId, idemKey) as { id: number } | undefined;
    if (dup) return dup.id; // 幂等：等价任务进行中则复用
  }
  const info = db
    .prepare("INSERT INTO analysis_runs (project_id, version, kind, status, idem_key) VALUES (?, ?, ?, 'queued', ?)")
    .run(projectId, nextVersion(projectId, kind), kind, idemKey ?? null);
  return Number(info.lastInsertRowid);
}

export function setRunStatus(runId: number, to: RunStatus, patch?: { stage?: string; step?: string; note?: string }): void {
  const db = getDb();
  const row = db.prepare("SELECT status FROM analysis_runs WHERE id = ?").get(runId) as { status: RunStatus };
  assertTransition(row.status, to);
  db.prepare(
    "UPDATE analysis_runs SET status = ?, stage = COALESCE(?, stage), step = COALESCE(?, step), progress_note = COALESCE(?, progress_note), updated_at = datetime('now','localtime') WHERE id = ?"
  ).run(to, patch?.stage ?? null, patch?.step ?? null, patch?.note ?? null, runId);
}

export function heartbeat(runId: number, stage?: string, step?: string): void {
  getDb()
    .prepare(
      "UPDATE analysis_runs SET heartbeat_at = datetime('now','localtime'), status = 'running', stage = COALESCE(?, stage), step = COALESCE(?, step), updated_at = datetime('now','localtime') WHERE id = ?"
    )
    .run(stage ?? null, step ?? null, runId);
}

/** 启动恢复：心跳超时的 running → queued（保留恢复位置）；恢复计数>3 → failed */
export function recoverStaleRuns(staleSeconds = 15): number[] {
  const db = getDb();
  const stale = db
    .prepare(
      "SELECT id, recovery_count FROM analysis_runs WHERE status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < datetime('now','localtime', ?))"
    )
    .all(`-${staleSeconds} seconds`) as { id: number; recovery_count: number }[];
  const recovered: number[] = [];
  for (const r of stale) {
    const count = r.recovery_count + 1;
    if (count > 3) {
      db.prepare(
        "UPDATE analysis_runs SET status = 'failed', recovery_count = ?, progress_note = '反复中断', updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(count, r.id);
    } else {
      db.prepare(
        "UPDATE analysis_runs SET status = 'queued', recovery_count = ?, updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(count, r.id);
      recovered.push(r.id);
    }
  }
  return recovered;
}

export function getRun(id: number) {
  return getDb().prepare("SELECT * FROM analysis_runs WHERE id = ?").get(id);
}
