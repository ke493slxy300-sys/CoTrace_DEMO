# 校园二手交易平台 · 跨端交付链实测报告

日期：2026-11-06（初测）／2026-11-07（live 收口）／2026-11-08（demo 主路径收口）／2026-11-08（真流式旁路）

## 结论（2026-11-08 · 默认 live）

Demo **仅保证两条主路径**：Alex 交付→Priya 接收；周老师读求助→正式反馈→双端同文回显。有 `DEEPSEEK_API_KEY` 时，分析 / 接手标注 / 教师情境 **默认走 DeepSeek live 整包**（非逐 token）；无 key 自动回退 mock。进度问答 **真 token SSE** 仍为接收页折叠旁路。验收脚本强制 mock；有 key 时另跑 `verify:live`。

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
| `COTRACE_AI_MODE` | `mock` / `live` / 省略 | **省略时：有 key → live，否则 mock**；示例文件推荐 `live` |
| `DEEPSEEK_API_KEY` | live 用（仅服务端 / `.env.local`） | 无则自动 mock |
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

### 旁路：进度问答真流式（非必经）

| 项 | 说明 |
|---|---|
| 路由 | `POST /api/ai/progress-qa/stream`（SSE：`meta` → `token*` → `result` → `done`） |
| 入口 | `#/next/receive` 折叠「进度问答（可选 · 真流式旁路）」 |
| mock | 答案分片多帧（断言 ≥2 个 `token`） |
| live | DeepSeek `stream: true` 真 delta；结束后补 `nextChecks` |
| 失败 | 客户端自动回退 `POST /api/ai/progress-qa`；不影响接手/求助/接收 |
| 主路径 JSON | analysis / focus / help-context **不**做逐 token |

### 不在演示范围

| 能力 | 状态 |
|---|---|
| 蓝图节点生成 / `blueprint-suggest` | 已取消 UI；服务端可保留，不演示 |
| 记忆决策草稿 / `memory-draft` | 客户端入口已收敛，不演示 |
| 进度问答主路径化 | 仅旁路；不写入主演示脚本必经步骤 |
| 阶段汇报整理 / `stage-brief` | 教师页可选 `<details>` |
| 跨设备推送 | 明确不做 |
| 主路径 JSON 真流式 | 明确不做 |

### 自动化验收（本轮）

```bash
npm run verify:chain    # 脚本内强制 COTRACE_AI_MODE=mock
npm run verify:api      # 强制 mock；含 streamProgressQa
npm run verify:stream   # 强制 mock；≥2 token 帧
npm run typecheck
# 有 key：npm run verify:live（分析四组）+ 手测接收页进度问答真流式
```

演示前请确认 `.env.local` 有 `DEEPSEEK_API_KEY`，并重启 `npm run dev`；页顶应显示「真实模型 (live)」。

`verify:api` 期望：`streamProgressQa: true`；`demoCoreAi` = handoff-focus / help-context / stage-brief；`excludedFromDemo` = blueprint-suggest / memory-draft / progress-qa。

### 排练检查清单（同浏览器切角色）

1. Alex：`#/next/publish` → 选 v0.4 材料 → 分析 → 改一句日志 → 发布  
2. Priya：`#/next/receive` → 见改句 + 接手标注 → 提交求助  
3. （可选）展开进度问答 → 见 token 逐段出现；**跳过也不影响**后面  
4. 周老师：`#/next/stage` → 读原文与共享日志 → 可选 AI 情境 → 发正式反馈  
5. Alex / Priya：`#/next/log` → **同一反馈原文与时间**

**红线：** 分析 / focus / 情境失败时仍可手填发布、手写反馈、完成闭环；流式失败不得阻断求助或接收。

## AI 边界

CoTrace AI 只做理解、标注、总结；输出校验拒绝代码围栏/命令/伪代码叙述；不改文件、不执行命令、不代替用户推进交付状态。教师页分区署名：学生原文 · AI 建议 · 教师正式反馈。

## 未验证 / 残留风险

- 未做长时间压力下的 JSON mode 偶发空白率统计（已有单次重试）。
- 浏览器侧未再单独造「分析超时后手填发布」UI 截图（脚本层超时 + 手工接收已证路径独立）。
- `DEEPSEEK_MODEL` 若写成非 flash 模型，thinking 参数行为需再确认。
- 跨浏览器 / 跨设备实时同步仍依赖同浏览器 store + 可选服务端快照，不在本轮保证范围。
