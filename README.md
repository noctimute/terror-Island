# TERROR ISLAND 台中恐怖島

16 個六邊形拼成台中市輪廓的互動恐怖傳說地圖：從海線、屯區到梨山，每一格是一則虛構的都市傳說，其中「垃圾山太空包」「廚餘湖」取材自城市公共議題（垃圾去化、廚餘處理）；「墜落島」則收錄經新聞查證的真實死亡事件，並附新聞標題與連結。

> 除「墜落島」與「氣爆火災島」外，所有傳說、人物與事件皆為虛構創作，僅借用台中行政區名稱作為地理位置。

## 執行

純靜態網站，沒有打包流程，但因為使用 ES Modules + `fetch`，必須透過 http 伺服器開啟：

```bash
python3 -m http.server 8000
# 首頁 http://localhost:8000/ ，台中 http://localhost:8000/lumama/
```

## 多城市結構

```
index.html          首頁（選城市）     → 網址/
engine/             共用 3D 引擎、樣式、three.js
lumama/index.html   台中頁面          → 網址/lumama/
lumama/data.json    台中內容
```

新增一座城市（例如台北）：

1. 複製 `lumama/` 成 `taipei/`
2. 改 `taipei/index.html` 裡的 `data-src="../taipei/data.json"`、`<title>` 與 description
3. 改 `taipei/data.json`：`meta.slug`、`meta.title`、`meta.welcome`、`meta.terrain`（台北盆地可用 `{ "sea": "none", "mountains": "ring" }`）、`zones`、`flows`…
4. 新的 3D 模型加到 `engine/models.js` 的 `MODELS`，在 `zones[].model` 指定名稱
5. 在根目錄 `index.html` 加上城市卡片

部署流程會自動發佈根目錄下所有含 `index.html` 的資料夾。

可直接部署到 GitHub Pages、Cloudflare Pages 等任何靜態主機。

## 技術架構

- 原生 JavaScript ES Modules + `<script type="importmap">`，無框架、無打包
- Three.js r160（自架於 `engine/vendor/three/`）：WebGLRenderer、ACES tone mapping、PCF 柔和陰影、OrbitControls、CSS2DRenderer
- 靜態零件以 `InstancedMesh` 合併繪製；會動的零件（摩天輪、紡車、幽靈船、太空包…）放在每區自己的小群組
- 內容由各城市的 `data.json` 驅動（例如 `lumama/data.json`）

| 檔案 | 用途 |
|---|---|
| `lumama/index.html` | 城市頁面骨架、importmap、`data-src` 指向該城市的 data.json |
| `engine/app.js` | 主程式：場景、相機、選取、卡片、清單、篩選、日誌、導覽 |
| `engine/world.js` | 台中輪廓六邊形排列、道路、路燈、深山森林格 |
| `engine/environment.js` | 天空、日夜光線、地形（西側海、東側中央山脈）、樹、霧 |
| `engine/models.js` | 16 座傳說的 3D 小模型與 instancing 零件工具 |
| `engine/people.js` | 沿詛咒連線搬運物品的小人、幽靈、烏鴉 |
| `engine/icons.js` | 攜帶物與骷髏圖示 |
| `engine/ui.css` | 介面樣式（桌面 / 手機 bottom sheet） |
| `lumama/data.json` | 地點、傳說、連線、夜間時刻表、導覽腳本 |

## 修改內容

編輯各城市的 `data.json`（例如 `lumama/data.json`）：

- `zones[]`：每一格。`cell` 是 odd-row offset 座標 `[col, row]`（奇數列向東偏半格），`model` 對應 `models.js` 裡的 `MODELS`，`civic` 有值時會顯示「現實中的市政議題」區塊並能被「只看市政議題」篩選
- `wilds[]`：不可點選、只用來補完台中輪廓的和平深山森林格
- `flows[]`：詛咒連線（搬運者 `walker`、攜帶物 `carry`、依據 `evidence`）
- `dayCycle[]`：「驚魂一夜」各時段會甦醒的地點
- `tour.cues[]`：64 秒導覽腳本

## 真實新聞島的事件資料（例如 `lumama/falls.json`）

收錄真實新聞的島，內容一律這樣呈現：點開島，下面是「事件」清單；點進一則事件，才看到摘要和新聞連結。

大量的事件放在獨立的 JSON 檔，`data.json` 裡該島加上 `"recordsSrc": "檔名.json"` 就會讀進來（例如墜落島 `falls.json`、漂浮島 `floaters.json`、垃圾山 `garbage.json`、廚餘湖 `foodwaste.json`、公安災害 `safety.json`、食安 `food.json`、貪瀆 `graft.json`、國安 `nat.json`、無聲 `quiet.json`、兒少 `kids.json`）。檔案格式：

```json
{
  "title": "台中墜樓新聞紀錄",
  "note": "顯示在島卡片最底部的來源說明",
  "helpline": true,
  "updated": "2026-10-22",
  "records": [
    {
      "id": "fall-119",
      "date": "2024-11-17",
      "place": "北屯",
      "summary": "只摘要報導寫到的事實，不放姓名、病史等個人資訊",
      "sources": [{ "title": "新聞標題（照原文）", "outlet": "媒體名稱", "url": "https://…" }]
    }
  ]
}
```

- 事件標題預設用第一則新聞的標題，也可以在該筆加 `"title"` 自訂
- 「事件時間軸」依 `date` 的年月排列；`date` 是區間或只有年份時，加 `"sort": "YYYY-MM"` 指定放在哪個月
- `helpline: true` 會在每則事件顯示 1925 安心專線（自殺、墜樓相關必開）
- 只收錄查得到新聞報導的案件；查無新聞、或只有推論沒有來源的，不要放進來
- 資料來源與查證過程放在私人 repo `noctimute/taichung-research`

## 網址參數

- 以下都接在城市網址後面，例如 `/lumama/?zone=beitun`
- `?zone=beitun`、`?spot=dadu-bubbles`、`?flow=F5`：直接開啟某地點／傳說／連線
- `?tour=1`：直接播放導覽
- `?time=03:00`：起始時間
- `?quality=high|medium`、`?debug=1`（顯示 FPS 與 draw calls）

## 部署到 GitHub Pages

`.github/workflows/pages.yml` 會在每次 push 到 `main` 時自動部署。第一次需要手動開啟：

1. repo **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**
2. 到 **Actions** 分頁，對「Deploy to GitHub Pages」按 **Run workflow**（或再 push 一次）
3. 網址：`https://noctimute.github.io/terror-Island/`（綁定自訂網域後是 `https://你的網址/lumama/`）

> 私人（private）repo 需要 GitHub Pro / Team 才能開 Pages；免費帳號請先把 repo 改成 public。

### 自訂網域

在 **Settings → Pages → Custom domain** 填入網域並勾選 **Enforce HTTPS**，然後在網域的 DNS 設定：

- 子網域（例如 `terror.example.com`）：新增 `CNAME` 記錄指向 `noctimute.github.io`
- 根網域（例如 `example.com`）：新增 4 筆 `A` 記錄：`185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`（若要 IPv6，再加 `AAAA`：`2606:50c0:8000::153` ～ `2606:50c0:8003::153`）
