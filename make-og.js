#!/usr/bin/env node
/* 產生 1200x630 的社群分享預覽圖 og.png。
 *
 *   npm i playwright-core     （只有這支工具需要，不是 App 的相依）
 *   node make-og.js
 *
 * 圖片是用 App 真正的 styles.css 渲染出來的，所以背景與球體永遠跟本體一致。
 * 標題字型是 og-font.woff2 —— Noto Sans TC（SIL Open Font License）只含這張圖用到的
 * 38 個字的子集，12KB。自己帶著走，所以出圖不需要連網、每次結果都一樣。
 * 字型沒載到會直接中止，不會默默用替代字型出圖。 */

const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname;

const FONT = '"Noto Sans TC", sans-serif';
const PAGE = `<meta charset="utf-8">
<link rel="stylesheet" href="/styles.css">
<style>
  @font-face {
    font-family: "Noto Sans TC";
    src: url("/og-font.woff2") format("woff2");
    font-weight: 100 900;
    font-display: block;
  }
  html,body{width:1200px;height:630px;overflow:hidden;margin:0}
  body{display:block;padding:0;gap:0}
  .smoke span{animation-play-state:paused!important}
  .stage{position:relative;z-index:1;width:1200px;height:630px;font-family:${FONT};
         display:flex;align-items:center;justify-content:center;gap:76px;padding:0 70px}
  .ball{width:372px!important;flex:none;margin:0}
  .answer{font-size:20px!important}
  .txt{max-width:430px}
  h1{margin:0;font-family:${FONT};font-weight:700;font-size:62px;letter-spacing:.06em;
     line-height:1.15;text-shadow:0 3px 16px rgba(0,0,0,.75)}
  p{margin:22px 0 0;font-family:${FONT};font-weight:400;font-size:25px;opacity:.84;
    letter-spacing:.05em;text-shadow:0 2px 12px rgba(0,0,0,.8)}
</style>
<div class="smoke"><span></span><span></span><span></span><span></span><span></span><span></span></div>
<div class="stage">
  <div class="txt">
    <h1>神奇八號球</h1>
    <p>猶豫不決的時候，就交給命運吧</p>
  </div>
  <div class="ball">
    <div class="window">
      <div class="tri-clip"><div class="triangle"></div></div>
      <div class="answer" data-mode="oracle">
        <span class="primary">Signs point to yes</span>
        <span class="secondary">種種跡象指出「是的」</span>
      </div>
      <div class="glass"></div>
    </div>
  </div>
</div>`;

const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
               ".js":"text/javascript; charset=utf-8", ".png":"image/png",
               ".woff2":"font/woff2" };
const server = http.createServer((q, r) => {
  const f = decodeURIComponent(q.url.split("?")[0]);
  if (f === "/og-source.html") { r.writeHead(200, {"Content-Type":"text/html; charset=utf-8"}); return r.end(PAGE); }
  const p = path.join(ROOT, f === "/" ? "/index.html" : f);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "" });
  fs.createReadStream(p).pipe(r);
});

server.listen(0, "127.0.0.1", async () => {
  let chromium;
  try { ({ chromium } = require("playwright-core")); }
  catch (e) { console.error("需要 playwright-core：npm i playwright-core"); process.exit(1); }
  const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const base = `http://127.0.0.1:${server.address().port}/`;
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(base + "og-source.html");
  // 固定的動畫時間點，重跑才會得到一樣的圖
  await p.evaluate(() => document.querySelectorAll(".smoke span")
    .forEach((s, i) => { s.style.animationDelay = `-${[6, 3, 11, 5, 8, 2][i]}s`; }));
  await p.waitForTimeout(400);

  // 字型沒載到就直接中止 —— 默默用替代字型出圖比失敗更糟。
  // 注意：不能用文字寬度來判斷字型有沒有生效，中文在任何字型裡都是全形等寬，
  // 量起來都一樣。改看 FontFace 的實際載入狀態。
  const font = await p.evaluate(async () => {
    await document.fonts.ready;
    const face = [...document.fonts].find(f => f.family === "Noto Sans TC");
    return {
      status: face ? face.status : "找不到 @font-face",
      weights: face ? face.weight : null,
      usable: document.fonts.check('700 62px "Noto Sans TC"'),
    };
  });
  if (font.status !== "loaded" || !font.usable) {
    console.error(`Noto Sans TC 沒有載入（狀態 ${font.status}），中止出圖以免用到替代字型`);
    await b.close(); server.close();
    process.exit(1);
  }
  console.log(`Noto Sans TC 已載入（字重範圍 ${font.weights}）`);

  await p.screenshot({ path: path.join(ROOT, "og.png") });
  await b.close();
  server.close();
  const kb = (fs.statSync(path.join(ROOT, "og.png")).size / 1024).toFixed(0);
  console.log(`og.png 已產生 1200x630、${kb} KB`);
});
