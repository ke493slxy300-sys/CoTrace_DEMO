/**
 * 蓝图页「个人待办」预置数据（Maya 视角）。
 * 团队提出的待办可关联协作 store 中的讨论 id，二次单击打开团队讨论窗。
 */

import { DEMO_DISCUSSION_IDS } from './nodeCollaborationStore';

export type PersonalTodoStatus =
  | 'open'
  | 'waiting'
  | 'done'
  | 'blocked-later';

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
  track: 'ready' | 'later';
};

/** 团队提出的待处理事项（预置） */
export const INITIAL_TEAM_PENDING_ITEMS: TeamPendingItem[] = [
  {
    id: 'pending-error-codes',
    title: '前端需区分购买失败错误码',
    fromMemberName: 'Priya Shah',
    summary:
      '当前只能显示通用“请求失败”，希望后端约定 LISTING_NOT_FOUND / LISTING_UNAVAILABLE。',
    status: 'open',
    relatedNodeId: 'node-frontend',
    relatedDiscussionId: DEMO_DISCUSSION_IDS.FE,
    track: 'ready',
  },
  {
    id: 'pending-integration-gate',
    title: '联调前请确认错误响应结构',
    fromMemberName: 'Jordan Lin',
    summary: '集成测试用例依赖稳定错误码，待后端版本确认后再开测。',
    status: 'waiting',
    relatedNodeId: 'node-integration',
    relatedDiscussionId: DEMO_DISCUSSION_IDS.INT,
    track: 'later',
  },
  {
    id: 'pending-review-ai-draft',
    title: '审查 AI 生成的接口草案说明',
    fromMemberName: 'Alex Lee',
    summary: '数据库快照字段已就绪，请对照后端 createOrder 入参是否一致。',
    status: 'open',
    relatedNodeId: 'node-database',
    relatedDiscussionId: DEMO_DISCUSSION_IDS.DB,
    track: 'ready',
  },
];

export const PERSONAL_TODO_STATUS_LABELS: Record<PersonalTodoStatus, string> = {
  open: '待处理',
  waiting: '等待中',
  done: '已完成',
  'blocked-later': '后续阶段',
};
