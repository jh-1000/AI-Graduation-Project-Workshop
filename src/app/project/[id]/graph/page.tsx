"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type GNode = { id: string; label: string; type: string; weight: number; status: string; href: string; meta: string; stale?: boolean };
type GEdge = { from: string; to: string; kind: string };
type GData = { project: { id: number; name: string }; nodes: GNode[]; edges: GEdge[]; mastery: Record<string, { status: string; due: string }> };

const TYPE_META: Record<string, { c: string; label: string }> = {
  k_module: { c: "#1B2A4A", label: "模块" },
  k_flow: { c: "#C43D3D", label: "业务功能" },
  k_concept: { c: "#3D4FA1", label: "核心概念" },
  k_api: { c: "#B7791F", label: "执行机制" },
  k_data: { c: "#7C5BA6", label: "数据" },
  flow: { c: "#C43D3D", label: "业务流程" },
  term: { c: "#5B6B85", label: "术语" },
  file: { c: "#98A7C0", label: "文件" },
};
const STS: Record<string, { cls: string; label: string }> = {
  mastered: { cls: "b-run", label: "已验证掌握" },
  learning: { cls: "b-infer", label: "练习中" },
  new: { cls: "b-none", label: "未学习" },
  none: { cls: "b-none", label: "未学习" },
};

type PNode = GNode & { x: number; y: number; z: number; vx: number; vy: number; vz: number };

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef<{ nodes: PNode[]; edges: { a: PNode; b: PNode; kind: string }[]; byId: Map<string, PNode> } | null>(null);
  const viewRef = useRef({ mode: "3d" as "2d" | "3d", yaw: 0.5, pitch: -0.2, zoom: 1, panX: 0, panY: 0, spin: false });
  const uiRef = useRef({ drag: false, moved: 0, lx: 0, ly: 0, hover: null as PNode | null, sel: null as PNode | null });
  const filterRef = useRef<Set<string>>(new Set(Object.keys(TYPE_META)));
  const searchRef = useRef("");
  const impactRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [data, setData] = useState<GData | null>(null);
  const [sel, setSel] = useState<GNode | null>(null);
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  const [spin, setSpin] = useState(false);
  const [impactView, setImpactView] = useState(false);
  const [filters, setFilters] = useState<Set<string>>(new Set(Object.keys(TYPE_META)));
  const [q, setQ] = useState("");
  const [count, setCount] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/graph`);
    if (res.ok) setData(await res.json());
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    filterRef.current = filters;
    searchRef.current = q;
  }, [filters, q]);
  useEffect(() => {
    impactRef.current = impactView;
  }, [impactView]);
  useEffect(() => {
    viewRef.current.mode = mode;
  }, [mode]);
  useEffect(() => {
    viewRef.current.spin = spin;
  }, [spin]);

  // 构建模拟数据
  useEffect(() => {
    if (!data) return;
    const nodes: PNode[] = data.nodes.map((n) => ({
      ...n,
      x: (Math.random() - 0.5) * 320,
      y: (Math.random() - 0.5) * 320,
      z: (Math.random() - 0.5) * 320,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = data.edges
      .map((e) => ({ a: byId.get(e.from), b: byId.get(e.to), kind: e.kind }))
      .filter((e): e is { a: PNode; b: PNode; kind: string } => Boolean(e.a && e.b));
    dataRef.current = { nodes, edges, byId };
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function start() {
    if (rafRef.current !== null) return;
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  function project(n: PNode, W: number, H: number) {
    const v = viewRef.current;
    if (v.mode === "2d") {
      return { sx: W / 2 + n.x * v.zoom + v.panX, sy: H / 2 + n.y * v.zoom + v.panY, s: v.zoom };
    }
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    const x1 = n.x * cy - n.z * sy;
    const z1 = n.x * sy + n.z * cy;
    const y1 = n.y * cp - z1 * sp;
    const z2 = n.y * sp + z1 * cp;
    const s = 500 / (700 / v.zoom + z2);
    return { sx: W / 2 + x1 * s + v.panX, sy: H / 2 + y1 * s + v.panY, s };
  }

  function draw() {
    const cv = canvasRef.current;
    const d = dataRef.current;
    if (!cv || !d) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width;
    const H = cv.height;
    const v = viewRef.current;
    const ui = uiRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#FBFCFE";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#EDF1F7";
    for (let x = 0; x < W; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (v.mode === "3d" && v.spin && !ui.drag && !ui.hover) v.yaw += 0.0016;

    // 力模拟
    const nodes = d.nodes;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = v.mode === "3d" ? a.z - b.z : 0;
        const d2 = dx * dx + dy * dy + dz * dz || 1;
        const dist = Math.sqrt(d2);
        const f = 2600 / d2;
        dx /= dist;
        dy /= dist;
        dz /= dist;
        a.vx += dx * f;
        a.vy += dy * f;
        if (v.mode === "3d") a.vz += dz * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
        if (v.mode === "3d") b.vz -= dz * f;
      }
    }
    for (const e of d.edges) {
      const rest = 80;
      const k = 0.015;
      let dx = e.b.x - e.a.x;
      let dy = e.b.y - e.a.y;
      let dz = e.b.z - e.a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = (dist - rest) * k;
      dx /= dist;
      dy /= dist;
      dz /= dist;
      e.a.vx += dx * f;
      e.a.vy += dy * f;
      if (v.mode === "3d") e.a.vz += dz * f;
      e.b.vx -= dx * f;
      e.b.vy -= dy * f;
      if (v.mode === "3d") e.b.vz -= dz * f;
    }
    for (const n of nodes) {
      n.vx -= n.x * 0.004;
      n.vy -= n.y * 0.004;
      if (v.mode === "3d") n.vz -= n.z * 0.004;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.vz *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;
    }

    const visible = nodes.filter((n) => {
      if (!filterRef.current.has(n.type)) return false;
      if (impactRef.current && n.stale !== true) {
        // 失效视图：只显示 stale 节点及其一跳邻居
        const hasStaleNeighbor = d.edges.some(
          (e) => (e.a.id === n.id && e.b.stale === true) || (e.b.id === n.id && e.a.stale === true)
        );
        if (!hasStaleNeighbor) return false;
      }
      return true;
    });
    const P = new Map<PNode, { sx: number; sy: number; s: number }>();
    for (const n of visible) P.set(n, project(n, W, H));

    for (const e of d.edges) {
      const pa = P.get(e.a);
      const pb = P.get(e.b);
      if (!pa || !pb) continue;
      const hot = ui.sel === e.a || ui.sel === e.b || ui.hover === e.a || ui.hover === e.b;
      ctx.strokeStyle = hot ? "rgba(196,61,61,.65)" : "rgba(27,42,74,.16)";
      ctx.lineWidth = hot ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }

    const order = [...visible].sort((a, b) => (v.mode === "3d" ? project(b, W, H).s - project(a, W, H).s : 0));
    const lower = searchRef.current.toLowerCase();
    for (const n of order) {
      const p = P.get(n);
      if (!p) continue;
      const meta = TYPE_META[n.type] ?? TYPE_META.file;
      const r = Math.max(3, n.weight * (v.mode === "3d" ? p.s / 1.1 : 0.9));
      const matched = Boolean(lower) && n.label.toLowerCase().includes(lower);
      ctx.globalAlpha = v.mode === "3d" ? Math.max(0.35, Math.min(1, (p.s - 0.45) / 0.6)) : 1;
      if (n === ui.sel) ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, 7);
      ctx.fillStyle = meta.c;
      if (matched || n === ui.hover || n === ui.sel) {
        ctx.shadowColor = "rgba(196,61,61,.9)";
        ctx.shadowBlur = 14;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      const m = dataRef.current;
      const st = (n.id.startsWith("k:") && data?.mastery[n.id]?.status) || n.status;
      if (n.stale) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 5, 0, 7);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "rgba(196,61,61,.85)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (st && st !== "none" && st !== "new") {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 3.5, 0, 7);
        ctx.strokeStyle = st === "mastered" ? "#2E7D4F" : "#B7791F";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const fs = n.weight >= 9 ? 11.5 : 10;
      ctx.font = `${n === ui.sel ? "bold " : ""}${fs}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(251,252,254,.92)";
      ctx.strokeText(n.label, p.sx, p.sy - r - 5);
      ctx.fillStyle = "#1B2A4A";
      ctx.fillText(n.label, p.sx, p.sy - r - 5);
      void m;
    }
    setCount(`显示 ${visible.length}/${nodes.length} 节点 · ${d.edges.length} 条边`);
  }

  function hit(mx: number, my: number): PNode | null {
    const cv = canvasRef.current;
    const d = dataRef.current;
    if (!cv || !d) return null;
    let best: PNode | null = null;
    let bd = 1e9;
    for (const n of d.nodes) {
      if (!filterRef.current.has(n.type)) continue;
      const p = project(n, cv.width, cv.height);
      const dd = Math.hypot(mx - p.sx, my - p.sy);
      if (dd < Math.max(8, n.weight * 1.2) + 4 && dd < bd) {
        bd = dd;
        best = n;
      }
    }
    return best;
  }

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const gsize = () => {
      if (cv.clientWidth > 0) {
        cv.width = cv.clientWidth;
        cv.height = cv.clientHeight;
      }
    };
    gsize();
    const onResize = () => gsize();
    window.addEventListener("resize", onResize);

    const pos = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
    };
    const down = (e: MouseEvent) => {
      const ui = uiRef.current;
      ui.drag = true;
      ui.moved = 0;
      const p = pos(e);
      ui.lx = p.x;
      ui.ly = p.y;
      cv.classList.add("dragging");
    };
    const move = (e: MouseEvent) => {
      const ui = uiRef.current;
      const v = viewRef.current;
      const p = pos(e);
      if (ui.drag) {
        const dx = p.x - ui.lx;
        const dy = p.y - ui.ly;
        ui.moved += Math.abs(dx) + Math.abs(dy);
        if (ui.moved > 6) {
          if (v.mode === "3d") {
            v.yaw += dx * 0.008;
            v.pitch = Math.max(-1.3, Math.min(1.3, v.pitch + dy * 0.008));
          } else {
            v.panX += dx;
            v.panY += dy;
          }
          ui.lx = p.x;
          ui.ly = p.y;
        }
      } else {
        ui.hover = hit(p.x, p.y);
        cv.style.cursor = ui.hover ? "pointer" : "grab";
      }
    };
    const up = (e: MouseEvent) => {
      const ui = uiRef.current;
      cv.classList.remove("dragging");
      if (ui.drag && ui.moved <= 6) {
        const p = pos(e);
        const n = hit(p.x, p.y);
        ui.sel = n;
        setSel(n ? stripNode(n) : null);
      }
      ui.drag = false;
    };
    const dbl = (e: MouseEvent) => {
      const p = pos(e);
      const n = hit(p.x, p.y);
      if (n) router.push(n.href);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      v.zoom = Math.max(0.4, Math.min(3, v.zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
    };
    cv.addEventListener("mousedown", down);
    cv.addEventListener("mousemove", move);
    cv.addEventListener("mouseup", up);
    cv.addEventListener("dblclick", dbl);
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("resize", onResize);
      cv.removeEventListener("mousedown", down);
      cv.removeEventListener("mousemove", move);
      cv.removeEventListener("mouseup", up);
      cv.removeEventListener("dblclick", dbl);
      cv.removeEventListener("wheel", wheel);
    };
  }, [router]);

  function stripNode(n: PNode): GNode {
    const { x, y, z, vx, vy, vz, ...rest } = n;
    void x; void y; void z; void vx; void vy; void vz;
    return rest;
  }

  const types = Array.from(new Set((data?.nodes ?? []).map((n) => n.type)));

  return (
    <div>
      <div className="crumb">GRAPH / 知识图谱 / 八类节点 · 单击侧卡 · 双击直达 · 2D/3D 双视图</div>
      <h1 className="t">知识图谱</h1>
      <p className="sub">
        整个项目一眼看完：大小 = 重要度，颜色 = 节点类型，外环 = 掌握状态。单击看详情，双击直达内容，拖拽旋转（3D）/ 滚轮缩放。
      </p>

      <div className="gtools" style={{ marginTop: 14 }}>
        <div className="depth">
          <button type="button" className={mode === "2d" ? "on" : ""} onClick={() => setMode("2d")}>2D 力导向</button>
          <button type="button" className={mode === "3d" ? "on" : ""} onClick={() => setMode("3d")}>3D 力导向</button>
        </div>
        <input placeholder="搜索节点：输入标题关键词…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="tchip" onClick={() => setSpin((s) => !s)} style={spin ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : {}}>
          ⟳ 自动旋转：{spin ? "开" : "关"}
        </span>
        <span className="tchip" onClick={() => setImpactView((v) => !v)} style={impactView ? { background: "var(--mark-red)", color: "#fff", borderColor: "var(--mark-red)" } : {}}>
          失效视图：{impactView ? "开" : "关"}
        </span>
        <span className="mut" style={{ fontSize: 11 }}>{count}</span>
      </div>

      <div className="gtools">
        {types.map((t) => {
          const on = filters.has(t);
          const meta = TYPE_META[t] ?? TYPE_META.file;
          return (
            <span
              key={t}
              className={`tchip${on ? " on" : ""}`}
              style={on ? { background: meta.c } : {}}
              onClick={() =>
                setFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                })
              }
            >
              {meta.label}
            </span>
          );
        })}
      </div>

      <div className="gwrap">
        <div className="gcanvas-box">
          <canvas id="gcanvas" ref={canvasRef} />
        </div>
        <div>
          {sel ? (
            <div className="card">
              <div className="hd">
                <span className="file-no" style={{ color: (TYPE_META[sel.type] ?? TYPE_META.file).c }}>
                  {(TYPE_META[sel.type] ?? TYPE_META.file).label}
                </span>
                <b>{sel.label}</b>
              </div>
              <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
                <span className={`badge ${STS[data?.mastery[sel.id]?.status ?? sel.status]?.cls ?? "b-none"}`}>
                  {STS[data?.mastery[sel.id]?.status ?? sel.status]?.label ?? "未学习"}
                </span>
                <div>重要度 {sel.weight}</div>
                <div className="mut" style={{ fontSize: 11.5 }}>{sel.meta}</div>
                <div className="toolrow" style={{ marginBottom: 0 }}>
                  <a className="btn sm" href={sel.href}>进入内容 →</a>
                  <a className="btn sm ghost" href={`/project/${id}/kb`}>在知识库中查看</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="hd"><span className="file-no">HINT</span><b>怎么用</b></div>
              <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
                单击节点看详情，双击直达对应页面。<br />
                拖拽旋转（3D）/ 平移（2D），滚轮缩放。<br />
                点上方类型 chips 过滤；搜索框实时高亮。
                <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
                  图为力导向实时模拟；规模大时建议先用类型过滤。
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glegend">
        {types.map((t) => (
          <span key={t}><i style={{ background: (TYPE_META[t] ?? TYPE_META.file).c }} />{(TYPE_META[t] ?? TYPE_META.file).label}</span>
        ))}
        <span><i style={{ border: "2px solid #2E7D4F", background: "#fff", width: 7, height: 7 }} />已验证掌握</span>
        <span><i style={{ border: "2px solid #B7791F", background: "#fff", width: 7, height: 7 }} />练习中</span>
      </div>
      {data && data.nodes.length === 0 && (
        <p className="sub">尚无图谱数据：先运行一次「完整分析（map）」，节点来自真实的分析产物。</p>
      )}
    </div>
  );
}
