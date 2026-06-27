import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "资源池管理平台",
  description: "动态资源池、资源关系和查询管理系统",
  icons: {
    icon: "/api/site-icon",
    shortcut: "/api/site-icon",
    apple: "/api/site-icon"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
