"use client";

import { useCallback, useEffect, useState } from "react";

type BrowseResult = {
  current: string;
  parent: string | null;
  dirs: { name: string; path: string }[];
  files: { name: string; size: number }[];
  error?: string;
};

/** 服务端目录浏览器弹窗：点选文件夹填入路径（Auth-L0 只读列目录，不读文件内容） */
export default function FolderBrowser({
  open,
  mode,
  onClose,
  onPick,
}: {
  open: boolean;
  mode: "path" | "zip";
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [dirs, setDirs] = useState<{ name: string; path: string }[]>([]);
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const browse = useCallback(async (p: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "浏览失败");
        return;
      }
      setCurrent(data.current);
      setDirs(data.dirs ?? []);
      setFiles(data.files ?? []);
      setParent(data.parent);
    } catch {
      setErr("浏览失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) browse("");
  }, [open, browse]);

  if (!open) return null;

  return (
    <div className="mask on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <h3>
          <span className="file-no">{mode === "zip" ? "选择 zip 文件" : "选择项目目录"}</span>
          <span className="x" onClick={onClose}>✕</span>
        </h3>
        <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "6px 0 4px" }} className="mono">
          {current || "（此电脑）"}
        </div>
        {parent && (
          <div className="crow" onClick={() => browse(parent)}>
            <span className="ic">↰</span> 上级目录
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto", maxHeight: "45vh", border: "1px solid var(--grid)", borderRadius: 6, marginTop: 8 }}>
          {loading ? (
            <p className="mut" style={{ padding: 20, textAlign: "center", fontSize: 12 }}>加载中…</p>
          ) : err ? (
            <p style={{ padding: 20, fontSize: 12, color: "var(--mark-red)" }}>{err}</p>
          ) : (
            <>
              {dirs.map((d) => (
                <div key={d.path} className="crow" onClick={() => browse(d.path)}>
                  <span className="ic">📁</span>
                  {d.name}
                </div>
              ))}
              {mode === "zip" &&
                files
                  .filter((f) => f.name.endsWith(".zip"))
                  .map((f) => (
                    <div key={f.name} className="crow" style={{ color: "var(--pass-green)" }} onClick={() => { onPick(`${current}\\${f.name}`); onClose(); }}>
                      <span className="ic">📦</span>
                      {f.name}
                      <span className="mut" style={{ marginLeft: "auto", fontSize: 10 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  ))}
              {dirs.length === 0 && (mode === "zip" ? files.filter((f) => f.name.endsWith(".zip")).length === 0 : true) && (
                <p className="mut" style={{ padding: 12, textAlign: "center", fontSize: 12 }}>
                  {mode === "zip" ? "此目录没有 zip 文件" : "没有子目录"}
                </p>
              )}
            </>
          )}
        </div>
        {mode === "path" && current && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--grid)" }}>
            <button
              className="btn"
              type="button"
              onClick={() => { onPick(current); onClose(); }}
            >
              ✓ 选择此目录：{current}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
