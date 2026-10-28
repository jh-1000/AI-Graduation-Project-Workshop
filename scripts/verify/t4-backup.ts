/** T4：db.backup() 在写入压力下产出一致快照，恢复校验通过 */
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { getDb } from "../../src/lib/db";

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  try {
    const db = getDb();
    db.exec(
      "CREATE TABLE IF NOT EXISTS t4_pressure (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)"
    );
    // 写入压力：第二条连接持续写 3 秒
    const writer = new Database(path.join(process.cwd(), "data", "app.db"));
    writer.pragma("busy_timeout = 5000");
    let writing = true;
    const w = writer.prepare("INSERT INTO t4_pressure (v) VALUES (?)");
    const loop = (async () => {
      while (writing) {
        try {
          writer.transaction(() => w.run("t4"))();
        } catch {
          /* BUSY 忽略 */
        }
        await new Promise((r) => setTimeout(r, 5));
      }
    })();

    const dest = path.join(process.cwd(), "data", `backup-t4-${Date.now()}.db`);
    await db.backup(dest);
    writing = false;
    await loop;
    writer.close();

    const src = db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number };
    const backup = new Database(dest);
    const integrity = (
      backup.pragma("integrity_check") as { integrity_check: string }[]
    )[0].integrity_check;
    const dst = backup.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number };
    const t4 = backup.prepare("SELECT COUNT(*) AS n FROM t4_pressure").get() as { n: number };
    backup.close();
    fs.rmSync(dest, { force: true });
    // 压测表不入主库：验证完即清理（保持数据目录干净）
    db.exec("DROP TABLE IF EXISTS t4_pressure");

    if (integrity === "ok" && dst.n === src.n && t4.n > 0) {
      return {
        status: "pass",
        detail: `写压下备份完成：files=${dst.n}/${src.n}，压测写入 ${t4.n} 行已包含，integrity=ok`,
      };
    }
    return {
      status: "fail",
      detail: `integrity=${integrity} files=${dst.n}/${src.n} t4rows=${t4.n}`,
    };
  } catch (err) {
    return { status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}
