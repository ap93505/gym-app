import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JUZ969fitness",
  description: "簡潔、安心的私人教練課程管理",
  icons: {
    icon: { url: "/favo.ico", sizes: "16x16 32x32 48x48 256x256", type: "image/x-icon" },
    shortcut: "/favo.ico",
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.webmanifest",
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
