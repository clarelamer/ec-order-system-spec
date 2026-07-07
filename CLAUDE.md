# CLAUDE.md — 電商訂單系統規格專案的 AI-first 工作流入口

> 這份檔案是「設計流程讓 AI 穩定產出高品質 spec」的核心。它不是筆記，而是**每個 AI session 進來時的行為契約**：讀完就知道這個專案在做什麼、規格長什麼樣、產出要遵守哪些規則。
> 專案定位：以 AI-first workflow 完整交付一次電商訂單系統的規格與 PoC。**過程即作品**——prompt、決策、修正循環都記錄在 `process-log.md`。

---

## 1. 專案目標與範圍

**目標**：交付一套「訂單流程」的完整規格（需求 → ER Diagram → State Machine → API Spec）與一個可跑的 PoC，證明從需求到系統設計的端到端能力。

**範圍收斂**：只做**訂單流程**，不做整個電商平台。

- ✅ 涵蓋：下單、付款、出貨、完成、取消、退貨的訂單生命週期；訂單與商品、會員、付款的資料關聯
- ❌ 不涵蓋：商品管理後台、購物車 UI、金流商實際串接、物流商 API、推薦系統、行銷活動

**為什麼收斂**：規格的價值在深度不在廣度。把訂單流程的邊界情況（付款逾時、部分退貨、併發下單）做透，比鋪開十個淺的模組更能證明系統設計能力。

## 2. 交付物與位置

| 交付物 | 檔案 | 狀態 |
|--------|------|------|
| 需求文件與 User Story | `docs/01-requirements.md` | 待建立 |
| ER Diagram（資料模型） | `docs/02-er-diagram.md` | 待建立 |
| State Machine（訂單狀態機） | `docs/03-state-machine.md` | 待建立 |
| API Spec（RESTful 端點） | `docs/04-api-spec.md` | 待建立 |
| 可跑 PoC | `poc/`（Prisma＋Express） | 待建立 |
| 產出過程紀錄 | `process-log.md` | 進行中 |

交付物之間必須**互相對齊**：ER 的實體 → State Machine 的狀態欄位 → API 的 request/response → PoC 的 Prisma schema。任何一層改動，下游都要跟著檢查。這條「一致性鏈」是審核 AI 產出的主要抓手。

## 3. 技術選型（PoC）

- **語言**：TypeScript（型別即輕量規格，與 spec 呼應）
- **API 框架**：Express（易讀、生態成熟，PoC 不需要重框架）
- **ORM**：Prisma（schema 檔本身就是可讀的資料模型文件，對齊 ER Diagram；JD 情境也用 Prisma）
- **資料庫**：SQLite（零設定、可直接跑；Prisma 只要改 datasource 就能換 PostgreSQL）
- **驗證**：Zod（request 驗證，schema 對齊 API Spec）

選型原則：**每個技術都要能對應到一份規格**，讓「規格 ↔ 程式」的映射清楚可查，而不是炫技。

## 4. 產出規則（給 AI 的硬約束）

1. **繁體中文**撰寫所有文件；程式碼註解精簡、只寫「為什麼」不寫「做什麼」
2. **圖用 Mermaid**：ER 用 `erDiagram`、狀態機用 `stateDiagram-v2`，確保 GitHub 直接渲染
3. **API Spec 每支端點必含**：method、path、path/query params、request body schema、成功 response（含狀態碼）、錯誤 response（含狀態碼與錯誤格式）、對應的狀態機轉移
4. **邊界情況優先**：每個交付物都要明確處理「不快樂路徑」（付款逾時、庫存不足、重複提交、部分退貨），happy path 只是基本盤
5. **不假裝完整**：PoC 只實作 1–2 支端點，其餘在 spec 標注 `未實作於 PoC`，誠實區分「設計了」與「做出來了」

## 5. 每個 session 的行為契約

新的 AI session 進來，依序：

1. 讀本檔（CLAUDE.md）→ 掌握範圍、交付物、選型、產出規則
2. 讀 `process-log.md` 最新一則 → 知道上次停在哪、下一步是什麼
3. 讀 `.agent/plan.md` 的 Handoff Note → 接手當前工作
4. 動工前，若要產出新交付物，先確認它與上游交付物（第 2 節的一致性鏈）對齊
5. 產出後，在 `process-log.md` 追加一則紀錄：做了什麼、關鍵決策、遇到的問題與修正

**第一次回覆必須restate**：目前停在哪、下一步要做什麼。
