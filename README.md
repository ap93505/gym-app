# RAY Fitness 健身房管理系統

以 LINE Login 作為會員身分驗證的健身房課程管理 Web App。學生可查看堂數、預約與報到；教練可建立自己的課程並在課後人工確認結果；管理者可維護會員、堂數、方案、補登、取消與報表。

## 已實作

- LINE OAuth 2.1 / OpenID Connect、PKCE、state、nonce 與伺服器端 Session
- `admin`、`coach`、`student` 即時 Firestore RBAC
- 堂數批次、十年期限、不可變更加值／扣堂帳本
- 預約占用堂數；報到不扣堂；教練確認完成才扣堂
- 每時段最多三組，教練與學生皆不可撞堂
- 每日／每週／每月循環，循環次數及結束日模式
- Coach 只可建立／改期自己的課程，但可查看全館行事曆
- Admin 補登、未來課程取消、角色與堂數管理
- 課程結束後查詢時計算待確認清單；不使用 Scheduler
- 教練完成／未完成確認，未完成原因與說明必填
- 教練區間報表與 CSV 匯出
- 單堂 `.ics` 匯出，可加入 Google 或 Apple Calendar
- Firestore 完全禁止瀏覽器直連，所有資料操作都經 Cloud Run 後端

## 本機啟動

需求：Node.js 24、Google Cloud ADC 或 Firestore Emulator。

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

### 使用 ngrok 測試 LINE Login

專案使用 ngrok 官方 JavaScript SDK，不需要另外安裝全域 CLI。先在 [ngrok Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) 取得 authtoken，填入 `.env.local`：

```dotenv
NGROK_AUTHTOKEN=你的_ngrok_authtoken
NGROK_DOMAIN=你的固定網域.ngrok.app
```

`NGROK_DOMAIN` 可留空，但每次啟動可能產生不同網址；使用固定 ngrok domain 可免除反覆修改 LINE Callback URL。

接著執行：

```powershell
npm run dev:ngrok
```

指令會自動：

1. 建立到本機 3000 port 的 HTTPS tunnel。
2. 將公開網址設為本次程序的 `NEXT_PUBLIC_APP_URL`。
3. 啟動 Next.js。
4. 顯示 LINE Callback、帳號資訊及打卡上課的完整網址。

把畫面顯示的 `LINE Callback` 加到 LINE Developers Console 後，即可從手機 LINE 測試。按 `Ctrl+C` 會同時停止 Next.js 與 tunnel。

填寫 `.env.local`：

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
LINE_CHANNEL_ID=你的_LINE_Login_Channel_ID
LINE_CHANNEL_SECRET=你的_LINE_Login_Channel_Secret
SESSION_SECRET=至少32字元的隨機值
GOOGLE_CLOUD_PROJECT=你的_GCP_Project_ID
FIRESTORE_DATABASE_ID=(default)
```

LINE Developers Console 的 Callback URL：

```text
http://localhost:3000/api/auth/line/callback
```

LINE Login Channel 與 Official Account 的 Messaging API Channel 必須位於同一個 Provider。

## 首位管理者

部署前可設定：

```dotenv
INITIAL_ADMIN_LINE_USER_ID=Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

此帳號第一次登入時會取得 `admin`、`coach`、`student`。另一種方式是先登入，再於 Firestore `users/{LINE_USER_ID}` 將 `roles` 設成相同陣列。

## 建立 GCP 資源

1. 在 `asia-east1` 建立 Firestore Native database。
2. 建立 Cloud Run 專用 Service Account，僅授予 Firestore 存取與 Secret Manager accessor。
3. 把 `LINE_CHANNEL_SECRET` 與 `SESSION_SECRET` 放入 Secret Manager。
4. 部署索引與封閉式規則：

```powershell
firebase deploy --only firestore --project YOUR_PROJECT_ID
```

## 部署 Cloud Run

```powershell
gcloud run deploy ray-gym `
  --source . `
  --region asia-east1 `
  --allow-unauthenticated `
  --service-account ray-gym-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com `
  --set-env-vars NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN,LINE_CHANNEL_ID=YOUR_CHANNEL_ID,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID `
  --set-secrets LINE_CHANNEL_SECRET=line-channel-secret:latest,SESSION_SECRET=session-secret:latest
```

部署後，在 LINE Login Channel 新增正式 Callback URL：

```text
https://YOUR_DOMAIN/api/auth/line/callback
```

圖文選單可直接連至：

```text
帳號資訊：https://YOUR_DOMAIN/api/auth/line/start?returnTo=/member/account
打卡上課：https://YOUR_DOMAIN/api/auth/line/start?returnTo=/member/check-in
```

## 驗證

```powershell
npm run lint
npm test
npm run build
```

目前 Windows 專案路徑包含中文字元，Next.js 16 Turbopack 會發生路徑 panic，因此 `dev` 與 `build` 已固定使用 Webpack。
