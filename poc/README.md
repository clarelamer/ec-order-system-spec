# PoC：訂單服務（可跑）

對應規格：`../docs/`。本 PoC 實作一致性鏈的下游末端——把規格變成可執行、可驗證的程式。

## 技術棧

TypeScript · Express · Prisma · SQLite · Zod（選型理由見 `../CLAUDE.md` §3）

## 快速開始

```bash
cd poc
npm install
npm run setup     # 建立 SQLite schema + 種子資料
npm run smoke     # 跑一次完整流程與邊界情況的自動驗證
```

啟動服務手動測試：

```bash
npm run dev       # http://localhost:3000
```

```bash
# 建立訂單（2 鍵盤 + 1 滑鼠）
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" -H "Idempotency-Key: demo-1" \
  -d '{"memberId":"mem_demo","items":[{"productId":"prod_keyboard","quantity":2},{"productId":"prod_mouse","quantity":1}]}'

# 查詢訂單
curl http://localhost:3000/api/v1/orders/<訂單id>

# 付款
curl -X POST http://localhost:3000/api/v1/orders/<訂單id>/payment \
  -H "Content-Type: application/json" -d '{"method":"mock","amountCents":38000}'
```

## 實作了什麼（對應 API Spec）

| 端點 | 狀態轉移 | 驗證重點 |
|------|---------|---------|
| `POST /orders` | T1 | 庫存預扣（防超賣）、價格快照、冪等、交易一致性 |
| `GET /orders/:id` | 唯讀 | 回傳 items/payments/statusHistory |
| `POST /orders/:id/payment` | T2 | 狀態守衛、金額校驗、預扣轉正式扣減 |

其餘端點（出貨／取消／退貨）在 `../docs/04-api-spec.md` 完整定義，PoC 未實作。

## smoke test 涵蓋的 19 項斷言

流程：建單 → 查詢 → 付款的 happy path，加上狀態轉移與 history 寫入。
邊界：冪等重送不重複建單、庫存不足 409、空 items 400、付款金額不符 422、已付款再付款 409（非法轉移）、庫存兩階段（預扣→落定）數字正確。

## 檔案對應

| 檔案 | 對應規格 |
|------|---------|
| `prisma/schema.prisma` | ER Diagram（`docs/02`） |
| `src/status.ts` | State Machine 轉移表（`docs/03`） |
| `src/schemas.ts` | API request schema（`docs/04`） |
| `src/routes/orders.ts` | API 端點邏輯（`docs/04`） |
