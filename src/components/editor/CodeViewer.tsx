import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { FileCode2 } from 'lucide-react';
import type { CodeFile, LineSelection } from '../../types';
import { getDisplayLines, normalizeSelection } from '../../utils/codeLines';
import { renderHighlightedLine } from '../../utils/highlightCode';
import { EmptyState } from '../common/EmptyState';

export type CodeScrollRequest = {
  fileId: string;
  lineStart: number;
  nonce: number;
};

type CodeViewerProps = {
  file: CodeFile | null;
  selection: LineSelection | null;
  highlightSelection?: LineSelection | null;
  scrollRequest?: CodeScrollRequest | null;
  toolbar?: ReactNode;
  /** 队友节点：语法高亮 + 文件名后的只读标记 */
  ideChrome?: boolean;
  onSelectionChange: (selection: LineSelection | null) => void;
  onUserSelect?: () => void;
};

export function CodeViewer({
  file,
  selection,
  highlightSelection = null,
  scrollRequest = null,
  toolbar = null,
  ideChrome = false,
  onSelectionChange,
  onUserSelect,
}: CodeViewerProps) {
  const draggingRef = useRef(false);
  const anchorRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    function handleMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      anchorRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useLayoutEffect(() => {
    if (!file || !scrollRequest) return;
    if (scrollRequest.fileId !== file.id) return;

    const body = bodyRef.current;
    if (!body) return;

    const target = body.querySelector<HTMLElement>(
      `[data-line="${scrollRequest.lineStart}"]`,
    );
    if (!target) return;

    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset =
      targetRect.top -
      bodyRect.top -
      body.clientHeight / 2 +
      targetRect.height / 2;

    body.scrollTop = Math.max(0, body.scrollTop + offset);
  }, [file, scrollRequest]);

  if (!file) {
    return (
      <>
        <div className="panel-header">
          <h2>代码</h2>
        </div>
        <div className="panel-body code-viewer-body">
          <EmptyState
            icon={FileCode2}
            title="尚未选择文件"
            description="从左侧选择任务文件，或上传本地代码文件以查看内容。"
          />
        </div>
        <div className="annotation-toolbar">{toolbar}</div>
      </>
    );
  }

  const displayLines = getDisplayLines(file.content);

  function updateSelection(lineNumber: number) {
    const anchor = anchorRef.current ?? lineNumber;
    onSelectionChange(normalizeSelection(anchor, lineNumber));
  }

  function handleLineMouseDown(lineNumber: number, event: MouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    anchorRef.current = lineNumber;
    setIsDragging(true);
    onUserSelect?.();
    onSelectionChange({ lineStart: lineNumber, lineEnd: lineNumber });
  }

  function handleLineMouseEnter(lineNumber: number) {
    if (!draggingRef.current) return;
    updateSelection(lineNumber);
  }

  return (
    <>
      <div className="panel-header">
        <h2 title={file.name}>{file.name}</h2>
        {ideChrome ? (
          <div className="code-file-status">
            <span className="badge">只读</span>
          </div>
        ) : (
          <span className="panel-meta">{file.language}</span>
        )}
      </div>
      <div
        ref={bodyRef}
        className={`panel-body code-viewer-body${isDragging ? ' is-selecting' : ''}`}
        role="region"
        aria-label={`${file.name} 代码内容`}
      >
        <div className="code-viewer">
          {displayLines.map((line, index) => {
            const lineNumber = index + 1;
            const selected =
              selection != null &&
              lineNumber >= selection.lineStart &&
              lineNumber <= selection.lineEnd;
            const focused =
              highlightSelection != null &&
              lineNumber >= highlightSelection.lineStart &&
              lineNumber <= highlightSelection.lineEnd;

            return (
              <div
                className={`code-line${selected ? ' is-selected' : ''}${focused ? ' is-focused' : ''}`}
                key={`${file.id}-${lineNumber}`}
                data-line={lineNumber}
                onMouseDown={(event) => handleLineMouseDown(lineNumber, event)}
                onMouseEnter={() => handleLineMouseEnter(lineNumber)}
              >
                <span className="code-gutter" aria-hidden="true">
                  {lineNumber}
                </span>
                <code className="code-content">
                  {line.length === 0
                    ? '\u00a0'
                    : ideChrome
                      ? renderHighlightedLine(line, file.language)
                      : line}
                </code>
              </div>
            );
          })}
        </div>
      </div>
      <div className="annotation-toolbar">{toolbar}</div>
    </>
  );
}
