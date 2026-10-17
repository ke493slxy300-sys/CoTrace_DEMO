import type { DiscussionStatus, DiscussionType } from '../types';
import type { DiscussionViewStatus } from '../types/collaboration';

export const DISCUSSION_TYPE_LABELS: Record<DiscussionType, string> = {
  question: '提问',
  discussion: '讨论',
  review: '评价',
};

/** @deprecated 旧 Discussion.open|resolved；主路径请用 DISCUSSION_VIEW_STATUS_LABELS */
export const DISCUSSION_STATUS_LABELS: Record<DiscussionStatus, string> = {
  open: '待处理',
  resolved: '已处理',
};

export const DISCUSSION_VIEW_STATUS_LABELS: Record<
  DiscussionViewStatus,
  string
> = {
  needs_my_reply: '待我回复',
  waiting_for_teammate: '等待队友',
  ready_to_archive: '待确认归档',
  archived: '已归档',
};

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
