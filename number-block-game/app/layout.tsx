import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数字消除方块",
  description: "数字消除+俄罗斯方块融合游戏",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
