# 原型还原验收说明（本轮）

基准：`原型图与设计规范.pdf` + 交付/阶段汇报动效分镜。截图目录：`newuichange/_shots/`。复现脚本：`node scripts/capture-acceptance.mjs http://localhost:5174`。

## 1. 工作蓝图（画布）

| 项 | 结果 |
| --- | --- |
| 四阶段分区 | 需求 / 设计 / 开发 / 验收虚线分区 |
| 依赖连线 | 7 条，全部来自 `blueprint-nodes.json` 的 `dependsOn`，未虚构依赖 |
| 分支与汇合 | 需求→设计/前端；后端+前端→交易流程联调 |
| v0.4 交付标识 | 后端→联调边上：`订单创建服务 v0.4 · Alex → Priya`（发布/接收后文案变化） |
| 节点默认信息 | 标题 + 状态；说明在底部详情区 |
| 选中态 | 节点描边 + 相关连线高亮 + 详情同步 |
| 主流程 | Alex 详情「发布交付」→ Priya 联调「打开待接收」→ 接收后联调「进行中」 |

截图：`blueprint-1536x1024.png`、`blueprint-1440x960.png`、`blueprint-priya-1536x1024.png`、`blueprint-received-1536x1024.png`

## 2. 项目记忆

| 入口 | 结果 |
| --- | --- |
| 蓝图侧栏「历史」 | `#/next/log?project=<校园项目id>`，空状态，不展示 SeatFlow |
| SeatFlow 项目卡 | `#/next/log?project=project-seatflow-demo`，新版壳 + 可展开决策/证据 |
| 证据标签 | `formatEvidenceKind`：不直接显示 `confirmed_memory` / `ai-trace` |

**本页新增设计选择（规范未单独定稿）：** 首屏只露标题/时间/最终决定；背景、AI 帮助、成员判断、理由、证据按需展开；沿用学生顶栏/侧栏/演示角色。

截图：`memory-campus-empty-1536x1024.png`、`memory-seatflow-1536x1024.png`、`memory-seatflow-expanded-1536x1024.png`

## 3. 字号核对（计算样式抽样）

| 元素 | 实测 | 规范目标 |
| --- | --- | --- |
| 页面标题「工作蓝图」 | 38px / 700 | 学生页标题 37–42 / 700 |
| 阶段标题 | 18px / 700 | 分区说明偏辅助层级 |
| 节点标题 | 16px / 700 | 节点识别信息 |
| 导航选中「工作」 | 22px / 700 | 导航文字 22–24 |
| Token 源 | `src/next/tokens.css` | PDF 页 7–11 |

教师端继续用教师页密度；共用色板/字号变量已 `@import` 到学生壳、蓝图、指导台、阶段汇报、核收。

## 4. 关键动效实测

| 路径 | 静止态 | 交互后 | 备注 |
| --- | --- | --- | --- |
| 发布交付 | `publish-before-*.png` | `publish-after-*.png` | 按钮 busy → 回执 `is-enter`；等待接收文案稳定 |
| 确认接收 | `receive-before-*.png` | `receive-after-*.png` | 操作区原位回执；可回蓝图 |
| 蓝图联调 | draft 待开始 | received 进行中 | `blueprint-received-*.png` |
| 阶段汇报 | 指导台待办 stash 事件 | 详情原位反馈 | 既有 `StageReportPage` + `teacherFocus` |
| 项目核收 | 待办 stash 提交 | 指导台「已核收」 | 既有 `AcceptancePage` |
| `prefers-reduced-motion` | CSS 关闭动画 | 操作仍可完成 | 蓝图/发布/接收已加 reduce 规则 |

短录屏未单独导出文件；可用上述 before/after 静帧对照，或本地再录一次发布/接收 1–2 秒片段。

## 5. 主路径实测清单

1. 项目列表 → 校园二手交易平台 → 蓝图画布：通过  
2. Alex 发布 v0.4 → 当前页回执「等待接收」：通过  
3. Priya 接收 → 蓝图联调进行中、徽章「已接手」：通过  
4. SeatFlow 卡 → 项目记忆 → 展开决策/证据 → 返回：通过  
5. 校园项目「历史」→ 空状态 → 回蓝图：通过  
6. 教师指导台 → 阶段反馈 / v1.0 核收 → 回指导台：入口与 stash 已接；本脚本截到指导台，反馈/核收可按既有教师页手测

## 6. 已知偏差

- PDF 原型含「原型设计」「部署复盘」等节点名；本轮按既有任务依赖映射，不新增虚构节点。  
- 开发区节点略宽，阶段列采用非等比加宽；连线终点仍落在节点左右中点。  
- 旧版 `ProjectLogPage`（SeatFlow 深色壳）仍保留在非 next 路由兜底，主入口已切到 `ProjectMemoryPage`。
