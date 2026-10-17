import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';
import type { CodeFile, Discussion } from '../../types';
import { formatLineRange } from '../../utils/codeLines';
import {
  DISCUSSION_STATUS_LABELS,
  DISCUSSION_TYPE_LABELS,
  formatRelativeTime,
} from '../../utils/discussionLabels';
import { EmptyState } from '../common/EmptyState';

type DiscussionListProps = {
  discussions: Discussion[];
  files: CodeFile[];
  activeDiscussionId: string | null;
  onSelect: (discussionId: string) => void;
};

export function DiscussionList({
  discussions,
  files,
  activeDiscussionId,
  onSelect,
}: DiscussionListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!activeDiscussionId || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-discussion-id="${activeDiscussionId}"]`,
    );
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeDiscussionId]);

  if (discussions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="暂无讨论"
        description="对代码发起提问、讨论或评价后，记录将出现在此列表。"
      />
    );
  }

  const sorted = [...discussions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ul className="discussion-list" ref={listRef}>
      {sorted.map((item) => {
        const fileName =
          files.find((file) => file.id === item.fileId)?.name ?? '未知文件';
        const active = item.id === activeDiscussionId;

        return (
          <li key={item.id}>
            <button
              type="button"
              data-discussion-id={item.id}
              className={`discussion-card${active ? ' is-active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <div className="discussion-card-top">
                <span className={`type-chip type-${item.type}`}>
                  {DISCUSSION_TYPE_LABELS[item.type]}
                </span>
                <span className={`status-chip status-${item.status}`}>
                  {DISCUSSION_STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="discussion-content">{item.content}</p>
              <div className="discussion-meta">
                <span>{item.author}</span>
                <span title={fileName}>{fileName}</span>
                <span>{formatLineRange(item.lineStart, item.lineEnd)}</span>
                <span>{formatRelativeTime(item.createdAt)}</span>
                <span>回复 {item.replies.length}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
