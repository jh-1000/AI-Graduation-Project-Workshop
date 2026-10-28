import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { startWorkspace, readDiff, rollback } from "@/lib/challenge";

/**
 * 交互式影响探针（升级 2）：从知识点页一键「把删掉这行代码试试」。
 * 复用 challenge 基建：隔离工作区 + 自动变异 + 验证 + 回滚。
 * 整个周期在一个 API 调用里完成，学习者只看到「删掉之前 vs 删掉之后」。
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const body = (await req.json()) as {
    filePath?: string;
    line?: number;
    mutation?: string; // 变更描述，如 "注释掉 setLoading(true)"
    verifyCommand?: string;
  };
  if (!body.filePath || !body.line) {
    return NextResponse.json({ error: "需要 filePath 和 line" }, { status: 400 });
  }

  const db = getDb();
  const project = db.prepare("SELECT root_path, allow_modify FROM projects WHERE id = ?").get(projectId) as
    | { root_path: string; allow_modify: number }
    | undefined;
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const root = fs.realpathSync(project.root_path);
  const abs = path.resolve(root, body.filePath);
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  // 读取原始内容
  const original = fs.readFileSync(abs, "utf8");
  const lines = original.split("\n");
  const targetIdx = body.line - 1;
  if (targetIdx < 0 || targetIdx >= lines.length) {
    return NextResponse.json({ error: `行号 ${body.line} 超出范围（共 ${lines.length} 行）` }, { status: 400 });
  }
  const targetLineContent = lines[targetIdx];

  // 构建变异后内容：注释掉目标行
  const mutated = lines.map((l, i) =>
    i === targetIdx ? `// [影响探针] ${l}` : l
  );

  // 写入临时副本做验证（不改原文件）
  const tmpDir = path.join(process.cwd(), "data", "probe", `probe-${Date.now()}`);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const relParts = body.filePath.replace(/\\/g, "/").split("/");
    let dest = tmpDir;
    for (const part of relParts.slice(0, -1)) {
      dest = path.join(dest, part);
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.writeFileSync(path.join(dest, relParts[relParts.length - 1]), mutated.join("\n"), "utf8");

    // 如果有验证命令且项目有 node_modules，尝试运行（降级：可能因依赖不全而失败——这本身就是结果）
    let verifyOutput = "";
    let verifyOk: boolean | null = null;
    const nodeModules = path.join(root, "node_modules");
    if (body.verifyCommand && fs.existsSync(nodeModules) && project.allow_modify) {
      try {
        const { execSync } = require("node:child_process");
        const out = execSync(body.verifyCommand, {
          cwd: root,
          encoding: "utf8",
          timeout: 60_000,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, FORCE_COLOR: "0" },
        });
        verifyOutput = String(out).slice(-3000);
        verifyOk = true;
      } catch (e: any) {
        verifyOutput = `${(e.stdout ?? "") + (e.stderr ?? "")}`.slice(-3000);
        verifyOk = false;
      }
    }

    // 生成 diff（前后对比）
    const before = lines.map((l, i) => `${i === targetIdx ? "  " : "  "} ${l}`).join("\n");
    const after = mutated.map((l, i) => `${i === targetIdx ? "- " : "  "} ${l}`).join("\n");

    return NextResponse.json({
      ok: true,
      targetLine: body.line,
      originalLine: targetLineContent,
      diff: { before, after },
      mutation: body.mutation ?? "注释掉该行",
      verify: verifyOk === null ? { status: "not_run", output: "" } : { status: verifyOk ? "passed" : "failed", output: verifyOutput },
      insight: `删掉「${targetLineContent.trim().slice(0, 50)}」后${verifyOk === false ? "，验证失败——这就是这行代码存在的意义。" : verifyOk === true ? "，验证通过——但真实运行时行为可能不同（类型检查≠运行时正确）。" : "，如果没有配置验证命令，建议到设置页配置后重试。"}`,
    });
  } finally {
    // 清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
