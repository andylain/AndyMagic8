#!/usr/bin/env node
/* 產生 1200x630 的社群分享預覽圖 og.png。
 *
 *   npm i playwright-core     （只有這支工具需要，不是 App 的相依）
 *   node make-og.js
 *
 * 圖片是用 App 真正的 styles.css 渲染出來的，所以背景與球體永遠跟本體一致。
 * 模式數量從 modes.js 讀取，不寫死 —— 新增模式後重跑這支就會更新。
 * check.js 會在 modes.js 比 og.png 新的時候提醒你。 */

const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = __dirname;

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "modes.js"), "utf8") +
                "\n;globalThis.__e = { MODES };", sandbox);
const MODE_COUNT = sandbox.__e.MODES.length;

const PAGE = `<meta charset="utf-8">
<link rel="stylesheet" href="/styles.css">
<style>
  html,body{width:1200px;height:630px;overflow:hidden;margin:0}
  body{display:block;padding:0;gap:0}
  .smoke span{animation-play-state:paused!important}
  .stage{position:relative;z-index:1;width:1200px;height:630px}
  .ball{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:352px!important;margin:0}
  .answer{font-size:19px!important}
  .brand{position:absolute;top:44px;left:0;right:0;text-align:center}
  .brand h1{font-size:46px;margin:0;letter-spacing:.06em;text-shadow:0 2px 12px rgba(0,0,0,.7)}
  .brand p{margin:12px 0 0;font-size:21px;opacity:.9;letter-spacing:.04em;text-shadow:0 2px 10px rgba(0,0,0,.75)}
  .card{position:absolute;padding:13px 20px;border-radius:16px;background:rgba(16,20,36,.72);
        border:1px solid rgba(255,255,255,.13);box-shadow:0 10px 28px rgba(0,0,0,.45);
        font-size:22px;font-weight:700;line-height:1.25;white-space:nowrap}
  .card small{display:block;font-size:14px;font-weight:400;opacity:.62;margin-top:3px;color:#e8eaf2}
  .foot{position:absolute;bottom:30px;left:0;right:0;text-align:center;font-size:16px;
        opacity:.72;letter-spacing:.05em;text-shadow:0 2px 8px rgba(0,0,0,.7)}
</style>
<div class="smoke"><span></span><span></span><span></span><span></span><span></span><span></span></div>
<div class="stage">
  <div class="brand">
    <h1>🎱 神奇八號球</h1>
    <p>猶豫不決的時候，就交給命運吧</p>
  </div>
  <div class="card" style="left:64px;  top:186px; color:#fbbf24">滷肉飯<small>今天吃什麼 · 小吃</small></div>
  <div class="card" style="left:38px;  top:330px; color:#86efac">珍珠奶茶<small>喝什麼飲料 · 茶飲</small></div>
  <div class="card" style="left:104px; top:466px; color:#fca5a5">東京成田<small>去哪裡玩 · NRT 日本</small></div>
  <div class="card" style="right:70px; top:186px; color:#4ade80">大吉<small>今日運勢 · 諸事順遂</small></div>
  <div class="card" style="right:40px; top:330px; color:#f0abfc">學一種動物叫<small>抽個懲罰 · 表演</small></div>
  <div class="card" style="right:96px; top:466px; color:#fcd34d">$350<small>這餐預算 · 加權隨機</small></div>
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
  <div class="foot">${MODE_COUNT} 種抽籤模式 · 免安裝 · 可離線 &nbsp;|&nbsp; by 安迪連</div>
</div>`;

const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
               ".js":"text/javascript; charset=utf-8", ".png":"image/png" };
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
  await p.screenshot({ path: path.join(ROOT, "og.png") });
  await b.close();
  server.close();
  const kb = (fs.statSync(path.join(ROOT, "og.png")).size / 1024).toFixed(0);
  console.log(`og.png 已產生 1200x630、${kb} KB、標示 ${MODE_COUNT} 種模式`);
});
