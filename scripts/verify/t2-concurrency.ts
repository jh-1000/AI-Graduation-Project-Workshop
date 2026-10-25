/** T2：better-sqlite3 多进程并发写（WAL + busy_timeout + 短事务 + 退避重试） */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const DB = path.join(process.cwd(), "data", "t2-concurrency.db");
const N = 300;

function freshDb() {
  const db = new Database(DB);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  // 复位式清空：Windows 下旧句柄可能锁文件，不依赖删除文件
  db.exec("CREATE TABLE IF NOT EXISTS t2_test (id INTEGER PRIMARY KEY AUTOINCREMENT, writer TEXT NOT NULL, n INTEGER NOT NULL)");
  db.exec("DELETE FROM t2_test");
  db.close();
}

function retry<T>(fn: () => T, tries = 5): T {
  for (let i = 0; i < tries; i += 1) {
    try {
      return fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "SQLITE_BUSY" && i < tries - 1) {
        const wait = 100 * 2 ** i;
        const end = Date.now() + wait;
        while (Date.now() < end) /* spin */;
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  try {
    freshDb();
    const script = path.join(process.cwd(), "scripts", "verify", "t2-writer.ts");
    const tsxCli = require.resolve("tsx/cli");
    const procs: ReturnType<typeof spawn>[] = [];
    for (const w of ["A", "B"]) {
      const p = spawn(process.execPath, [tsxCli, script, w], {
        cwd: process.cwd(),
        stdio: "ignore",
        windowsHide: true,
      });
      procs.push(p);
    }
    // 主进程同时写
    const main = new Database(DB);
    main.pragma("journal_mode = WAL");
    main.pragma("busy_timeout = 5000");
    const ins = main.prepare("INSERT INTO t2_test (writer, n) VALUES ('MAIN', ?)");
    for (let i = 0; i < 100; i += 1) {
      retry(() => main.transaction(() => ins.run(i))());
    }

    const exitCodes = await Promise.all(
      procs.map(
        (p) =>
          new Promise<number>((resolve) => {
            p.on("exit", (c) => resolve(c ?? -1));
          })
      )
    );

    const db = new Database(DB);
    const count = (db.prepare("SELECT COUNT(*) AS n FROM t2_test").get() as { n: number }).n;
    const integrity = (db.pragma("integrity_check") as { integrity_check: string }[])[0]
      .integrity_check;
    const fk = db.pragma("foreign_key_check") as unknown[];
    db.close();
    const expected = N * 2 + 100;
    const allExitedZero = exitCodes.every((c) => c === 0);
    if (count === expected && integrity === "ok" && fk.length === 0 && allExitedZero) {
      return {
        status: "pass",
        detail: `并发写 ${expected} 行全部落库；integrity_check=ok；foreign_key_check 干净；写者退出码 ${exitCodes}`,
      };
    }
    return {
      status: "fail",
      detail: `count=${count}/${expected} integrity=${integrity} fk=${fk.length} exits=${exitCodes}`,
    };
  } catch (err) {
    return { status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}
