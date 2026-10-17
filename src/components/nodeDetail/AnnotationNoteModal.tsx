import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import {
  createDiscussion,
  getAnnotation,
} from '../../data/nodeCollaborationStore';
import { getMemberById, EXPERIENCE_MEMBER_ID } from '../../data/members';
import { formatRelativeTime } from '../../utils/discussionLabels';

type AnnotationNoteModalProps = {
  open: boolean;
  annotationId: string | null;
  projectId: string;
  currentUserId: string;
  /** 默认发起讨论时等待回复的队友 */
  defaultPeerId?: string;
  onClose: () => void;
  onDiscussionCreated: (discussionId: string) => void;
};

export function AnnotationNoteModal({
  open,
  annotationId,
  projectId,
  currentUserId,
  defaultPeerId = 'member-priya',
  onClose,
  onDiscussionCreated,
}: AnnotationNoteModalProps) {
  const titleId = useId();
  const annotation = annotationId ? getAnnotation(annotationId) : null;
  const [composeOpen, setComposeOpen] = useState(false);
  const [peerId, setPeerId] = useState(defaultPeerId);
  const [firstMessage, setFirstMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setComposeOpen(false);
    setPeerId(defaultPeerId);
    setFirstMessage('');
  }, [open, annotationId, defaultPeerId]);

  if (!open || !annotation) return null;

  const authorName =
    getMemberById(annotation.authorId)?.name ?? annotation.authorId;

  function handleStartDiscussion() {
    const text = firstMessage.trim();
    if (!text || !annotation) return;
    const waitingOn =
      currentUserId === EXPERIENCE_MEMBER_ID ? peerId : EXPERIENCE_MEMBER_ID;
    const created = createDiscussion(projectId, {
      nodeId: annotation.nodeId,
      annotationId: annotation.id,
      title: annotation.summary,
      participantIds: [currentUserId, waitingOn],
      waitingOnMemberId: waitingOn,
      firstMessage: { authorId: currentUserId, content: text },
    });
    onDiscussionCreated(created.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="discussion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="discussion-modal-header">
          <div className="team-discussion-window-head">
            <div>
              <p className="team-discussion-window-kind">
                项目标注 · {annotation.typeLabel}
              </p>
              <h2 id={titleId}>{annotation.summary}</h2>
              <p>
                {authorName} · {formatRelativeTime(annotation.createdAt)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="关闭标注"
              onClick={onClose}
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="discussion-modal-body">
          <p className="submit-stage-lead">{annotation.content}</p>
          <p className="submit-hint">
            此标注尚未关联团队讨论。发起讨论并发送第一条消息后，才会出现「待我回复 /
            等待队友」状态。
          </p>
          {!composeOpen ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setComposeOpen(true)}
            >
              发起讨论
            </button>
          ) : (
            <div className="submit-desc-body">
              <label className="submit-field">
                <span>参与队友（下一步等待回复的人）</span>
                <select
                  value={peerId}
                  onChange={(event) => setPeerId(event.target.value)}
                >
                  <option value="member-priya">
                    {getMemberById('member-priya')?.name ?? 'member-priya'}
                  </option>
                  <option value="member-alex">
                    {getMemberById('member-alex')?.name ?? 'member-alex'}
                  </option>
                  <option value="member-jordan">
                    {getMemberById('member-jordan')?.name ?? 'member-jordan'}
                  </option>
                </select>
              </label>
              <label className="submit-field">
                <span>第一条消息</span>
                <textarea
                  rows={4}
                  value={firstMessage}
                  onChange={(event) => setFirstMessage(event.target.value)}
                  placeholder="写出你想讨论的问题或说明"
                />
              </label>
              <div className="submit-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setComposeOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={firstMessage.trim().length === 0}
                  onClick={handleStartDiscussion}
                >
                  发送并创建讨论
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
