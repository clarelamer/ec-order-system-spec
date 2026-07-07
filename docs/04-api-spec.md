# 04. API Spec：訂單 RESTful 端點

> 上游：`01-requirements.md`、`02-er-diagram.md`（response 欄位）、`03-state-machine.md`（每支端點對應一次狀態轉移）
> 下游：`poc/`（實作標注 ✅ 的端點）

---

## 0. 通用約定

- **Base path**：`/api/v1`
- **格式**：request/response 一律 `application/json`
- **金額**：所有 `*_cents` 欄位為整數，單位「分」（BR-6）
- **時間**：ISO-8601 字串（UTC）
- **冪等性**：寫入端點接受 `Idempotency-Key` header（BR-4）
- **錯誤格式**（全站統一）：

```json
{
  "error": {
    "code": "STRING_ENUM",
    "message": "人類可讀的說明",
    "details": [ { "field": "quantity", "issue": "must be >= 1" } ]
  }
}
```

| 狀態碼 | 使用時機 |
|--------|---------|
| 200 | 讀取或轉移成功 |
| 201 | 建立成功 |
| 400 | request 格式/驗證錯誤（Zod 擋下） |
| 404 | 資源不存在 |
| 409 | 狀態衝突（非法狀態轉移、庫存不足、重複 idempotency key 衝突） |
| 422 | 語意錯誤（如退貨數量超過原購買數） |

---

## 1. 建立訂單 ✅（PoC 實作）

`POST /api/v1/orders` — 對應狀態轉移 **T1**（→ 待付款）

**Request Header**：`Idempotency-Key: <uuid>`（選填但建議）

**Request Body**：
```json
{
  "memberId": "mem_123",
  "items": [
    { "productId": "prod_1", "quantity": 2 },
    { "productId": "prod_2", "quantity": 1 }
  ]
}
```

**成功 201**：
```json
{
  "id": "ord_abc",
  "status": "PENDING_PAYMENT",
  "memberId": "mem_123",
  "totalAmountCents": 45000,
  "items": [
    { "productId": "prod_1", "quantity": 2, "unitPriceCents": 15000, "subtotalCents": 30000 },
    { "productId": "prod_2", "quantity": 1, "unitPriceCents": 15000, "subtotalCents": 15000 }
  ],
  "createdAt": "2026-07-07T08:00:00Z"
}
```

**錯誤**：
- `400` items 為空、quantity < 1、缺 memberId（Zod）
- `404` member 或 product 不存在（`code: MEMBER_NOT_FOUND` / `PRODUCT_NOT_FOUND`）
- `409` 庫存不足（`code: INSUFFICIENT_STOCK`，details 列出不足品項）；idempotency key 已用於不同 request（`code: IDEMPOTENCY_CONFLICT`）

**冪等行為**：相同 `Idempotency-Key` 重送且 body 相同 → 回傳首次建立的同一張訂單（201→200 亦可），不重複建單（AC-4）。

---

## 2. 查詢訂單 ✅（PoC 實作）

`GET /api/v1/orders/:id` — 唯讀，不涉及狀態轉移

**成功 200**：回傳訂單完整資訊，含 `items`、`payments`、`statusHistory`：
```json
{
  "id": "ord_abc",
  "status": "PAID",
  "memberId": "mem_123",
  "totalAmountCents": 45000,
  "items": [ { "productId": "prod_1", "quantity": 2, "unitPriceCents": 15000, "subtotalCents": 30000 } ],
  "payments": [ { "id": "pay_1", "status": "succeeded", "amountCents": 45000, "createdAt": "..." } ],
  "statusHistory": [
    { "fromStatus": null, "toStatus": "PENDING_PAYMENT", "actor": "customer", "createdAt": "..." },
    { "fromStatus": "PENDING_PAYMENT", "toStatus": "PAID", "actor": "customer", "createdAt": "..." }
  ],
  "createdAt": "...", "paidAt": "...", "shippedAt": null, "completedAt": null
}
```

**錯誤**：`404` 訂單不存在（`code: ORDER_NOT_FOUND`）

---

## 3. 付款 ✅（PoC 實作）

`POST /api/v1/orders/:id/payment` — 對應狀態轉移 **T2**（待付款 → 已付款）

**Request Header**：`Idempotency-Key: <uuid>`

**Request Body**：
```json
{ "method": "mock", "amountCents": 45000 }
```

**成功 200**：回傳更新後訂單（`status: "PAID"`，含新 payment 與 history）

**錯誤**：
- `409` 訂單非「待付款」狀態（`code: INVALID_STATE_TRANSITION`，message 標注當前狀態與嘗試的轉移）
- `422` 付款金額與訂單金額不符（`code: AMOUNT_MISMATCH`）
- `404` 訂單不存在

> 付款失敗（金流回失敗）不改狀態、寫一筆 `payment(failed)`，回 `200` 但 `order.status` 仍為 `PENDING_PAYMENT`，可重試（US-02 AC-3）。

---

## 4. 出貨（Spec-only，未實作於 PoC）

`POST /api/v1/orders/:id/shipment` — 對應狀態轉移 **T5**（已付款 → 已出貨）

- 權限：營運人員
- 成功 200：`status: "SHIPPED"`，記錄 `shippedAt`
- 錯誤：`409` 訂單非「已付款」

---

## 5. 取消訂單（Spec-only，未實作於 PoC）

`POST /api/v1/orders/:id/cancel` — 對應狀態轉移 **T3 或 T6**

- 待付款訂單 → 直接取消（T3），釋放庫存
- 已付款未出貨 → 觸發退款後取消（T6）
- 成功 200：`status: "CANCELLED"`
- 錯誤：`409` 訂單已出貨或已完成（`code: NOT_CANCELLABLE`，訊息引導改走退貨）

---

## 6. 申請退貨（Spec-only，未實作於 PoC）

`POST /api/v1/orders/:id/returns` — 對應狀態轉移 **T8 或 T9**

**Request Body**（支援部分退貨）：
```json
{
  "items": [ { "orderItemId": "oi_1", "quantity": 1 } ],
  "reason": "商品瑕疵"
}
```

- 成功 201：建立 `RETURN_REQUEST`（status `requested`），等待營運審核
- 審核通過後：全額退貨 → T8（`RETURNED`）；部分退貨 → T9（主狀態不變）
- 錯誤：
  - `409` 訂單非「已出貨/已完成」（`code: NOT_RETURNABLE`）
  - `422` 退貨數量使累計超過原購買數（`code: RETURN_QUANTITY_EXCEEDED`，BR-5）

---

## 7. 端點 ↔ 狀態轉移對照總表

| 端點 | 方法 | 轉移 | PoC |
|------|------|------|:---:|
| `/orders` | POST | T1 | ✅ |
| `/orders/:id` | GET | —（唯讀） | ✅ |
| `/orders/:id/payment` | POST | T2 | ✅ |
| `/orders/:id/shipment` | POST | T5 | spec |
| `/orders/:id/cancel` | POST | T3 / T6 | spec |
| `/orders/:id/returns` | POST | T8 / T9 | spec |

> PoC 實作 3 支端點（建單、查詢、付款），完整走過「建立 → 待付款 → 付款 → 已付款」與庫存兩階段扣減，足以驗證一致性鏈跑得通。其餘端點在 spec 完整定義，誠實標注 `未實作於 PoC`。
