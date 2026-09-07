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

/* 順手把這一版的模式 id 記進 published-ids.json。
 * 分享連結會把 id 帶在網址的 # 後面，一旦上線就不能消失 ——
 * 「發版」正好是「這些 id 已經公開」的時間點，所以記錄放在這裡。
 * 只增不減：check.js 會拿這份清單確認每個 id 都還解得開。 */
const vm = require("vm");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, "modes.js"), "utf8") + "\n;globalThis.__ids = MODES.map(m => m.id);",
  sandbox
);
const regPath = path.join(ROOT, "published-ids.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
const before = reg.ids.length;
reg.ids = [...new Set([...reg.ids, ...sandbox.__ids])].sort();
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
const added = reg.ids.length - before;
console.log(added ? `published-ids.json 新增 ${added} 個 id` : "published-ids.json 沒有新的 id");
