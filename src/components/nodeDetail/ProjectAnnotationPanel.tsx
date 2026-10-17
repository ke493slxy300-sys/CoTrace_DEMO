import { useMemo, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { getSubmission } from '../../data/demoSubmission';
import { BACKEND_APP_NODE_ID } from '../../demoContent/packIds';
import {
  DEMO_ANNOTATION_IDS,
  getDecisionBadge,
  getDiscussionByAnnotationId,
  getDiscussionViewStatus,
  getReadyToArchiveHint,
  useNodeCollaborationStore,
} from '../../data/nodeCollaborationStore';
import { getMemberById } from '../../data/members';
import type { ProjectAnnotation } from '../../types/collaboration';
import type { DiscussionViewStatus } from '../../types/collaboration';
import {
  DISCUSSION_VIEW_STATUS_LABELS,
  formatRelativeTime,
} from '../../utils/discussionLabels';
import { EmptyState } from '../common/EmptyState';

/**
 * 后端 API：提交前只展示 A/C 两条标注；
 * 《购买失败需区分错误码后再改提示》(B) 提交后再出现。
 */
function isBackendAnnotationVisibleBeforeSubmit(
  annotationId: string,
): boolean {
  return (
    annotationId === DEMO_ANNOTATION_IDS.A ||
    annotationId === DEMO_ANNOTATION_IDS.C
  );
}

type FilterKey = 'all' | DiscussionViewStatus;

type ProjectAnnotationPanelProps = {
  projectId: string;
  nodeId: string;
  currentUserId: string;
  onOpenDiscussion: (discussionId: string) => void;
  onOpenAnnotation: (annotationId: string) => void;
};

function formatTarget(annotation: ProjectAnnotation): string {
  const t = annotation.target;
  if (t.kind === 'node') return '节点';
  if (t.kind === 'file') return t.fileLabel ?? t.fileId;
  if (t.kind === 'lines') {
    return `${t.fileLabel ?? t.fileId} · L${t.lineStart}–${t.lineEnd}`;
  }
  return t.traceTitle ? `溯源 · ${t.traceTitle}` : 'AI 溯源卡片';
}

export function ProjectAnnotationPanel({
  projectId,
  nodeId,
  currentUserId,
  onOpenDiscussion,
  onOpenAnnotation,
}: ProjectAnnotationPanelProps) {
  const store = useNodeCollaborationStore();
  const [filter, setFilter] = useState<FilterKey>('all');

  const hasBackendSubmission = Boolean(
    nodeId === BACKEND_APP_NODE_ID && getSubmission(nodeId, projectId),
  );

  const annotations = useMemo(
    () =>
      store.annotations
        .filter((item) => {
          if (item.projectId !== projectId || item.nodeId !== nodeId) {
            return false;
          }
          if (nodeId === BACKEND_APP_NODE_ID && !hasBackendSubmission) {
            return isBackendAnnotationVisibleBeforeSubmit(item.id);
          }
          return true;
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [store, projectId, nodeId, hasBackendSubmission],
  );

  const rows = useMemo(() => {
    return annotations.map((annotation) => {
      const discussion = getDiscussionByAnnotationId(annotation.id);
      const viewStatus = discussion
        ? getDiscussionViewStatus(discussion, currentUserId)
        : null;
      const lastMsg = discussion?.messages[discussion.messages.length - 1];
      const counterpartId = discussion
        ? discussion.participantIds.find((id) => id !== currentUserId) ??
          discussion.participantIds[0]
        : annotation.authorId;
      return {
        annotation,
        discussion,
        viewStatus,
        lastSummary: lastMsg?.content ?? annotation.summary,
        updatedAt: discussion?.updatedAt ?? annotation.updatedAt,
        counterpartName:
          getMemberById(counterpartId)?.name ?? counterpartId ?? '—',
        authorName:
          getMemberById(annotation.authorId)?.name ?? annotation.authorId,
        archiveHint: discussion
          ? getReadyToArchiveHint(discussion, currentUserId)
          : null,
        decisionBadge: discussion ? getDecisionBadge(discussion) : null,
      };
    });
  }, [annotations, currentUserId]);

  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = {
      all: rows.length,
      needs_my_reply: 0,
      waiting_for_teammate: 0,
      ready_to_archive: 0,
      archived: 0,
    };
    for (const row of rows) {
      if (row.viewStatus) base[row.viewStatus] += 1;
    }
    return base;
  }, [rows]);

  const visible = rows.filter((row) => {
    if (filter === 'all') return true;
    return row.viewStatus === filter;
  });

  if (annotations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="暂无项目标注"
        description="该节点还没有团队标注。可从 AI 溯源或代码选择发起标注。"
      />
    );
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'needs_my_reply', label: DISCUSSION_VIEW_STATUS_LABELS.needs_my_reply },
    {
      key: 'waiting_for_teammate',
      label: DISCUSSION_VIEW_STATUS_LABELS.waiting_for_teammate,
    },
    {
      key: 'ready_to_archive',
      label: DISCUSSION_VIEW_STATUS_LABELS.ready_to_archive,
    },
    { key: 'archived', label: DISCUSSION_VIEW_STATUS_LABELS.archived },
  ];

  return (
    <div className="project-anno-wrap">
      <div className="project-anno-filters" role="tablist" aria-label="讨论状态筛选">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`project-anno-filter${
              filter === item.key ? ' is-active' : ''
            }`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            <span>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="blueprint-detail-note">当前筛选下没有标注。</p>
      ) : (
        <ul className="project-anno-list">
          {visible.map((row) => (
            <li key={row.annotation.id}>
              <button
                type="button"
                className="project-anno-card"
                onClick={() => {
                  if (row.discussion) {
                    onOpenDiscussion(row.discussion.id);
                  } else {
                    onOpenAnnotation(row.annotation.id);
                  }
                }}
              >
                <span className="project-anno-kind">
                  {row.annotation.typeLabel} · {row.authorName}
                </span>
                {row.viewStatus ? (
                  <span
                    className={`project-anno-status is-${row.viewStatus}`}
                  >
                    {DISCUSSION_VIEW_STATUS_LABELS[row.viewStatus]}
                    {row.archiveHint ? ` · ${row.archiveHint}` : ''}
                    {row.decisionBadge ? ` · ${row.decisionBadge}` : ''}
                  </span>
                ) : (
                  <span className="project-anno-status is-note">仅标注</span>
                )}
                <span className="project-anno-summary">
                  {row.annotation.summary}
                </span>
                <span className="project-anno-meta">
                  对象：{formatTarget(row.annotation)}
                  {row.discussion
                    ? ` · 对方 ${row.counterpartName}`
                    : ' · 尚未发起讨论'}
                </span>
                <span className="project-anno-meta">
                  {formatRelativeTime(row.updatedAt)}
                  {row.discussion ? ` · ${row.lastSummary}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
