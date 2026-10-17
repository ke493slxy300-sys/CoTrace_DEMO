import { useEffect, useState } from 'react';
import type { DiscussionType } from '../../types';
import { DISCUSSION_TYPE_LABELS } from '../../utils/discussionLabels';

export type AnnotationComposeDraft = {
  type: DiscussionType;
  content: string;
};

type AnnotationComposeModalProps = {
  open: boolean;
  cardTheme: string;
  submitting?: boolean;
  initialType?: DiscussionType;
  onSubmit: (draft: AnnotationComposeDraft) => void;
  onClose: () => void;
};

const TYPE_OPTIONS: DiscussionType[] = ['question', 'discussion', 'review'];

export function AnnotationComposeModal({
  open,
  cardTheme,
  submitting = false,
  initialType = 'discussion',
  onSubmit,
  onClose,
}: AnnotationComposeModalProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<DiscussionType>(initialType);

  useEffect(() => {
    if (!open) return;
    setContent('');
    setType(initialType);
  }, [open, initialType]);

  if (!open) return null;

  const canSubmit = content.trim().length > 0 && !submitting;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card annotation-compose-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anno-compose-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="anno-compose-title">添加标注</h2>
        <p className="annotation-compose-meta">关联 AI 溯源：{cardTheme}</p>

        <fieldset className="annotation-compose-types">
          <legend>标注类型</legend>
          <div className="annotation-compose-type-row">
            {TYPE_OPTIONS.map((option) => (
              <label key={option} className="annotation-compose-type">
                <input
                  type="radio"
                  name="annotation-type"
                  value={option}
                  checked={type === option}
                  disabled={submitting}
                  onChange={() => setType(option)}
                />
                <span>{DISCUSSION_TYPE_LABELS[option]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="annotation-compose-field">
          <span>内容</span>
          <textarea
            rows={5}
            value={content}
            maxLength={500}
            placeholder="填写提问、讨论或评价内容…"
            disabled={submitting}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <div className="annotation-compose-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ type, content: content.trim() })
            }
          >
            {submitting ? '提交中…' : `提交${DISCUSSION_TYPE_LABELS[type]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
