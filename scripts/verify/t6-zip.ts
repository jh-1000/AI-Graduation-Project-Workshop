/** T6：Windows 兼容——中文文件名 zip 导入与内容正确性 */
import path from "node:path";
import AdmZip from "adm-zip";
import { deleteProjectData, getDb } from "../../src/lib/db";
import { importFromZip } from "../../src/lib/ingest";

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  const slug = `t6-zip-${Date.now().toString(36)}`;
  try {
    const zip = new AdmZip();
    zip.addFile("src/数据/任务页面.txt", Buffer.from("这是任务页面内容", "utf8"));
    zip.addFile("src/阅读我.md", Buffer.from("# 说明\n中文内容", "utf8"));
    const tmp = path.join(process.cwd(), "data", `${slug}.zip`);
    zip.writeZip(tmp);

    const r = importFromZip(slug, "T6 中文 zip 测试", tmp);
    const db = getDb();
    const rows = db
      .prepare("SELECT path FROM files WHERE project_id = ? ORDER BY path")
      .all(r.projectId) as { path: string }[];
    const has = (p: string) => rows.some((x) => x.path === p);

    // 清理：统一走 deleteProjectData（含 P1 新增的 flows/nodes/terms/practice 等表）
    deleteProjectData(r.projectId);

    if (has("src/数据/任务页面.txt") && has("src/阅读我.md")) {
      return { status: "pass", detail: `中文条目名解码正确：${rows.map((x) => x.path).join(", ")}` };
    }
    return { status: "fail", detail: `路径不符：${rows.map((x) => x.path).join(", ")}` };
  } catch (err) {
    return { status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}