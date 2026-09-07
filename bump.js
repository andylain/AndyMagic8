#!/usr/bin/env node
/* 一次把資源版本號改到三個地方，不會漏。
 *
 *   node bump.js        下一號
 *   node bump.js 12     指定號碼
 *
 * 三處必須同步：index.html 的 ?v=、sw.js 的 ASSET_V 與 VERSION。
 * 不同步的話使用者會拿到新的 HTML 配舊的 CSS/JS —— 這個 bug 真的發生過。
 * check.js 會驗證同步狀態，所以忘了跑這支的話 CI 會擋下來。 */

const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const htmlPath = path.join(ROOT, "index.html");
const swPath = path.join(ROOT, "sw.js");
let html = fs.readFileSync(htmlPath, "utf8");
let sw = fs.readFileSync(swPath, "utf8");

const current = Number((sw.match(/const ASSET_V = "(\d+)"/) || [])[1]);
if (!Number.isInteger(current)) {
  console.error("sw.js 讀不到 ASSET_V");
  process.exit(1);
}

const arg = process.argv[2];
const next = arg === undefined ? current + 1 : Number(arg);
if (!Number.isInteger(next) || next < 1) {
  console.error(`版本號要是正整數，收到「${arg}」`);
  process.exit(1);
}
if (next === current) {
  console.log(`版本已經是 ${current}，沒有變動`);
  process.exit(0);
}

html = html.replace(/(\?v=)\d+/g, `$1${next}`);
sw = sw.replace(/const VERSION = "magic8-v\d+"/, `const VERSION = "magic8-v${next}"`)
       .replace(/const ASSET_V = "\d+"/, `const ASSET_V = "${next}"`);

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(swPath, sw);
console.log(`版本 ${current} → ${next}（index.html 的 ?v=、sw.js 的 ASSET_V 與 VERSION）`);
