import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAY Fitness",
  description: "簡潔、安心的私人教練課程管理",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="shell">
          {children}
        </div>
      </body>
    </html>
  );
}
