/**
 * P5.4 多语言符号抽取（web-tree-sitter）。
 * 覆盖 py / go / java / rust / c / cpp —— ts-morph 管 TS/JS，这里管其余语言。
 * 抽取粒度：函数与类定义（够答辩定位用；不做完整语义）。
 */
import path from "node:path";
import fs from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */

type LangDef = { wasm: string; exts: string[]; fnNode: string; nameField: string; classNode: string };

const LANGS: Record<string, LangDef> = {
  python: { wasm: "tree-sitter-python.wasm", exts: [".py"], fnNode: "function_definition", nameField: "name", classNode: "class_definition" },
  go: { wasm: "tree-sitter-go.wasm", exts: [".go"], fnNode: "function_declaration", nameField: "name", classNode: "type_declaration" },
  java: { wasm: "tree-sitter-java.wasm", exts: [".java"], fnNode: "method_declaration", nameField: "name", classNode: "class_declaration" },
  rust: { wasm: "tree-sitter-rust.wasm", exts: [".rs"], fnNode: "function_item", nameField: "name", classNode: "struct_item" },
  c: { wasm: "tree-sitter-c.wasm", exts: [".c", ".h"], fnNode: "function_definition", nameField: "declarator", classNode: "struct_specifier" },
  cpp: { wasm: "tree-sitter-cpp.wasm", exts: [".cpp", ".cc", ".hpp"], fnNode: "function_definition", nameField: "declarator", classNode: "class_specifier" },
};

let loaded: Map<string, any> | null = null;

async function getParser(lang: string): Promise<any | null> {
  if (!loaded) loaded = new Map();
  if (loaded.has(lang)) return loaded.get(lang) ?? null;
  const def = LANGS[lang];
  if (!def) return null;
  try {
    const WTS: any = require("web-tree-sitter");
    await WTS.Parser.init();
    const wasmPath = require.resolve(`tree-sitter-wasms/out/${def.wasm}`);
    const langObj = await WTS.Language.load(wasmPath);
    const p = new WTS.Parser();
    p.setLanguage(langObj);
    loaded.set(lang, p);
    return p;
  } catch {
    return null;
  }
}

export type MultiSymbol = { name: string; kind: string; file: string; line: number; lang: string };

/** 对非 TS 文件做多语言符号抽取（P5.4）。单文件失败静默降级。 */
export async function extractSymbolsMulti(
  root: string,
  files: { path: string; ext: string }[]
): Promise<MultiSymbol[]> {
  const out: MultiSymbol[] = [];
  for (const lang of Object.keys(LANGS)) {
    const def = LANGS[lang];
    const targets = files.filter((f) => def.exts.includes(path.extname(f.path).toLowerCase()));
    if (targets.length === 0) continue;
    const parser = await getParser(lang);
    if (!parser) continue;
    for (const f of targets) {
      const abs = path.join(root, f.path);
      if (!fs.existsSync(abs)) continue;
      try {
        const tree = parser.parse(fs.readFileSync(abs, "utf8"));
        if (!tree?.rootNode) continue;
        const decls = tree.rootNode.descendantsOfType([def.fnNode, def.classNode]);
        for (const d of decls) {
          const nameNode = d.childForFieldName(def.nameField);
          const name = nameNode?.text ?? "(anonymous)";
          out.push({
            name,
            kind: d.type.includes("class") || d.type.includes("struct") ? "class" : "function",
            file: f.path,
            line: d.startPosition.row + 1,
            lang,
          });
        }
      } catch {
        /* 单文件解析失败跳过 */
      }
    }
  }
  return out;
}
