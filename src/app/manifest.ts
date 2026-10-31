import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JUZ969 fitness",
    short_name: "JUZ969 fitness",
    description: "簡潔、安心的私人教練課程管理",
    lang: "zh-Hant",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d7292c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
