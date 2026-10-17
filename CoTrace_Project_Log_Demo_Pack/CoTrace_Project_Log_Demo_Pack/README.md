# CoTrace 项目日志 Demo 内容包

本包只服务于一页式项目日志演示，不构造完整历史项目仓库。

## 包含内容

- `SeatFlow`：项目列表中的虚构已完成项目，以及一页项目日志数据。
- `CoTrace`：截至 2026-10-17 的开发日志，区分“已经实现”“已经确认但尚未施工”和“内容是否已经提交”。
- 内容状态映射：说明此前内容包中的哪些内容可在团队节点和项目记忆中出现，以及体验者操作后如何变化。
- Cursor 接入说明：限制本阶段只增加项目卡片和一页日志入口。

## 重要边界

- SeatFlow 是 CoTrace Demo 使用的虚构课程项目，不代表真实用户研究、真实上线效果或真实团队成员。
- 项目日志只能引用已经提交的团队内容和已经确认的团队决定。
- 未提交代码、完整原始 Agent 对话、私人探索笔记和未确认的 Agent 总结不得进入团队项目日志。
- “提交成果”和“确认任务完成”是两个独立动作。
- “归档讨论”和“确认团队决定”也是两个独立动作。

## 文件

- `project/seatflow-project-card.json`：项目列表卡片。
- `project/seatflow-project-log.json`：一页日志的直接数据源。
- `project/SeatFlow_项目日志.md`：人类可读文案。
- `development/CoTrace_开发日志.md`：当前开发进度与下一步。
- `development/cotrace-development-log.json`：结构化开发状态。
- `meta/content-state-map.json`：已提交/未提交及体验者操作映射。
- `meta/CURSOR_IMPORT_GUIDE.md`：Cursor 接入约束。
