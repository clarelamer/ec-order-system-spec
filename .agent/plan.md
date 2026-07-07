# Plan: EC Order System 規格＋PoC

## Handoff Note

- **Current**: 五份交付物與 PoC 全部完成，smoke test 19/19 通過。專案 README、PoC README、process-log #001–#003 齊備。
- **Why stopped**: 交付完成，等 Lucia 審閱後發布獨立 GitHub repo。
- **Next action**: Lucia 審閱 → 發布到新 public repo（建議名 `ec-order-system-spec`）。

## 交付順序（一致性鏈，由上而下）

- [x] 專案骨架與 CLAUDE.md
- [x] `docs/01-requirements.md` — 需求與 User Story
- [x] `docs/02-er-diagram.md` — 資料模型（Mermaid erDiagram）
- [x] `docs/03-state-machine.md` — 訂單狀態機（Mermaid stateDiagram-v2）
- [x] `docs/04-api-spec.md` — RESTful API Spec（6 支，PoC 實作 3 支）
- [x] `poc/` — Prisma schema ＋ 3 支端點（Express＋Zod＋SQLite），smoke test 19/19
- [ ] README ＋ 發布到獨立 GitHub repo（待審閱）

## 一致性鏈檢查點

ER 實體 → 狀態機的狀態欄位 → API 的 request/response → Prisma schema。
每完成一層，往上對齊一次再往下走。
