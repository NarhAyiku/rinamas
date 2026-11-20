// Renders print/src/designs.html to print-ready PDFs (vector, true size) and PNG previews in print/.
// Usage: node print/src/render.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..");
const src = "file://" + path.join(here, "designs.html");
const DESIGNS = [
  { id: "banner", file: "rinamas-banner-3000x1000mm", w: 3000, h: 1000, previewPx: 2400 },
  { id: "sticker-wide", file: "rinamas-sticker-600x200mm", w: 606, h: 206, previewPx: 1800 },
  { id: "sticker-square", file: "rinamas-sticker-300x300mm", w: 306, h: 306, previewPx: 1200 },
];

const browser = await chromium.launch({ channel: "chrome" });
for (const d of DESIGNS) {
  const page = await browser.newPage();
  await page.goto(`${src}#${d.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => window.ready);
  await page.addStyleTag({ content: `@page { size: ${d.w}mm ${d.h}mm; margin: 0 }` });
  await page.pdf({ path: path.join(out, `${d.file}.pdf`), width: `${d.w}mm`, height: `${d.h}mm`, printBackground: true, preferCSSPageSize: true });
  await page.close();
  // preview PNG made from the PDF itself (macOS sips), so the preview is exactly what gets printed
  const png = path.join(out, `${d.file}-preview.png`);
  execFileSync("sips", ["-s", "format", "png", "-Z", String(d.previewPx), path.join(out, `${d.file}.pdf`), "--out", png], { stdio: "ignore" });
  console.log("rendered", d.file);
}
await browser.close();
