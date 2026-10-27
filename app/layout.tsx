import type { Metadata } from "next";
import "./globals.css";
import { SITE_BASE } from "../lib/paths";

export const metadata: Metadata = {
  title: "Courtside · 2026–27 NBA 赛程与观赛日记",
  description: "每日 NBA 比分、赛程、数据统计与个人观赛日记。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${SITE_BASE}/favicon.svg`,
    shortcut: `${SITE_BASE}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
