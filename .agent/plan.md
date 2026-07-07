# Plan: EC Order System 規格＋PoC

## Handoff Note

- **Current**: 專案骨架已建立（CLAUDE.md、process-log #001、.gitignore）。
- **Why stopped**: 骨架完成，接續撰寫第一份交付物。
- **Next action**: 寫 `docs/01-requirements.md`（需求文件與 User Story）。

## 交付順序（一致性鏈，由上而下）

- [x] 專案骨架與 CLAUDE.md
- [ ] `docs/01-requirements.md` — 需求與 User Story
- [ ] `docs/02-er-diagram.md` — 資料模型（Mermaid erDiagram）
- [ ] `docs/03-state-machine.md` — 訂單狀態機（Mermaid stateDiagram-v2）
- [ ] `docs/04-api-spec.md` — RESTful API Spec（3–5 支端點）
- [ ] `poc/` — Prisma schema ＋ 1–2 支端點（Express＋Zod＋SQLite）
- [ ] README ＋ 發布到獨立 GitHub repo

## 一致性鏈檢查點

ER 實體 → 狀態機的狀態欄位 → API 的 request/response → Prisma schema。
每完成一層，往上對齊一次再往下走。
