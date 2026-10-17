import { useEffect, useId, useRef, useState } from 'react';
import type { CodeFile, DiscussionType, LineSelection } from '../../types';
import { formatLineRange } from '../../utils/codeLines';
import { DISCUSSION_TYPE_LABELS } from '../../utils/discussionLabels';
import { ConfirmDialog } from '../common/ConfirmDialog';

export type DiscussionDraft = {
  type: DiscussionType;
  content: string;
  fileId: string;
  lineStart: number;
  lineEnd: number;
};

type DiscussionModalProps = {
  open: boolean;
  file: CodeFile;
  selection: LineSelection;
  initialType: DiscussionType;
  submitting: boolean;
  onSubmit: (draft: DiscussionDraft) => void;
  onClose: () => void;
};

export function DiscussionModal({
  open,
  file,
  selection,
  initialType,
  submitting,
  onSubmit,
  onClose,
}: DiscussionModalProps) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContent('');
    setConfirmOpen(false);
    setEmptyHint(false);
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initialType, file.id, selection.lineStart, selection.lineEnd]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (confirmOpen) {
        setConfirmOpen(false);
        return;
      }
      if (submitting) return;
      if (content.trim().length > 0) {
        setConfirmOpen(true);
        return;
      }
      onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmOpen, submitting, content, onClose]);

  if (!open) return null;

  const canSubmit = content.trim().length > 0 && !submitting;

  function requestClose() {
    if (submitting) return;
    if (content.trim().length > 0) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }

  function handleSubmit() {
    if (submitting) return;
    if (!content.trim()) {
      setEmptyHint(true);
      return;
    }
    onSubmit({
      type: initialType,
      content: content.trim(),
      fileId: file.id,
      lineStart: selection.lineStart,
      lineEnd: selection.lineEnd,
    });
  }

  const typeLabel = DISCUSSION_TYPE_LABELS[initialType];

  return (
    <>
      <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
        <div
          className="discussion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={submitting}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="discussion-modal-header">
            <h2 id={titleId}>发起{typeLabel}</h2>
            <p>技术判断与最终决定由团队成员完成。AI 内容仅为模拟示例。</p>
          </header>

          <div className="discussion-modal-body">
            <div className="field-row field-row-3">
              <div className="field">
                <span>讨论类型</span>
                <div className="field-readonly">{typeLabel}</div>
              </div>
              <div className="field">
                <span>关联文件</span>
                <div className="field-readonly" title={file.name}>
                  {file.name}
                </div>
              </div>
              <div className="field">
                <span>关联代码行</span>
                <div className="field-readonly">
                  {formatLineRange(selection.lineStart, selection.lineEnd)}
                </div>
              </div>
            </div>

            <label className="field">
              <span>内容</span>
              <textarea
                ref={textareaRef}
                value={content}
                rows={6}
                placeholder="填写提问、讨论或评价内容…"
                disabled={submitting}
                onChange={(event) => {
                  setContent(event.target.value);
                  if (emptyHint && event.target.value.trim()) {
                    setEmptyHint(false);
                  }
                }}
              />
              {emptyHint ? (
                <span className="field-error">请填写内容后再提交。</span>
              ) : null}
            </label>
          </div>

          <footer className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={requestClose}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? '提交中…' : '提交'}
            </button>
          </footer>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="放弃未保存内容？"
        message="关闭后，当前输入的内容将不会保存。"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}
