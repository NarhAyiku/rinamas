import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: { default: "RINAMAS Equipment & Trading", template: "%s · RINAMAS" },
  description:
    "Heavy-duty machine hire in Ghana: low beds, excavators, backhoes, dozers, loaders, graders, rollers, tippers and cranes, with operators and haulage from our yard off the N1 Highway, Accra.",
  icons: { icon: "/brand/rinamas-badge.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RINAMAS" },
};

export const viewport: Viewport = { themeColor: "#23262A", width: "device-width", initialScale: 1, viewportFit: "cover" };

// Runs before paint: saved choice wins, otherwise the system setting.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}<SwRegister />
      </body>
    </html>
  );
}
