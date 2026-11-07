import { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  FileCode2,
  FileText,
  Folder,
  Home,
  TriangleAlert,
} from 'lucide-react';
import {
  publishDelivery,
  updateDeliverySummary,
  useDelivery,
} from '../data/deliveryStore';
import { getCurrentMember, getMemberById } from '../data/members';
import { useActiveMemberId } from '../data/demoRoleStore';
import { HANDOFF_PROJECT_NAME } from '../data/handoffDemoSeed';
import './deliveryHandoff.css';

type DeliveryPublishPageProps = {
  onBack: () => void;
  /** 切到接收人视角并打开接收页。不会确认接收。 */
  onGoReceiveHint: () => void;
};

export function DeliveryPublishPage({
  onBack,
  onGoReceiveHint,
}: DeliveryPublishPageProps) {
  const delivery = useDelivery();
  const actorId = useActiveMemberId();
  const me = getCurrentMember();
  const receiver = getMemberById(delivery.receiverId);
  const publisher = getMemberById(delivery.publisherId);
  const [summary, setSummary] = useState(delivery.summary);
  const [processOpen, setProcessOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    setSummary(delivery.summary);
  }, [delivery.summary]);

  const receiverName = receiver?.name ?? delivery.receiverId;
  const publisherName = publisher?.name ?? delivery.publisherId;
  const isPublisher = actorId === delivery.publisherId;
  const isDraft = delivery.status === 'draft';
  const canPublish = isPublisher && isDraft;
  const docName =
    delivery.files.find((file) => file.kind === 'doc')?.name ?? '接口说明';
  const highlightedDiff = delivery.versionDiffs.find((line) => line.highlight);

  const saveDraft = () => {
    if (!isPublisher || !isDraft) return;
    updateDeliverySummary(summary, actorId);
  };

  const handlePublish = () => {
    if (!canPublish) return;
    publishDelivery(actorId, summary);
  };

  return (
    <div className="publish-frame">
      <header className="publish-topbar">
        <div className="publish-brand">
          <span className="publish-brand-mark">CT</span>
          <span>CoTrace 共迹</span>
        </div>
        <div className="publish-topbar-tools">
          <span className="publish-icon-btn" aria-hidden="true">
            <Bell size={22} strokeWidth={1.7} />
          </span>
          <span className="publish-avatar" title={me.name}>
            {me.initials}
          </span>
        </div>
      </header>

      <div className="publish-body">
        <nav className="publish-nav" aria-label="工作区">
          <button type="button" onClick={onBack}>
            <Home size={22} strokeWidth={1.7} aria-hidden="true" />
            项目
          </button>
          <button type="button" className="is-active" aria-current="page">
            <ClipboardCheck size={22} strokeWidth={1.7} aria-hidden="true" />
            工作
          </button>
          <button type="button">
            <Clock3 size={22} strokeWidth={1.7} aria-hidden="true" />
            历史
          </button>
          <button type="button">
            <Folder size={22} strokeWidth={1.7} aria-hidden="true" />
            材料
          </button>
        </nav>

        <main className="publish-main">
          {isDraft ? (
            <div className="publish-form">
              <p className="publish-crumb">
                {HANDOFF_PROJECT_NAME}
                <span> / </span>
                后端接口
                <span> / </span>
                {delivery.title}
              </p>
              <div className="publish-title-row">
                <h1>交付给队友</h1>
                <span className="publish-pill">
                  {delivery.version} 修订版
                </span>
              </div>

              <section className="publish-section">
                <h2>交付文件</h2>
                <div className="publish-file-list">
                  {delivery.files.map((file) => (
                    <div key={file.id} className="publish-file-row">
                      {file.kind === 'code' ? (
                        <FileCode2 size={18} strokeWidth={1.6} aria-hidden="true" />
                      ) : (
                        <FileText size={18} strokeWidth={1.6} aria-hidden="true" />
                      )}
                      <span className="publish-file-name">{file.name}</span>
                      {file.sizeLabel ? (
                        <span className="publish-file-size">{file.sizeLabel}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="publish-section">
                <h2>接收人</h2>
                <div className="publish-select" aria-label="接收人">
                  <span>{receiverName}</span>
                  <ChevronDown size={18} strokeWidth={1.7} aria-hidden="true" />
                </div>
              </section>

              <section className="publish-section">
                <h2>使用说明</h2>
                <textarea
                  className="publish-note"
                  aria-label="使用说明"
                  value={isPublisher ? summary : delivery.usageNote}
                  readOnly={!isPublisher}
                  onChange={(event) => setSummary(event.target.value)}
                  onBlur={() => {
                    if (isPublisher) updateDeliverySummary(summary, actorId);
                  }}
                />
              </section>

              <button
                type="button"
                className="publish-fold"
                aria-expanded={processOpen}
                onClick={() => setProcessOpen((open) => !open)}
              >
                <ChevronDown
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className={processOpen ? 'is-open' : ''}
                />
                整理过程（{delivery.verifiedItems.length + delivery.pendingItems.length}{' '}
                步）
              </button>
              {processOpen ? (
                <p className="publish-fold-body">{summary}</p>
              ) : null}

              <button
                type="button"
                className="publish-fold"
                aria-expanded={evidenceOpen}
                onClick={() => setEvidenceOpen((open) => !open)}
              >
                <ChevronDown
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className={evidenceOpen ? 'is-open' : ''}
                />
                证据（{delivery.verifiedItems.length} 项）
              </button>
              {evidenceOpen ? (
                <ul className="publish-fold-body">
                  {delivery.verifiedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {!isPublisher ? (
                <p className="publish-lock-note">
                  发布由 {publisherName} 完成。
                </p>
              ) : null}

              <div className="publish-actions">
                <button
                  type="button"
                  className="publish-btn is-secondary"
                  disabled={!isPublisher}
                  onClick={saveDraft}
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  className="publish-btn is-primary"
                  disabled={!canPublish}
                  onClick={handlePublish}
                >
                  发布交付
                </button>
              </div>
            </div>
          ) : (
            <div className="publish-receipt">
              <p className="publish-crumb">{HANDOFF_PROJECT_NAME}</p>
              <div className="publish-title-row">
                <h1>{delivery.title}</h1>
                <span className="publish-pill is-version">{delivery.version}</span>
                <span className="publish-title-split" aria-hidden="true" />
                <span className="publish-people">
                  {publisherName}
                  <span aria-hidden="true"> → </span>
                  {receiverName}
                </span>
              </div>

              <div className="publish-receipt-grid">
                <article className="publish-doc">
                  <div className="publish-doc-head">
                    <h2>供前端联调</h2>
                    <span className="publish-warn">
                      <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
                      {delivery.pendingHighlight}
                    </span>
                  </div>
                  <p className="publish-doc-lead">{delivery.summary}</p>

                  <h3>交付文件</h3>
                  <div className="publish-file-list">
                    {delivery.files.map((file) => (
                      <div key={file.id} className="publish-file-row">
                        {file.kind === 'code' ? (
                          <FileCode2 size={18} strokeWidth={1.6} aria-hidden="true" />
                        ) : (
                          <FileText size={18} strokeWidth={1.6} aria-hidden="true" />
                        )}
                        <span className="publish-file-name">{file.name}</span>
                        {file.sizeLabel ? (
                          <span className="publish-file-size">{file.sizeLabel}</span>
                        ) : null}
                        <Download size={16} strokeWidth={1.7} aria-hidden="true" />
                      </div>
                    ))}
                  </div>

                  <h3>版本差异</h3>
                  <div className="publish-diffs">
                    {delivery.versionDiffs.map((line) => (
                      <div
                        key={line.version}
                        className={
                          line.highlight ? 'publish-diff is-new' : 'publish-diff'
                        }
                      >
                        <span className="publish-pill">{line.version}</span>
                        <span>{line.text}</span>
                      </div>
                    ))}
                  </div>

                  {delivery.errorCode ? (
                    <>
                      <h3>错误码</h3>
                      <div className="publish-error">
                        <span className="publish-pill">{delivery.errorCode.code}</span>
                        <span>{delivery.errorCode.meaning}</span>
                      </div>
                    </>
                  ) : null}
                </article>

                <aside className="publish-talk">
                  <article className="publish-talk-card">
                    <h2>关联讨论</h2>
                    <div className="publish-msg">
                      <span className="publish-avatar is-sm">
                        {receiver?.initials ?? '收'}
                      </span>
                      <div>
                        <p className="publish-msg-meta">
                          <strong>{receiverName}</strong>
                          <span>今天 10:12</span>
                        </p>
                        <p className="publish-msg-body">
                          库存不足时的提示语最终是用「
                          {highlightedDiff?.text.split('：').pop() ?? '暂时无法购买'}
                          」吗？需要我在前端同步更新文案。
                        </p>
                      </div>
                    </div>
                    <div className="publish-msg">
                      <span className="publish-avatar is-sm is-dark">
                        {publisher?.initials ?? '发'}
                      </span>
                      <div>
                        <p className="publish-msg-meta">
                          <strong>{publisherName}</strong>
                          <span>今天 10:26</span>
                        </p>
                        <p className="publish-msg-body">
                          是的。已在 {delivery.version} 中更新，{docName}{' '}
                          也已同步修订。
                        </p>
                      </div>
                    </div>
                  </article>

                  {delivery.status === 'received' ? (
                    <p className="publish-received-state">
                      <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                      已接收 {delivery.version}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="publish-btn is-primary publish-receipt-btn"
                      onClick={onGoReceiveHint}
                    >
                      <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                      接收 {delivery.version}
                    </button>
                  )}
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
