# AIDD Wiki — Agent conventions

> Project: `软件项目分析学习系统` (`project: proj-analysis-learner`)

## Layers

1. **`raw/`** — Source materials. Agent **read-only**.
2. **`aidd-wiki/`** — Agent-maintained Markdown. Use `[[wikilinks]]`.
3. **`output/`** — Session reports.

## Requirements vs Design

| Spec (`01-Requirements/modules/`) | Design (`02-Design/modules/`) |
|-------------------------------------|----------------------------------|
| User stories, AC, F-xxx capabilities | ENT-xxx domain model, API-xxx, DDL, DEMO |
| Business rules, capability **intent** | `DES-*.md`, `domain/ENT.md`, `ddl/schema.sql`, `api/API.md`, `demo/**/DEMO.md` |

Index: **`01-Requirements/Requirements-Graph.md`** (max 3 levels: module → area → point).

## Directories

| Path | /aidd |
|------|-------|
| `_slots/` | Cross-phase invariants / prefs (Brief inject) |
| `_pending/` | Multi-file staging before **入库** promote |
| `handoffs/` | Open → accepted → done session batons |
| `sessions/` | Rule-based daily summaries (zero LLM) |
| `observations/` | Hook / silent capture append log |
| `archive/` | Superseded + swept pages |
| `Requirements-Graph.md` | spec updates graph |
| `modules/<m>/<m>.md` | L1 模块节点 |
| `modules/<m>/<a>/<a>.md` | L2 功能域节点 |
| `<p>/<p>.md` + `REQ.md` / `SPEC.md` | L3 链式图谱（`parent` 只链上一级） |
| `02-Design/standards/*.md` | init 分类型导入；design 按 `范围:` 只读其一 |
| `output/fe-demo/` | Design System 工程（`参考路径:` 拷贝或脚手架） |
| `02-Design/_templates/DEMO.md` 等 | init 导入；复制到 `modules/.../demo/.../DEMO.md` |
| `02-Design/Design-Graph.md` | design index |
| `02-Design/modules/<m>/DES-<m>.md` + `domain/` `ddl/` `api/` `demo/` | design |
| `05-Test-Tasks/specs/FE-PW-PLAN-*.md` | fe-test Playwright plan |
| `05-Test-Tasks/specs/BE-API-PLAN-*.md` | be-test API plan |
| `05-Test-Tasks/FE-TEST-*.md` / `BE-TEST-*.md` | acceptance execution records |
| `raw/design/` | 线框/参考 UI（只读） |

## On 入库 (spec)

1. Split multi-feature descriptions into L1/L2/L3; update **Requirements-Graph.md**
2. Do not put ER/OpenAPI in SPEC
3. ≥3 files or **暂存** → `_pending/` then promote on **入库**
4. Supersede prior SPEC with `is_latest` / `supersedes`
5. Append `log.md` per `_shared.md` (prefer `phase | op | summary`)

## On Test

- `/aidd:fe-test` plans and runs Playwright acceptance for user-visible frontend flows.
- `/aidd:be-test` plans and runs Java API acceptance for business interface contracts.
- Backend test scope is API-level proof for frontend integration, not Service/Mapper/unit coverage.
- After runs, optional: `python "$AIDD_CLI" observe --kind fe-test|be-test --summary "…"`.

## Memory aids (P0–P2)

- **Brief** on `/aidd` and `/aidd:status`
- **Handoff** via `/aidd:handoff`
- **wiki-search** before deep reads
- **sweep** via `/aidd:sweep` for stale drafts
- Project root `.aidd.toml` `[capture] ignore_paths`

## Forbidden

- Flat dump of sub-requirements into one SPEC
- Full API/entity tables in spec
- Long stems `REQ-<m>-<a>-<p>.md` or skipping parent links (breaks graph chain)
- **`/aidd:init`** must not touch `01-Requirements/**`
- Treating skipped/empty tests as pass
- Treating `archive/` or `is_latest: false` as current truth

## Obsidian

`$AIDD_SKILL_ROOT/scripts/cli.py` with **入库** and `OBSIDIAN_SKILL_WRITE=1`.
