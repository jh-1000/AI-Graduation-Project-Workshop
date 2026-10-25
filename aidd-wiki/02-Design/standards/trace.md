---
project: proj-analysis-learner
type: design-standards
standard: trace
phase: design
status: active
date: 2026-10-25
---

# Standard — 追溯

> Skill 真源：`$AIDD_SKILL_ROOT/templates/aidd-wiki/standards/trace.md`；`模式:初始化` 同步到项目 `aidd-wiki/02-Design/standards/trace.md`。

## 业务追溯

- 每个 `API-xxx`、`ENT-xxx` 必须对应 SPEC 的 `F-xxx` 或 AC。
- DES 维护 API / 数据模型追溯表；禁止无 F-ID 的接口或表。
- UI 交互步骤须标注 `API-xxx` 并链到 `api/API.md`。

## Obsidian：需求 ↔ 设计双链（强制）

需求在 `01-Requirements/`，设计在 `02-Design/`。**必须用 `[[wikilink]]`** 跨目录关联，禁止只写纯文本路径（图谱不会连边）。

### 模块名对照

| 需求 L1（`01-Requirements/modules/`） | 设计目录（`02-Design/modules/`） |
|--------------------------------------|----------------------------------|
| `monitoring` | `monitoring-mgmt` |
| `model-management` | `model-management` |

L2/L3 路径（`monitor-list/list` 等）一般一致；仅 L1 目录名可能不同，以 DES § **需求↔设计** 与 `Requirements-Graph` 对照表为准。

### 必链位置

| 文件 | 须链到 |
|------|--------|
| 每个 `SPEC.md` § **设计跟进** | DES、UI、API（按需） |
| 每个 `UI.md` § **关联** | 对应 SPEC（完整 vault 路径）、DES |
| `DES-<module>.md` | 需求 L1 + § **需求↔设计** 表（每个 L3 point） |
| `Requirements-Graph.md` § **与 Design** | DES + 各 L3 SPEC↔UI |
| `Design-Graph.md` § **与 Requirements** | 需求 L1 + 各 L3 SPEC↔UI |
| L1 `<module>.md` | 对应 `DES-<design-module>` |

### SPEC § 设计跟进（模板）

```markdown
## 设计跟进

| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/<design-module>/DES-<design-module>\|DES]] |
| UI | [[02-Design/modules/<design-module>/ui/<area>/<point>/UI\|UI]] |
| API | [[02-Design/modules/<design-module>/api/API\|API]] |
```

### UI § 关联（模板）

```markdown
## 关联

- SPEC：[[01-Requirements/modules/<req-module>/<area>/<point>/SPEC\|SPEC]]
- DES：[[../../DES-<design-module>\|DES]]
```

### DES § 需求↔设计（模板）

```markdown
## 需求↔设计（Obsidian）

| 需求 SPEC | UI | API |
|-----------|-----|-----|
| [[01-Requirements/modules/<req-module>/<area>/<point>/SPEC\|SPEC]] | [[ui/<area>/<point>/UI\|UI]] | [[api/API\|API]] |
```

### 入库检查（spec / design）

- [ ] `Requirements-Graph` § 与 Design 已更新
- [ ] `Design-Graph` § 与 Requirements 已更新
- [ ] 涉及 L3 的 SPEC **设计跟进** 均为 `[[wikilink]]`
- [ ] 新建/更新的 UI **关联** 含 SPEC + DES
- [ ] DES 含 **需求↔设计** 表且链到 `01-Requirements/.../SPEC`

`/aidd:spec` 写 SPEC、`/aidd:design` 入库时**必须**执行上述维护（见 `commands/_shared.md`、`commands/spec.md`、`commands/design.md`）。

索引：[[README]]。
