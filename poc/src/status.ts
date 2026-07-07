// 訂單狀態與合法轉移 — 對齊 docs/03-state-machine.md
// 這裡是「狀態機的唯一真相」：程式不允許繞過本表直接改 order.status。

export const OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAID: "PAID",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const;

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

// 合法轉移表（from -> 允許的 to 集合）。對應狀態機轉移表 T1–T9。
const ALLOWED_TRANSITIONS: Record<string, OrderStatusValue[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED], // T2, T3/T4
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED], // T5, T6
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED, OrderStatus.RETURNED], // T7, T8
  [OrderStatus.COMPLETED]: [OrderStatus.RETURNED], // T8（部分退貨為自迴圈，不改主狀態）
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
};

export function canTransition(from: string, to: OrderStatusValue): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
