import { useEffect, useRef } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import type { AiTrace, CodeFile } from '../../types';
import { formatLineRange } from '../../utils/codeLines';
import { EmptyState } from '../common/EmptyState';

type TracePanelProps = {
  traces: AiTrace[];
  files: CodeFile[];
  activeTraceId: string | null;
  onSelect: (traceId: string) => void;
};

export function TracePanel({
  traces,
  files,
  activeTraceId,
  onSelect,
}: TracePanelProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!activeTraceId || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-trace-id="${activeTraceId}"]`,
    );
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeTraceId]);

  if (traces.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="暂无关联记录"
        description="当前代码片段没有匹配的模拟 AI 溯源。不会自动生成虚假记录。"
      />
    );
  }

  return (
    <ul className="trace-list" ref={listRef}>
      {traces.map((trace) => {
        const fileName =
          files.find((file) => file.id === trace.fileId)?.name ?? '未知文件';
        const active = trace.id === activeTraceId;

        return (
          <li key={trace.id}>
            <button
              type="button"
              data-trace-id={trace.id}
              className={`trace-card${active ? ' is-active' : ''}`}
              onClick={() => onSelect(trace.id)}
            >
              <div className="trace-card-top">
                <span className="badge">
                  <Sparkles size={12} strokeWidth={1.5} aria-hidden="true" />
                  {trace.label}
                </span>
                <span className="status-chip status-ai">AI 建议</span>
              </div>
              <p className="trace-label">输入（示例）</p>
              <p className="trace-content">{trace.input}</p>
              <p className="trace-label">整理结果（模拟 AI 内容）</p>
              <p className="trace-content">{trace.suggestion}</p>
              <div className="discussion-meta">
                <span title={fileName}>{fileName}</span>
                <span>{formatLineRange(trace.lineStart, trace.lineEnd)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
