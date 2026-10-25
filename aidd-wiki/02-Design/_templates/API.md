---
project: proj-analysis-learner
type: design-api
module: <module>
phase: design
status: draft
date: 2026-10-25
---

# API — <module>

> 规范：`02-Design/standards/api.md`

## 模块约定

| 项 | 值 |
|----|-----|
| Base | `/api/v1`（模块内统一） |
| Auth | Bearer / 会话 |
| 响应信封 | `{ code, success, message, data }` |

## 操作类型清单（按资源补齐）

| 类型 | Path 模式 | Method | data |
|------|-----------|--------|------|
| page | `/{resource}/page-query` | POST | `rows` + 分页 |
| list | `/{resource}/list` | GET | `list[]` |
| detail | `/{resource}/{id}` | GET | 对象 |
| create | `/{resource}` | POST | 含 `id` |
| update | `/{resource}/{id}` | PUT/PATCH | 对象或 null |
| delete | `/{resource}/{id}` | DELETE | null |

## 接口列表

### API-001 <接口名称>（page | list | detail | create | update | delete）

| 项 | 内容 |
|----|------|
| 操作类型 | page |
| 接口地址 | `/api/v1/.../page-query` |
| 请求方式 | POST |
| 接口描述 | |
| F-ID | F-001 |

**请求参数**

| 参数名 | 类型 | 是否必填 | 说明 |
|--------|------|----------|------|
| | | | |

**响应字段**

| 字段路径 | 类型 | 示例 | 说明 |
|----------|------|------|------|
| code | int | 200 | |
| success | boolean | true | |
| message | string | 请求成功 | |
| data.rows | array | — | |

**请求示例**

```json
{}
```

**返回示例**

```json
{
  "code": 200,
  "success": true,
  "message": "请求成功",
  "data": {}
}
```

**错误**

| code | HTTP | 说明 |
|------|------|------|

## 追溯

| API-ID | F-ID | SPEC |
|--------|------|------|
| API-001 | F-001 | [[01-Requirements/modules/<module>/.../SPEC\|SPEC]] |

## 关联

[[../DES-<module>]]
[[../domain/ENT]]
[[02-Design/standards/api]]
