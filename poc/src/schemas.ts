import { z } from "zod";

// Zod schema 對齊 docs/04-api-spec.md 的 request body。驗證失敗 → 400。

export const createOrderSchema = z.object({
  memberId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "訂單至少需一個品項"),
});

export const paymentSchema = z.object({
  method: z.string().min(1),
  amountCents: z.number().int().positive(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
