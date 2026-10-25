/** T1：web-tree-sitter 在 Node worker 语境加载 WASM 并解析 fixture（Auth/证据层编号无关） */
import path from "node:path";
import fs from "node:fs";
// web-tree-sitter 0.22.x 以 CJS default 导出 Parser 类（含静态 Language）
import ParserCtor from "web-tree-sitter";

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  try {
    await ParserCtor.init();
    // tree-sitter-wasms 预置各语言 wasm
    const wasmPath = require.resolve("tree-sitter-wasms/out/tree-sitter-typescript.wasm");
    const tsLang = await ParserCtor.Language.load(wasmPath);
    const parser = new ParserCtor();
    parser.setLanguage(tsLang);

    const root = path.join(process.cwd(), "fixtures", "fixture1-todo-clip");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(dir, e.name));
        else if (/\.(ts|tsx)$/.test(e.name)) files.push(path.join(dir, e.name));
      }
    };
    walk(path.join(root, "src"));

    const t0 = Date.now();
    let parsed = 0;
    let fnCount = 0;
    for (const f of files) {
      const tree = parser.parse(fs.readFileSync(f, "utf8"));
      if (!tree) throw new Error(`解析失败：${f}`);
      parsed += 1;
      const cursor = tree.walk();
      // 统计函数声明节点
      cursor.gotoFirstChild();
      do {
        if (cursor.nodeType === "function_declaration") fnCount += 1;
      } while (cursor.gotoNextSibling());
    }
    const ms = Date.now() - t0;
    return {
      status: "pass",
      detail: `web-tree-sitter WASM 解析 ${parsed} 个 TS 文件 OK，函数声明 ${fnCount} 个，耗时 ${ms}ms`,
    };
  } catch (err) {
    return { status: "fail", detail: err instanceof Error ? err.message : String(err) };
  }
}
