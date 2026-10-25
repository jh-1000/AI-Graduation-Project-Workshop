/** T2 写者子进程：短事务 + BUSY 退避重试 */
import Database from "better-sqlite3";
import path from "node:path";

const writer = process.argv[2] ?? "X";
const N = 300;
const DB = path.join(process.cwd(), "data", "t2-concurrency.db");

const db = new Database(DB);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
const ins = db.prepare("INSERT INTO t2_test (writer, n) VALUES (?, ?)");

function retry<T>(fn: () => T, tries = 5): T {
  for (let i = 0; i < tries; i += 1) {
    try {
      return fn();
    } catch (e) {
      if ((e as { code?: string }).code === "SQLITE_BUSY" && i < tries - 1) {
        const end = Date.now() + 100 * 2 ** i;
        while (Date.now() < end) /* spin */;
        continue;
      }
      throw e;
    }
  }
  throw new Error("BUSY 超限");
}

for (let i = 0; i < N; i += 1) {
  retry(() => db.transaction(() => ins.run(writer, i))());
}
db.close();
process.exit(0);
