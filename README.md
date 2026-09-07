# AndyMagic8

🎱 神奇八號球 —— 一顆球，多種抽籤模式。單一 HTML 檔、零相依、可離線使用。

線上版：<https://andylain.github.io/AndyMagic8/>

## 使用方式

點一下球（或按 Enter／空白鍵）搖出答案。左上角切換模式，右上角開關音效（預設靜音）。

## 模式

| 模式 | 題數 | 說明 |
| --- | --- | --- |
| 🎱 神奇八號球 | 20 | 預設模式。肯定 10、否定 5、模稜兩可 5 |
| 🍽️ 今天吃什麼 | 24 | 小吃／麵食／飯類／異國／清爽 |
| 🎲 擲骰子 | 6 | ⚀–⚅ |
| ⚖️ Yes or No | 2 | |
| 🧭 往哪走 | 8 | 前後左右八個方向 |
| 🧋 喝什麼飲料 | 20 | 茶飲／咖啡／無糖／其他 |
| 🌙 吃什麼宵夜 | 20 | 鹹食／麵食／異國／清爽／甜食 |

八號球、骰子、Yes or No、方向都是每次獨立隨機，不記上一次抽到什麼。
食物、飲料、宵夜會避開連續抽到同一項（`noRepeat`）。
App 每次開啟都回到八號球，不會記住上次用的模式。

## 新增模式

往 `index.html` 的 `MODES` 陣列推一筆就好，選單、標題、配色、字級都會自動跟上：

```js
{
  id: "xxx", icon: "🎯", label: "選單上的名稱", size: "md",
  hint: "球下方的提示文字",
  initial: { primary: "?", secondary: "點一下球" },
  noRepeat: true,                     // 選用：避開連續重複
  items: [
    { primary: "大字", secondary: "小字", tone: "snack" }
  ]
}
```

- `size`：`md`（詞彙）、`lg`（YES/NO）、`xl`（單一符號）；省略則用預設字級
- `tone`：對應 CSS 的顏色變數，省略則用預設白色

## 離線支援

`sw.js` 會在首次載入時快取整個 App。

- **HTML 走 network-first** —— 有網路時一律拿最新版，快取只是離線後備，所以改版不會讓使用者卡在舊版
- **圖示與 manifest 走 cache-first** —— 不常變動，直接吃快取
- 改動較大時把 `sw.js` 裡的 `VERSION` 換掉，舊快取會整包清除

## 檔案

```
index.html              App 本體（HTML／CSS／JS 全在裡面，favicon 內嵌為 data URI）
sw.js                   Service Worker，離線快取
manifest.json           PWA 設定
apple-touch-icon.png    iOS 主畫面圖示（180）
icon-192/512.png        Android 圖示
icon-maskable-512.png   Android 遮罩用圖示
```
