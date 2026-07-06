# Firestore Schema 與資料關聯

本文件描述 `ray-app` 目前實際使用的 Firestore 資料模型。Firestore 並非關聯式資料庫，以下所稱「表」實際上是 collection；關聯不會由資料庫外鍵強制，而是由文件 ID、關聯欄位與 Firestore transaction 維護。

## 整體關聯

```mermaid
erDiagram
    USERS ||--o{ CREDIT_BATCHES : owns
    USERS ||--o{ SESSIONS : attends_as_student
    USERS ||--o{ SESSIONS : teaches_as_coach
    PLANS ||--o{ CREDIT_BATCHES : grants
    PLANS ||--o{ SESSIONS : selected_for
    CREDIT_BATCHES ||--o{ SESSIONS : reserves_credit_for
    RECURRENCE_SERIES ||--o{ SESSIONS : groups
    TIME_SLOTS ||--o{ SESSIONS : contains_up_to_3
    SESSIONS ||--o| COACH_SLOT_LOCKS : locks_coach
    SESSIONS ||--o| STUDENT_SLOT_LOCKS : locks_student
    CREDIT_BATCHES ||--o{ CREDIT_LEDGERS : records
    SESSIONS ||--o{ CREDIT_LEDGERS : consumes
    USERS ||--o{ AUDIT_LOGS : acts
```

## Collection 一覽

| Collection | 文件 ID | 用途 |
| --- | --- | --- |
| `users` | LINE User ID (`profile.sub`) | 會員、教練與管理員帳號 |
| `users/{userId}/creditBatches` | Auto ID | 每次方案儲值形成的堂數批次 |
| `plans` | Auto ID | 可購買的課堂方案定義 |
| `sessions` | Auto ID | 每一堂實際課程預約 |
| `recurrenceSeries` | Auto ID | 重複課程的系列摘要 |
| `timeSlots` | 課程開始時間的 Unix milliseconds | 同時段容量計數，最多三組 |
| `coachSlotLocks` | `{coachId}_{startAtMillis}` | 防止同一教練同時段重複預約 |
| `studentSlotLocks` | `{studentId}_{startAtMillis}` | 防止同一學生同時段重複預約 |
| `creditLedgers` | Auto ID | 堂數增加與正式扣除流水 |
| `auditLogs` | Auto ID | 管理操作與課程狀態異動稽核 |

## `users`

路徑：`users/{userId}`

`userId` 固定使用 LINE Login 回傳的 subject。單一帳號可同時具有多個角色。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `lineUserId` | string | LINE User ID，通常與文件 ID 相同 |
| `displayName` | string | LINE 顯示名稱 |
| `realName` | string | 使用者填寫的本名 |
| `nickname` | string | 使用者填寫的綽號 |
| `pictureUrl` | string? | LINE 頭像 URL |
| `email` | string? | LINE Login 提供的 Email |
| `roles` | string[] | `admin`、`coach`、`student`，可複選 |
| `status` | string | 目前使用 `active` 或 `disabled` |
| `credits.totalRemaining` | number | 所有有效批次尚未正式扣除的堂數總和，包含已預約堂數 |
| `credits.reserved` | number | 已被課程預約鎖定、尚未完成或釋放的堂數 |
| `createdAt` | Timestamp | 首次 LINE 登入時間 |
| `updatedAt` | Timestamp | 最近更新時間 |

計算欄位：`available = totalRemaining - reserved`。此值由 API 計算，不存入文件。

### `creditBatches` 子集合

路徑：`users/{userId}/creditBatches/{batchId}`

每次替會員儲值一個方案，都建立一個獨立批次。預約同一方案時，優先使用最早到期且仍有可預約堂數的批次。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `originalUnits` | number | 此次儲值的原始堂數 |
| `remainingUnits` | number | 尚未正式消耗的堂數，包含已預約堂數 |
| `reservedUnits` | number | 此批次已被課程鎖定的堂數 |
| `planId` | string | 對應 `plans/{planId}` |
| `planName` | string | 儲值當下的方案名稱快照 |
| `grantedBy` | string | 執行儲值的 Admin user ID |
| `grantedAt` | Timestamp | 儲值時間 |
| `expiresAt` | Timestamp | 到期時間，目前為儲值日起十年 |
| `note` | string | 儲值備註 |

批次可預約堂數：`remainingUnits - reservedUnits`。

## `plans`

路徑：`plans/{planId}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `name` | string | 方案名稱 |
| `sessions` | number | 每次購買增加的堂數 |
| `price` | number | 每堂價格（NT$） |
| `active` | boolean | 是否上架；停用方案仍保留歷史關聯 |
| `sortOrder` | number | 顯示順序；啟用與停用方案各自在群組內排序 |
| `createdAt` | Timestamp | 建立時間 |
| `updatedAt` | Timestamp | 最近更新時間 |

列表排序規則：先顯示 `active = true`，再依 `sortOrder`；停用方案自動置底。舊資料若沒有 `sortOrder`，會再依堂數與名稱排序。

## `sessions`

路徑：`sessions/{sessionId}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `studentId` | string | 對應 `users/{studentId}` |
| `studentName` | string | 建立／編輯課程時的學生名稱快照 |
| `coachId` | string | 對應 `users/{coachId}` |
| `coachName` | string | 建立／編輯課程時的教練名稱快照 |
| `planId` | string | 此堂課使用的方案 |
| `planName` | string | 此堂課的方案名稱快照 |
| `creditBatchId` | string | 對應 `users/{studentId}/creditBatches/{creditBatchId}` |
| `startAt` | Timestamp | 課程開始時間 |
| `endAt` | Timestamp | 課程結束時間，目前固定為開始後一小時 |
| `status` | string | 課程狀態，見下方狀態流程 |
| `seriesId` | string/null | 重複課程時對應 `recurrenceSeries/{seriesId}` |
| `createdBy` | string | 建立者 user ID |
| `createdAt` | Timestamp | 建立時間 |
| `updatedBy` | string? | 最近編輯者 user ID |
| `updatedAt` | Timestamp | 最近更新時間 |
| `checkedInAt` | Timestamp? | 學生報到時間 |
| `checkedInBy` | string? | 報到或補登操作者 user ID |
| `completedAt` | Timestamp? | 教練確認結果的時間 |
| `completedBy` | string? | 確認結果的教練或 Admin user ID |
| `incompleteReason` | string? | 未完成原因代碼 |
| `incompleteNote` | string? | 未完成說明 |
| `cancelledAt` | Timestamp? | 取消時間 |
| `cancelledBy` | string? | 取消操作的 Admin user ID |
| `cancellationReason` | string? | 取消原因 |

### 課程狀態流程

```mermaid
stateDiagram-v2
    [*] --> scheduled: 建立預約並鎖堂
    scheduled --> checked_in: 學生報到或 Admin 補登
    checked_in --> completed: 教練確認完成並正式扣堂
    scheduled --> not_completed: 教練確認未完成並釋放堂數
    checked_in --> not_completed: 教練確認未完成並釋放堂數
    scheduled --> cancelled: Admin 取消並釋放堂數
    checked_in --> cancelled: Admin 取消並釋放堂數
```

重要規則：

- `studentId` 不可等於 `coachId`。
- 每個開始時段最多三組課程。
- 同一教練或學生在同時段只能有一堂課。
- 建立預約只增加 `reserved` / `reservedUnits`，不減少 `remainingUnits`。
- `completed` 才會同時減少 `remainingUnits`、`reservedUnits` 與使用者 `totalRemaining`、`reserved`。
- `not_completed` 或 `cancelled` 只釋放預約，不正式扣堂。

## `recurrenceSeries`

路徑：`recurrenceSeries/{seriesId}`

只有一次建立多堂重複課程時才產生。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `studentId` | string | 學生 user ID |
| `coachId` | string | 教練 user ID |
| `planId` | string | 使用方案 ID |
| `planName` | string | 方案名稱快照 |
| `frequency` | string | `daily`、`weekly` 或 `monthly` |
| `count` | number | 系列包含的課程數 |
| `startAt` | Timestamp | 第一堂開始時間 |
| `endAt` | Timestamp | 最後一堂開始時間 |
| `createdBy` | string | 建立者 user ID |
| `createdAt` | Timestamp | 建立時間 |

`sessions.seriesId` 指向此文件；目前編輯或取消單堂課不會自動改寫整個系列。

## 容量與衝堂鎖

### `timeSlots`

路徑：`timeSlots/{startAtMillis}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `startAt` | Timestamp | 時段開始時間 |
| `count` | number | 此時段目前課程組數，最大為 3 |
| `sessionIds` | string[] | 此時段包含的 session IDs |

### `coachSlotLocks`

路徑：`coachSlotLocks/{coachId}_{startAtMillis}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `sessionId` | string | 對應課程 ID |
| `coachId` | string | 教練 user ID |
| `startAt` | Timestamp | 時段開始時間 |

### `studentSlotLocks`

路徑：`studentSlotLocks/{studentId}_{startAtMillis}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `sessionId` | string | 對應課程 ID |
| `studentId` | string | 學生 user ID |
| `startAt` | Timestamp | 時段開始時間 |

以上三種文件會與 `sessions` 在同一個 transaction 建立、移動或釋放，避免容量計數與課程資料不同步。

## `creditLedgers`

路徑：`creditLedgers/{ledgerId}`

堂數流水採 append-only。現在會寫入 `grant` 與 `consume`；取消或未完成屬於釋放預約，沒有額外流水。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `userId` | string | 會員 user ID |
| `type` | string | `grant` 或 `consume` |
| `quantity` | number | 儲值為正數；消耗固定為 `-1` |
| `batchId` | string | 對應會員的 `creditBatches/{batchId}` |
| `planId` | string | 方案 ID |
| `planName` | string | 方案名稱快照 |
| `sessionId` | string? | `consume` 時對應課程 ID |
| `actorId` | string | 執行者 user ID |
| `note` | string? | 儲值備註 |
| `createdAt` | Timestamp | 流水建立時間 |

## `auditLogs`

路徑：`auditLogs/{logId}`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `action` | string | 操作代碼 |
| `actorId` | string | 操作者 user ID 或維護腳本識別字 |
| `targetId` | string? | 主要受影響文件 ID |
| `metadata` | map? | 操作相關參數快照 |
| `createdAt` | Timestamp | 操作時間 |

目前常見 action：

- `user.roles_updated`
- `credits.granted`
- `plan.created`、`plan.updated`、`plans.reordered`
- `sessions.created`、`session.updated`
- `session.checked_in`、`session.checkin_backfilled`
- `session.completed`、`session.not_completed`、`session.cancelled`
- `maintenance.bookings_and_credits_reset`

## 一致性與反正規化

Firestore 沒有 join，因此以下名稱會保存快照：

- `sessions.studentName` / `sessions.coachName`
- `sessions.planName`
- `creditBatches.planName`
- `creditLedgers.planName`

修改會員名稱或方案名稱不會回寫歷史課程與流水。這能保留報表當時的顯示內容，但也代表歷史名稱可能與目前主檔不同。

使用者文件中的 `credits` 是快速查詢用的彙總；各方案精確來源是 `creditBatches`。所有預約、完成、未完成與取消操作必須透過既有 transaction service 更新兩者，不應直接在 Console 單獨修改其中一邊。

## 查詢與 Index

`firestore.indexes.json` 目前定義以下 `sessions` 複合索引：

1. `studentId ASC, status ASC, startAt ASC`
2. `studentId ASC, startAt ASC`
3. `coachId ASC, status ASC, endAt DESC`
4. `status ASC, endAt DESC`

目前主要範圍查詢還包括：

- `sessions.startAt >= from AND startAt < to ORDER BY startAt ASC`
- `sessions.endAt <= now ORDER BY endAt DESC`
- `timeSlots.startAt >= from AND startAt < to ORDER BY startAt ASC`
- `users.roles ARRAY_CONTAINS role`

單欄位查詢通常由 Firestore 自動索引處理；若日後將角色或狀態過濾下推至同一查詢，應同步更新 `firestore.indexes.json`。

## 存取方式與安全規則

前端不直接連線 Firestore。所有資料存取都經由 Next.js server route 與 Firebase Admin SDK；`firestore.rules` 對所有 client read/write 設為 `false`。角色權限由 server session 檢查：

- Admin：會員、方案、報表與所有課程管理。
- Coach：只建立、查看與修改自己的課程；可查看自己的待確認課程。
- Student：查看個人資料、方案堂數、自己的預約與打卡。

## 清除腳本

`npm run data:reset-bookings-credits` 會刪除：

- `sessions`
- `recurrenceSeries`
- `timeSlots`
- `coachSlotLocks`
- `studentSlotLocks`
- `creditLedgers`
- 所有 `users/{userId}/creditBatches`

並將每位會員的 `credits` 歸零。此腳本會保留 `users`、`plans` 與既有 `auditLogs`，並新增一筆 maintenance audit log。這是破壞性操作，只應對確認過的 GCP project / Firestore database 執行。
