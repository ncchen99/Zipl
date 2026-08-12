# zipl

極簡短網址服務。貼上網址、按 Enter、已複製 — 三秒完成。

跑在 Cloudflare Pages + Workers KV 上，**每月成本 $0**。

線上位址：<https://zipl.pages.dev>

---

## 操作流程

```
第一次使用   輸入通行碼 ──► 存進這台裝置的 localStorage，之後不再詢問
             
日常使用     貼上網址 ──► Enter ──► 短網址已在剪貼簿裡
             
需要好記的   點「自訂短碼」──► 填 my-link ──► zipl.pages.dev/my-link
             
管理         下方清單：點一下複製、垃圾桶圖示按兩次刪除
```

其他小地方：

- 網址可以只打 `example.com/article`，會自動補上 `https://`
- 貼進空白輸入框會直接送出，連 Enter 都不用按
- 按 `/` 隨時跳回輸入框
- 深色 / 淺色模式跟隨系統
- 右上角「鎖定」可清除這台裝置記住的通行碼

---

## 架構

```
使用者
  │
  ├─ GET /                    ──► Pages CDN 靜態檔案      （不計 Workers 用量）
  ├─ GET /assets/*            ──► Pages CDN 靜態檔案      （不計 Workers 用量）
  │
  ├─ GET /:code               ──► Pages Function ──► KV ──► 302 轉址
  └─ /api/links               ──► Pages Function ──► KV   （需通行碼）
```

`public/_routes.json` 明確把 `/`、`/assets/*`、`/404.html` 等排除在 Functions 之外。
沒有這一步，Pages 會為了每個靜態檔案也叫起一次 Function，白白吃掉免費額度。

### 檔案結構

```
public/                     靜態前端（= Pages 的 build output，無 build step）
  index.html                單一頁面
  404.html                  短碼不存在時顯示
  _routes.json              哪些路徑要進 Functions ← 成本關鍵
  _headers                  安全標頭與快取策略
  robots.txt
  assets/
    app.css  app.js  favicon.svg
    fonts/jakarta-latin.woff2   自架字型，不連外部 CDN

functions/                  Pages Functions（Workers 執行環境）
  [code].js                 GET /:code   轉址
  api/
    _middleware.js          /api/* 的通行碼驗證
    links/
      index.js              GET 列表 / POST 建立
      [code].js             DELETE 刪除
```

### 為什麼是這個選型

| 決策 | 原因 |
|------|------|
| Pages 而非純 Workers | 靜態檔案由 CDN 直接送，完全不計入 Workers 請求數 |
| KV 而非 D1 | 只需要 key → value 查詢，KV 讀取延遲更低也更便宜 |
| 無框架、無 build step | 部署即上傳，CI 不用跑 build，也沒有相依套件要維護 |
| 自架字型 | 少一個外網請求，CSP 可以收緊成 `default-src 'self'` |
| 不做點擊統計 | 每次點擊都要寫入 KV，會撞上每天 1,000 次寫入上限 |

---

## 免費額度

| 資源 | 免費額度 | 對應到什麼 |
|------|---------|-----------|
| Functions 請求 | 100,000 / 天 | 每天 10 萬次轉址 |
| KV 讀取 | 100,000 / 天 | 同上 |
| KV 寫入 | 1,000 / 天 | 每天建立 1,000 個短網址 |
| KV 儲存 | 1 GB | 約 50–100 萬筆 |
| 靜態檔案請求 | 無限 | 網頁本身怎麼開都不花錢 |

轉址回應帶 `Cache-Control: public, max-age=60`，重複點擊 60 秒內不會再進 Function。
代價是刪除後最多 60 秒才會完全生效。

---

## 開發

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入自己的 ADMIN_TOKEN
npm run dev                       # http://localhost:8788
```

本機用的是獨立的 preview KV namespace，不會動到正式資料。

## 部署

推到 `main` 就會由 GitHub Actions 自動部署（見 `.github/workflows/deploy.yml`）。
PR 會部署到該分支專屬的 preview 網址。

手動部署：

```bash
npm run deploy
```

### 需要的 GitHub Secrets

| Secret | 怎麼拿 |
|--------|--------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 儀表板右側，或 `wrangler whoami` |
| `CLOUDFLARE_API_TOKEN` | 儀表板 → My Profile → API Tokens → **Create Custom Token** |

**`CLOUDFLARE_API_TOKEN` 權限設定（Permissions）：**
- **Account** ➔ **Cloudflare Pages** ➔ **Edit** （必要）
- **Account** ➔ **Workers KV Storage** ➔ **Edit** （必要）
- **Account** ➔ **Workers Scripts** ➔ **Edit** （必要）
- **User** ➔ **User Details** ➔ **Read** （建議）
- **User** ➔ **Memberships** ➔ **Read** （建議）

Account Resources 選擇 **All accounts** 或指定您的帳號。

### 更換通行碼

```bash
npm run secret          # 依提示輸入新的通行碼
```

改完之後，每台裝置都要重新解鎖一次（點右上角「鎖定」再輸入新的）。

---

## 換成自己的網域

短網址當然是越短越好。有自己的網域的話：

1. 把網域加進 Cloudflare（免費方案即可）
2. Pages 專案 → Custom domains → 加上例如 `s.你的網域`
3. 完成，`https://s.你的網域/abc123` 就能用了

程式碼不用改任何一行 — 前端用 `location.origin` 組短網址，後端用請求本身的 host 判斷。

---

## 已知限制

- KV 是最終一致性，自訂短碼在極短時間內重複建立可能不會被擋下（個人使用不會遇到）
- 清單一次最多顯示 500 筆
- 原始網址超過約 700 bytes 時，清單只顯示「網址過長，未顯示」，但轉址完全正常
- 沒有點擊統計 — 這是刻意的，見上面的選型說明
