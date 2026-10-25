import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

export type SymbolInfo = {
  name: string;
  kind: "function" | "class" | "method";
  file: string;
  line: number;
};

/** ts-morph 深度符号抽取（函数/类/方法），产物统一入 symbols 表（identify_by=ts-morph, precision=exact） */
export function extractSymbolsTs(root: string, relFiles: string[]): SymbolInfo[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: true,
    useInMemoryFileSystem: false,
  });
  const absFiles: string[] = [];
  for (const rel of relFiles) {
    const abs = path.join(root, rel);
    if (/\.(ts|tsx)$/.test(rel) && fs.existsSync(abs)) absFiles.push(abs);
  }
  if (!absFiles.length) return [];
  const sourceFiles = project.addSourceFilesAtPaths(absFiles);
  const out: SymbolInfo[] = [];
  for (const sf of sourceFiles) {
    const rel = path.relative(root, sf.getFilePath()).replace(/\\/g, "/");
    for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      const name = fn.getName();
      if (!name) continue;
      out.push({ name, kind: "function", file: rel, line: fn.getStartLineNumber() });
    }
    for (const cls of sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      const name = cls.getName();
      if (!name) continue;
      out.push({ name, kind: "class", file: rel, line: cls.getStartLineNumber() });
      for (const m of cls.getMethods()) {
        out.push({ name: `${name}.${m.getName()}`, kind: "method", file: rel, line: m.getStartLineNumber() });
      }
    }
  }
  return out;
}
