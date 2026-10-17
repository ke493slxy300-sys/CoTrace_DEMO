import { useState } from 'react';
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

export function AiTraceThemeCards({
  cards,
  activeCardId,
  onSelectCard,
  onAnnotate,
}: AiTraceThemeCardsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        const expanded = hoveredId === card.id;
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
                <span className="ai-theme-card-index">任务 · {card.theme}</span>
                <span className="ai-theme-card-time">
                  {formatRelativeTime(card.createdAt)} · {card.initiator}
                </span>
              </header>
              <p className="ai-theme-card-stage">{card.stage}</p>
              <p className="ai-theme-card-summary">{card.summary}</p>

              <div className="ai-theme-card-detail">
                {card.problem ? (
                  <p className="ai-theme-card-line">
                    <strong>识别问题：</strong>
                    {card.problem}
                  </p>
                ) : null}
                {card.agentAdvice ? (
                  <p className="ai-theme-card-line">
                    <strong>Agent 建议：</strong>
                    {card.agentAdvice}
                  </p>
                ) : null}
                {card.adoption ? (
                  <p className="ai-theme-card-line">
                    <strong>处理结果：</strong>
                    {card.adoption}
                  </p>
                ) : null}
                {card.relatedFileLabel ? (
                  <p className="ai-theme-card-meta">
                    关联产出：{card.relatedFileLabel}
                    {card.changeRelation ? ` · ${card.changeRelation}` : ''}
                  </p>
                ) : null}

                {card.dialogues.length > 0 ? (
                  <div className="ai-theme-card-dialogue">
                    <div className="ai-theme-card-dialogue-title">
                      多轮对话（模拟） · 第 {index + 1} 张卡片
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
