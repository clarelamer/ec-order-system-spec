# 產出過程紀錄（Process Log）

> 這份紀錄本身就是交付物。它證明的不是「文件寫得好」，而是「我設計了一套流程，讓 AI 穩定產出高品質 spec，而我負責審核與迭代」。
> 每則紀錄含：日期、做了什麼、關鍵決策與理由、prompt/流程設計、遇到的問題與修正循環。新的在最上面。

---

## 2026-07-07 — #003 PoC 實作與驗證（一致性鏈末端）

**做了什麼**：實作可跑 PoC（Express＋Prisma＋SQLite＋Zod），三支端點（建單 T1／查詢／付款 T2），寫 smoke test 跑過 happy path 與 6 類邊界情況，19/19 通過。

**一致性鏈落地**：程式的每個檔案都對應一份 spec——`schema.prisma`↔ER、`status.ts`↔狀態機轉移表、`schemas.ts`↔API request、`routes/orders.ts`↔API 端點。狀態機的合法轉移直接編碼在 `status.ts` 的 `ALLOWED_TRANSITIONS`，程式不允許繞過它改 status。

**遇到的問題與修正循環**：

1. **libuv assertion on teardown**（Windows）：smoke test 結尾出現 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`。19 項斷言已全過、只是收尾崩。原因是 `process.exit()` 與 http server handle 關閉的 race。**修正**：改成 `await new Promise(resolve => server.close(resolve))` 優雅關閉後，用 `process.exitCode` 取代 `process.exit()`，讓 node 自然退出。
2. **多餘的 3000 埠 listener**：smoke test import `app` 時，`index.ts` 也自動 `listen(3000)`。原本用 `NODE_ENV !== "test"` 守衛不夠乾淨。**修正**：改用 `process.argv[1] === fileURLToPath(import.meta.url)` 判斷「是否為直接執行的主檔」，被 import 時不啟動 server。

**驗證的關鍵行為**：庫存兩階段（建單 stock 10→8/reserved 0→2、付款後 reserved→0）、冪等重送不重複建單、庫存不足擋在交易內（防超賣）、非法狀態轉移回 409。

**下一步**：寫專案 README，發布到獨立 GitHub repo（待 Lucia 審閱）。

## 2026-07-07 — #002 四份規格文件（一致性鏈上半）

**做了什麼**：依序產出 `docs/01-requirements.md` → `02-er-diagram.md` → `03-state-machine.md` → `04-api-spec.md`。

**流程設計（重點）**：四份文件**刻意按依賴順序產出**，每份開頭標注「上游／下游」，強制形成一致性鏈：

```
需求(User Story + AC + BR) → ER(實體欄位) → 狀態機(轉移表) → API(端點↔轉移)
```

這樣設計的目的，是讓「AI 產出的 spec 品質」有客觀的檢查點，而不是靠人逐字讀感覺對不對。例如：狀態機的 6 個狀態必須等於 ER 的 `ORDER.status` 合法值，必須等於 API 對照表的轉移目標——三處對不上就是 bug，一眼可查。

**關鍵決策**：

1. **金額一律存整數分（BR-6）**：從需求就定調，貫穿 ER（`Int _cents`）、API（response 標注單位）、PoC（Prisma `Int`）。避免浮點誤差是金流系統的基本功，提前在源頭鎖死。
2. **部分退貨用「主狀態不變＋子實體記錄」解耦**（狀態機 §4.2）：若把每種退貨組合設成訂單主狀態，狀態機會爆炸。這是刻意避開的設計陷阱，也是面試可講的系統設計判斷。
3. **庫存兩階段（預扣／正式扣減）**：用 `PRODUCT.reserved_quantity` 獨立欄位，讓「鎖住」與「賣掉」可區分，併發下單靠交易內條件更新防超賣。
4. **PoC 範圍誠實切分**：API Spec 六支端點，PoC 只實作三支（建單／查詢／付款），其餘標 `未實作於 PoC`。誠實區分「設計了」與「做出來了」，符合 CLAUDE.md 產出規則第 5 條。

**下一步**：實作 PoC——Prisma schema（對齊 ER）＋ 三支端點（對齊 API Spec 與狀態機的 T1/T2）＋ seed 資料 ＋ README 跑法。

---

## 2026-07-07 — #001 專案啟動與 context 骨架

**做了什麼**：建立專案骨架（`06.EC-Order-System`），寫下 `CLAUDE.md` 作為 AI-first 工作流的行為契約。

**關鍵決策**：

1. **範圍收斂在訂單流程**，而非整個電商。理由：規格價值在深度不在廣度，把訂單的邊界情況（付款逾時、部分退貨、併發）做透，比鋪十個淺模組更能證明系統設計能力。
2. **以「一致性鏈」作為審核 AI 產出的主要抓手**：ER 實體 → 狀態機欄位 → API schema → Prisma schema 必須互相對齊。這把「規格品質」從主觀感覺轉成可檢查的客觀關係——任一層改動，下游都要複查。
3. **技術選型綁定「每個技術對應一份規格」原則**：TypeScript（型別即規格）、Prisma（schema 即資料模型文件）、Zod（驗證即 API schema）。選型不為炫技，為的是讓規格與程式的映射可查。

**流程設計**：CLAUDE.md 第 5 節寫死「每個 session 的行為契約」——先讀 CLAUDE.md → process-log → plan.md，動工前對齊上游、產出後回寫紀錄。這是讓「不同時間、不同 session 的 AI 產出保持一致」的核心機制，也是這個專案要示範的能力本身。

**下一步**：撰寫 `docs/01-requirements.md`（需求文件與 User Story），界定角色、範圍、非目標。
