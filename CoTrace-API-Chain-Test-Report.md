# 校园二手交易平台 · 跨端交付链实测报告

日期：2026-11-06（初测）／2026-11-07（live 收口）／2026-11-08（demo 主路径收口）

## 结论（2026-11-08 收口）

Demo **仅保证两条主路径**：Alex 交付→Priya 接收；周老师读求助→正式反馈→双端同文回显。蓝图 AI / 记忆草稿 / 进度问答不在演示范围。`COTRACE_AI_MODE=mock npm run verify:chain`、`npm run verify:api`、`npm run typecheck` 已通过；有 key 时可选 `npm run verify:live`（只验分析四组）。

## 运行方式

```bash
npm run dev
# 浏览器 #/next/blueprint ，角色菜单切换 Alex / Priya / 周老师

# mock 全链路状态机 + 四组材料判定
npm run verify:chain

# 真实模型四组材料（读 .env.local 的 DEEPSEEK_API_KEY）
npm run verify:live
```

环境（与 `.env.example` / 代码默认一致）：

| 变量 | 作用 | 默认 |
|---|---|---|
| `COTRACE_AI_MODE` | `mock` 或 `live` | `mock` |
| `DEEPSEEK_API_KEY` | live 必需（仅服务端 / `.env.local`） | — |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-flash` |
| `COTRACE_AI_TIMEOUT_MS` | live 调用超时 | `60000` |

## 路由与持久化（核查）

| 能力 | 落点 | 是否调模型 |
|---|---|---|
| Alex 上传分析发布 | `#/next/publish` → `PublishDeliveryPage` | 分析：是（handoff-analysis）；发布：否（local store） |
| Priya 接手 / 改意见 / 接收 / 求助 | `#/next/receive` | 接手标注：是（handoff-focus）；接收/求助落盘：否 |
| 项目记录回显反馈 | `#/next/log` → `ProjectMemoryPage` | 否（读 processEventStore） |
| 教师待办与正式反馈 | `#/next/guide` → `#/next/stage` | 情境整理：是（help-context）；发送反馈：否 |
| 交付快照 | `cotrace-demo-submissions.handoffDelivery`（schema v4） | 否 |
| 过程事件 / 教师反馈 | `cotrace-demo-process-events` | 否 |

状态：`draft → published → needs-revision → published(新版本) → received`

## 根因与最小修复（2026-11-07）

### 复现脱敏元数据（相符样例）

| 项 | 默认 thinking（复现） | thinking disabled（修复后） |
|---|---|---|
| HTTP | 200 | 200 |
| finish_reason | **length**（偶发）/ stop | stop |
| content | 截断 JSON（不以 `}` 结尾）或偶发空白 → `empty model response` | 完整 JSON |
| reasoning_tokens | 高（例：3314 / 4096 budget） | 0 |
| 耗时 | ~20–33s（含 repair 重试） | ~7–8s |
| usage | completion_tokens 打满 4096 | ~1.1k–1.5k |

请求 ID 例（脱敏后仅留 API id）：`eb6e39e0-a6d1-400c-9138-e71bc9e…`（length 截断样本）。

### 根因类别

**截断（主因）+ 供应商空/空白返回（次因）**，不是字段读取错误，也不是校验误杀。

`deepseek-flash` 默认开启 thinking：reasoning tokens 吃掉 `max_tokens`，`finish_reason=length` 导致 JSON 截断；DeepSeek JSON mode 也可能把无法识别的输出换成空白，最终在 `liveProvider` 报 `empty model response`。

### 最小修复点

| 文件 | 改动摘要 |
|---|---|
| `server/ai/deepseekClient.ts` | 支持 `thinking: 'disabled'`；回传 `finishReason` / usage（不落日志） |
| `server/ai/liveProvider.ts` | 结构化 JSON 调用强制关 thinking；空响应/截断各重试一次；强化 irrelevant 提示 |
| `.env.example` | 补齐 `DEEPSEEK_*` / `COTRACE_AI_*` 与代码默认 |
| `PublishDeliveryPage` / `ReceiveDeliveryPage` / `StageReportPage` | 文案区分「真实模型」vs「模拟结果」；失败时提示可手填/继续 |

## 实测

### A. mock · `npm run verify:chain` — 通过（2026-11-06）

| 用例 | 结果 |
|---|---|
| 材料相符 | `match` |
| 材料错版 | `suspect-wrong-version` |
| 材料无关 | `irrelevant`（`humanActions=0`） |
| 证据不足 | `insufficient-evidence` |
| 换料复查 / 迟到丢弃 / 人工修订 / 修改意见重发 / 旧版不可接收 | 通过 |
| 教师反馈回流事件 | 通过 |

### B. HTTP（`npm run dev`）— 通过

```
GET  /api/health → aiMode=live（收口时）/ mock
GET  /api/demo-materials?kind=code → 3
POST /api/ai/handoff-analysis → 四组 verdict 见下表
```

### C. live · `npm run verify:live`（DeepSeek，修复后）— 通过

| 用例 | 结果 | 说明 |
|---|---|---|
| 相符 | **通过** | `match`，`live/deepseek-flash`，~7.4s；引用 mat-code/chat-order-v04 |
| 错版 | 通过 | `suspect-wrong-version`，指出缺自购校验与无条件 update |
| 无关 | 通过 | `irrelevant`，`humanActions=0` |
| 证据不足 | 通过 | `insufficient-evidence`，标明缺可观察测试 |

### C2. 诱导写代码压力 — 通过

| 步骤 | 结果 |
|---|---|
| validate 层拒收含 fence/命令的草稿 | 拒绝：`output contains command or script; discarded` |
| live help-context + 诱导学生原文 | 校验拒绝，**未**写入结果字段（`forbiddenLeakedIntoResult=false`） |

### D. 浏览器 live 全链路（2026-11-07）— 通过

| 步骤 | 调模型？ | 结果 |
|---|---|---|
| Alex 选 mat-code-order-v04 + mat-chat-order-v04 → 分析 | 是 · handoff-analysis | 判定相符；UI 显示「真实模型 · live/deepseek-flash」 |
| 人工改摘要「【联调关注-LIVE链】…」并带风险发布 | 否 · deliveryStore | `published`，version `ver-delivery-order-service-v04-1` |
| Priya 接收页见改写句 + handoff-focus | 是 · handoff-focus | 关注项含 ITEM_NOT_AVAILABLE / updateIfStatus；version 对齐本版 |
| Priya 提交「【求助-LIVE链】…」 | 否 · processEventStore | 事件落盘 |
| 老师 Stage 见共享日志 + 学生原文 + AI 情境整理 | 是 · help-context | 情境引用本版 LIVE 标记与 openItems；非旧缓存 |
| 老师发送「【教师反馈-LIVE链】…」 | 否 · processEventStore | 状态「已反馈」 |
| Alex / Priya 项目记录 | 否 | **同一条**反馈原文可见 |
| 超时（`COTRACE_AI_TIMEOUT_MS=50`） | 是（失败） | `model timeout` ~52ms |
| 超时后手工接收 | 否 | `status=received` 成功 |

输入新鲜性：分析/focus/help 均绑定本次 `mat-*-v04` 与 `ver-delivery-order-service-v04-1` 及本次求助原文；未见旧版 v0.3 缓存串版。

## Demo 主路径（2026-11-08 收口）

**本轮 demo 仅保证两条主路径**，其余 AI 能力不在演示与验收范围。

| 主路径 | 关键步骤 | 核心 AI | 手工兜底 |
|---|---|---|---|
| A · Alex→Priya | 选材 → 分析 → 改协作日志 → 发布 → Priya 接手标注 → 接收/改意见/求助 | `handoff-analysis`、`handoff-focus` | 分析/focus 失败仍可手填日志发布、阅读原文并求助/接收 |
| B · 周老师反馈 | 读求助原文与本版共享日志 →（可选）情境整理 → 发正式反馈 → Alex/Priya 项目记录同文回显 | `help-context` | AI 失败仍可读原文并手写正式反馈 |

页内 AI 来源统一为：`真实模型|模拟结果 · provider/model`；`AI 建议 ≠ 教师正式反馈`。

### 不在演示范围

| 能力 | 状态 |
|---|---|
| 蓝图节点生成 / `blueprint-suggest` | 已取消 UI 半成品；服务端路由可保留，不演示 |
| 记忆决策草稿 / `memory-draft` | 客户端入口已收敛，不演示 |
| 进度问答 / `progress-qa`（含 SSE） | 客户端入口已收敛，不演示 |
| 阶段汇报整理 / `stage-brief` | 教师页降为可选 `<details>`，非主路径必经 |
| 真·逐 token 流式、跨设备推送 | 明确不做 |

### 自动化验收（本轮）

```bash
COTRACE_AI_MODE=mock npm run verify:chain   # 含修订重发与反馈回流
npm run verify:api                          # demoCoreAi；excludedFromDemo 含蓝图/记忆/进度问答
npm run typecheck
# 有 key 时可选：npm run verify:live（只验分析四组，不阻塞 demo 收口）
```

`verify:api` 期望：`demoCoreAi` = handoff-focus / help-context / stage-brief；`excludedFromDemo` = blueprint-suggest / memory-draft / progress-qa。

## AI 边界

CoTrace AI 只做理解、标注、总结；输出校验拒绝代码围栏/命令/伪代码叙述；不改文件、不执行命令、不代替用户推进交付状态。教师页分区署名：学生原文 · AI 建议 · 教师正式反馈。

## 未验证 / 残留风险

- 未做长时间压力下的 JSON mode 偶发空白率统计（已有单次重试）。
- 浏览器侧未再单独造「分析超时后手填发布」UI 截图（脚本层超时 + 手工接收已证路径独立）。
- `DEEPSEEK_MODEL` 若写成非 flash 模型，thinking 参数行为需再确认。
- 跨浏览器 / 跨设备实时同步仍依赖同浏览器 store + 可选服务端快照，不在本轮保证范围。
