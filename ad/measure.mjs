import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
await p.goto("http://localhost:3200/ad/film.html?fmt=square"); await p.evaluate(() => window.READY);
const probe = async (t, sel, textOnly) => { await p.evaluate(t => window.seek(t), t);
  return p.evaluate(([sel]) => { const e = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(e); const q = r.getBoundingClientRect(); return [q.x, q.y, q.width, q.height].map(Math.round); }, [sel]); };
const out = {
  hook1: await probe(1.0, "#h1"), hook2: await probe(1.0, "#h2"), url1: await probe(1.5, "#h3"),
  source: await probe(7.0, "#s-source .slam"), get: await probe(13.5, "#s-call .mono"),
  conv: await probe(27.0, "#convval"), cta2: await probe(29.5, "#c3"),
};
console.log(JSON.stringify(out)); await b.close();
