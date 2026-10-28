import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "软件项目分析学习系统",
  description: "AI 辅助开发者的项目理解与能力训练系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
