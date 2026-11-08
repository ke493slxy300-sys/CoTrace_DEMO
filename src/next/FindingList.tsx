import { useState, type CSSProperties, type ReactNode } from 'react';
import { EvidenceChip } from './EvidenceNav';

export type FindingSeverity = 'warn' | 'ok' | 'neutral';

export type FindingItem = {
  id?: string;
  title: string;
  body?: string;
  refs?: number[];
  severity?: FindingSeverity;
  /** 额外操作（如接收页「引用」） */
  actions?: ReactNode;
};

export type FindingListProps = {
  items: FindingItem[];
  /** 侧栏默认最多展示条数 */
  maxVisible?: number;
  onFocusEvidence?: (id: string) => void;
  /** 正文默认截断行数；0 表示不截断 */
  clampLines?: number;
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  warn: '需关注',
  ok: '相符',
  neutral: '提示',
};

function FindingCard({
  item,
  clampLines,
  onFocusEvidence,
}: {
  item: FindingItem;
  clampLines: number;
  onFocusEvidence?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = item.body?.trim() ?? '';
  const canClamp = clampLines > 0 && body.length > 48;
  const clamped = canClamp && !expanded;

  return (
    <li className="rd-finding">
      <div className="rd-finding-title">
        <span className="rd-finding-name">{item.title}</span>
        {item.severity ? (
          <span className={`rd-finding-sev is-${item.severity}`}>
            {SEVERITY_LABEL[item.severity]}
          </span>
        ) : null}
        {item.refs?.map((ref) =>
          onFocusEvidence ? (
            <EvidenceChip
              key={`${item.title}-${ref}`}
              index={ref}
              onFocus={onFocusEvidence}
            />
          ) : (
            <span key={`${item.title}-${ref}`} className="rd-chip is-static">
              [{String(ref).padStart(2, '0')}]
            </span>
          ),
        )}
        {item.actions}
      </div>
      {body ? (
        <>
          <p
            className={`rd-finding-body${clamped ? ' is-clamped' : ''}`}
            style={
              clamped
                ? ({ WebkitLineClamp: clampLines } as CSSProperties)
                : undefined
            }
          >
            {body}
          </p>
          {canClamp ? (
            <button
              type="button"
              className="rd-finding-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? '收起' : '展开'}
            </button>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/** 短标题 + 可选严重度 + 证据 chip；正文默认截断可展开 */
export function FindingList({
  items,
  maxVisible = 3,
  onFocusEvidence,
  clampLines = 2,
}: FindingListProps) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return null;

  const visible = showAll ? items : items.slice(0, maxVisible);
  const hidden = items.length - visible.length;

  return (
    <div className="rd-finding-list">
      <ul className="rd-findings">
        {visible.map((item, index) => (
          <FindingCard
            key={item.id ?? `${item.title}-${index}`}
            item={item}
            clampLines={clampLines}
            onFocusEvidence={onFocusEvidence}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          className="rd-finding-more"
          onClick={() => setShowAll(true)}
        >
          还有 {hidden} 条
        </button>
      ) : null}
      {showAll && items.length > maxVisible ? (
        <button
          type="button"
          className="rd-finding-more"
          onClick={() => setShowAll(false)}
        >
          收起列表
        </button>
      ) : null}
    </div>
  );
}
