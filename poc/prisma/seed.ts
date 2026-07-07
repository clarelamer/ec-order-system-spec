import { prisma } from "../src/db.js";

// 種子資料：一個會員、兩個商品，供 smoke test 與手動測試使用。
async function main() {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.member.deleteMany();

  await prisma.member.create({
    data: { id: "mem_demo", email: "lucia@example.com", name: "Lucia" },
  });

  await prisma.product.createMany({
    data: [
      { id: "prod_keyboard", name: "機械鍵盤", priceCents: 15000, stockQuantity: 10 },
      { id: "prod_mouse", name: "無線滑鼠", priceCents: 8000, stockQuantity: 3 },
    ],
  });

  console.log("種子資料建立完成：mem_demo、prod_keyboard(庫存10)、prod_mouse(庫存3)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
