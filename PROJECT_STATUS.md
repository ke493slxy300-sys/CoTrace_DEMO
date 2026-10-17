# CoTrace Demo 项目状态

> 本文档记录当前实现进度、产品决定与已知风险。  
> **文档层级（冲突时优先服从）**：产品决定（本节）＞ `INTERACTION_SPEC.md`（行动指导）＞ `COTRACE_DEMO_SPEC.md`（宪章/总价值判断）。  
> 最后更新：2026-10-17（SeatFlow 虚构历史项目 + 一页式项目日志）

---

## 1. 当前版本与整体完成度

| 项 | 状态 |
|---|---|
| Demo 版本号（`package.json`） | `0.1.0` |
| 规范版本 | `COTRACE_DEMO_SPEC.md` 含 v0.1 工作台要求 + **§14 v0.2** 校园二手交易主线 |
| 体验角色 | 固定 Maya Chen（`CURRENT_USER_ID = member-maya`） |
| 技术栈 | React 19 + Vite 6 + TypeScript + 全局 CSS（非 Tailwind、非 CSS Modules） |
| 路由 | 无 react-router（`AppView` 内存切换）；部署可用 `vercel.json` SPA rewrite |
| Demo 存储 | `cotrace-demo-*` localStorage；`demoStorage` schemaVersion=2；顶栏可重置 |
| **相对 §14 主线整体完成度** | **约 75%–80%**（含本地 Demo 提交闭环；编辑/真后端/蓝图状态机未做） |
| 列表 → 注册 → AI → 蓝图段 | 约 90%（可用） |
| 个人编码工作区 | Content Pack baseline + Agent 预置对话；伪 IDE 只读；可进三步提交 |
| 节点详情 | LAYOUT-02；DemoSubmission → Content Pack → 空态；负责人可「开始/继续工作」 |

当前可走通的主线：

```text
项目列表
  ├─ SeatFlow（虚构已完成）→「查看项目日志」→ ProjectLogPage（一页记忆层）
  └─ 校园二手交易（注册后）→ 模拟 AI → 任务蓝图
        ├─ 画布/侧栏二次单击 → BlueprintNodeDetailPage
        ├─ 底栏「我负责」→ PersonalCodingWorkspace → TaskSubmitPage → 节点详情
        └─ 底栏团队待办 → TeamDiscussionWindow（若有）
```

---

## 2. 已完成

### 2.1 页面与流程

- 项目列表页（空态 / 创建后项目卡片，可再次进入蓝图）
- 居中项目注册弹窗：预置项目信息、核心业务流程、协作者与职责
- 未保存关闭确认；核心业务流程不可改
- 「模拟 AI 项目理解」短暂遮罩后进入任务蓝图
- 任务蓝图画布：7 个初始节点、依赖连线、拖拽、点选详情
- 空白节点：新增、改名、删除、指定负责人
- 右侧：选中节点 → 节点详情；未选中 / 点画布空白 → AI 项目理解助手
- 底部栏：个人待办横向卡片；共享文档库横向卡片槽；会话内 PDF 上传
- 预置节点内容硬锁定（尝试修改 toast：`项目演示内容，无法修改`）
- 产出空状态文案（未指定负责人 / Maya 尚无产出）
- 固定高度桌面布局：`100vh` + 禁止整页滚动（局部面板滚动）
- **进入方式**：先选中，再单击进入（非 `dblclick`）；画布/侧栏一律节点详情；底栏「我负责」直达工作区
- **顶栏左侧返回**：个人编码 / 节点详情 / 三步提交页；详情负责人 CTA「开始/继续工作」
- **最小提交闭环**：确认写入后直接进节点详情（读 `DemoSubmission`）

### 2.2 演示数据与资产

| 类别 | 位置 |
|---|---|
| 项目模板 / 成员 / 职责 | `src/data/project.ts`、`members.ts`、`duties.ts`、`collaborators.ts` |
| 蓝图节点与详情 | `src/data/blueprint.ts`、`blueprintDetail.ts`、`blueprintSession.ts` |
| 演示锁定 | `src/data/demoLock.ts` |
| AI 助手文案 | `src/data/aiAssistant.ts` |
| 个人待办 | `src/data/personalTodos.ts`（含后续阶段缺口项） |
| 共享文档列表 | `src/data/sharedDocs.ts` ← Content Pack 6 份 |
| 预置 PDF | `public/docs/01–06_*.pdf` + 旧 3 份；原文 `public/docs/sources/` |
| **Backend Content Pack** | `src/demoContent/`：baseline / session / submission-v1 / published traces / link-map |
| **Teammate Node Pack** | `src/demoContent/teammate/`：前端代码、数据库 SQL、需求文档、片段溯源 JSON |
| 工作日志（仅备份） | `src/demoContent/teammate/reserve/work-logs/`（本阶段无 UI） |
| 讨论 / 溯源（兼容层） | `src/data/discussions.ts`、`traces.ts`、`nodeCollaboration.ts` |

### 2.3 页面架构

| 页面 | 路径 | 用途 |
|---|---|---|
| 个人编码工作区 | `PersonalCodingWorkspace` | Maya 编程 + 编程 Agent（只读伪 IDE；提交进三步页） |
| 三步提交页 | `TaskSubmitPage` | 说明 → 左右栏选公开溯源 → 预览确认写入 |
| Demo 提交存储 | `src/data/demoSubmission.ts` | `localStorage` key：`cotrace-demo-submissions` |
| 节点详细内容 | `BlueprintNodeDetailPage` | LAYOUT-02：左仓 / 中代码或文档 / 右溯源+标注 |
| 入口类型 | `src/data/workspaceEntry.ts` | `personal-coding` / `blueprint-detail` |
| 旧 Workbench | `src/pages/Workbench.tsx` | **已废弃**，App 不再挂载 |

### 2.4 本阶段 UI 与内容（已落地）

- **队友节点中栏**：IDE 风格只读代码（行号 + 语法高亮）；文件名旁「只读」+「发起修改」占位按钮（无功能）
- **AI 溯源卡**：默认展示选中片段 / 人的理解 / 人的决定 / 未决 / 记忆候选；提供「标注」入口
- **个人工作区 Agent**：去掉消息上的「已选公开 / 私密」；去掉右上角「等待负责人确认」状态徽标
- **团队讨论窗**：对话气泡布局；体验者（Maya）靠右且标「你 · …」，队友靠左
- **布局校正**：中间内容必须包在 `panel editor-panel` 内，避免三栏网格被打散（LAYOUT-02）

### 2.5 遗留未使用

- `src/pages/FoundationShell.tsx`
- `src/components/workbench/EmptyWorkbenchBody.tsx`（功能已并入个人编码空仓）

---

## 3. 进行中

最小提交闭环本切片已收口。后续可选打磨：

- 提交页与个人工作区的「任务状态」视觉区分（布局已相似，属预期）
- 「发起修改」按钮：副本修改流程（最终开发阶段）

---

## 4. 待完成

按 SPEC §14 与体验主线，尚未完成或未接通：

| 优先级 | 内容 | 规范参照 | 备注 |
|---|---|---|---|
| ~~P0~~ | ~~从蓝图进入个人代码工作区（第一阶段只读）~~ | §14.8 / §14.12 | **已完成** |
| ~~P2~~ | ~~数据库 / 前端 / 需求节点可打开预置产出~~ | §14.7 | **已完成**（队友包） |
| ~~P1~~ | ~~本地 Demo 提交闭环（说明 / 勾选溯源 / 写入详情）~~ | SUBMIT-01 / §14.10 | **已完成**（无真后端） |
| P1 | 提交驱动蓝图状态（后端→新版本待验收，联动相关节点） | §14.11 | **明确不做于本阶段** |
| P1 | `orderService.js` 可编辑、重置预置代码 | §14.8 | 产品：第二阶段 |
| P2 | Diff、接受/拒绝、真实保存 | 产品决定 | 未做 |
| P2 | 工作日志 UI（现仅 `reserve/` 备份） | 队友包指南 | 最后阶段再做 |
| P3 | 待办事项状态随流程推进 | 产品约定 | 现预留缺口 |
| P3 | 共享文档专用 PDF SVG 图标 | 产品约定 | 现用 file-code 占位 |
| — | 规范级「预置节点全文可编辑」 | §14.5 | **产品决定暂不做** |

---

## 5. 当前产品决定（优先于规范字面冲突项）

以下决定已在实现/规划中采用，**在修订 SPEC 或另行拍板前保持不变**：

1. **预置蓝图节点暂时硬锁**  
   名称、背景、目标、验收标准、前置依赖不可改；尝试修改 toast「项目演示内容，无法修改」。

2. **负责人可以新增节点**；**新增空白节点可编辑**（改名/负责人/删除）。

3. **蓝图节点 = 团队可见成果入口；个人工作区为私人过程**  
   - 画布 / 侧栏：任意节点二次单击 → **一律** `BlueprintNodeDetailPage`（不再按是否负责人分流）。  
   - 底栏「我负责」：二次单击仍直达 `PersonalCodingWorkspace`（产品例外）。  
   - 节点详情负责人 CTA：「开始工作 / 继续工作」→ 个人工作区。  
   - 个人编码页**不以**溯源/讨论为主内容；节点详情不读未提交草稿。

4. **个人编码工作区当前阶段 = 只读伪 IDE + 预置 Agent 对话**  
   baseline 代码 + session 对话；输入与保存禁用；「提交任务」进三步提交页。  
   **不接真模型**；Agent **不自动提交**。

5. **下一阶段再做**：Mock 编辑、Diff、接受/拒绝、真保存、蓝图状态机。  
   **已完成（Demo）**：本地 `DemoSubmission` 写入 + 节点详情优先读取。

6. **蓝图侧栏**仍为轻量摘要；完整协作者/溯源/讨论在节点详细内容页展示。

7. **待处理事项**：部分条目保留后续阶段缺口；团队待办单击仅选中蓝图节点。

8. **进入方式正式采纳「先选中，再单击进入」**（非 `dblclick`）  
   个人待办与蓝图节点均适用；细则见 `INTERACTION_SPEC.md` §11 / NAV-01 / NAV-02。

9. **团队讨论坚持次级窗口**  
   节点详情右栏「项目标注」仅保留讨论主题卡片；点击后打开团队讨论次级窗口（对话气泡），不在右栏内嵌完整线程。

10. **「返回任务蓝图」在顶栏左侧**（个人编码工作区与队友节点详情均适用）。

11. **AI 溯源卡片**  
    队友包：成员选取片段 + 人的理解/决定；后端包：published traces。  
    卡片提供「标注」入口；悬停/选中可强调，**关键字段默认可见**（避免「内容丢失」感）。

12. **演示优先假文件**  
    节点详情可使用演示用假文件供展示；联调/测试等节点仍可保持空仓。

13. **伪项目开箱负责人**  
    创建项目时自动合并演示班底（Alex / Priya / Jordan）；「需求与流程确认」挂项目负责人（Maya）。  
    **Demo 锁定协作人**：注册侧仅班底可入选且不可增删改职责；其余成员仅展示，试图更改提示「当前为 demo 演示模式，不允许更改」。

14. **Content Pack 四类内容不混用**  
    个人工作区：baseline + 原始 session；共享文档库：shared-documents；跨定位：link-map。  
    **后端 API 节点详情**：提交前无代码/无溯源；标注仅保留 A《订单状态…》与 C《LISTING_UNAVAILABLE…》，B《购买失败需区分错误码…》提交后再显示。新建项目清空 DemoSubmission。确认提交后展示工作区上传内容 + 勾选溯源。

15. **个人编码区伪 IDE**  
    只读高亮 + 行号；底栏「测试 / Debug」为空壳；「提交任务」进入 `TaskSubmitPage`。

16. **队友节点内容包（前端 / 数据库 / 需求）**  
    只读代码或文档 + 成员选取片段式溯源。工作日志仅备份，本阶段不做 UI。  
    布局必须服从 `INTERACTION_SPEC` LAYOUT-02：左仓 / **中代码** / 右溯源+标注。  
    中栏文件名后：「只读」+「发起修改」（占位）。

17. **Demo：product-analysis 暂归 Maya**  
    「需求与流程确认」蓝图挂 `project-owner`；详情展示负责人固定为 Maya。真实产品中需求分析未必属于项目负责人——见 §7.1。

18. **个人工作区对话 UI 精简**  
    不展示单条消息的公开/私密徽标；不展示面板级「等待负责人确认」状态（避免与「仅演示对话」冲突）。

19. **最小提交闭环（SUBMIT-01 Demo）**  
    - 代码仓默认全部写入节点详情，提交页不可取消勾选（仅预览切换文件）。  
    - 仅主题溯源卡可自主勾选；默认不勾选；不公开完整原始对话。  
    - 步骤二左右分栏（类个人工作区）：左仓 / 中代码 / 右溯源勾选。  
    - 确认前不写入；确认后 `localStorage`（`cotrace-demo-submissions`）；刷新仍在。  
    - **确认提交后直接进入对应节点详情**（预览页非长期入口）；详情立即读快照。  
    - 预览页提供「确认本任务已完成」勾选；勾选后将该节点 `status` 设为 `done`（Demo，非完整状态机）。  
    - 后端 API：无提交时详情空白；提交后展示工作区实际上传内容。

20. **协作数据方案 C（标注 ≠ 讨论）**  
    - 统一 store：`src/data/nodeCollaborationStore.ts`，key：`cotrace-demo-node-collaboration`。  
    - `ProjectAnnotation` 与 `TeamDiscussion` 分离；仅 `TeamDiscussion.annotationId` 单向关联。  
    - 查询必须带 `projectId` + `nodeId`。  
    - 底层 `DiscussionLifecycle`：`open | ready_to_archive | archived` + `waitingOnMemberId`；UI 推导「待我回复 / 等待队友」。  
    - 团队决定独立：`none | generating | draft | confirmed`，`source: member | project-agent`；Agent 草案须人工确认。  
    - 右栏仍叫「项目标注」；讨论仍为次级窗口；不改 LAYOUT-02、不驱动蓝图状态。

21. **导航统一（覆盖旧 NAV-02 负责人直达工作区）**  
    - 蓝图节点一律先到节点详情；负责人从详情 CTA 进入工作区。  
    - 底栏「我负责」保留直达工作区。  
    - 覆盖 `INTERACTION_SPEC` NAV-02 中「负责人二次单击进个人工作区」字面；以本决定为准。

22. **SeatFlow 项目日志（一页记忆层）**  
    - 项目列表常驻虚构已完成项目 SeatFlow；入口仅「查看项目日志」。  
    - 布局：左栏纵向时间轴 + 决策卡（独立滚动）；右栏个人成长归档（不滚动）；无 Agent 总结面板。  
    - 数据：`src/demoContent/projectLog/`（源自 `CoTrace_Project_Log_Demo_Pack`）。  
    - 决策历史仅含 `publicationState=submitted` + `decisionState=confirmed` 的三条记录。  
    - 证据入口 Toast，不跳转历史代码仓。  
    - 个人成长仅 `member-maya` 可见。  
    - **未接入** `development/CoTrace_开发日志*` 为体验者页面。  
    - 不改蓝图 / 提交 / 讨论运行时逻辑。

### 手动微调入口

| 要改什么 | 文件与位置 |
|---|---|
| 蓝图底栏高度 / 卡片宽度 | `src/styles/tokens.css` → `--blueprint-dock-height`、`--blueprint-todo-card-width`、`--blueprint-doc-card-width` |
| 「提交任务」按钮位置 | `src/components/coding/IdeBottomPanel.tsx` → `.ide-panel-submit` |
| 三步提交页 | `src/pages/TaskSubmitPage.tsx` |
| 项目日志页 | `src/pages/ProjectLogPage.tsx` |
| SeatFlow 数据 | `src/demoContent/projectLog/` · `src/data/projectLogs.ts` |
| 路由切换 | `src/App.tsx` → `view === 'task-submit' \| project-log'` |
| 队友溯源卡 | `src/components/nodeDetail/MemberSelectedTraceCards.tsx` |
| 团队讨论气泡 | `src/components/nodeDetail/TeamDiscussionWindow.tsx` |
| 只读 IDE 抬头 | `src/components/editor/CodeViewer.tsx` → `ideChrome` |

---

## 6. 与 `COTRACE_DEMO_SPEC.md` 的冲突

| # | 规范要求 | 当前 / 产品决定 | 处理 |
|---|---|---|---|
| 1 | §14.5 可修改预置节点名称、说明、前置任务、验收标准 | 预置节点硬锁 | **以产品决定为准** |
| 2 | §14.5 详情显示负责人**和协作者** | 不展示协作者 | **以产品决定为准** |
| 3 | §14.8 预置代码可编辑、可提交 | 第一阶段只读；第二阶段再开放 | **分阶段，以产品决定为准** |
| 4 | §2「暂不实现：在线编辑代码」与 §14.8「可编辑」互相矛盾 | 采用分阶段：先只读，后编辑 | 建议后续修订 SPEC 消除矛盾 |
| 5 | §14.9 连续人–Agent 合作过程（多类型回合） | 个人工作区已接 Content Pack 多轮预置对话；仍非真模型 | **演示数据已通；交互未开放** |
| 6 | §14.7 DB/FE 须有预置产出文件 | 队友包已提供可打开代码/SQL/文档 | **已基本满足** |
| 7 | §14.2/14.12 进入个人工作区并完成提交主线 | 可进入工作区；本地 Demo 提交闭环已通 | **Demo 已通；无真后端 / 无蓝图状态机** |
| 8 | 样式「CSS Modules 或普通 CSS」 | 使用全局普通 CSS | 可接受，非阻塞 |
| 9 | 成员头像等资源完整性 | `members.ts` 引用 maya/alex/priya/jordan 等，部分文件缺失，UI 回退缩写 | **待补资源或改路径** |

---

## 7. 已知风险与待验证问题

### 7.1 风险

- **死代码误解**：`Workbench` / `FoundationShell` 仍在仓库但未挂载，易被误认为「工作区已完成」。
- **头像资源不一致**：预设成员 JPG 与 `public/avatars/` 实际文件不匹配。
- **文档图标占位**：共享文档槽使用 `/icons/code/file-code.svg`，非正式 PDF 图标。
- **会话态不持久**：刷新丢失项目与上传 PDF（符合 demo「不长期保存」，但演示需注意操作路径）。
- **SPEC 双轨**：v0.1 工作台条文与 §14 v0.2 并存，未统一时易出现实现口径漂移。
- **product-analysis ↔ 项目负责人（Demo 简化）**：工作逻辑上「需求与流程确认 / 产品分析」未必必须由项目负责人承担；当前 Demo 为开箱可演示，将 `product-analysis` 展示与提交视角暂归 Maya（`project-owner`）。后续若引入独立产品分析角色，需拆开蓝图职责映射与详情负责人解析，避免把组织角色写死进数据模型。
- **LAYOUT-02 易碎**：中栏内容若缺少 `editor-panel` 包裹层，三栏 grid 会被打散（已踩坑并修复）。
- **无本地 git**：工作区当前无 `.git`，误删文件只能靠对话/本地历史恢复，建议尽早建仓或备份。

### 7.2 待验证

- [ ] 1440 × 900 下蓝图页（含底部横向卡片栏）无整页纵向滚动
- [ ] 画布空白点击稳定回到 AI 助手
- [ ] 预置节点误操作仅 toast、不改数据
- [ ] 共享 PDF 可在新标签打开；上传非 PDF 有明确提示
- [ ] 注册协作职责 → 蓝图负责人映射正确（含「待分配」）
- [x] `npm run build` 持续通过（最近一次：2026-10-16 队友 UI 切片后通过）
- [x] 开发服务中 `npm run dev` 可正常预览
- [x] 前端节点：中栏只读 IDE +「发起修改」占位可见
- [x] 溯源卡展示片段 / 理解 / 决定 / 记忆候选 + 标注按钮
- [x] 个人工作区无「已选公开/私密」与「等待负责人确认」徽标
- [x] 团队讨论窗：Maya 右气泡、队友左气泡

---

## 8. 下一步建议

**建议的下一个阶段：**

> Mock 编辑 / Diff / 接受拒绝，或蓝图状态机（提交后节点状态联动）。  
> 仍不做：真模型、真后端、工作日志 UI、审批流。

产品决定已覆盖：演示假文件优先；联调/测试等节点仍可为空；`product-analysis` Demo 归 Maya。

---

## 9. 关键路径速查

| 用途 | 路径 |
|---|---|
| 宪章 / 总价值判断 | `COTRACE_DEMO_SPEC.md` |
| 交互行动指导 | `INTERACTION_SPEC.md`（v0.3） |
| 产品决定与进度 | 本文 `PROJECT_STATUS.md` |
| 应用入口 / 视图切换 | `src/App.tsx` |
| 蓝图页 | `src/pages/BlueprintPage.tsx` |
| 个人编码工作区 | `src/pages/PersonalCodingWorkspace.tsx` |
| 三步提交页 | `src/pages/TaskSubmitPage.tsx` |
| Demo 提交 store | `src/data/demoSubmission.ts` |
| 提交溯源候选 | `src/data/submitTraceCandidates.ts` |
| store 最小校验 | `npm run verify:submission` |
| 队友节点详情 | `src/pages/BlueprintNodeDetailPage.tsx` |
| 队友内容加载 | `src/demoContent/teammatePack.ts` |
| 后端内容加载 | `src/demoContent/backendPack.ts` |
| 团队讨论次级窗口 | `src/components/nodeDetail/TeamDiscussionWindow.tsx` |
| 协作 store | `src/data/nodeCollaborationStore.ts` |
| 协作类型 | `src/types/collaboration.ts` |
| 底部栏 | `src/components/blueprint/BlueprintBottomDock.tsx` |
| AI 助手 | `src/components/blueprint/BlueprintAiAssistant.tsx` |
| 已废弃工作台 | `src/pages/Workbench.tsx`（勿再挂载） |
| 演示锁定文案 | `src/data/demoLock.ts` |
| 共享文档图标常量 | `src/data/sharedDocs.ts` → `SHARED_DOC_ICON_SRC` |

---

*状态更新约定：每完成一个确认阶段，同步更新本节完成度、已完成/待完成列表，并复核「产品决定」是否仍成立。*
