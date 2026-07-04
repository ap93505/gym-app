import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAY Fitness",
  description: "簡潔、安心的私人教練課程管理",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" data-theme="future" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const theme=localStorage.getItem("ray-theme");if(theme==="minimal"||theme==="future")document.documentElement.dataset.theme=theme}catch{}` }} />
      </head>
      <body>
        <div className="shell">
          {children}
        </div>
      </body>
    </html>
  );
}
