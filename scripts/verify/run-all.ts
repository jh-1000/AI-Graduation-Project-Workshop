/** T1-T6 技术验证总入口：输出 PASS/FAIL/SKIP 报告 */
import { run as t1 } from "./t1-tree-sitter";
import { run as t2 } from "./t2-concurrency";
import { run as t3 } from "./t3-llm-json";
import { run as t4 } from "./t4-backup";
import { run as t5 } from "./t5-ssrf";
import { run as t6 } from "./t6-zip";

type Res = { status: "pass" | "fail" | "skip"; detail: string };

async function main() {
  const items: [string, () => Promise<Res>][] = [
    ["T1 web-tree-sitter WASM", t1],
    ["T2 SQLite 双进程并发", t2],
    ["T3 LLM 结构化输出", t3],
    ["T4 在线备份一致性", t4],
    ["T5 SSRF 防护", t5],
    ["T6 Windows 中文 zip", t6],
  ];
  const out: Record<string, Res> = {};
  for (const [name, fn] of items) {
    process.stdout.write(`运行 ${name} …`);
    const r = await fn();
    out[name] = r;
    console.log(` ${r.status.toUpperCase()}\n  ${r.detail}`);
  }
  const fail = Object.entries(out).filter(([, r]) => r.status === "fail");
  console.log(`\n小结：${items.length - fail.length}/${items.length} 通过（fail=${fail.length}）`);
  process.exitCode = fail.length === 0 ? 0 : 1;
}

void main();
