import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { extractFromFile, isTextFile, nextAppRoute } from "@/lib/scan";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id)) as
    | { id: number; root_path: string; stack: string }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const files = db
    .prepare("SELECT path, ext, loc, parse_mode FROM files WHERE project_id = ? ORDER BY path LIMIT 500")
    .all(Number(id)) as { path: string; ext: string | null; loc: number; parse_mode: string }[];

  // 从磁盘现读现抽（P0 预览级；正式分析走 Map 管线并落库）
  const endpoints: { method: string; path: string; file: string; line: number }[] = [];
  const routes: { path: string; file: string; kind: string }[] = [];
  for (const f of files.slice(0, 300)) {
    if (!isTextFile(f.path)) continue;
    const abs = path.join(project.root_path, f.path);
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (content.length > 200_000) continue;
    const r = extractFromFile(f.path, content);
    endpoints.push(...r.endpoints);
    routes.push(...r.routes);
    const nr = nextAppRoute(f.path);
    if (nr !== null) routes.push({ path: nr, file: f.path, kind: "next-app" });
  }

  return NextResponse.json({
    stack: JSON.parse(project.stack || "{}"),
    stats: files.reduce<Record<string, number>>((acc, f) => {
      acc[f.parse_mode] = (acc[f.parse_mode] ?? 0) + 1;
      return acc;
    }, {}),
    endpoints,
    routes,
    files: files.map((f) => ({ path: f.path, loc: f.loc, parse_mode: f.parse_mode })),
  });
}
