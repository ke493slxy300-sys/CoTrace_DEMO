import { Bot, Send } from 'lucide-react';
import type { WorkspaceAgentMessage } from '../../data/codingAgent';

type CodingAgentPanelProps = {
  messages: WorkspaceAgentMessage[];
  inputDisabled?: boolean;
  onFileRefClick?: (path: string) => void;
};

export function CodingAgentPanel({
  messages,
  inputDisabled = true,
  onFileRefClick,
}: CodingAgentPanelProps) {
  return (
    <aside className="panel right-panel" aria-label="编程 Agent">
      <div className="panel-header">
        <h2>编程 Agent</h2>
      </div>
      <div className="panel-body coding-agent-body">
        {messages.length === 0 ? (
          <div className="coding-agent-empty">
            <Bot size={22} strokeWidth={1.5} aria-hidden="true" />
            <strong>等待用户发起对话</strong>
            <p>编程 Agent 尚未启动。本阶段使用本地预置数据，不接入真实大模型。</p>
            <p className="coding-agent-hint">
              Agent 不会自动提交代码；需负责人确认后才能保存（保存/提交后续阶段）。
            </p>
          </div>
        ) : (
          <ul className="coding-agent-messages">
            {messages.map((item) => (
              <li
                key={item.id}
                className={`coding-agent-msg is-${item.role} type-${item.type}`}
              >
                <div className="coding-agent-msg-head">
                  <span>{item.role === 'agent' ? 'Agent' : '你'}</span>
                  <span className="coding-agent-msg-type">{item.typeLabel}</span>
                  <span className="coding-agent-msg-time">{item.time}</span>
                </div>
                <p>{item.content}</p>
                {item.fileRefs.length > 0 ? (
                  <div className="coding-agent-msg-refs">
                    {item.fileRefs.map((path) => (
                      <button
                        key={path}
                        type="button"
                        className="coding-agent-file-ref"
                        onClick={() => onFileRefClick?.(path)}
                      >
                        {path}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="coding-agent-composer">
          <textarea
            rows={3}
            placeholder="向编程 Agent 描述任务或提问（骨架阶段禁用）"
            disabled={inputDisabled}
          />
          <button type="button" className="btn btn-primary" disabled>
            <Send size={14} strokeWidth={1.5} aria-hidden="true" />
            发送
          </button>
        </div>
      </div>
    </aside>
  );
}
