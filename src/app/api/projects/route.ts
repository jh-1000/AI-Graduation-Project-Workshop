import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { importFromPath, importFromZip } from "@/lib/ingest";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT p.id, p.slug, p.name, p.source_type, p.created_at, " +
        "(SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) AS file_count " +
        "FROM projects p ORDER BY p.id DESC"
    )
    .all();
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      mode?: "path" | "zip";
      path?: string;
      mission?: string;
      defenseDate?: string;
    };
    const name = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "缺少项目名称" }, { status: 400 });
    const slug =
      (body.slug ?? "").trim() ||
      `proj-${Date.now().toString(36)}`;
    const mode = body.mode ?? "path";
    let result;
    if (mode === "path") {
      if (!body.path) return NextResponse.json({ error: "缺少本地路径" }, { status: 400 });
      result = importFromPath(slug, name, body.path, body.mission ?? null, body.defenseDate ?? null);
      if (result.fileCount > 2000) {
        // 文件数异常多，可能是导入了包含缓存/系统文件的目录
        console.warn(`导入 ${slug} 文件数 ${result.fileCount} 偏多，建议检查 NOISE_DIRS 过滤`);
      }
    } else {
      if (!body.path) return NextResponse.json({ error: "缺少 zip 文件路径" }, { status: 400 });
      result = importFromZip(slug, name, body.path, body.mission ?? null, body.defenseDate ?? null);
    }
    return NextResponse.json({ ok: true, projectId: result.projectId, fileCount: result.fileCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
