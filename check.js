#!/usr/bin/env node
/* 資料與版本一致性檢查。純 Node、零相依，CI 與本機都跑同一支。
 *
 *   node check.js
 *
 * 這裡的每一條規則都對應到開發過程中真的踩過的坑：清單重複項、
 * 未定義的 tone、撞色、過長而爆版的項目、資源版本號沒同步。 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = __dirname;
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---- 載入 modes.js（它宣告的是全域常數，用 vm 取出來） ----
const sandbox = {};
vm.createContext(sandbox);
// const 宣告不會掛到 sandbox 上，補一行把它們導出來
vm.runInContext(
  fs.readFileSync(path.join(ROOT, "modes.js"), "utf8") +
  "\n;globalThis.__exports = { MODES, TONES, GROUPS };",
  sandbox
);
const { MODES, TONES, GROUPS } = sandbox.__exports;

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/* 主字長度上限。單純數字元數是錯的模型：中文字寬約是英文的兩倍，
 * 所以改用「寬度單位」—— 一個中日韓字算 1，英數字約 0.58，小寫約 0.5。
 * 下面的上限是在 Chromium 上實測 320 / 390 / 1200px 三種寬度校準出來的，
 * 抓的是「排版會變醜」而不是「會溢出圓形視窗」，後者的容忍度其實寬得多
 * （md 塞 24 個中文字才會真的溢出，但那早就是四行了）。 */
const SIZES = { undefined: 16, md: 9, lg: 4, xl: 4 };

function widthUnits(str) {
  let w = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0);
    const wide = (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) ||
                 (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
                 (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
                 (c >= 0x1f300 && c <= 0x1faff);
    w += wide ? 1 : /[A-Z0-9$]/.test(ch) ? 0.58 : 0.5;
  }
  return w;
}

// ---- TONES ----
if (!TONES || typeof TONES !== "object") fail("TONES 不存在");
for (const [name, hex] of Object.entries(TONES || {})) {
  if (!HEX.test(hex)) fail(`TONES.${name} 不是合法色碼: ${hex}`);
}

// ---- MODES ----
if (!Array.isArray(MODES) || !MODES.length) fail("MODES 不是非空陣列");
const seenIds = new Set();

for (const m of MODES || []) {
  const at = `模式 ${m.id || "(缺 id)"}`;
  if (!m.id) fail(`${at}: 缺少 id`);
  if (seenIds.has(m.id)) fail(`${at}: id 重複`);
  seenIds.add(m.id);

  if (!GROUPS.includes(m.group)) fail(`${at}: group「${m.group}」不在 GROUPS 裡`);
  for (const k of ["icon", "label", "hint"]) {
    if (!m[k]) fail(`${at}: 缺少 ${k}`);
  }
  if (!m.initial || !m.initial.primary || !m.initial.secondary) {
    fail(`${at}: initial 需要 primary 與 secondary`);
  }
  if (m.size !== undefined && !["md", "lg", "xl"].includes(m.size)) {
    fail(`${at}: size「${m.size}」不合法`);
  }

  const hasItems = Array.isArray(m.items);
  const hasRoll = typeof m.roll === "function";
  if (hasItems === hasRoll) fail(`${at}: 必須有 items 或 roll，且只能有一個`);

  if (hasRoll) {
    if (!m.summary) warn(`${at}: 用 roll() 卻沒有 summary，總表會顯示制式說明`);
    if (m.noRepeat) fail(`${at}: roll() 模式不適用 noRepeat`);
    // 實際跑一遍，確認回傳形狀正確
    for (let i = 0; i < 200; i++) {
      const r = m.roll();
      if (!r || typeof r.primary !== "string" || typeof r.secondary !== "string") {
        fail(`${at}: roll() 回傳值不正確`);
        break;
      }
      if (r.tone && !TONES[r.tone]) { fail(`${at}: roll() 用了未定義的 tone「${r.tone}」`); break; }
      const cap = SIZES[m.size];
      if (widthUnits(r.primary) > cap) {
        fail(`${at}: roll() 產生過長的「${r.primary}」（${widthUnits(r.primary).toFixed(1)} > ${cap} 寬度單位）`);
        break;
      }
    }
    continue;
  }

  if (!m.items.length) fail(`${at}: items 是空的`);
  if (m.noRepeat && m.items.length <= 2) {
    warn(`${at}: 只有 ${m.items.length} 項卻開了 noRepeat，會被自動忽略`);
  }

  const seenPairs = new Set();   // 完全相同的一列才是重複
  const seenPrimary = new Set(); // 同名不同解說是合法的（例如運勢的「大吉」配不同籤詩）
  const cap = SIZES[m.size];
  const tonesUsed = new Map();

  for (let i = 0; i < m.items.length; i++) {
    const it = m.items[i];
    const where = `${at} 第 ${i + 1} 項`;
    if (it === undefined) { fail(`${where}: 是空的（多打逗號造成的陣列空洞？）`); continue; }
    if (!it.primary || !it.secondary) { fail(`${where}: 缺少 primary 或 secondary`); continue; }
    const pair = it.primary + "\u0000" + it.secondary;
    if (seenPairs.has(pair)) fail(`${at}: 完全重複的項目「${it.primary} / ${it.secondary}」`);
    seenPairs.add(pair);
    if (seenPrimary.has(it.primary) && m.id !== "fortune") {
      warn(`${at}: 「${it.primary}」出現多次（小字不同），確認是刻意的`);
    }
    seenPrimary.add(it.primary);

    const units = widthUnits(it.primary);
    if (units > cap) {
      fail(`${at}: 「${it.primary}」寬 ${units.toFixed(1)} 單位，超過 size=${m.size} 的上限 ${cap}`);
    }

    if (it.tone !== undefined) {
      if (!TONES[it.tone]) fail(`${where}: 未定義的 tone「${it.tone}」`);
      else tonesUsed.set(it.tone, TONES[it.tone]);
    }
    if (it.color !== undefined && !HEX.test(it.color)) fail(`${where}: color 不是合法色碼「${it.color}」`);
    if (it.weight !== undefined) {
      if (typeof it.weight !== "number" || !isFinite(it.weight) || it.weight <= 0) {
        fail(`${where}: weight 必須是正數`);
      }
    }
  }

  // 同一個模式裡兩個分類用到同一個顏色 → 使用者分不出來
  const byHex = new Map();
  for (const [name, hex] of tonesUsed) {
    if (byHex.has(hex)) fail(`${at}: tone「${byHex.get(hex)}」與「${name}」撞色 ${hex}`);
    byHex.set(hex, name);
  }
}

// ---- 資源版本號必須三處同步 ----
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

const htmlVers = [...html.matchAll(/(?:href|src)="[^"]+\?v=(\d+)"/g)].map(m => m[1]);
const assetV = (sw.match(/const ASSET_V = "(\d+)"/) || [])[1];
const swV = (sw.match(/const VERSION = "magic8-v(\d+)"/) || [])[1];

if (!htmlVers.length) fail("index.html 沒有任何帶 ?v= 的資源");
if (new Set(htmlVers).size > 1) fail(`index.html 的 ?v= 不一致: ${[...new Set(htmlVers)].join(", ")}`);
if (!assetV) fail("sw.js 找不到 ASSET_V");
if (!swV) fail("sw.js 找不到 VERSION");
if (htmlVers[0] !== assetV || assetV !== swV) {
  fail(`版本號不同步 — index.html=${htmlVers[0]} ASSET_V=${assetV} VERSION=${swV}`);
}

// ---- index.html 引用的檔案都要被 sw.js 預快取，也都要真的存在 ----
for (const ref of [...html.matchAll(/(?:href|src)="(?!https?:|data:)([^"]+)"/g)].map(m => m[1])) {
  const file = ref.split("?")[0];
  if (!fs.existsSync(path.join(ROOT, file))) fail(`index.html 引用了不存在的檔案: ${file}`);
  if (!sw.includes(`"./${file}`)) fail(`sw.js 沒有預快取 ${file}，離線時會載不到`);
}

// ---- 社群分享的 metadata ----
const metaOf = (attr, key) => {
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  return m ? m[1] : null;
};
for (const key of ["og:type", "og:title", "og:description", "og:image", "og:url",
                   "og:image:width", "og:image:height", "og:image:alt"]) {
  if (!metaOf("property", key)) fail(`index.html 缺少 ${key}`);
}
for (const key of ["description", "author", "twitter:card", "twitter:image"]) {
  if (!metaOf("name", key)) fail(`index.html 缺少 meta ${key}`);
}

const ogImage = metaOf("property", "og:image");
if (ogImage && !/^https?:\/\//.test(ogImage)) {
  fail("og:image 必須是絕對網址，Facebook 不接受相對路徑");
}
const ogUrl = metaOf("property", "og:url");
const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
if (ogUrl && canonical && ogUrl !== canonical) fail(`og:url 與 canonical 不一致: ${ogUrl} vs ${canonical}`);
if (ogImage && ogUrl && !ogImage.startsWith(ogUrl)) {
  warn(`og:image 不在 og:url 底下，換網域時容易漏改: ${ogImage}`);
}

// 宣告的尺寸要跟實際檔案相符，否則 Facebook 會裁錯或不顯示
const ogFile = path.join(ROOT, "og.png");
if (!fs.existsSync(ogFile)) fail("找不到 og.png");
else {
  const buf = fs.readFileSync(ogFile);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const dw = Number(metaOf("property", "og:image:width"));
  const dh = Number(metaOf("property", "og:image:height"));
  if (w !== dw || h !== dh) fail(`og.png 實際是 ${w}x${h}，但宣告為 ${dw}x${dh}`);
  if (w < 600 || h < 315) fail(`og.png ${w}x${h} 小於 Facebook 的最低要求 600x315`);
  if (buf.length > 8 * 1024 * 1024) fail("og.png 超過 Facebook 的 8MB 上限");
  // 模式清單改了但圖沒重產 —— 圖上的模式數量會過期
  if (fs.statSync(path.join(ROOT, "modes.js")).mtimeMs > fs.statSync(ogFile).mtimeMs) {
    warn("modes.js 比 og.png 新，模式數量可能已過期 —— 跑 node make-og.js 重新產圖");
  }
}

const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!ld) fail("缺少 JSON-LD 結構化資料");
else {
  try {
    const data = JSON.parse(ld[1]);
    if (data["@type"] !== "WebApplication") warn(`JSON-LD 的 @type 是 ${data["@type"]}`);
    if (!data.author || !data.author.name) fail("JSON-LD 缺少作者");
  } catch (e) {
    fail(`JSON-LD 不是合法的 JSON: ${e.message}`);
  }
}

// ---- 使用量統計 ----
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const gaId = (app.match(/const GA_ID = (?:"([^"]*)"|GA_PLACEHOLDER)/) || [])[1];
if (gaId === undefined && /GA_ID = GA_PLACEHOLDER/.test(app)) {
  warn("GA_ID 還是預設值，統計未啟用（要啟用的話把 app.js 的 GA_ID 換成 GA4 評估 ID）");
} else if (gaId !== undefined && !/^G-[A-Z0-9]{6,}$/.test(gaId)) {
  fail(`GA_ID「${gaId}」不是合法的 GA4 評估 ID 格式`);
}

// ---- 報告 ----
const total = MODES.reduce((n, m) => n + (m.items ? m.items.length : 0), 0);
console.log(`模式 ${MODES.length} 個、清單項目 ${total} 筆、tone ${Object.keys(TONES).length} 種`);
warnings.forEach(w => console.log(`  warn  ${w}`));
if (errors.length) {
  errors.forEach(e => console.error(`  FAIL  ${e}`));
  console.error(`\n${errors.length} 項錯誤`);
  process.exit(1);
}
console.log(warnings.length ? `通過（${warnings.length} 項提醒）` : "全部通過");
