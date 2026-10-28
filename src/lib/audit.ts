/**
 * 全库体检（audit）：正则规则扫描常见 code smell，输出"最可能被追问的点"。
 * 设计依据：01-Requirements/modules/analysis/audit/SPEC.md
 *   - F-1 代码体检：TODO/FIXME、console 残留、空 catch、debugger、注释代码
 *   - R-1 体检是 judgement call 不是硬违规，必须标"疑似"
 *
 * 产物：repo_insights kind='health'，每条一个 smell 点。
 * 不依赖 LLM，纯确定性扫描。
 */
import { getDb } from "./db";

export type AuditResult = { inserted: number };

type Smell = {
  kind: "todo" | "console" | "empty_catch" | "debugger" | "commented_code";
  file: string;
  line: number;
  detail: string;
};

const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b[:：]?\s*(.*)/;
const CONSOLE_RE = /\bconsole\.(log|error|warn|info|debug)\s*\(/;
const DEBUGGER_RE = /\bdebugger\b/;
// catch (e) { } 或 catch { } —— 块体为空或只有注释
const EMPTY_CATCH_RE = /catch\s*(\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*)?\s*\}/;

export function runAudit(projectId: number, analysisVersion: string, files: { path: string; content: string }[]): AuditResult {
  const smells: Smell[] = [];

  for (const f of files) {
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (TODO_RE.test(line)) {
        const m = line.match(TODO_RE);
        smells.push({
          kind: "todo",
          file: f.path,
          line: i + 1,
          detail: `${m?.[1] ?? "TODO"}${m?.[2] ? "：" + m[2].trim() : ""}`,
        });
      }
      if (CONSOLE_RE.test(line)) {
        smells.push({ kind: "console", file: f.path, line: i + 1, detail: line.trim().slice(0, 120) });
      }
      if (DEBUGGER_RE.test(line)) {
        smells.push({ kind: "debugger", file: f.path, line: i + 1, detail: "debugger 语句残留" });
      }
      // 空 catch：按块检测可能跨行，简单做法是单行内匹配
      if (EMPTY_CATCH_RE.test(line)) {
        smells.push({ kind: "empty_catch", file: f.path, line: i + 1, detail: "catch 块为空——异常被静默吞掉" });
      }
    }
  }

  const db = getDb();
  // 按版本整体替换
  db.prepare("DELETE FROM repo_insights WHERE project_id = ? AND analysis_version = ? AND kind = 'health'")
    .run(projectId, analysisVersion);

  const ins = db.prepare(
    "INSERT INTO repo_insights (project_id, analysis_version, kind, title, content, evidence_note) VALUES (?, ?, 'health', ?, ?, ?)"
  );

  let inserted = 0;
  const tx = db.transaction(() => {
    for (const s of smells) {
      const title = smellTitle(s.kind, s.file, s.line);
      ins.run(projectId, analysisVersion, title, s.detail, `${s.file}:${s.line}`);
      inserted++;
    }
  });
  tx();
  return { inserted };
}

function smellTitle(kind: Smell["kind"], file: string, line: number): string {
  switch (kind) {
    case "todo":
      return `疑似待办 ${file}:${line}`;
    case "console":
      return `调试输出残留 ${file}:${line}`;
    case "empty_catch":
      return `空 catch 块 ${file}:${line}`;
    case "debugger":
      return `debugger 残留 ${file}:${line}`;
    case "commented_code":
      return `注释代码 ${file}:${line}`;
  }
}
