"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Preview = {
  stack: { languages?: string[]; frameworks?: string[] };
  stats: Record<string, number>;
  endpoints: { method: string; path: string; file: string; line: number }[];
  routes: { path: string; file: string; kind: string }[];
  files: { path: string; loc: number; parse_mode: string }[];
};

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Preview | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/preview`);
    if (res.ok) setP(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!p) return <p className="sub">加载中…</p>;

  return (
    <div>
      <div className="toolrow">
        <div className="crumb" style={{ margin: 0 }}>SCAN / 初步清单 / 零 LLM 成本</div>
        <span className="badge b-infer">初步清单 · 不代表完整分析</span>
      </div>
      <h1 className="t">Scan 清单</h1>
      <p className="sub">导入完成即可边看边学，不用等 AI。确认方向无误后，再去「AI 分析现场」启动深度拆解。</p>

      <div className="grid3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="hd"><span className="file-no">SC-01</span><b>技术栈</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            {[...(p.stack.languages ?? []), ...(p.stack.frameworks ?? [])].map((t) => (
              <span key={t} className="badge b-src" style={{ marginRight: 6 }}>{t}</span>
            ))}
            {(p.stack.languages ?? []).length === 0 && <span className="mut">未识别到 manifest</span>}
            <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>版本取自 lockfile / manifest，不是猜测</div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">SC-02</span><b>解析方式（诚实口径）</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            {Object.entries(p.stats).map(([k, v]) => (
              <div className="st" key={k}><span>{k}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">SC-03</span><b>下一步</b></div>
          <div className="bd" style={{ fontSize: 12.5 }}>
            <Link className="btn" href={`/project/${id}/map`}>启动 AI 深度分析 →</Link>
            <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>任务后台运行 · 断点续跑 · 预算可控</div>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">SC-04</span><b>API 端点（{p.endpoints.length}）</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            {p.endpoints.slice(0, 40).map((e, i) => (
              <div key={i} className="mono">
                <span className="badge b-src">{e.method}</span> {e.path}
                <Link href={`/project/${id}/code?path=${encodeURIComponent(e.file)}&line=${e.line}`} className="mut" style={{ fontSize: 11 }}>
                  {" "}{e.file}:{e.line}
                </Link>
              </div>
            ))}
            {p.endpoints.length === 0 && <span className="mut">未抽取到端点（可能不是 HTTP 服务项目）</span>}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">SC-05</span><b>前端路由（{p.routes.length}）</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            {p.routes.slice(0, 40).map((r, i) => (
              <div key={i} className="mono">
                {r.path} <span className="mut" style={{ fontSize: 11 }}>{r.kind} · {r.file}</span>
              </div>
            ))}
            {p.routes.length === 0 && <span className="mut">未抽取到前端路由</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">SC-06</span><b>文件清单（前 {Math.min(p.files.length, 120)} / 共 {p.files.length}）</b></div>
        <div className="bd">
          {p.files.slice(0, 120).map((f) => (
            <div key={f.path} style={{ display: "flex", gap: 10, fontSize: 12, padding: "3px 0" }}>
              <Link href={`/project/${id}/code?path=${encodeURIComponent(f.path)}`} className="mono" style={{ flex: 1 }}>
                {f.path}
              </Link>
              <span className="mut">{f.loc} 行</span>
              <span className={`badge ${f.parse_mode === "parsed" ? "b-src" : "b-none"}`}>{f.parse_mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
