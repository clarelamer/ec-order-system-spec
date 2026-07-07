import { fileURLToPath } from "node:url";
import express from "express";
import { ordersRouter } from "./routes/orders.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/v1/orders", ordersRouter);

// 相容性：未被路由命中的 API 路徑回 404 統一格式
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "路徑不存在" } });
});

const PORT = Number(process.env.PORT) || 3000;

// 只有「直接執行本檔」才啟動 server；被 import（smoke test）時不啟動。
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(PORT, () => console.log(`訂單服務 PoC 已啟動：http://localhost:${PORT}`));
}

export { app };
