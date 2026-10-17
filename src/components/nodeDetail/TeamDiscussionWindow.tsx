import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  archiveDiscussion,
  confirmTeamDecision,
  getDecisionBadge,
  getDiscussionViewStatus,
  getReadyToArchiveHint,
  sendDiscussionMessage,
  useNodeCollaborationStore,
} from '../../data/nodeCollaborationStore';
import { getMemberById } from '../../data/members';
import {
  DISCUSSION_VIEW_STATUS_LABELS,
  formatRelativeTime,
} from '../../utils/discussionLabels';

type TeamDiscussionWindowProps = {
  open: boolean;
  discussionId: string | null;
  currentUserId: string;
  viewerName: string;
  onClose: () => void;
};

export function TeamDiscussionWindow({
  open,
  discussionId,
  currentUserId,
  viewerName,
  onClose,
}: TeamDiscussionWindowProps) {
  const titleId = useId();
  const store = useNodeCollaborationStore();
  const discussion = useMemo(
    () =>
      discussionId
        ? store.discussions.find((item) => item.id === discussionId) ?? null
        : null,
    [store, discussionId],
  );

  const [draft, setDraft] = useState('');
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [decisionEdit, setDecisionEdit] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft('');
    setArchiveConfirmOpen(false);
  }, [open, discussionId]);

  useEffect(() => {
    if (!discussion) return;
    if (
      discussion.teamDecision.status === 'draft' &&
      discussion.teamDecision.draftContent
    ) {
      setDecisionEdit(discussion.teamDecision.draftContent);
    }
  }, [
    discussion?.id,
    discussion?.teamDecision.status,
    discussion?.teamDecision.draftContent,
  ]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (archiveConfirmOpen) {
          setArchiveConfirmOpen(false);
          return;
        }
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, archiveConfirmOpen]);

  if (!open || !discussion) return null;

  const viewStatus = getDiscussionViewStatus(discussion, currentUserId);
  const archiveHint = getReadyToArchiveHint(discussion, currentUserId);
  const decisionBadge = getDecisionBadge(discussion);
  const canArchive =
    discussion.lifecycle === 'ready_to_archive' &&
    discussion.waitingOnMemberId === currentUserId;
  const canReply = discussion.lifecycle !== 'archived';
  const participants = discussion.participantIds
    .map((id) => getMemberById(id)?.name ?? id)
    .join('、');
  const waitingName = discussion.waitingOnMemberId
    ? (getMemberById(discussion.waitingOnMemberId)?.name ??
      discussion.waitingOnMemberId)
    : null;

  const discussionRefId = discussion.id;

  function handleSend() {
    const text = draft.trim();
    if (!text || !canReply) return;
    sendDiscussionMessage(discussionRefId, {
      authorId: currentUserId,
      content: text,
    });
    setDraft('');
  }

  function handleConfirmArchive() {
    setArchiveConfirmOpen(false);
    archiveDiscussion(discussionRefId, currentUserId);
  }

  function handleConfirmDecision() {
    const text = decisionEdit.trim();
    if (!text) return;
    confirmTeamDecision(
      discussionRefId,
      text,
      currentUserId,
      'project-agent',
    );
  }

  const decision = discussion.teamDecision;
  const confirmedByName = decision.confirmedBy
    ? (getMemberById(decision.confirmedBy)?.name ?? decision.confirmedBy)
    : null;

  return (
    <>
      <div className="modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="discussion-modal team-discussion-window"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="discussion-modal-header team-discussion-window-header">
            <div className="team-discussion-window-head">
              <div>
                <p className="team-discussion-window-kind">
                  团队讨论 · {participants}
                </p>
                <h2 id={titleId}>{discussion.title}</h2>
                <p>
                  <span className={`project-anno-status is-${viewStatus}`}>
                    {DISCUSSION_VIEW_STATUS_LABELS[viewStatus]}
                  </span>
                  {archiveHint ? ` · ${archiveHint}` : ''}
                  {decisionBadge ? ` · ${decisionBadge}` : ''}
                  {waitingName && viewStatus === 'waiting_for_teammate'
                    ? ` · 等待 ${waitingName}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="关闭团队讨论"
                onClick={onClose}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <DecisionRegion
              discussion={discussion}
              decisionEdit={decisionEdit}
              onDecisionEditChange={setDecisionEdit}
              onConfirmDecision={handleConfirmDecision}
              confirmedByName={confirmedByName}
            />
          </div>

          <div className="discussion-modal-body team-discussion-window-body">
            <ul className="team-discussion-thread">
              {discussion.messages.map((msg) => {
                const isViewer = msg.authorId === currentUserId;
                const authorName =
                  getMemberById(msg.authorId)?.name ?? msg.authorId;
                return (
                  <li
                    key={msg.id}
                    className={`team-discussion-msg${
                      isViewer ? ' is-viewer' : ' is-teammate'
                    }`}
                  >
                    <div className="team-discussion-msg-head">
                      <strong>
                        {isViewer ? `你 · ${viewerName}` : authorName}
                      </strong>
                      <span>{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    <p>{msg.content}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="team-discussion-footer">
            {canReply ? (
              <div className="team-discussion-composer">
                <textarea
                  rows={3}
                  value={draft}
                  placeholder="以 Maya Chen 身份回复…"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="team-discussion-composer-actions">
                  <span className="submit-hint">Ctrl + Enter 发送 · Enter 换行</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={draft.trim().length === 0}
                    onClick={handleSend}
                  >
                    发送回复
                  </button>
                </div>
              </div>
            ) : (
              <p className="submit-hint">已归档讨论为只读，不可再发送消息。</p>
            )}

            {discussion.lifecycle === 'ready_to_archive' ? (
              canArchive ? (
                <button
                  type="button"
                  className="btn btn-primary team-discussion-archive-btn"
                  onClick={() => setArchiveConfirmOpen(true)}
                >
                  确认已解决并归档
                </button>
              ) : (
                <p className="submit-hint">
                  等待{waitingName ?? '对应成员'}确认归档
                </p>
              )
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="确认归档这条讨论？"
        message="归档后，项目理解 Agent 将根据讨论内容生成一份团队决定草案。草案仍需你确认后，才能成为正式团队决定。"
        confirmLabel="确认归档"
        cancelLabel="取消"
        onCancel={() => setArchiveConfirmOpen(false)}
        onConfirm={handleConfirmArchive}
      />
    </>
  );
}

function DecisionRegion({
  discussion,
  decisionEdit,
  onDecisionEditChange,
  onConfirmDecision,
  confirmedByName,
}: {
  discussion: NonNullable<
    ReturnType<typeof useNodeCollaborationStore>['discussions'][number]
  >;
  decisionEdit: string;
  onDecisionEditChange: (value: string) => void;
  onConfirmDecision: () => void;
  confirmedByName: string | null;
}) {
  const decision = discussion.teamDecision;

  if (decision.status === 'none' && discussion.lifecycle !== 'archived') {
    return null;
  }

  if (decision.status === 'generating') {
    return (
      <section
        className="team-discussion-decision is-generating"
        aria-label="团队决定"
      >
        <header className="team-discussion-decision-label">
          <span>团队决定草案</span>
          <span className="team-discussion-decision-meta">生成中</span>
        </header>
        <p className="team-discussion-decision-body">
          项目理解 Agent 正在整理讨论内容…
        </p>
      </section>
    );
  }

  if (decision.status === 'draft') {
    return (
      <section
        className="team-discussion-decision is-draft"
        aria-label="团队决定草案"
      >
        <header className="team-discussion-decision-label">
          <span>团队决定草案</span>
          <span className="team-discussion-decision-meta">
            项目理解 Agent 整理 · 待确认
          </span>
        </header>
        <textarea
          rows={3}
          value={decisionEdit}
          onChange={(event) => onDecisionEditChange(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={decisionEdit.trim().length === 0}
          onClick={onConfirmDecision}
        >
          确认作为团队决定
        </button>
      </section>
    );
  }

  if (decision.status === 'confirmed' && decision.content) {
    const byAgent = decision.source === 'project-agent';
    return (
      <section
        className="team-discussion-decision is-confirmed"
        aria-label="团队决定"
      >
        <header className="team-discussion-decision-label">
          <span>团队决定</span>
          <span className="team-discussion-decision-meta">
            {byAgent
              ? `Agent 整理 · ${confirmedByName ?? '成员'}确认`
              : `${confirmedByName ?? '成员'}提出并确认`}
          </span>
        </header>
        <p className="team-discussion-decision-body">{decision.content}</p>
      </section>
    );
  }

  return null;
}
