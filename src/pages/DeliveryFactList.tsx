import type { Delivery } from '../types/handoff';
import { getMemberById } from '../data/members';

type DeliveryFactListProps = {
  delivery: Delivery;
  summary: string;
  summaryEditable: boolean;
  /** publish：编辑摘要；receive：首屏三问 */
  surface?: 'publish' | 'receive';
  onSummaryChange?: (summary: string) => void;
  onSummaryBlur?: (summary: string) => void;
};

export function DeliveryFactList({
  delivery,
  summary,
  summaryEditable,
  surface = 'publish',
  onSummaryChange,
  onSummaryBlur,
}: DeliveryFactListProps) {
  const receiver = getMemberById(delivery.receiverId);
  const publisher = getMemberById(delivery.publisherId);

  if (surface === 'receive') {
    return (
      <section className="handoff-briefing" aria-label="接收说明">
        <article className="handoff-brief-card">
          <h3>收到什么</h3>
          <p className="handoff-brief-title">
            {delivery.title} {delivery.version}
          </p>
          <p className="handoff-brief-body">{summary}</p>
          <ul className="handoff-brief-files">
            {delivery.files.map((file) => (
              <li key={file.id}>{file.name}</li>
            ))}
          </ul>
        </article>

        <article className="handoff-brief-card">
          <h3>下一步做什么</h3>
          <p className="handoff-brief-body">{delivery.nextStep}</p>
          <p className="handoff-brief-note">{delivery.usageNote}</p>
        </article>

        <article className="handoff-brief-card is-pending">
          <h3>还需验证什么</h3>
          <p className="handoff-brief-tag">{delivery.pendingHighlight}</p>
          <ul>
            {delivery.pendingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {delivery.verifiedItems.length > 0 ? (
            <div className="handoff-brief-verified">
              <h4>已验证</h4>
              <ul>
                {delivery.verifiedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  return (
    <section className="handoff-facts" aria-label="交付字段">
      <h3>交付字段</h3>
      <dl>
        <dt>版本</dt>
        <dd>{delivery.version}</dd>
        <dt>发布人</dt>
        <dd>{publisher?.name ?? delivery.publisherId}</dd>
        <dt>接收人</dt>
        <dd>{receiver?.name ?? delivery.receiverId}</dd>
        <dt>成果摘要</dt>
        <dd>
          {summaryEditable ? (
            <textarea
              aria-label="成果摘要"
              value={summary}
              onChange={(event) => onSummaryChange?.(event.target.value)}
              onBlur={(event) => onSummaryBlur?.(event.target.value)}
            />
          ) : (
            summary
          )}
        </dd>
        <dt>关联材料</dt>
        <dd>{delivery.files.map((file) => file.name).join('、')}</dd>
        <dt>使用说明</dt>
        <dd>{delivery.usageNote}</dd>
        <dt>已验证</dt>
        <dd>
          <ul>
            {delivery.verifiedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </dd>
        <dt>待验证</dt>
        <dd>
          <ul>
            {delivery.pendingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </dd>
      </dl>
    </section>
  );
}
