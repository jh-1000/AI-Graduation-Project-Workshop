import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const NOISE = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "venv",
  "__pycache__", ".idea", ".vscode", "coverage", ".gradle", "target",
  "AppData", "Windows", "Program Files", "Program Files (x86)", "$Recycle.Bin",
  "System Volume Information", "Documents and Settings", "Recovery",
  "DumpStack.log.tmp", "pagefile.sys", "swapfile.sys", "hiberfil.sys",
]);

/** 服务端目录浏览（Auth-L0：只读列目录名，不读文件内容）。
 *  per-entry 容错：Windows 系统文件/目录可能 EPERM，逐条跳过不让整目录失败。 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path") || "";
  const dir = raw ? path.resolve(raw) : "";
  if (!dir || !fs.existsSync(dir) || !safeStat(dir)?.isDirectory()) {
    // Windows 盘符根列表
    if (!raw) {
      const drives: string[] = [];
      for (const c of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
        const root = `${c}:\\`;
        if (fs.existsSync(root)) drives.push(root);
      }
      return NextResponse.json({ current: "", parent: null, dirs: drives.map((d) => ({ name: d, path: d })), files: [] });
    }
    return NextResponse.json({ error: "目录不存在" }, { status: 404 });
  }

  let real: string;
  try {
    real = fs.realpathSync(dir);
  } catch {
    return NextResponse.json({ error: "无法解析路径" }, { status: 404 });
  }

  const dirs: { name: string; path: string }[] = [];
  const files: { name: string; size: number }[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(real, { withFileTypes: true });
  } catch (e) {
    const code = (e as { code?: string }).code ?? "unknown";
    return NextResponse.json(
      { error: `读取目录失败（${code}）：${(e as Error).message?.slice(0, 200)}` },
      { status: 403 }
    );
  }
  for (const entry of entries) {
    if (NOISE.has(entry.name)) continue;
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: path.join(real, entry.name) });
    } else if (entry.isFile()) {
      try {
        const st = fs.statSync(path.join(real, entry.name));
        files.push({ name: entry.name, size: st.size });
      } catch {
        files.push({ name: entry.name, size: 0 }); // stat 失败仍列出文件名
      }
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  const parent = path.dirname(real) !== real ? path.dirname(real) : null;

  return NextResponse.json({
    current: real,
    parent,
    dirs: dirs.map((d) => ({ name: d.name, path: path.join(real, d.name) })),
    files: files.slice(0, 100),
  });
}

function safeStat(p: string): fs.Stats | null {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}
