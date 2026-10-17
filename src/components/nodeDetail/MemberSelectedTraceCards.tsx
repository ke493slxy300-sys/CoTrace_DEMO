import { useState } from 'react';
import { Bot, MessageSquarePlus } from 'lucide-react';
import type { TeammateTraceCard } from '../../demoContent/teammateTypes';
import { EmptyState } from '../common/EmptyState';

type MemberSelectedTraceCardsProps = {
  cards: TeammateTraceCard[];
  sourcePolicy: string;
  organizedBy: string;
  /** 卡片里「当前队友」替换成节点负责人姓名 */
  memberLabel: string;
  activeCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onOpenArtifact?: (path: string) => void;
  onAnnotate: (cardId: string) => void;
};

export function MemberSelectedTraceCards({
  cards,
  sourcePolicy,
  organizedBy,
  memberLabel,
  activeCardId,
  onSelectCard,
  onOpenArtifact,
  onAnnotate,
}: MemberSelectedTraceCardsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="暂无公开溯源片段"
        description="该队友尚未选取可展示的协作片段。"
      />
    );
  }

  return (
    <div className="member-trace-wrap">
      <p className="member-trace-policy">
        由当前队友选取片段，{organizedBy}按任务主题整理。不包含完整原始对话。
      </p>
      <p className="member-trace-policy is-muted">{sourcePolicy}</p>
      <ul className="ai-theme-card-list">
        {cards.map((card) => {
          const expanded = hoveredId === card.id || activeCardId === card.id;
          return (
            <li key={card.id}>
              <article
                className={`ai-theme-card${activeCardId === card.id ? ' is-active' : ''}${
                  expanded ? ' is-expanded' : ''
                }`}
                onMouseEnter={() => setHoveredId(card.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectCard(card.id)}
              >
                <header className="ai-theme-card-head">
                  <span className="ai-theme-card-index">
                    {card.topic} · {card.displayTitle}
                    {card.titleEdited ? '（已改标题）' : ''}
                  </span>
                </header>
                <p className="ai-theme-card-summary">{card.selectionNote}</p>

                <div className="ai-theme-card-detail">
                  <div className="member-trace-fragments">
                    <strong>选中片段</strong>
                    <ul>
                      {card.fragments.map((frag, index) => (
                        <li key={`${card.id}-f${index}`}>
                          <span>
                            {frag.speaker === '当前队友'
                              ? memberLabel
                              : frag.speaker}
                          </span>
                          <p>{frag.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="ai-theme-card-line">
                    <strong>人的理解：</strong>
                    {card.humanUnderstanding}
                  </p>
                  <p className="ai-theme-card-line">
                    <strong>人的决定：</strong>
                    {card.humanDecision}
                  </p>
                  {card.affectedArtifacts.length > 0 ? (
                    <div className="member-trace-artifacts">
                      <strong>影响产物</strong>
                      <div className="member-trace-artifact-row">
                        {card.affectedArtifacts.map((path) => (
                          <button
                            key={path}
                            type="button"
                            className="coding-agent-file-ref"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenArtifact?.(path);
                            }}
                          >
                            {path}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="ai-theme-card-meta">未决：{card.unresolved}</p>
                  {card.memoryCandidate ? (
                    <p className="ai-theme-card-line">
                      <strong>记忆候选：</strong>
                      {card.memoryCandidate}
                    </p>
                  ) : null}
                </div>

                <div className="ai-theme-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAnnotate(card.id);
                    }}
                  >
                    <MessageSquarePlus size={14} strokeWidth={1.5} />
                    标注
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
