import { Bot, MessageSquarePlus, PencilLine } from 'lucide-react';
import type { AiTraceThemeCard } from '../../data/nodeCollaboration';
import { formatRelativeTime } from '../../utils/discussionLabels';
import { EmptyState } from '../common/EmptyState';

type AiTraceThemeCardsProps = {
  cards: AiTraceThemeCard[];
  activeCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onAnnotate: (cardId: string) => void;
};

function shortLabel(label: string): string {
  const parts = label.split(/[/·]/).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || label;
}

export function AiTraceThemeCards({
  cards,
  activeCardId,
  onSelectCard,
  onAnnotate,
}: AiTraceThemeCardsProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="暂无 AI 溯源"
        description="该节点还没有可展示的模拟 AI 协作记录。"
      />
    );
  }

  return (
    <ul className="ai-theme-card-list">
      {cards.map((card, index) => {
        const expanded = activeCardId === card.id;
        const hasDetail = card.dialogues.length > 0;
        return (
          <li key={card.id}>
            <article
              className={`ai-theme-card${expanded ? ' is-active is-expanded' : ''}`}
              onClick={() => onSelectCard(card.id)}
            >
              <header className="ai-theme-card-head">
                <span className="ai-theme-card-index">
                  <span className="ai-theme-card-title">{card.theme}</span>
                </span>
                <span className="ai-theme-card-time">
                  {formatRelativeTime(card.createdAt)} · {card.initiator}
                </span>
              </header>
              {card.stage ? (
                <p className="ai-theme-card-stage">{card.stage}</p>
              ) : null}
              {card.summary ? (
                <p className="ai-theme-card-decision">
                  <span className="ai-theme-card-label">要点</span>
                  <span className="ai-theme-card-decision-text">
                    {card.summary}
                  </span>
                </p>
              ) : null}

              <div className="ai-theme-card-sections">
                {card.problem ? (
                  <p className="ai-theme-card-section is-pending">
                    <span className="ai-theme-card-label">问题</span>
                    <span className="ai-theme-card-section-body">
                      {card.problem}
                    </span>
                  </p>
                ) : null}
                {card.agentAdvice ? (
                  <p className="ai-theme-card-section">
                    <span className="ai-theme-card-label">建议</span>
                    <span className="ai-theme-card-section-body">
                      {card.agentAdvice}
                    </span>
                  </p>
                ) : null}
                {card.adoption ? (
                  <p className="ai-theme-card-section">
                    <span className="ai-theme-card-label">结果</span>
                    <span className="ai-theme-card-section-body">
                      {card.adoption}
                    </span>
                  </p>
                ) : null}
                {card.relatedFileLabel ? (
                  <p className="ai-theme-card-section">
                    <span className="ai-theme-card-label">产物</span>
                    <span
                      className="ai-theme-card-section-body"
                      title={
                        card.changeRelation
                          ? `${card.relatedFileLabel} · ${card.changeRelation}`
                          : card.relatedFileLabel
                      }
                    >
                      {shortLabel(card.relatedFileLabel)}
                      {card.changeRelation ? ` · ${card.changeRelation}` : ''}
                    </span>
                  </p>
                ) : null}
              </div>

              {hasDetail ? (
                <>
                  <div className="ai-theme-card-detail">
                    <div className="ai-theme-card-dialogue">
                      <div className="ai-theme-card-dialogue-title">
                        对话 · {index + 1}
                      </div>
                      <ul>
                        {card.dialogues.map((turn) => (
                          <li
                            key={turn.id}
                            className={`ai-theme-turn is-${turn.role}`}
                          >
                            <span>{turn.author}</span>
                            <p>{turn.content}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {!expanded ? (
                    <p className="ai-theme-card-expand-hint">点击查看更多</p>
                  ) : null}
                </>
              ) : null}

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
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  disabled
                  title="修改功能后续阶段开放"
                  onClick={(event) => event.stopPropagation()}
                >
                  <PencilLine size={14} strokeWidth={1.5} />
                  修改
                </button>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
