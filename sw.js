/* 神奇八號球 Service Worker
 *
 * 改版時把 VERSION 換掉，舊快取就會在 activate 時整包清掉。
 * 不過就算忘了換也不會讓使用者卡在舊版：HTML 走 network-first，
 * 有網路時一律拿最新的，快取只是離線時的後備。
 */
const VERSION = "magic8-v25";
// 資源網址帶版本號：舊版 Service Worker 對 .css/.js 是 cache-first，
// 換掉網址才能確保它不會一直回舊檔（index.html 一律走網路，所以拿得到新版號）
const ASSET_V = "25";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=" + ASSET_V,
  "./modes.js?v=" + ASSET_V,
  "./app.js?v=" + ASSET_V,
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())      // 新版立刻就緒，不用等舊分頁關掉
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())    // 立刻接管已開啟的分頁
  );
});

function putInCache(req, res) {
  const copy = res.clone();
  caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;   // 外部連結不碰

  // HTML、CSS、JS 都是會改版的程式碼，必須一起走 network-first：
  // 只要其中一支吃到舊快取、配上新的另一支，畫面就可能壞掉
  const path = new URL(req.url).pathname;
  const isCode = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html") ||
                 path.endsWith(".js") || path.endsWith(".css");

  if (isCode) {
    // network-first：內容永遠是最新的，離線才退回快取
    e.respondWith(
      fetch(req)
        .then(res => putInCache(req, res))
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // cache-first：圖示和 manifest 不常變，直接吃快取最快
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => putInCache(req, res)))
  );
});
