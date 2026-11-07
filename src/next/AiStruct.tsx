import type { ReactNode } from 'react';
import type { MaterialCitation } from '../types/handoff';
import './aiStruct.css';

/** 信息等级角色：与 tokens / aiStruct.css 一一对应 */
export type AiStructRole =
  | 'impact'
  | 'check'
  | 'risk'
  | 'note'
  | 'cite';

const ROLE_LABEL: Record<AiStructRole, string> = {
  impact: '影响',
  check: '核对',
  risk: '风险',
  note: '不确定',
  cite: '证据',
};

/** 把错误码、字段名、版本号抬到 mono，不改变语义层级 */
const CODEISH =
  /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|[a-z]+(?:[A-Z][a-zA-Z0-9]*)+\b|v\d+\.\d+\b)/g;

export function enrichAiProse(text: string): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(CODEISH.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(
      <code key={`${match.index}-${match[1]}`} className="ai-struct__code">
        {match[1]}
      </code>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : nodes;
}

export function AiStructField({
  role,
  children,
  label,
}: {
  role: AiStructRole;
  children: ReactNode;
  label?: string;
}) {
  if (children == null || children === '') return null;
  return (
    <div className={`ai-struct__field is-${role}`}>
      <span className="ai-struct__label">{label ?? ROLE_LABEL[role]}</span>
      <div className="ai-struct__body">{children}</div>
    </div>
  );
}

export function AiStructCard({
  claim,
  children,
}: {
  claim: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="ai-struct">
      <h4 className="ai-struct__claim">{claim}</h4>
      {children ? <div className="ai-struct__fields">{children}</div> : null}
    </article>
  );
}

export type AiFocusItemView = {
  title: string;
  impact: string;
  checkAction: string;
  risk?: string;
  uncertainty?: string;
  citations?: MaterialCitation[];
};

export function AiFocusItemCard({ item }: { item: AiFocusItemView }) {
  return (
    <AiStructCard claim={enrichAiProse(item.title)}>
      <AiStructField role="impact">{enrichAiProse(item.impact)}</AiStructField>
      <AiStructField role="check">{enrichAiProse(item.checkAction)}</AiStructField>
      {item.risk ? (
        <AiStructField role="risk">{enrichAiProse(item.risk)}</AiStructField>
      ) : null}
      {item.uncertainty ? (
        <AiStructField role="note">{enrichAiProse(item.uncertainty)}</AiStructField>
      ) : null}
      {item.citations?.map((cite, index) => (
        <AiStructField
          key={`${item.title}-cite-${index}`}
          role="cite"
          label="证据"
        >
          {enrichAiProse(cite.excerpt)}
          {cite.note ? (
            <span className="ai-struct__cite-note">
              {enrichAiProse(cite.note)}
            </span>
          ) : null}
        </AiStructField>
      ))}
    </AiStructCard>
  );
}

export function AiFocusItemList({ items }: { items: AiFocusItemView[] }) {
  if (!items.length) return null;
  return (
    <ul className="ai-struct-list">
      {items.map((item) => (
        <li key={item.title}>
          <AiFocusItemCard item={item} />
        </li>
      ))}
    </ul>
  );
}

/** 教师情境整理等：同一信息等级，字段由调用方组合 */
export function AiStructStack({ children }: { children: ReactNode }) {
  return <div className="ai-struct-stack">{children}</div>;
}
