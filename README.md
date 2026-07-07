# 電商訂單系統：規格與 PoC

> 以 **AI-first workflow** 完整交付一次電商訂單流程的規格與可跑 PoC。
> 重點不只是「文件寫得好」，而是**設計一套流程讓 AI 穩定產出高品質 spec，人負責審核與迭代**——完整產出過程記錄在 [`process-log.md`](process-log.md)。

## 這個專案示範什麼

從需求到系統設計的端到端交付能力，以及用 AI 加速的工作流。範圍**刻意收斂在訂單流程**（不做整個電商），把付款逾時、部分退貨、併發下單防超賣等邊界情況做透。

## 一致性鏈（核心設計）

五份交付物按依賴順序產出，每份標注上下游，形成可客觀檢查的一致性鏈——任一層改動，下游都要複查：

```
需求 (User Story + AC + 業務規則)
  └→ ER Diagram (實體與欄位)
       └→ State Machine (狀態與轉移守衛)
            └→ API Spec (端點 ↔ 轉移)
                 └→ PoC (Prisma schema + 端點實作)
```

例如：狀態機的 6 個狀態 = ER 的 `ORDER.status` 合法值 = API 對照表的轉移目標 = PoC 的 status 常數。三處對不上就是 bug，一眼可查。這是把「spec 品質」從主觀感覺轉成客觀檢查的機制。

## 交付物

| # | 交付物 | 檔案 |
|---|--------|------|
| 1 | 需求文件與 User Story | [`docs/01-requirements.md`](docs/01-requirements.md) |
| 2 | ER Diagram（Mermaid） | [`docs/02-er-diagram.md`](docs/02-er-diagram.md) |
| 3 | State Machine（Mermaid） | [`docs/03-state-machine.md`](docs/03-state-machine.md) |
| 4 | API Spec（RESTful） | [`docs/04-api-spec.md`](docs/04-api-spec.md) |
| 5 | 可跑 PoC | [`poc/`](poc/) — Express + Prisma + SQLite |
| — | AI 工作流契約 | [`CLAUDE.md`](CLAUDE.md) |
| — | 產出過程紀錄 | [`process-log.md`](process-log.md) |

## 跑 PoC

```bash
cd poc && npm install && npm run setup && npm run smoke
```

預期輸出：`結果：19 passed, 0 failed`（涵蓋 happy path 與 6 類邊界情況）。

## AI-first workflow 的體現

- **[`CLAUDE.md`](CLAUDE.md)**：每個 AI session 進來的行為契約——範圍、交付物、選型、產出規則、session 交接協定
- **[`process-log.md`](process-log.md)**：每個階段的決策、prompt/流程設計、修正循環。過程即作品
- **設計陷阱的判斷**：例如部分退貨用「主狀態不變＋子實體記錄」解耦，避免狀態機爆炸（見 `docs/03` §4.2）

---

*此專案為求職作品集的一部分，展示 Technical PM 的系統設計與 AI 協作能力。*
