import { Router, type Request, type Response } from "express";
import { prisma } from "../db.js";
import { createOrderSchema, paymentSchema } from "../schemas.js";
import { OrderStatus, canTransition } from "../status.js";

export const ordersRouter = Router();

// 統一錯誤回傳（對齊 API Spec §0）
function fail(
  res: Response,
  httpStatus: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(httpStatus).json({ error: { code, message, details } });
}

// 讀取完整訂單（GET 與寫入後回傳共用）
async function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
}

// ── 1. 建立訂單（POST /orders）─ 狀態轉移 T1 ──────────────────
ordersRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "request 格式錯誤", parsed.error.issues);
  }
  const { memberId, items } = parsed.data;
  const idempotencyKey = req.header("Idempotency-Key") ?? null;

  // 冪等：相同 key 已建過 → 回傳原訂單（BR-4 / AC-4）
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return res.status(200).json(await loadOrder(existing.id));
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return fail(res, 404, "MEMBER_NOT_FOUND", `會員 ${memberId} 不存在`);

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      // 逐項預扣庫存：條件更新確保不超賣（§4.3）。updateMany 回傳 count=0 代表庫存不足。
      const snapshots: { productId: string; quantity: number; unitPriceCents: number }[] = [];
      for (const line of items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw { code: "PRODUCT_NOT_FOUND", productId: line.productId };

        const reserved = await tx.product.updateMany({
          where: { id: line.productId, stockQuantity: { gte: line.quantity } },
          data: {
            stockQuantity: { decrement: line.quantity },
            reservedQuantity: { increment: line.quantity },
          },
        });
        if (reserved.count === 0) {
          throw { code: "INSUFFICIENT_STOCK", productId: line.productId, requested: line.quantity, available: product.stockQuantity };
        }
        snapshots.push({ productId: line.productId, quantity: line.quantity, unitPriceCents: product.priceCents });
      }

      const totalAmountCents = snapshots.reduce((sum, s) => sum + s.unitPriceCents * s.quantity, 0);

      const order = await tx.order.create({
        data: {
          memberId,
          status: OrderStatus.PENDING_PAYMENT,
          totalAmountCents,
          idempotencyKey,
          items: {
            create: snapshots.map((s) => ({
              productId: s.productId,
              quantity: s.quantity,
              unitPriceCents: s.unitPriceCents,
              subtotalCents: s.unitPriceCents * s.quantity,
            })),
          },
          statusHistory: {
            create: { fromStatus: null, toStatus: OrderStatus.PENDING_PAYMENT, actor: "customer" },
          },
        },
      });
      return order.id;
    });

    return res.status(201).json(await loadOrder(orderId));
  } catch (e: any) {
    if (e?.code === "PRODUCT_NOT_FOUND")
      return fail(res, 404, "PRODUCT_NOT_FOUND", `商品 ${e.productId} 不存在`);
    if (e?.code === "INSUFFICIENT_STOCK")
      return fail(res, 409, "INSUFFICIENT_STOCK", "庫存不足", [e]);
    throw e;
  }
});

// ── 2. 查詢訂單（GET /orders/:id）─ 唯讀 ─────────────────────
ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const order = await loadOrder(req.params.id);
  if (!order) return fail(res, 404, "ORDER_NOT_FOUND", `訂單 ${req.params.id} 不存在`);
  return res.json(order);
});

// ── 3. 付款（POST /orders/:id/payment）─ 狀態轉移 T2 ─────────
ordersRouter.post("/:id/payment", async (req: Request, res: Response) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "request 格式錯誤", parsed.error.issues);
  }
  const { method, amountCents } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) return fail(res, 404, "ORDER_NOT_FOUND", `訂單 ${req.params.id} 不存在`);

  // 守衛：只有待付款可付款（非法轉移 → 409）
  if (!canTransition(order.status, OrderStatus.PAID)) {
    return fail(res, 409, "INVALID_STATE_TRANSITION", `訂單目前為 ${order.status}，不可付款`);
  }
  if (amountCents !== order.totalAmountCents) {
    return fail(res, 422, "AMOUNT_MISMATCH", `付款金額 ${amountCents} 與訂單金額 ${order.totalAmountCents} 不符`);
  }

  await prisma.$transaction(async (tx) => {
    // 預扣轉正式扣減：reserved-- （stock 在建單時已扣，付款只是把「鎖住」落定為「賣掉」，BR-2）
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { reservedQuantity: { decrement: item.quantity } },
      });
    }
    await tx.payment.create({
      data: { orderId: order.id, amountCents, status: "succeeded", method },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: OrderStatus.PAID, actor: "customer" },
    });
  });

  return res.json(await loadOrder(order.id));
});
