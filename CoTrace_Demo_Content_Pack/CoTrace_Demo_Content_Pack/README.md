# CoTrace Demo Content Pack

这套内容用于 CoTrace 课程演示，统一围绕“校园二手交易平台 - 创建订单”任务展开。

## 内容边界

- `code/`：真实代码文本。`baseline` 是负责人进入个人工作区时的初始版本，`submission-v1` 是人工确认后的提交版本。
- `conversations/`：Maya Chen 与编程 Agent 的原始对话，只用于个人代码工作区。
- `documents/`：团队共享文档。`sources` 为可编辑 Markdown，`pdfs` 为可展示 PDF。
- `data/`：Demo 可直接读取的结构化数据、差异和跨内容关联。

## 演示主线

1. Maya 在个人待办中进入“后端 API”工作区。
2. Agent 阅读初始代码，发现自购、商品状态、订单快照和一致性缺口。
3. Maya 限定课程 Demo 范围，拒绝扩展支付和完整库存系统。
4. Agent 修改代码并补充测试，Maya 人工确认后提交 `submission-v1`。
5. 队友从蓝图节点查看已提交代码、选定公开的 AI 溯源和共享文档。

## 推荐接入顺序

1. 先接入 `data/backend-api-agent-session.json` 到 PersonalCodingWorkspace。
2. 将 `data/backend-api-submission-v1.json` 与 `code/backend-api/submission-v1/` 用于 BlueprintNodeDetail。
3. 用 `data/published-ai-traces.json` 展示提交后公开的 AI 溯源。
4. 用 `data/shared-documents.json` 建立共享文档库。
5. 用 `data/demo-content-link-map.json` 实现溯源到文件、文档和测试的定位。

## 角色

- Maya Chen：项目负责人、后端 API 负责人。
- Alex Lee：数据库设计负责人。
- Priya Shah：前端页面负责人。
- 测试与交易流程联调：当前待分配。

## 范围限制

示例使用内存仓储模拟数据一致性，不连接真实数据库，也不实现支付、库存锁定、消息通知和真实大模型调用。这些限制会在代码、对话和文档中保持一致。
