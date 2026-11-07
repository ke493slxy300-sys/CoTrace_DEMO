import { useState } from "react";
import { Bot, MessageSquarePlus } from "lucide-react";
import type { TeammateTraceCard } from "../../datasets/built-in/campus-marketplace/content/teammateTypes";
import { EmptyState } from "../common/EmptyState";

type MemberSelectedTraceCardsProps = {
  cards: TeammateTraceCard[];
  /** 卡片里「当前队友」替换成节点负责人姓名 */
  memberLabel: string;
  activeCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onOpenArtifact?: (path: string) => void;
  onAnnotate: (cardId: string) => void;
};

export function MemberSelectedTraceCards({
  cards,
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
      <ul className="ai-theme-card-list">
        {cards.map((card) => {
          const expanded = hoveredId === card.id || activeCardId === card.id;
          const hasDetail =
            Boolean(card.selectionNote) ||
            card.fragments.length > 0 ||
            Boolean(card.humanUnderstanding);
          return (
            <li key={card.id}>
              <article
                className={`ai-theme-card${activeCardId === card.id ? " is-active" : ""}${
                  expanded ? " is-expanded" : ""
                }`}
                onMouseEnter={() => setHoveredId(card.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectCard(card.id)}
              >
                <header className="ai-theme-card-head">
                  <span className="ai-theme-card-index">
                    {card.topic} · {card.displayTitle}
                    {card.titleEdited ? "（已改标题）" : ""}
                  </span>
                </header>

                <p className="ai-theme-card-decision">
                  <span className="ai-theme-card-label">决定</span>
                  <span className="ai-theme-card-decision-text">
                    {card.humanDecision}
                  </span>
                </p>

                <div className="ai-theme-card-sections">
                  {card.affectedArtifacts.length > 0 ? (
                    <div className="ai-theme-card-section">
                      <span className="ai-theme-card-label">产物</span>
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
                  {card.unresolved ? (
                    <p className="ai-theme-card-section">
                      <span className="ai-theme-card-label">未决</span>
                      <span>{card.unresolved}</span>
                    </p>
                  ) : null}
                  {card.memoryCandidate ? (
                    <p className="ai-theme-card-section">
                      <span className="ai-theme-card-label">记忆</span>
                      <span>{card.memoryCandidate}</span>
                    </p>
                  ) : null}
                </div>

                {hasDetail ? (
                  <div className="ai-theme-card-detail">
                    {card.selectionNote ? (
                      <p className="ai-theme-card-line">
                        <strong>选取说明</strong>
                        {card.selectionNote}
                      </p>
                    ) : null}
                    {card.fragments.length > 0 ? (
                      <div className="member-trace-fragments">
                        <strong>片段</strong>
                        <ul>
                          {card.fragments.map((frag, index) => (
                            <li key={`${card.id}-f${index}`}>
                              <span>
                                {frag.speaker === "当前队友"
                                  ? memberLabel
                                  : frag.speaker}
                              </span>
                              <p>{frag.text}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {card.humanUnderstanding ? (
                      <p className="ai-theme-card-line">
                        <strong>理解</strong>
                        {card.humanUnderstanding}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!expanded && hasDetail ? (
                  <p className="ai-theme-card-expand-hint">悬停查看片段与说明</p>
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
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
