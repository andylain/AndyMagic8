/* 神奇八號球 —— 應用邏輯。
   模式與清單資料在 modes.js，要新增模式請改那一支。 */

/* 每個模式都是這個形狀，要加新模式就往 MODES 推一筆，其他邏輯不用動。
   noRepeat 只給「連抽到一樣會掃興」的模式；占卜、骰子、是非、方向
   都必須維持每次獨立隨機，所以不開。 */

/* ---------- 音效：Web Audio 即時合成，不載入任何音檔 ---------- */

const SOUND_KEY = "magic8-sound";
let soundOn = false;
try { soundOn = localStorage.getItem(SOUND_KEY) === "on"; } catch (e) {}

let audioCtx = null;
function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  // iOS/Chrome 的自動播放政策：必須在使用者手勢裡 resume
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function noiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playShake() {
  if (!soundOn) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // 液體晃動：白噪音穿過頻率掃動的帶通濾波器
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.7);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.55);

  // 三下起伏，對齊 @keyframes shake 的節奏
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  [0, 0.18, 0.36].forEach((d, i) => {
    g.gain.linearRampToValueAtTime(0.22 - i * 0.05, t + d + 0.06);
    g.gain.linearRampToValueAtTime(0.015, t + d + 0.16);
  });
  g.gain.linearRampToValueAtTime(0.0001, t + 0.62);

  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.7);

  // 答案浮現時的「咚」
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t + 0.55);
  osc.frequency.exponentialRampToValueAtTime(62, t + 0.82);
  og.gain.setValueAtTime(0.0001, t + 0.55);
  og.gain.linearRampToValueAtTime(0.16, t + 0.60);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  osc.connect(og).connect(ctx.destination);
  osc.start(t + 0.55);
  osc.stop(t + 0.95);
}

const soundBtn = document.getElementById("soundToggle");
function renderSoundBtn() {
  soundBtn.textContent = soundOn ? "\u{1F50A}" : "\u{1F507}";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
  soundBtn.setAttribute("aria-label", soundOn ? "關閉音效" : "開啟音效");
}
renderSoundBtn();

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch (e) {}
  renderSoundBtn();
  if (soundOn) getCtx();   // 趁這個手勢把 AudioContext 解鎖
});

/* ---------- 模式 ---------- */

const answer    = document.getElementById("answer");
const pageTitle = document.getElementById("pageTitle");
const hintEl    = document.getElementById("hint");
const modeBtn   = document.getElementById("modeBtn");
const modeIcon  = document.getElementById("modeBtnIcon");
const modeList  = document.getElementById("modeList");
const swatch    = document.getElementById("swatch");
const listBtn   = document.getElementById("listBtn");
const listPanel = document.getElementById("listPanel");

// 預設永遠是神奇八號球：每次打開都從這裡開始，不記上次選了什麼
let mode = MODES[0];

let lastItem = null;   // 只有 noRepeat 的模式會用到

function showItem(item) {
  answer.style.color = (item.tone && TONES[item.tone]) || "";
  // 直接帶色碼的項目（選一個顏色）多顯示一塊色票，深色系才看得見
  swatch.hidden = !item.color;
  if (item.color) swatch.style.background = item.color;
  answer.querySelector(".primary").textContent = item.primary;
  answer.querySelector(".secondary").textContent = item.secondary;
}

function pick() {
  if (mode.roll) return mode.roll();     // 用算的模式沒有清單
  const items = mode.items;
  let item = items[Math.floor(Math.random() * items.length)];
  // 只在題庫夠大時才避免連抽重複，否則會把「隨機」變成「輪流」
  if (mode.noRepeat && items.length > 2) {
    while (item === lastItem) item = items[Math.floor(Math.random() * items.length)];
  }
  lastItem = item;
  return item;
}

function applyMode(next) {
  mode = next;
  lastItem = null;
  answer.dataset.mode = mode.id;
  if (mode.size) answer.dataset.size = mode.size; else delete answer.dataset.size;
  pageTitle.textContent = mode.icon + " " + mode.label;
  document.title = mode.label + " Magic 8-Ball";
  hintEl.textContent = mode.hint;
  modeIcon.textContent = mode.icon;
  ball.setAttribute("aria-label", "搖動" + mode.label);
  showItem(mode.initial);
  [...modeList.querySelectorAll("button")].forEach(b =>
    b.setAttribute("aria-current", String(b.dataset.id === mode.id)));
  if (!listPanel.hidden) renderList();
}

// 模式一多，平舖的選單會超出畫面，所以依 group 分段並加小標
GROUPS.forEach(group => {
  const inGroup = MODES.filter(m => m.group === group);
  if (!inGroup.length) return;
  const head = document.createElement("li");
  head.className = "group";
  head.setAttribute("aria-hidden", "true");
  head.textContent = group;
  modeList.appendChild(head);
  inGroup.forEach(m => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "menuitem");
    btn.dataset.id = m.id;
    btn.textContent = m.icon + "\u00A0\u00A0" + m.label;
    btn.addEventListener("click", () => { applyMode(m); closeMenu(); modeBtn.focus(); });
    li.appendChild(btn);
    modeList.appendChild(li);
  });
});

const sep = document.createElement("li");
sep.className = "sep";
sep.setAttribute("aria-hidden", "true");
modeList.appendChild(sep);

// 安裝：只有瀏覽器真的給了安裝提示才顯示，否則這個項目點了也沒反應
const installLi = document.createElement("li");
installLi.hidden = true;
const installBtn = document.createElement("button");
installBtn.type = "button";
installBtn.setAttribute("role", "menuitem");
installBtn.textContent = "\u{1F4F2}\u00A0\u00A0安裝";
installLi.appendChild(installBtn);
modeList.appendChild(installLi);

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();               // 擋掉瀏覽器自己的橫幅，改由選單觸發
  deferredPrompt = e;
  installLi.hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installLi.hidden = true;
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  closeMenu();
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;            // 用過就失效，不能重複使用
  installLi.hidden = true;
});

const aboutLi = document.createElement("li");
aboutLi.innerHTML = '<a href="https://andylain.com" target="_blank" rel="noopener" role="menuitem">' +
                    '\u{1F464}\u00A0\u00A0關於作者</a>';
modeList.appendChild(aboutLi);

/* ---------- 這個模式的總表 ---------- */

function renderList() {
  listPanel.textContent = "";
  const head = document.createElement("h2");
  head.textContent = mode.icon + " " + mode.label;
  listPanel.appendChild(head);

  if (!mode.items) {                       // 用算的模式沒有清單，改顯示說明
    const p = document.createElement("p");
    p.className = "list-note";
    p.textContent = mode.summary || "這個模式的結果是即時算出來的，沒有固定清單。";
    listPanel.appendChild(p);
    return;
  }

  const count = document.createElement("p");
  count.className = "list-note";
  count.textContent = "共 " + mode.items.length + " 種";
  listPanel.appendChild(count);

  // secondary 夠集中就當成分類（食物那種），否則它其實是每筆自己的說明，平舖就好
  const cats = [...new Set(mode.items.map(i => i.secondary))];
  if (cats.length <= mode.items.length / 3) {
    cats.forEach(cat => {
      const h = document.createElement("h3");
      h.textContent = cat;
      listPanel.appendChild(h);
      const wrap = document.createElement("div");
      wrap.className = "chips";
      mode.items.filter(i => i.secondary === cat).forEach(i => {
        const chip = document.createElement("span");
        chip.className = "chip";
        if (i.color) {
          const dot = document.createElement("i");
          dot.style.background = i.color;
          chip.appendChild(dot);
        }
        chip.appendChild(document.createTextNode(i.primary));
        if (i.tone && TONES[i.tone]) chip.style.color = TONES[i.tone];
        wrap.appendChild(chip);
      });
      listPanel.appendChild(wrap);
    });
  } else {
    const ul = document.createElement("ul");
    ul.className = "rows";
    mode.items.forEach(i => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = i.primary;
      if (i.tone && TONES[i.tone]) b.style.color = TONES[i.tone];
      li.appendChild(b);
      li.appendChild(document.createTextNode(" " + i.secondary));
      ul.appendChild(li);
    });
    listPanel.appendChild(ul);
  }
}

function openList() {
  renderList();
  listPanel.hidden = false;
  listBtn.setAttribute("aria-expanded", "true");
}
function closeList() {
  listPanel.hidden = true;
  listBtn.setAttribute("aria-expanded", "false");
}
listBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeMenu();
  listPanel.hidden ? openList() : closeList();
});
document.addEventListener("click", e => {
  if (!listPanel.hidden && !e.target.closest(".list-menu")) closeList();
});

function openMenu() {
  modeList.hidden = false;
  modeBtn.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  modeList.hidden = true;
  modeBtn.setAttribute("aria-expanded", "false");
}
modeBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeList();
  modeList.hidden ? openMenu() : closeMenu();
});
document.addEventListener("click", e => {
  if (!modeList.hidden && !e.target.closest(".mode-menu")) closeMenu();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!modeList.hidden) { closeMenu(); modeBtn.focus(); }
  if (!listPanel.hidden) { closeList(); listBtn.focus(); }
});

/* ---------- 搖球 ---------- */

const ball = document.getElementById("ball");
let rolling = false;

function shake() {
  if (rolling) return;
  rolling = true;

  ball.classList.remove("shake");
  void ball.offsetWidth;      // 重播動畫
  ball.classList.add("shake");
  answer.classList.add("fade");
  playShake();

  setTimeout(() => {
    showItem(pick());
    answer.classList.remove("fade");
    rolling = false;
  }, 600);
}

ball.addEventListener("click", shake);
ball.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shake(); }
});

applyMode(mode);

/* ---------- 離線支援 ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
