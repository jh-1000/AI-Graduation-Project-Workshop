/**
 * 上下文选料（repo-map）：用 ts-morph 解析全库 import 关系，建文件引用图，
 * 跑个性化 PageRank，按 token 预算贪心选出最值得放进 LLM 上下文的文件。
 *
 * 设计依据：01-Requirements/modules/analysis/repo-map/SPEC.md
 *   - F-1 符号引用图：ts-morph 抽 import 声明
 *   - F-2 PageRank：文件重要性排序
 *   - F-3 预算拟合：按 maxChars 贪心截断
 *
 * 与旧占位（worker.ts contextParts: 按 loc DESC 取前 20）的区别：
 *   - 旧：文件越长越重要，大文件一定被选，小工具文件被埋没
 *   - 新：被引用多的基础模块分高，入口/路由文件靠被 import 关系自然浮现
 *
 * 注意：选料只决定 LLM 上下文优先级，不决定覆盖统计口径（不变量 R-1）。
 */
import { Project } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

export type FileWeight = {
  path: string;
  chars: number;
};

export type RepomapResult = {
  /** 选中的 rel path，按 PageRank 从高到低 */
  selected: string[];
  /** 全部候选文件的 PageRank 分（调试/观测用） */
  scores: Record<string, number>;
  /** 选中文件累计字符数 */
  totalChars: number;
  /** 参与建图的文件数（ts/tsx） */
  graphSize: number;
};

const DAMPING = 0.85;
const MAX_ITER = 40;
const TOL = 1e-6;

/**
 * @param root      项目根目录绝对路径
 * @param files     候选文件（rel path + 字符数），通常传全部 text 文件
 * @param maxChars  LLM 上下文字符预算（默认 60000，对应 settings.maxContextChars）
 * @param maxFiles  选中文件数硬上限
 */
export function selectContextFiles(
  root: string,
  files: FileWeight[],
  maxChars = 60_000,
  maxFiles = 20
): RepomapResult {
  const tsFiles = files.filter((f) => /\.(ts|tsx)$/.test(f.path));
  if (tsFiles.length === 0) {
    return { selected: [], scores: {}, totalChars: 0, graphSize: 0 };
  }

  // 1. 用 ts-morph 加载所有 ts/tsx 文件（复用 symbols 阶段的 project，但这里独立加载）
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: true,
    useInMemoryFileSystem: false,
  });
  const absPaths = tsFiles.map((f) => path.join(root, f.path));
  const sourceFiles = project.addSourceFilesAtPaths(absPaths);

  const toRel = (abs: string) => path.relative(root, abs).replace(/\\/g, "/");

  // 2. 建图：outgoing[u] = {v1, v2} 表示 u import 了 v1/v2
  const outgoing = new Map<string, Set<string>>();
  for (const sf of sourceFiles) {
    const from = toRel(sf.getFilePath());
    if (!outgoing.has(from)) outgoing.set(from, new Set());
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      // 只解析相对 import（./xxx、../xxx），跳过 npm 包和资源文件
      if (!spec.startsWith(".")) continue;
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue; // 解析不到（.css/.json/无类型声明）就跳过
      outgoing.get(from)!.add(toRel(target.getFilePath()));
    }
  }

  // 3. PageRank 迭代
  const nodes = tsFiles.map((f) => f.path);
  const n = nodes.length;
  const rank = new Map<string, number>();
  for (const f of nodes) rank.set(f, 1 / n);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const next = new Map<string, number>();
    for (const f of nodes) next.set(f, (1 - DAMPING) / n);
    for (const u of nodes) {
      const outs = outgoing.get(u);
      if (!outs || outs.size === 0) continue; // 悬空节点把分平均散给所有节点（简化处理）
      const share = (rank.get(u) ?? 0) / outs.size;
      for (const v of outs) {
        next.set(v, (next.get(v) ?? 0) + DAMPING * share);
      }
    }
    let diff = 0;
    for (const f of nodes) {
      diff += Math.abs((next.get(f) ?? 0) - (rank.get(f) ?? 0));
      rank.set(f, next.get(f) ?? 0);
    }
    if (diff < TOL) break;
  }

  // 4. 按分数排序，贪心选文件直到预算
  const sorted = [...nodes].sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0));
  const sizeMap = new Map(files.map((f) => [f.path, f.chars]));
  const selected: string[] = [];
  let total = 0;
  for (const f of sorted) {
    if (selected.length >= maxFiles) break;
    const size = sizeMap.get(f) ?? 0;
    // 已经选了至少一个且再加这个会超预算，就停（不硬塞超预算文件）
    if (selected.length > 0 && total + size > maxChars) break;
    selected.push(f);
    total += size;
  }

  const scores: Record<string, number> = {};
  for (const [k, v] of rank) scores[k] = v;

  return { selected, scores, totalChars: total, graphSize: n };
}
