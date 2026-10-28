"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

type FileData = {
  path: string;
  content: string;
  parseMode: string;
  symbols: { id: number; name: string; kind: string | null; line: number | null; precision: string }[];
  evidence: { id: number; start_line: number | null; end_line: number | null; origin: string; processing: string; freshness: string; note: string | null; stage: string }[];
  importsOut: { path: string; toId: number }[];
  importsIn: { path: string; fromId: number }[];
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function highlight(line: string) {
  return esc(line).replace(
    /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|import|export|default|async|await|if|else|try|catch|finally|new|class|from|interface|type|CREATE|TABLE|PRIMARY|KEY|NOT|NULL|DEFAULT|INTEGER|TEXT)\b|\b(\d+)\b/g,
    (m, c, st, kw, num) => {
      if (c) return `<span style="color:#6A7FA8">${m}</span>`;
      if (st) return `<span style="color:#7ED09A">${m}</span>`;
      if (kw) return `<span style="color:#C792EA">${m}</span>`;
      if (num) return `<span style="color:#E8B45A">${m}</span>`;
      return m;
    }
  );
}

export default function CodePage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState<FileData | null>(null);
  const [line, setLine] = useState(0);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<{ line: number; ev: FileData["evidence"][number] } | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathParam = search.get("path");
  const lineParam = Number(search.get("line")) || 0;

  // 文件清单
  useEffect(() => {
    fetch(`/api/projects/${id}/preview`)
      .then((r) => r.json())
      .then((d) => {
        const list = ((d.files ?? []) as { path: string }[]).map((f) => f.path);
        setFiles(list);
      });
  }, [id]);

  const openFile = useCallback(
    async (p: string, l = 0, why = "") => {
      const res = await fetch(`/api/projects/${id}/file?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "读取失败");
        return;
      }
      setFile(data);
      setLine(l);
      setNote(why);
      if (l) setToast(`已定位 ${p}:${l}${why ? ` · ${why}` : ""}`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    },
    [id]
  );

  useEffect(() => {
    if (pathParam) void openFile(pathParam, lineParam, "来自链接定位");
    else if (files.length && !file) {
      const first = files.find((f) => /\.(ts|tsx|js|jsx|py|java|go)$/.test(f)) ?? files[0];
      if (first) void openFile(first);
    }
  }, [pathParam, lineParam, files, file, openFile]);

  useEffect(() => {
    if (line && areaRef.current) {
      const el = areaRef.current.querySelector(".cl.cur");
      el?.classList.add("pulse");
      el?.scrollIntoView({ block: "center" });
    }
  }, [line, file]);

  const tree = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const f of files.slice(0, 400)) {
      const d = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "·";
      (groups[d] = groups[d] || []).push(f);
    }
    return groups;
  }, [files]);

  const evByLine = useMemo(() => {
    const m: Record<number, FileData["evidence"][number]> = {};
    for (const e of file?.evidence ?? []) if (e.start_line) m[e.start_line] = e;
    return m;
  }, [file]);

  const lines = file?.content.split("\n") ?? [];

  return (
    <div>
      <div className="toolrow">
        <h1 className="t" style={{ fontSize: 20 }}>代码库</h1>
        <span className="badge b-src">只读</span>
        <span className="mut" style={{ fontSize: 12 }}>修改只发生在挑战隔离区（Auth-L5）——这里负责"看懂"和"定位"。</span>
      </div>

      <div className="codel">
        <div className="card ctree">
          <div className="hd"><span className="file-no">FILES</span><b>共 {files.length} 文件</b></div>
          <div className="bd" style={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
            {Object.keys(tree).sort().map((dir) => (
              <div key={dir}>
                {dir !== "·" && <div className="crow cdir"><span className="ic">▾</span>{dir}/</div>}
                {tree[dir].map((f) => {
                  const name = dir === "·" ? f : f.slice(dir.length + 1);
                  return (
                    <div key={f} className={`crow${file?.path === f ? " on" : ""}`} style={dir !== "·" ? { paddingLeft: 26 } : {}} onClick={() => { setLine(0); void openFile(f); }}>
                      <span className="ic">{f.endsWith(".sql") ? "🗄" : f.endsWith(".json") ? "📦" : f.endsWith(".md") ? "📄" : "📜"}</span>
                      {name}
                    </div>
                  );
                })}
              </div>
            ))}
            {files.length === 0 && <p className="mut" style={{ fontSize: 12, padding: 10 }}>尚无文件</p>}
          </div>
        </div>

        <div className="card" style={{ overflow: "hidden", position: "relative" }}>
          {toast && <div className="ctoast" style={{ display: "block" }}><span className="dot" />{toast}</div>}
          <div className="codebar">
            <span className="mono">{file?.path ?? "未选择文件"}</span>
            {line > 0 && <span className="mono" style={{ color: "var(--evidence-amber)" }}>· 第 {line} 行</span>}
            <span className="badge b-infer" style={{ marginLeft: "auto" }}>{file?.parseMode ?? "—"}</span>
            <button className="btn sm ghost" type="button" style={{ color: "#B9C6DC", borderColor: "#31446B" }} onClick={() => router.push(`/project/${id}/challenge`)}>
              在挑战中修改
            </button>
          </div>
          <div className="ccode" ref={areaRef}>
            {lines.map((l, i) => {
              const ln = i + 1;
              const ev = evByLine[ln];
              return (
                <div
                  key={ln}
                  className={`cl${ev ? " ev" : ""}${ln === line ? " cur" : ""}`}
                  title={ev ? `证据：${ev.note ?? ev.origin}（点击查看）` : undefined}
                  onClick={() => ev && setModal({ line: ln, ev })}
                >
                  <span className="ln">{ln}</span>
                  <span>{ev ? "● " : ""}<span dangerouslySetInnerHTML={{ __html: highlight(l) }} /></span>
                </div>
              );
            })}
            {!file && <p className="mut" style={{ padding: 20 }}>选择左侧文件开始阅读</p>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
          <div className="card">
            <div className="hd"><span className="file-no">SYM</span><b>符号大纲</b></div>
            <div className="bd outl">
              {(file?.symbols ?? []).length === 0 && <p className="mut" style={{ fontSize: 12, padding: "4px 10px" }}>该文件无已识别符号</p>}
              {(file?.symbols ?? []).map((s) => (
                <div key={s.id} className="orow" onClick={() => s.line && void openFile(file!.path, s.line, "来自符号大纲")}>
                  <span><span className="k">{s.kind ?? "sym"}</span> {s.name}</span>
                  <span className="mut mono" style={{ fontSize: 10 }}>:{s.line ?? "?"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="hd"><span className="file-no">REF</span><b>静态引用</b></div>
            <div className="bd outl" style={{ fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, margin: "4px 0" }}>它 import 谁</div>
              {(file?.importsOut ?? []).map((x) => (
                <div key={x.toId} className="cr" onClick={() => void openFile(x.path, 0, "来自 import 引用图")}>
                  <div className="pth">↘ {x.path}</div>
                </div>
              ))}
              {(file?.importsOut ?? []).length === 0 && <div className="mut" style={{ fontSize: 11.5 }}>无（或未解析到）</div>}
              <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>谁 import 它</div>
              {(file?.importsIn ?? []).map((x) => (
                <div key={x.fromId} className="cr" onClick={() => void openFile(x.path, 0, "来自 import 引用图")}>
                  <div className="pth">↖ {x.path}</div>
                </div>
              ))}
              {(file?.importsIn ?? []).length === 0 && <div className="mut" style={{ fontSize: 11.5 }}>无（入口文件或未解析到）</div>}
              <div className="mut" style={{ fontSize: 10.5, marginTop: 8 }}>来自整库静态引用图（L2）· 静态关系 ≠ 运行时一定执行</div>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="mask on" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <h3>
              <span className="file-no">EVIDENCE</span>证据 · {file?.path}:{modal.line}
              <span className="x" onClick={() => setModal(null)}>✕</span>
            </h3>
            <div style={{ margin: "8px 0" }}>
              <span className="badge b-src">{modal.ev.origin}</span>{" "}
              <span className="badge b-infer">processing：{modal.ev.processing}</span>{" "}
              <span className={`badge ${modal.ev.freshness === "current" ? "b-none" : "b-stale"}`}>freshness：{modal.ev.freshness}</span>{" "}
              <span className="badge b-none">stage：{modal.ev.stage}</span>
            </div>
            <div className="term-body">{modal.ev.note ?? "（无说明）"}</div>
            <div className="notice">
              <span>证据存在 ≠ 足以证明整条流程；断言范围以证据行为限。</span>
              <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>返回原位置</button>
            </div>
          </div>
        </div>
      )}
      {note && <span style={{ display: "none" }}>{note}</span>}
    </div>
  );
}
