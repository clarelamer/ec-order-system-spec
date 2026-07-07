// Smoke test：啟動 server，跑一次完整流程與關鍵邊界情況。
// 執行：npm run setup && npm run smoke
import { app } from "./index.js";
import { prisma } from "./db.js";

const PORT = 3999;
const base = `http://localhost:${PORT}/api/v1/orders`;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`, extra ?? "");
  }
}

async function reseed() {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.member.deleteMany();
  await prisma.member.create({ data: { id: "mem_demo", email: "l@example.com", name: "Lucia" } });
  await prisma.product.createMany({
    data: [
      { id: "prod_keyboard", name: "機械鍵盤", priceCents: 15000, stockQuantity: 10 },
      { id: "prod_mouse", name: "無線滑鼠", priceCents: 8000, stockQuantity: 3 },
    ],
  });
}

async function main() {
  await reseed();
  const server = app.listen(PORT);
  try {
    // 1. 建立訂單（T1）：2 鍵盤 + 1 滑鼠 = 30000 + 8000 = 38000
    const createRes = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "key-001" },
      body: JSON.stringify({ memberId: "mem_demo", items: [
        { productId: "prod_keyboard", quantity: 2 },
        { productId: "prod_mouse", quantity: 1 },
      ] }),
    });
    const order = await createRes.json();
    console.log("\n[流程] 建立訂單");
    check("HTTP 201", createRes.status === 201, createRes.status);
    check("狀態為 PENDING_PAYMENT", order.status === "PENDING_PAYMENT");
    check("金額快照正確 (38000)", order.totalAmountCents === 38000, order.totalAmountCents);
    check("寫入一筆 status history", order.statusHistory?.length === 1);

    // 庫存已預扣：鍵盤 stock 10→8, reserved 0→2
    const kb = await prisma.product.findUnique({ where: { id: "prod_keyboard" } });
    check("鍵盤庫存預扣 (stock 8, reserved 2)", kb?.stockQuantity === 8 && kb?.reservedQuantity === 2, kb);

    // 2. 冪等：相同 key 重送 → 同一張訂單，不重複建單
    const dupRes = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "key-001" },
      body: JSON.stringify({ memberId: "mem_demo", items: [{ productId: "prod_keyboard", quantity: 2 }, { productId: "prod_mouse", quantity: 1 }] }),
    });
    const dup = await dupRes.json();
    console.log("\n[邊界] 冪等重送");
    check("回傳同一張訂單 id", dup.id === order.id, dup.id);
    const orderCount = await prisma.order.count();
    check("訂單數仍為 1（未重複建單）", orderCount === 1, orderCount);

    // 3. 查詢訂單（GET）
    const getRes = await fetch(`${base}/${order.id}`);
    const fetched = await getRes.json();
    console.log("\n[流程] 查詢訂單");
    check("HTTP 200", getRes.status === 200);
    check("含 items", fetched.items?.length === 2);

    // 4. 庫存不足（T1 守衛）：滑鼠只剩 3 - 1(預扣) = 2 可售，訂 5 應失敗
    const oosRes = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem_demo", items: [{ productId: "prod_mouse", quantity: 5 }] }),
    });
    console.log("\n[邊界] 庫存不足");
    check("HTTP 409", oosRes.status === 409, oosRes.status);
    check("錯誤碼 INSUFFICIENT_STOCK", (await oosRes.json()).error?.code === "INSUFFICIENT_STOCK");

    // 5. 驗證錯誤（400）：空 items
    const badRes = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem_demo", items: [] }),
    });
    console.log("\n[邊界] 驗證錯誤");
    check("空 items → HTTP 400", badRes.status === 400, badRes.status);

    // 6. 付款金額不符（422）
    const wrongAmt = await fetch(`${base}/${order.id}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "mock", amountCents: 999 }),
    });
    console.log("\n[邊界] 付款金額不符");
    check("HTTP 422", wrongAmt.status === 422, wrongAmt.status);

    // 7. 付款成功（T2）
    const payRes = await fetch(`${base}/${order.id}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "mock", amountCents: 38000 }),
    });
    const paid = await payRes.json();
    console.log("\n[流程] 付款");
    check("HTTP 200", payRes.status === 200);
    check("狀態轉為 PAID", paid.status === "PAID");
    check("寫入 payment(succeeded)", paid.payments?.[0]?.status === "succeeded");
    check("status history 增為 2 筆", paid.statusHistory?.length === 2);
    const kb2 = await prisma.product.findUnique({ where: { id: "prod_keyboard" } });
    check("付款後預扣落定 (reserved 回 0)", kb2?.reservedQuantity === 0, kb2?.reservedQuantity);

    // 8. 重複付款（T2 守衛，非法轉移 409）
    const payAgain = await fetch(`${base}/${order.id}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "mock", amountCents: 38000 }),
    });
    console.log("\n[邊界] 已付款訂單再付款");
    check("HTTP 409 (INVALID_STATE_TRANSITION)", payAgain.status === 409, payAgain.status);

    console.log(`\n───────────\n結果：${pass} passed, ${fail} failed`);
  } finally {
    // 優雅關閉：等 server 完全關閉再 disconnect，避免 Windows 上 process.exit 與 handle 關閉的 race
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
  process.exitCode = fail === 0 ? 0 : 1;
}

main();
