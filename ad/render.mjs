// Render the film frame by frame: node render.mjs <square|vertical> [out.mp4] [--stills t1,t2,...] [--fps-scale 0.5]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const fmt = process.argv[2] || "square";
const args = process.argv.slice(3);
const stillsArg = args.indexOf("--stills");
const stills = stillsArg >= 0 ? args[stillsArg + 1].split(",").map(Number) : null;
const out = args.find(a => a.endsWith(".mp4")) || `out/${fmt}-silent.mp4`;
const H = fmt === "vertical" ? 1920 : 1080;
mkdirSync("out", { recursive: true }); mkdirSync("stills", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:3200/ad/film.html?fmt=${fmt}`);
await page.evaluate(() => window.READY);
const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.DUR, FPS: window.FPS }));

if (stills) {
  for (const t of stills) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: `stills/${fmt}-${t.toFixed(2)}.png` });
  }
  console.log("stills", stills.length);
} else {
  const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(DUR * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`${fmt}: frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  console.log("wrote", out);
}
await browser.close();
