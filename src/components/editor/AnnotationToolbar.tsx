import { CircleHelp, MessageCircle, MessageSquare } from 'lucide-react';
import type { DiscussionType, LineSelection } from '../../types';
import { formatLineRange } from '../../utils/codeLines';
import { DISCUSSION_TYPE_LABELS } from '../../utils/discussionLabels';

type AnnotationToolbarProps = {
  fileName: string;
  selection: LineSelection;
  disabled?: boolean;
  onAction: (type: DiscussionType) => void;
};

const ACTIONS: {
  type: DiscussionType;
  icon: typeof CircleHelp;
}[] = [
  { type: 'question', icon: CircleHelp },
  { type: 'discussion', icon: MessageCircle },
  { type: 'review', icon: MessageSquare },
];

export function AnnotationToolbar({
  fileName,
  selection,
  disabled = false,
  onAction,
}: AnnotationToolbarProps) {
  return (
    <div className="annotation-toolbar-inner" role="toolbar" aria-label="代码批注工具栏">
      <div className="annotation-toolbar-meta">
        <span title={fileName}>{fileName}</span>
        <span>{formatLineRange(selection.lineStart, selection.lineEnd)}</span>
      </div>
      <div className="annotation-toolbar-actions">
        {ACTIONS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            className="btn btn-ghost btn-compact annotation-action"
            disabled={disabled}
            onClick={() => onAction(type)}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {DISCUSSION_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
