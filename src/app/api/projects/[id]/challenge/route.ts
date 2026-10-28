import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startWorkspace, readDiff, runVerify, rollback, finalize, reviewCommand } from "@/lib/challenge";

/**
 * P4 实战挑战 API（Auth-L5/L2 强制）。
 * start   : 创建隔离工作区（worktree/副本双轨），要求 projects.allow_modify = 1
 * state   : 工作区状态 + diff
 * verify  : 运行验证命令（Auth-L2 单次授权，副作用黑名单审查，runtime_proofs 记录）
 * rollback: 一键还原
 * complete: 终局三态（modified / verifyExecuted / accepted）
 */

async function requireModify(projectId: number) {
  const db = getDb();
  const p = db.prepare("SELECT allow_modify FROM projects WHERE id = ?").get(projectId) as
    | { allow_modify: number }
    | undefined;
  if (!p) return "项目不存在";
  if (!p.allow_modify) return "Auth-L5 未授权：请先打开本项目的「允许修改」开关（挑战页内），并理解修改发生在隔离工作区";
  return null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as { action?: string; runId?: number; command?: string };
  const action = body.action ?? "start";

  try {
    if (action === "start") {
      const denied = await requireModify(projectId);
      if (denied) return NextResponse.json({ error: denied, code: "AUTH_L5" }, { status: 403 });
      const kind = "modify";
      const r = startWorkspace(projectId, 0, kind);
      return NextResponse.json({ ok: true, ...r });
    }

    const runId = Number(body.runId);
    if (!runId) return NextResponse.json({ error: "缺少 runId" }, { status: 400 });

    if (action === "state") {
      const d = readDiff(projectId, runId);
      return NextResponse.json({ ok: true, ...d });
    }
    if (action === "verify") {
      const denied = await requireModify(projectId);
      if (denied) return NextResponse.json({ error: denied, code: "AUTH_L5" }, { status: 403 });
      const command = (body.command ?? "").trim();
      if (!command) return NextResponse.json({ error: "缺少验证命令" }, { status: 400 });
      const block = reviewCommand(command);
      if (block) return NextResponse.json({ error: `Auth-L2 副作用审查拒绝：${block}` }, { status: 403 });
      const r = runVerify(projectId, runId, command);
      return NextResponse.json({ ok: true, ...r });
    }
    if (action === "rollback") {
      const r = rollback(projectId, runId);
      return NextResponse.json({ ok: r.ok, mode: r.mode });
    }
    if (action === "complete") {
      const r = finalize(projectId, runId);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: `未知 action：${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
