import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runInvalidation } from "@/lib/invalidation";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ ok: false, error: "invalid project id" }, { status: 400 });
  }
  const db = getDb();
  const project = db
    .prepare("SELECT root_path FROM projects WHERE id = ?")
    .get(projectId) as { root_path: string } | undefined;
  if (!project) {
    return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  }
  const result = runInvalidation(projectId, project.root_path);
  return NextResponse.json({ ok: true, ...result });
}
