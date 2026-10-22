# TERROR ISLAND 台中驚魂島

16 個六邊形拼成台中市輪廓的互動恐怖傳說地圖：從海線、屯區到梨山，每一格是一則虛構的都市傳說，其中「垃圾山太空包」「廚餘湖」取材自城市公共議題（垃圾去化、廚餘處理）。

> 所有傳說、人物與事件皆為虛構創作，僅借用台中行政區名稱作為地理位置。

## 執行

純靜態網站，沒有打包流程，但因為使用 ES Modules + `fetch`，必須透過 http 伺服器開啟：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

可直接部署到 GitHub Pages、Cloudflare Pages 等任何靜態主機。

## 技術架構

- 原生 JavaScript ES Modules + `<script type="importmap">`，無框架、無打包
- Three.js r160（自架於 `assets/vendor/three/`）：WebGLRenderer、ACES tone mapping、PCF 柔和陰影、OrbitControls、CSS2DRenderer
- 靜態零件以 `InstancedMesh` 合併繪製；會動的零件（摩天輪、紡車、幽靈船、太空包…）放在每區自己的小群組
- 內容全部由 `assets/data.json` 驅動

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面骨架、importmap |
| `assets/app.js` | 主程式：場景、相機、選取、卡片、清單、篩選、日誌、導覽 |
| `assets/world.js` | 台中輪廓六邊形排列、道路、路燈、深山森林格 |
| `assets/environment.js` | 天空、日夜光線、地形（西側海、東側中央山脈）、樹、霧 |
| `assets/models.js` | 16 座傳說的 3D 小模型與 instancing 零件工具 |
| `assets/people.js` | 沿詛咒連線搬運物品的小人、幽靈、烏鴉 |
| `assets/icons.js` | 攜帶物與骷髏圖示 |
| `assets/ui.css` | 介面樣式（桌面 / 手機 bottom sheet） |
| `assets/data.json` | 地點、傳說、連線、夜間時刻表、導覽腳本 |

## 修改內容

編輯 `assets/data.json`：

- `zones[]`：每一格。`cell` 是 odd-row offset 座標 `[col, row]`（奇數列向東偏半格），`model` 對應 `models.js` 裡的 `MODELS`，`civic` 有值時會顯示「現實中的市政議題」區塊並能被「只看市政議題」篩選
- `wilds[]`：不可點選、只用來補完台中輪廓的和平深山森林格
- `flows[]`：詛咒連線（搬運者 `walker`、攜帶物 `carry`、依據 `evidence`）
- `dayCycle[]`：「驚魂一夜」各時段會甦醒的地點
- `tour.cues[]`：64 秒導覽腳本

## 網址參數

- `?zone=beitun`、`?spot=dadu-bubbles`、`?flow=F5`：直接開啟某地點／傳說／連線
- `?tour=1`：直接播放導覽
- `?time=03:00`：起始時間
- `?quality=high|medium`、`?debug=1`（顯示 FPS 與 draw calls）

## 部署到 GitHub Pages

`.github/workflows/pages.yml` 會在每次 push 到 `main` 或 `claude/awesome-cannon-q4axxh` 時自動部署。第一次需要手動開啟：

1. repo **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**
2. 到 **Actions** 分頁，對「Deploy to GitHub Pages」按 **Run workflow**（或再 push 一次）
3. 網址：`https://brownrhined.github.io/terror-Island/`

> 私人（private）repo 需要 GitHub Pro / Team 才能開 Pages；免費帳號請先把 repo 改成 public。

### 自訂網域

在 **Settings → Pages → Custom domain** 填入網域並勾選 **Enforce HTTPS**，然後在網域的 DNS 設定：

- 子網域（例如 `terror.example.com`）：新增 `CNAME` 記錄指向 `brownrhined.github.io`
- 根網域（例如 `example.com`）：新增 4 筆 `A` 記錄：`185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`（若要 IPv6，再加 `AAAA`：`2606:50c0:8000::153` ～ `2606:50c0:8003::153`）
