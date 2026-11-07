import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, FileCode2, FileText } from 'lucide-react';
import {
  fetchDemoMaterials,
  fetchHealth,
  fetchMaterialPreview,
  requestHandoffFocus,
  requestHelpContext,
  toSharedLogPayload,
  type DemoMaterialCatalogItem,
  type MaterialPreview,
} from '../../api/cotraceApi';
import {
  receiveDelivery,
  requestDeliveryRevision,
  saveFocusAnnotation,
  submitStudentHelp,
  useDelivery,
} from '../../data/deliveryStore';
import { useActiveMemberId } from '../../data/demoRoleStore';
import { getMemberById } from '../../data/members';
import {
  HANDOFF_INTEGRATION_GOAL,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { getVersionSnapshot } from '../../data/deliveryChain';
import type { HandoffBriefBlock } from '../../types/handoff';
import { AiFocusItemList } from '../AiStruct';
import { formatAiFailureHint, formatAiSourceLabel } from '../aiMeta';
import { StudentShell, type StudentPlace } from './StudentShell';
import './receive.css';

type ReceiveDeliveryPageProps = {
  onNavigate: (place: StudentPlace) => void;
  onReceived: (integrationNodeId: string) => void;
};

function kindLabel(kind: HandoffBriefBlock['kind']): string {
  if (kind === 'fact') return '事实';
  if (kind === 'suggestion') return '建议';
  return '未验证';
}

function verdictLabel(verdict: string | undefined): string {
  if (verdict === 'match') return '相符';
  if (verdict === 'suspect-wrong-version') return '疑似错版';
  if (verdict === 'irrelevant') return '无关';
  if (verdict === 'insufficient-evidence') return '证据不足';
  return '未分析';
}

function EvidenceSection({
  title,
  blocks,
}: {
  title: string;
  blocks: HandoffBriefBlock[];
}) {
  if (!blocks.length) return null;
  return (
    <section className="rcv-evidence-section">
      <h3>{title}</h3>
      <ul>
        {blocks.map((block, index) => (
          <li key={`${title}-${index}`}>
            <span className={`rcv-kind is-${block.kind}`}>{kindLabel(block.kind)}</span>
            <p>{block.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReceiveDeliveryPage({
  onNavigate,
  onReceived,
}: ReceiveDeliveryPageProps) {
  const delivery = useDelivery();
  const actorId = useActiveMemberId();
  const receiver = getMemberById(delivery.receiverId);
  const publisher = getMemberById(delivery.publisherId);
  const isReceiver = actorId === delivery.receiverId;
  const isPublisher = actorId === delivery.publisherId;
  const canAct =
    delivery.status === 'published' && isReceiver;
  const [confirming, setConfirming] = useState(false);
  const [showEvidence, setShowEvidence] = useState(true);
  const [revisionNote, setRevisionNote] = useState('');
  const [evidenceLocator, setEvidenceLocator] = useState('');
  const [hint, setHint] = useState('');
  const [helpText, setHelpText] = useState('');
  const [clarify, setClarify] = useState<string[]>([]);
  const [adopted, setAdopted] = useState<string[]>([]);
  const [focusError, setFocusError] = useState('');
  const [focusRetryNonce, setFocusRetryNonce] = useState(0);
  const [aiMode, setAiMode] = useState('mock');
  const [catalog, setCatalog] = useState<DemoMaterialCatalogItem[]>([]);
  const [previews, setPreviews] = useState<Record<string, MaterialPreview>>({});
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);

  const currentSnapshot = useMemo(() => {
    if (!delivery.currentVersionId) return null;
    return getVersionSnapshot(delivery, delivery.currentVersionId);
  }, [delivery]);

  const codeId =
    currentSnapshot?.codeMaterialId ?? delivery.selectedCodeMaterialId;
  const chatId =
    currentSnapshot?.chatMaterialId ?? delivery.selectedChatMaterialId;
  const log =
    currentSnapshot?.collaborationLog ?? delivery.collaborationLog;
  const analysis = currentSnapshot?.analysis ?? delivery.analysis;
  const riskAck =
    currentSnapshot?.riskAcknowledged ?? delivery.riskAcknowledged;
  const riskNotes = currentSnapshot?.riskNotes ?? delivery.riskNotes;
  const usageSummary = currentSnapshot?.summary ?? delivery.summary;

  const hasBrief = Boolean(log?.summary?.trim() || delivery.brief?.trim());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, health] = await Promise.all([
        fetchDemoMaterials(),
        fetchHealth(),
      ]);
      if (cancelled) return;
      if (health.ok) setAiMode(health.data.aiMode);
      if (all.ok) {
        setCatalog(all.data.materials);
        if (!health.ok) setAiMode(all.data.aiMode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = [codeId, chatId].filter(Boolean) as string[];
      const next: Record<string, MaterialPreview> = {};
      for (const id of ids) {
        const result = await fetchMaterialPreview(id);
        if (cancelled) return;
        if (result.ok) next[id] = result.data;
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [codeId, chatId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        delivery.status !== 'published' ||
        !delivery.currentVersionId ||
        !codeId ||
        !chatId
      ) {
        return;
      }
      if (
        focusRetryNonce === 0 &&
        delivery.focusAnnotation &&
        delivery.focusAnnotation.versionId === delivery.currentVersionId &&
        delivery.focusAnnotation.items.length > 0
      ) {
        return;
      }
      const sharedLog = toSharedLogPayload(
        log,
        log?.summary || delivery.brief || '',
      );
      const result = await requestHandoffFocus({
        deliveryId: delivery.id,
        versionId: delivery.currentVersionId,
        projectId: delivery.projectId,
        collaborationSummary: sharedLog.summary,
        risks: analysis?.risks ?? [],
        riskNotes: riskNotes || '',
        riskAcknowledged: Boolean(riskAck),
        sharedLog,
        integrationGoal: HANDOFF_INTEGRATION_GOAL,
        codeMaterialId: codeId,
        chatMaterialId: chatId,
        bypassCache: focusRetryNonce > 0,
      });
      if (cancelled) return;
      if (!result.ok) {
        setFocusError(
          formatAiFailureHint(
            aiMode,
            result.message,
            '仍可阅读已发布协作日志，并手工求助或确认接收。',
          ),
        );
        return;
      }
      saveFocusAnnotation(result.focus);
      setFocusError('');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    delivery.status,
    delivery.currentVersionId,
    codeId,
    chatId,
    delivery.id,
    delivery.projectId,
    log,
    delivery.brief,
    analysis?.risks,
    riskNotes,
    riskAck,
    delivery.focusAnnotation,
    focusRetryNonce,
    aiMode,
  ]);

  const titleOf = (id: string | null) => {
    if (!id) return '未选择';
    const fromCatalog = catalog.find((item) => item.id === id);
    if (fromCatalog) return `${fromCatalog.title}（${fromCatalog.versionLabel}）`;
    const preview = previews[id];
    if (preview) return `${preview.title}（${preview.versionLabel}）`;
    return id;
  };

  const confirm = () => {
    if (!canAct || confirming) return;
    setConfirming(true);
    window.setTimeout(() => {
      const result = receiveDelivery(
        actorId,
        delivery.currentVersionId ?? undefined,
      );
      setConfirming(false);
      if (!result.ok) {
        setHint(
          result.reason === 'stale-version'
            ? '这是旧版本，不能确认成当前接收版本'
            : result.reason === 'already-received'
              ? '该版本已确认接收'
              : '当前无法确认接收',
        );
        return;
      }
      onReceived(result.integrationNodeId);
      setHint(`已确认接收 ${delivery.version}`);
    }, 180);
  };

  const sendRevision = () => {
    if (!canAct) return;
    const result = requestDeliveryRevision(
      actorId,
      revisionNote,
      evidenceLocator || undefined,
      delivery.currentVersionId ?? undefined,
    );
    if (!result.ok) {
      setHint(
        result.reason === 'empty-note'
          ? '请填写修改意见'
          : result.reason === 'stale-version'
            ? '意见绑定的是旧版本'
            : '无法提交修改意见',
      );
      return;
    }
    setHint('已提交修改意见，等待 Alex 发布新版本');
    setRevisionNote('');
  };

  const loadClarify = async () => {
    if (!helpText.trim() || !delivery.currentVersionId) return;
    const sharedLog = toSharedLogPayload(
      log,
      log?.summary || delivery.brief || '',
    );
    const selectedEvidence = [
      ...(evidenceLocator.trim() ? [evidenceLocator.trim()] : []),
      ...(log?.openItems.slice(0, 2) ?? []),
      ...(codeId ? [`材料 ${codeId}`] : []),
      ...(chatId ? [`材料 ${chatId}`] : []),
    ];
    const result = await requestHelpContext({
      mode: 'student-clarify',
      projectId: delivery.projectId,
      taskId: delivery.integrationNodeId,
      deliveryVersionId: delivery.currentVersionId,
      studentText: helpText,
      collaborationSummary: sharedLog.summary,
      sharedEvidence: sharedLog.openItems,
      selectedEvidence,
      adoptedSupplements: [],
      sharedLog,
    });
    if (!result.ok || !result.data.help) {
      setHint(result.ok ? '澄清建议失败' : result.message);
      return;
    }
    setClarify(result.data.help.clarifyPrompts ?? []);
    setHint('已生成可编辑澄清建议，勾选后再正式提交');
  };

  const submitHelp = () => {
    if (!helpText.trim() || !delivery.currentVersionId) return;
    if (!isReceiver && !isPublisher) {
      setHint('请切换到项目成员后再提交求助');
      return;
    }
    submitStudentHelp({
      projectId: delivery.projectId,
      taskId: delivery.integrationNodeId,
      deliveryId: delivery.id,
      versionId: delivery.currentVersionId,
      studentText: helpText.trim(),
      adoptedClarify: adopted,
      authorId: actorId,
    });
    setHint('求助已提交，教师待办可从指导台打开');
  };

  return (
    <StudentShell
      place="receive"
      projectName={HANDOFF_PROJECT_NAME}
      onNavigate={onNavigate}
    >
      <div className="rcv">
        <p className="rcv-kicker">
          {HANDOFF_PROJECT_NAME} / 交易流程联调 / {delivery.title}
        </p>
        <div className="rcv-head">
          <h1>接收交付</h1>
          <span className="rcv-pill">{delivery.version}</span>
          <span className="rcv-note">
            {delivery.currentVersionId
              ? `可接收版本 ${delivery.version}（${delivery.currentVersionId}）`
              : '等待发布'}
          </span>
        </div>

        {delivery.status === 'draft' || delivery.status === 'needs-revision' ? (
          <p className="rcv-brief is-empty">
            {delivery.status === 'needs-revision'
              ? '已提出修改意见，等待 Alex 发布新版本。旧版本不可再确认接收。'
              : 'Alex 尚未发布交付。'}
          </p>
        ) : null}

        <div className="rcv-grid">
          <article>
            <h2>交付说明与协作日志</h2>
            {hasBrief ? (
              <p className="rcv-brief">{log?.summary || delivery.brief}</p>
            ) : (
              <p className="rcv-brief is-empty">发布人尚未确认协作日志。</p>
            )}
            {analysis ? (
              <p className="rcv-summary-note">
                材料分析结论：{verdictLabel(analysis.verdict)}
              </p>
            ) : null}
            {riskAck ? (
              <p className="rcv-summary-note">
                发布时已确认风险：{riskNotes || '见分析结论'}
              </p>
            ) : null}
            {usageSummary?.trim() ? (
              <p className="rcv-summary-note">使用说明：{usageSummary}</p>
            ) : null}

            {log ? (
              <section className="rcv-evidence-section" aria-label="已确认协作日志">
                <h3>已确认协作日志</h3>
                <ul className="rcv-log-list">
                  {log.humanActions.map((item) => (
                    <li key={`h-${item}`}>人工：{item}</li>
                  ))}
                  {log.aiActions.map((item) => (
                    <li key={`a-${item}`}>AI：{item}</li>
                  ))}
                  {log.openItems.map((item) => (
                    <li key={`o-${item}`}>待确认：{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rcv-evidence-section" aria-label="接手标注">
              <h3>接手标注（AI）</h3>
              {focusError ? (
                <p className="rcv-note" role="alert">
                  {focusError}{' '}
                  <button
                    type="button"
                    className="rcv-btn"
                    onClick={() => {
                      setFocusError('');
                      setFocusRetryNonce((value) => value + 1);
                    }}
                  >
                    重新生成接手标注
                  </button>
                </p>
              ) : null}
              {delivery.focusAnnotation?.items?.length ? (
                <AiFocusItemList items={delivery.focusAnnotation.items} />
              ) : (
                <p className="rcv-note">
                  打开本页后自动整理关注项；失败时仍可阅读发布原文并手工求助或接收。
                </p>
              )}
              <p className="ai-struct__meta">
                {delivery.focusAnnotation?.items?.length
                  ? `${formatAiSourceLabel(
                      delivery.focusAnnotation.provider,
                      delivery.focusAnnotation.modelLabel,
                    )}${
                      delivery.focusAnnotation.cacheKey.includes(':hit')
                        ? ' · 服务端缓存命中'
                        : ''
                    } · 绑定 ${delivery.focusAnnotation.versionId}`
                  : '尚未生成'}
              </p>
            </section>

            <button
              type="button"
              className="rcv-evidence-toggle"
              aria-expanded={showEvidence}
              onClick={() => setShowEvidence((open) => !open)}
            >
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ transform: showEvidence ? 'none' : 'rotate(-90deg)' }}
              />
              查看依据与分区
            </button>
            {showEvidence ? (
              <div className="rcv-evidence" aria-label="接手依据">
                <EvidenceSection title="人工动作" blocks={delivery.changes ?? []} />
                <EvidenceSection
                  title="AI 动作"
                  blocks={delivery.downstreamImpact ?? []}
                />
                <EvidenceSection
                  title="待确认"
                  blocks={delivery.evidenceAndOpen ?? []}
                />
              </div>
            ) : null}

            {canAct ? (
              <div className="rcv-evidence-section">
                <h3>提出修改意见</h3>
                <textarea
                  className="rcv-brief"
                  style={{ width: '100%', minHeight: 72 }}
                  value={revisionNote}
                  placeholder="说明需要修改的点"
                  onChange={(event) => setRevisionNote(event.target.value)}
                />
                <input
                  style={{ width: '100%', marginTop: 8 }}
                  value={evidenceLocator}
                  placeholder="可选：证据定位（材料/片段）"
                  onChange={(event) => setEvidenceLocator(event.target.value)}
                />
                <button type="button" className="rcv-btn" onClick={sendRevision}>
                  提交修改意见
                </button>
              </div>
            ) : null}

            {(delivery.status === 'published' ||
              delivery.status === 'received') && (
              <div className="rcv-evidence-section">
                <h3>向教师求助</h3>
                <textarea
                  style={{ width: '100%', minHeight: 72 }}
                  value={helpText}
                  placeholder="学生原文：描述联调卡点"
                  onChange={(event) => setHelpText(event.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="rcv-btn" onClick={() => void loadClarify()}>
                    获取 AI 澄清建议
                  </button>
                  <button type="button" className="rcv-btn is-primary" onClick={submitHelp}>
                    正式提交求助
                  </button>
                </div>
                {clarify.length > 0 ? (
                  <ul>
                    {clarify.map((item) => {
                      const checked = adopted.includes(item);
                      return (
                        <li key={item}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAdopted((prev) =>
                                  checked
                                    ? prev.filter((line) => line !== item)
                                    : [...prev, item],
                                )
                              }
                            />{' '}
                            {item}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            )}
          </article>

          <aside>
            <h2>交付材料</h2>
            <div className="rcv-files">
              {[
                { id: codeId, kind: 'code' as const },
                { id: chatId, kind: 'chat' as const },
              ]
                .filter((item) => item.id)
                .map((item) => (
                  <div key={item.id!} className="rcv-file">
                    {item.kind === 'code' ? (
                      <FileCode2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <div>
                      <strong>{titleOf(item.id)}</strong>
                      <button
                        type="button"
                        className="rcv-btn"
                        style={{ marginTop: 6 }}
                        onClick={() =>
                          setOpenPreviewId((prev) =>
                            prev === item.id ? null : item.id,
                          )
                        }
                      >
                        {openPreviewId === item.id ? '收起正文' : '打开该版本文件'}
                      </button>
                      {openPreviewId === item.id && previews[item.id!] ? (
                        <pre className="rcv-preview">
                          {previews[item.id!].preview}
                        </pre>
                      ) : null}
                      <details>
                        <summary>技术 ID</summary>
                        {item.id}
                      </details>
                    </div>
                  </div>
                ))}
              {delivery.files.map((file) => (
                <div key={file.id} className="rcv-file">
                  {file.kind === 'code' ? (
                    <FileCode2 size={18} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>{file.name.split(/[/\\]/).pop()}</span>
                </div>
              ))}
            </div>
            <p className="rcv-next">{delivery.nextStep}</p>
            {hint ? <p className="rcv-note">{hint}</p> : null}

            {isPublisher && delivery.status === 'published' ? (
              <p className="rcv-note" role="status">
                发送方视角：已发布 · 等待确认接收（{receiver?.name ?? 'Priya'}）
              </p>
            ) : null}

            {canAct ? (
              <button
                type="button"
                className="rcv-btn is-primary"
                disabled={confirming}
                onClick={confirm}
              >
                {confirming ? (
                  '确认中…'
                ) : (
                  <>
                    <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                    确认接收
                  </>
                )}
              </button>
            ) : delivery.status === 'received' ? (
              <p className="rcv-note" role="status">
                已确认接收 {delivery.version}
              </p>
            ) : !isReceiver && delivery.status === 'published' ? (
              <p className="rcv-note">仅指定接收人可确认接收。</p>
            ) : null}

            <p className="rcv-note">
              发布者 {publisher?.name ?? delivery.publisherId} · 接收者{' '}
              {receiver?.name ?? delivery.receiverId}
            </p>
            {delivery.publishedVersions.length > 1 ? (
              <div className="rcv-evidence-section">
                <h3>历史版本（不可确认旧版）</h3>
                <ul>
                  {delivery.publishedVersions.map((version) => (
                    <li key={version.versionId}>
                      {version.version}
                      {version.versionId === delivery.currentVersionId
                        ? '（当前）'
                        : '（旧）'}
                      {version.riskAcknowledged ? ' · 已确认风险' : ''}
                      <details>
                        <summary>版本详情</summary>
                        {version.versionId}
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </StudentShell>
  );
}
