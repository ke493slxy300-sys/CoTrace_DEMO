# Cursor 接入说明

## 1. 不要混合四类内容

| 内容类型 | 数据来源 | 展示位置 |
|---|---|---|
| 代码文本 | `code/backend-api/` | 代码编辑器或只读代码详情 |
| 原始 Agent 对话 | `data/backend-api-agent-session.json` | PersonalCodingWorkspace |
| 公开 AI 溯源 | `data/published-ai-traces.json` | BlueprintNodeDetail 右侧 |
| 团队共享文档 | `data/shared-documents.json` | 蓝图底部共享文档库 |

原始 Agent 对话不能直接作为公开 AI 溯源。只有 `shareStatus: "selected"` 且存在 `traceId` 的消息，才可以通过 `published-ai-traces.json` 出现在队友页面。

## 2. 个人代码工作区

进入“后端 API”个人待办时：

- 读取 `data/backend-api-baseline.json`；
- 默认打开 `src/services/orderService.js`；
- 代码内容来自 `code/backend-api/baseline/`；
- 对话来自 `data/backend-api-agent-session.json`；
- 对话按 `messages` 顺序展示；
- `type` 决定消息样式，`speaker` 决定用户或 Agent；
- 文件读取、修改建议和测试结果属于对话事件，不应显示成源代码。

## 3. 提交后的队友节点

进入蓝图中的“后端 API”节点时：

- 读取 `data/backend-api-submission-v1.json`；
- 代码内容来自 `code/backend-api/submission-v1/`；
- 所有代码只读；
- 右侧溯源读取 `data/published-ai-traces.json`；
- 点击溯源时根据 `fileRefs` 切换相关文件；
- 不读取 baseline 草稿和未公开原始对话；
- 团队讨论保持为次级窗口。

## 4. 代码差异

`data/backend-api-diff-map.json` 用于连接：

- 修改 ID；
- 修改文件；
- 修改摘要；
- 原始消息；
- 公开溯源。

它描述的是语义级差异。若页面需要逐行 diff，可由 baseline 和 submission 文件在前端或构建阶段计算，不要把对话文本当作 diff。

## 5. 共享文档库

读取 `data/shared-documents.json` 生成文档卡片：

- `sourcePath` 指向可编辑 Markdown；
- `pdfPath` 指向可展示 PDF；
- `ownerIds` 为空表示待分配；
- `nodeIds` 用于从文档回到相关蓝图节点；
- 不要将文档正文复制为团队讨论消息。

## 6. 跨内容定位

使用 `data/demo-content-link-map.json` 建立以下关系：

    Agent 原始消息
    → 负责人选择公开
    → AI 溯源
    → 提交代码文件
    → 团队共享文档

映射不存在时正常展示内容，不要编造代码行号、文件或文档关联。

## 7. 建议的最小验收

1. 个人待办进入 baseline 代码与 16 条原始消息；
2. 队友节点进入 submission-v1，只显示 5 条公开溯源；
3. 点击“保存商品快照”溯源后打开 `src/services/orderService.js`；
4. 共享文档库显示 6 份文档，负责人和状态正确；
5. 测试节点文档负责人显示“待分配”；
6. 个人未公开消息不出现在队友节点；
7. PDF 可以在文档查看器中打开。
