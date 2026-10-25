import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "软件项目分析学习系统",
  description: "AI 辅助开发者的项目理解与能力训练系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-800">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-semibold tracking-wide">
              项目分析学习系统
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/" className="hover:text-slate-900">
                项目
              </Link>
              <Link href="/settings" className="hover:text-slate-900">
                设置
              </Link>
            </nav>
            <span className="ml-auto text-xs text-slate-400">证据优先 · 主动回忆 · 隔离实战</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
