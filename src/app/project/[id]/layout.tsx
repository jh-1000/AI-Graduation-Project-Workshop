import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AskPanel from "./AskPanel";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: number;
  name: string;
  slug: string;
  source_type: string;
  root_path: string;
};

/**
 * 项目作用域布局：所有功能页挂在 /project/[id]/ 下，侧栏随之切换。
 * 路由重构动因：原实现把功能页放在顶层并硬编码 project 44，破坏多项目与便携。
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getDb()
    .prepare("SELECT id, name, slug, source_type, root_path FROM projects WHERE id = ?")
    .get(Number(id)) as ProjectRow | undefined;
  if (!project) notFound();

  const base = `/project/${project.id}`;
  const items = [
    { no: "00", label: "从这里开始", href: "/" },
    { no: "01", label: "项目总览", href: base },
    { no: "02", label: "Scan 清单", href: `${base}/scan` },
    { no: "03", label: "代码库", href: `${base}/code` },
    { no: "04", label: "AI 分析现场", href: `${base}/map` },
    { no: "05", label: "知识图谱", href: `${base}/graph` },
    { no: "06", label: "业务流程线", href: `${base}/flow` },
    { no: "07", label: "知识库体系", href: `${base}/kb` },
    { no: "08", label: "知识点", href: `${base}/node` },
    { no: "09", label: "答辩模拟", href: `${base}/defend` },
    { no: "10", label: "实战挑战", href: `${base}/challenge` },
    { no: "11", label: "能力雷达", href: `${base}/radar` },
    { no: "12", label: "变更影响", href: `${base}/impact` },
    { no: "13", label: "体检与演进", href: `${base}/insights` },
    { no: "14", label: "设置与授权", href: "/settings" },
  ];

  return (
    <AppShell
      title={project.name}
      subtitle={`${project.slug} · ${project.source_type === "zip" ? "zip 包（便携）" : "本地路径"}`}
      items={items}
      foot={
        <>
          项目 <b>#{project.id}</b> · 便携模式
          <br />
          证据优先 · AI 不产生事实
        </>
      }
    >
      {children}
      <AskPanel projectId={String(project.id)} />
    </AppShell>
  );
}
