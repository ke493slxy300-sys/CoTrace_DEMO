/**
 * 教师指导台小组目录。真实联调演示组为第03组校园项目；其余为可进入的示意组。
 */

import {
  HANDOFF_GROUP_LABEL,
  HANDOFF_PROJECT_ID,
  HANDOFF_PROJECT_NAME,
} from './handoffDemoSeed';

export type TeacherGroupCard = {
  id: string;
  label: string;
  name: string;
  summary: string;
  status: string;
  tone: 'ok' | 'warn' | 'idle';
  /** 是否有真实过程事件 / 交付链 */
  live: boolean;
  projectId: string | null;
};

export const TEACHER_LIVE_GROUP_ID = 'g3';

export const TEACHER_GROUPS: TeacherGroupCard[] = [
  {
    id: 'g1',
    label: '第01组',
    name: '校园活动平台',
    summary: '已按建议更新报名流程',
    status: '已回应',
    tone: 'ok',
    live: false,
    projectId: null,
  },
  {
    id: 'g2',
    label: '第02组',
    name: '自习室预约系统',
    summary: '预约冲突处理已提交验证',
    status: '新汇报',
    tone: 'ok',
    live: false,
    projectId: null,
  },
  {
    id: TEACHER_LIVE_GROUP_ID,
    label: HANDOFF_GROUP_LABEL,
    name: HANDOFF_PROJECT_NAME,
    summary: '订单创建交付与联调求助',
    status: '待指导',
    tone: 'warn',
    live: true,
    projectId: HANDOFF_PROJECT_ID,
  },
  {
    id: 'g4',
    label: '第04组',
    name: '校园失物招领',
    summary: '第二阶段成果已提交',
    status: '新汇报',
    tone: 'ok',
    live: false,
    projectId: null,
  },
];

export function getTeacherGroup(
  groupId: string | null | undefined,
): TeacherGroupCard {
  return (
    TEACHER_GROUPS.find((group) => group.id === groupId) ??
    TEACHER_GROUPS.find((group) => group.id === TEACHER_LIVE_GROUP_ID)!
  );
}
