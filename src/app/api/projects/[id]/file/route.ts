import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

const MAX_BYTES = 400 * 1024;

/**
 * 代码库阅读器数据源（只读，Auth-L0 授权根目录内）。
 * 返回：文件内容 + 符号大纲 + 证据行 + 静态引用（谁 import 它 / 它 import 谁）。
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return NextResponse.json({ error: "缺少 path" }, { status: 400 });

  const db = getDb();
  const project = db.prepare("SELECT id, root_path FROM projects WHERE id = ?").get(projectId) as
    | { id: number; root_path: string }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  // 路径穿越防护：realpath 前缀必须落在授权根目录内
  const root = fs.realpathSync(project.root_path);
  const abs = path.resolve(root, rel);
  let real: string;
  try {
    real = fs.realpathSync(abs);
  } catch {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  if (!real.startsWith(root + path.sep) && real !== root) {
    return NextResponse.json({ error: "越界访问被拒绝（Auth-L0）" }, { status: 403 });
  }

  const stat = fs.statSync(real);
  if (!stat.isFile()) return NextResponse.json({ error: "不是文件" }, { status: 400 });
  if (stat.size > MAX_BYTES) return NextResponse.json({ error: "文件过大（>400KB）", truncated: true }, { status: 413 });

  const content = fs.readFileSync(real, "utf8");

  const file = db
    .prepare("SELECT id, path, loc, parse_mode FROM files WHERE project_id = ? AND path = ?")
    .get(projectId, rel.replace(/\\/g, "/")) as
    | { id: number; path: string; loc: number; parse_mode: string }
    | undefined;

  const symbols = file
    ? (db
        .prepare(
          "SELECT id, name, kind, line, precision FROM symbols WHERE project_id = ? AND file_id = ? ORDER BY line"
        )
        .all(projectId, file.id) as { id: number; name: string; kind: string | null; line: number | null; precision: string }[])
    : [];

  const evidence = (db
    .prepare(
      "SELECT id, file_path, start_line, end_line, origin, processing, freshness, note, stage FROM evidence WHERE project_id = ? AND file_path = ? ORDER BY start_line"
    )
    .all(projectId, rel.replace(/\\/g, "/")) as {
    id: number;
    file_path: string;
    start_line: number | null;
    end_line: number | null;
    origin: string;
    processing: string;
    freshness: string;
    note: string | null;
    stage: string;
  }[]).filter((e) => e.start_line !== null);

  // 静态引用：IMPORTS 边（file→file）
  let importsOut: { path: string; toId: number }[] = [];
  let importsIn: { path: string; fromId: number }[] = [];
  if (file) {
    const latest = db
      .prepare("SELECT analysis_version FROM edges WHERE project_id = ? ORDER BY id DESC LIMIT 1")
      .get(projectId) as { analysis_version: string } | undefined;
    if (latest) {
      importsOut = db
        .prepare(
          `SELECT f.path, e.to_id AS toId FROM edges e JOIN files f ON f.id = e.to_id
           WHERE e.project_id = ? AND e.analysis_version = ? AND e.kind = 'IMPORTS' AND e.from_type = 'file' AND e.to_type = 'file' AND e.from_id = ?`
        )
        .all(projectId, latest.analysis_version, file.id) as { path: string; toId: number }[];
      importsIn = db
        .prepare(
          `SELECT f.path, e.from_id AS fromId FROM edges e JOIN files f ON f.id = e.from_id
           WHERE e.project_id = ? AND e.analysis_version = ? AND e.kind = 'IMPORTS' AND e.from_type = 'file' AND e.to_type = 'file' AND e.to_id = ?`
        )
        .all(projectId, latest.analysis_version, file.id) as { path: string; fromId: number }[];
    }
  }

  return NextResponse.json({
    path: rel,
    content,
    loc: stat.size,
    parseMode: file?.parse_mode ?? "text_only",
    symbols,
    evidence,
    importsOut,
    importsIn,
  });
}
