/**
 * 蓝图页「个人待办」预置数据（Maya 视角）。
 * 团队提出的待办可关联协作 store 中的讨论 id，二次单击打开团队讨论窗。
 */

import personalTodoData from "./personal-todos.json";

export type PersonalTodoStatus = "open" | "waiting" | "done" | "blocked-later";

export type OwnedTaskJump = {
  nodeId: string;
  /** 若节点尚不存在（未选负责人等），跳转时由页面降级处理 */
};

export type TeamPendingItem = {
  id: string;
  title: string;
  fromMemberName: string;
  summary: string;
  status: PersonalTodoStatus;
  /** 关联蓝图节点；单击选中时跳转 */
  relatedNodeId: string | null;
  /** 关联团队讨论；再次单击打开讨论窗 */
  relatedDiscussionId: string | null;
  /**
   * later = 本阶段只展示，完整处理流留给后续（讨论/提交）
   */
  track: "ready" | "later";
};

/** 团队提出的待处理事项（预置） */
/** 团队提出的待处理事项（预置） */
export const INITIAL_TEAM_PENDING_ITEMS =
  personalTodoData as unknown as TeamPendingItem[];

export const PERSONAL_TODO_STATUS_LABELS: Record<PersonalTodoStatus, string> = {
  open: "待处理",
  waiting: "等待中",
  done: "已完成",
  "blocked-later": "后续阶段",
};
