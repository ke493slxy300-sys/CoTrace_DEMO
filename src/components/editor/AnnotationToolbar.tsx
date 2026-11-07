import { MessageSquarePlus } from 'lucide-react';
import type { DiscussionType, LineSelection } from '../../types';
import { formatLineRange } from '../../utils/codeLines';

type AnnotationToolbarProps = {
  fileName: string;
  selection: LineSelection;
  disabled?: boolean;
  onAction: (type: DiscussionType) => void;
};

/** 统一入口；下游弹窗仍可选用讨论类型，默认 discussion */
const DEFAULT_ANNOTATION_TYPE: DiscussionType = 'discussion';

export function AnnotationToolbar({
  fileName: _fileName,
  selection,
  disabled = false,
  onAction,
}: AnnotationToolbarProps) {
  return (
    <div className="annotation-toolbar-inner" role="toolbar" aria-label="代码批注工具栏">
      <div className="annotation-toolbar-meta">
        <span>{formatLineRange(selection.lineStart, selection.lineEnd)}</span>
      </div>
      <div className="annotation-toolbar-actions">
        <button
          type="button"
          className="btn btn-ghost btn-compact annotation-action"
          disabled={disabled}
          onClick={() => onAction(DEFAULT_ANNOTATION_TYPE)}
        >
          <MessageSquarePlus size={16} strokeWidth={1.5} aria-hidden="true" />
          标注
        </button>
      </div>
    </div>
  );
}
