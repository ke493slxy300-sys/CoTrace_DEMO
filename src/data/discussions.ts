/**
 * @deprecated 团队讨论主路径已迁至 `nodeCollaborationStore`。
 * 保留兼容导出，避免旧引用断裂。
 */
import type { Discussion } from '../types';
import { BACKEND_TASK_ID } from './files';

/** @deprecated */
export const presetDiscussions: Discussion[] = [
  {
    id: 'discussion-001',
    type: 'question',
    author: 'Maya Chen',
    fileId: 'file-order-service',
    lineStart: 5,
    lineEnd: 11,
    content:
      '商品不可购买时，抛出 LISTING_UNAVAILABLE 是否足够？前端目前只能显示通用失败提示。',
    status: 'open',
    relatedTraceId: 'trace-002',
    replies: [],
    createdAt: '2026-10-15T08:00:00.000Z',
  },
];

export function getPresetDiscussionsForTask(taskId: string): Discussion[] {
  if (taskId !== BACKEND_TASK_ID) return [];
  return presetDiscussions.map((item) => ({
    ...item,
    replies: [...item.replies],
  }));
}
