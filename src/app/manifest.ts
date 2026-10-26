import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RINAMAS Equipment & Trading",
    short_name: "RINAMAS",
    description: "Heavy-duty machine hire in Ghana: excavators, low beds, backhoes, dozers, loaders and more, with operators and haulage.",
    start_url: "/",
    display: "standalone",
    background_color: "#23262A",
    theme_color: "#23262A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
