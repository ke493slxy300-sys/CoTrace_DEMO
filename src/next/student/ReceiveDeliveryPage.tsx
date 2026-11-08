import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  fetchDemoMaterials,
  fetchHealth,
  fetchMaterialPreview,
  requestHandoffFocus,
  requestHelpContext,
  requestProgressQa,
  requestProgressQaStream,
  toSharedLogPayload,
  type DemoMaterialCatalogItem,
  type MaterialPreview,
  type ProgressQaPayload,
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
import { enrichAiProse } from '../AiStruct';
import { formatAiFailureHint, formatAiSourceLabel } from '../aiMeta';
import { EvidenceChip, evidenceLabel, useEvidenceFocus } from '../EvidenceNav';
import { parseHash } from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import '../readingLayout.css';
import './receive.css';

type ReceiveDeliveryPageProps = {
  onNavigate: (place: StudentPlace) => void;
  onReceived: (integrationNodeId: string) => void;
};

function verdictLabel(verdict: string | undefined): string {
  if (verdict === 'match') return '相符';
  if (verdict === 'suspect-wrong-version') return '疑似错版';
  if (verdict === 'irrelevant') return '所选对话与任务无关';
  if (verdict === 'insufficient-evidence') return '证据不足';
  return '未分析';
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
  const [revisionNote, setRevisionNote] = useState('');
  const [evidenceLocator, setEvidenceLocator] = useState('');
  const [hint, setHint] = useState('');
  const [helpText, setHelpText] = useState('');
  const [clarify, setClarify] = useState<string[]>([]);
  const [adopted, setAdopted] = useState<string[]>([]);
  const [focusError, setFocusError] = useState('');
  const [focusRetryNonce, setFocusRetryNonce] = useState(0);
  const [aiMode, setAiMode] = useState('mock');
  const aiModeRef = useRef(aiMode);
  aiModeRef.current = aiMode;
  const focusRequestGenRef = useRef(0);
  const [hasLiveKey, setHasLiveKey] = useState(true);
  const [catalog, setCatalog] = useState<DemoMaterialCatalogItem[]>([]);
  const [previews, setPreviews] = useState<Record<string, MaterialPreview>>({});
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const { activeId, focusEvidence } = useEvidenceFocus();
  const [progressQuestion, setProgressQuestion] = useState(
    '当前版本还缺什么才能安心联调？',
  );
  const [progressStreaming, setProgressStreaming] = useState(false);
  const [progressAnswer, setProgressAnswer] = useState('');
  const [progressChecks, setProgressChecks] = useState<string[]>([]);
  const [progressMeta, setProgressMeta] = useState<ProgressQaPayload | null>(
    null,
  );
  const [progressNote, setProgressNote] = useState('');
  const progressAbortRef = useRef<AbortController | null>(null);

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
      if (health.ok) {
        setAiMode(health.data.aiMode);
        setHasLiveKey(Boolean(health.data.hasLiveKey));
      }
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

    const gen = ++focusRequestGenRef.current;
    const versionId = delivery.currentVersionId;
    const sharedLog = toSharedLogPayload(
      log,
      log?.summary || delivery.brief || '',
    );
    const payload = {
      deliveryId: delivery.id,
      versionId,
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
    };

    void (async () => {
      const result = await requestHandoffFocus(payload);
      // Ignore superseded requests (StrictMode remount, material/health churn).
      if (gen !== focusRequestGenRef.current) return;
      if (!result.ok) {
        setFocusError(
          formatAiFailureHint(
            aiModeRef.current,
            result.message,
            '仍可阅读已发布协作日志，并手工求助或确认接收。',
          ),
        );
        return;
      }
      saveFocusAnnotation(result.focus);
      setFocusError('');
    })();
  }, [
    delivery.status,
    delivery.currentVersionId,
    codeId,
    chatId,
    delivery.id,
    delivery.projectId,
    // Stabilize on summary text rather than log object identity.
    log?.summary,
    delivery.brief,
    riskNotes,
    riskAck,
    delivery.focusAnnotation?.versionId,
    delivery.focusAnnotation?.items?.length,
    focusRetryNonce,
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

  const stopProgressQa = () => {
    progressAbortRef.current?.abort();
    progressAbortRef.current = null;
    setProgressStreaming(false);
  };

  const runProgressQaAsk = async () => {
    if (progressStreaming) return;
    const question = progressQuestion.trim();
    if (!question) {
      setProgressNote('请先填写问题');
      return;
    }
    const contextSummary = [
      log?.summary || delivery.brief || '',
      ...(log?.openItems ?? []),
      delivery.currentVersionId
        ? `版本 ${delivery.currentVersionId}`
        : '',
    ]
      .filter(Boolean)
      .join('；');

    setProgressStreaming(true);
    setProgressAnswer('');
    setProgressChecks([]);
    setProgressMeta(null);
    setProgressNote('正在流式生成…');
    const controller = new AbortController();
    progressAbortRef.current = controller;

    const streamed = await requestProgressQaStream({
      projectId: delivery.projectId,
      question,
      contextSummary,
      signal: controller.signal,
      onMeta: (meta) => setAiMode(meta.aiMode),
      onToken: (text) => {
        setProgressAnswer((prev) => prev + text);
      },
    });

    if (streamed.ok) {
      setProgressAnswer(streamed.progress.answer);
      setProgressChecks(streamed.progress.nextChecks ?? []);
      setProgressMeta(streamed.progress);
      setProgressNote(
        streamed.tokenCount >= 2
          ? `真流式完成（${streamed.tokenCount} 帧）· ${formatAiSourceLabel(
              streamed.progress.provider,
              streamed.progress.modelLabel,
            )}`
          : `已完成 · ${formatAiSourceLabel(
              streamed.progress.provider,
              streamed.progress.modelLabel,
            )}`,
      );
      setProgressStreaming(false);
      progressAbortRef.current = null;
      return;
    }

    if (streamed.message === 'aborted') {
      setProgressNote('已停止流式生成');
      setProgressStreaming(false);
      progressAbortRef.current = null;
      return;
    }

    setProgressNote(
      `流式失败（${streamed.message}），改用普通请求…`,
    );
    const fallback = await requestProgressQa({
      projectId: delivery.projectId,
      question,
      contextSummary,
    });
    if (fallback.ok) {
      setProgressAnswer(fallback.progress.answer);
      setProgressChecks(fallback.progress.nextChecks ?? []);
      setProgressMeta(fallback.progress);
      setProgressNote(
        `已回退普通请求 · ${formatAiSourceLabel(
          fallback.progress.provider,
          fallback.progress.modelLabel,
        )}`,
      );
    } else {
      setProgressNote(
        formatAiFailureHint(
          aiMode,
          fallback.message,
          '可跳过进度问答，继续接手标注、求助或接收。',
        ),
      );
    }
    setProgressStreaming(false);
    progressAbortRef.current = null;
  };

  const fromPlace = parseHash(window.location.hash).query.get('from');

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
        {fromPlace === 'work' ? (
          <p className="rd-aux" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className="rd-chip"
              onClick={() => onNavigate('work')}
            >
              ← 返回工作
            </button>
          </p>
        ) : null}
        <div className="rcv-head">
          <h1 className="rd-page-title">接收交付</h1>
          <span className="rcv-pill">{delivery.version}</span>
        </div>
        <p className="rd-aux" role="status" style={{ marginBottom: 16 }}>
          {delivery.status === 'published'
            ? '等待确认接收'
            : delivery.status === 'received'
              ? `已确认接收 ${delivery.version}`
              : delivery.status === 'needs-revision'
                ? '已提出修改意见，等待 Alex 发布新版本'
                : '等待发布'}
          {delivery.currentVersionId
            ? ` · ${delivery.currentVersionId}`
            : ''}
          {aiMode === 'live'
            ? ' · 真实模型'
            : hasLiveKey
              ? ' · 模拟结果'
              : ' · 模拟结果 · 未检测到 DEEPSEEK_API_KEY'}
        </p>

        <div className="rcv-grid rd-split is-stack-ai-first">
          <article className="rd-evidence" aria-label="本版交付证据">
            <h2 className="rd-section-title">本版交付证据</h2>
            <article
              id={`evidence-${evidenceLabel(1)}`}
              className={`rd-block${activeId === `evidence-${evidenceLabel(1)}` ? ' is-flash' : ''}`}
            >
              <div className="rd-block-head">
                <span className="rd-num">{evidenceLabel(1)}</span>
                <div className="rd-block-meta">
                  <strong>Alex 最终确认协作日志</strong>
                  <span className="rd-aux">
                    {delivery.currentVersionId ?? '尚无版本'}
                  </span>
                </div>
              </div>
              {hasBrief ? (
                <p className="rd-excerpt rd-body">
                  {log?.summary || delivery.brief}
                </p>
              ) : (
                <p className="rd-missing">发布人尚未确认协作日志。</p>
              )}
              {log ? (
                <ul className="rcv-log-list" style={{ marginTop: 10 }}>
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
              ) : null}
              {riskAck ? (
                <p className="rd-aux" style={{ marginTop: 8 }}>
                  已确认风险：{riskNotes || '见分析结论'}
                </p>
              ) : null}
            </article>

            <article
              id={`evidence-${evidenceLabel(2)}`}
              className={`rd-block${activeId === `evidence-${evidenceLabel(2)}` ? ' is-flash' : ''}`}
            >
              <div className="rd-block-head">
                <span className="rd-num">{evidenceLabel(2)}</span>
                <div className="rd-block-meta">
                  <strong>{titleOf(codeId)}</strong>
                  <span className="rd-aux">代码材料</span>
                </div>
              </div>
              {codeId && previews[codeId] ? (
                <pre className="rd-code">{previews[codeId].preview.slice(0, 1000)}</pre>
              ) : (
                <p className="rd-missing">打开材料预览以查看本版代码摘录</p>
              )}
              {codeId ? (
                <button
                  type="button"
                  className="rcv-btn"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setOpenPreviewId((prev) => (prev === codeId ? null : codeId))
                  }
                >
                  {openPreviewId === codeId ? '收起' : '展开完整预览'}
                </button>
              ) : null}
            </article>

            <article
              id={`evidence-${evidenceLabel(3)}`}
              className={`rd-block${activeId === `evidence-${evidenceLabel(3)}` ? ' is-flash' : ''}`}
            >
              <div className="rd-block-head">
                <span className="rd-num">{evidenceLabel(3)}</span>
                <div className="rd-block-meta">
                  <strong>{titleOf(chatId)}</strong>
                  <span className="rd-aux">对话材料</span>
                </div>
              </div>
              {chatId && previews[chatId] ? (
                <p className="rd-excerpt rd-body">
                  {previews[chatId].preview.slice(0, 900)}
                </p>
              ) : (
                <p className="rd-missing">打开材料预览以查看本版对话摘录</p>
              )}
              {chatId ? (
                <button
                  type="button"
                  className="rcv-btn"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setOpenPreviewId((prev) => (prev === chatId ? null : chatId))
                  }
                >
                  {openPreviewId === chatId ? '收起' : '展开完整预览'}
                </button>
              ) : null}
            </article>

            {(delivery.status === 'published' ||
              delivery.status === 'received') && (
              <div className="rd-block">
                <h3 className="rd-section-title">向教师求助</h3>
                <textarea
                  style={{ width: '100%', minHeight: 72 }}
                  value={helpText}
                  placeholder="学生原文：描述联调卡点"
                  onChange={(event) => setHelpText(event.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="rcv-btn"
                    onClick={() => void loadClarify()}
                  >
                    获取 AI 澄清建议
                  </button>
                  <button
                    type="button"
                    className="rcv-btn is-primary"
                    onClick={submitHelp}
                  >
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

            <details className="rcv-progress-qa">
              <summary>进度问答（可选 · 真流式旁路）</summary>
              <p className="rd-aux">非主路径必经。失败可跳过。</p>
              <textarea
                className="rcv-brief"
                style={{ width: '100%', minHeight: 64 }}
                value={progressQuestion}
                onChange={(event) => setProgressQuestion(event.target.value)}
                disabled={progressStreaming}
              />
              <div className="rcv-progress-actions">
                <button
                  type="button"
                  className="rcv-btn"
                  disabled={progressStreaming || !progressQuestion.trim()}
                  onClick={() => void runProgressQaAsk()}
                >
                  {progressStreaming ? '生成中…' : '开始流式问答'}
                </button>
                <button
                  type="button"
                  className="rcv-btn"
                  disabled={!progressStreaming}
                  onClick={stopProgressQa}
                >
                  停止
                </button>
              </div>
              {progressNote ? <p className="rd-aux">{progressNote}</p> : null}
              {progressAnswer ? (
                <p className="rd-excerpt">{progressAnswer}</p>
              ) : null}
              {progressChecks.length > 0 ? (
                <ul className="rd-findings">
                  {progressChecks.map((item) => (
                    <li key={item}>
                      <p>{item}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {progressMeta ? (
                <details className="rd-aux">
                  <summary>技术来源</summary>
                  <p>
                    {formatAiSourceLabel(
                      progressMeta.provider,
                      progressMeta.modelLabel,
                    )}
                  </p>
                </details>
              ) : null}
            </details>
          </article>

          <aside className="rd-ai" aria-label="联调关注与操作">
            <h2 className="rd-section-title">联调关注点</h2>
            <div className="rd-status">
              <h3>
                {delivery.status === 'published'
                  ? '等待确认接收'
                  : delivery.status === 'received'
                    ? '已确认接收'
                    : delivery.status === 'needs-revision'
                      ? '等待新版本'
                      : '等待发布'}
              </h3>
              <p>
                仅「确认接收」当前有效版本会推进联调。打开本页或生成 AI
                提示不会改变联调状态。
              </p>
              {focusError ? (
                <p className="ctn-brief-error" role="alert">
                  {focusError}{' '}
                  <button
                    type="button"
                    className="rcv-btn"
                    onClick={() => {
                      setFocusError('');
                      setFocusRetryNonce((value) => value + 1);
                    }}
                  >
                    重试
                  </button>
                </p>
              ) : null}
            </div>

            {delivery.focusAnnotation?.items?.length ? (
              <ul className="rd-findings">
                {delivery.focusAnnotation.items.slice(0, 3).map((item, index) => (
                  <li key={item.title} className="rd-finding">
                    <div className="rd-finding-title">
                      {item.title}
                      <EvidenceChip
                        index={Math.min(index + 1, 3)}
                        onFocus={focusEvidence}
                      />
                    </div>
                    <p className="rd-finding-body">
                      <strong>先查：</strong>
                      {enrichAiProse(item.checkAction)}
                    </p>
                    <p className="rd-finding-body">
                      <strong>预期：</strong>
                      {enrichAiProse(item.impact)}
                    </p>
                    {item.citations?.[0] ? (
                      <p className="rd-finding-body">
                        <strong>依据：</strong>
                        {enrichAiProse(item.citations[0].excerpt)}
                      </p>
                    ) : item.risk ? (
                      <p className="rd-finding-body">
                        <strong>依据：</strong>
                        {enrichAiProse(item.risk)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rd-aux">
                打开本页后自动整理关注项；失败时仍可阅读发布原文并手工求助或接收。
              </p>
            )}
            {delivery.focusAnnotation?.items?.length ? (
              <p className="rd-aux" style={{ marginTop: 12 }}>
                {formatAiSourceLabel(
                  delivery.focusAnnotation.provider,
                  delivery.focusAnnotation.modelLabel,
                )}
                {delivery.focusAnnotation.cacheKey.includes(':hit')
                  ? ' · 缓存命中'
                  : ''}
                · 绑定 {delivery.focusAnnotation.versionId}
              </p>
            ) : null}

            {hint ? <p className="rcv-note">{hint}</p> : null}

            {canAct ? (
              <div className="rd-block" style={{ marginTop: 20 }}>
                <h3 className="rd-section-title">提出修改意见</h3>
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
                  placeholder="可选：证据定位"
                  onChange={(event) => setEvidenceLocator(event.target.value)}
                />
                <button
                  type="button"
                  className="rcv-btn"
                  style={{ marginTop: 8 }}
                  onClick={sendRevision}
                >
                  提交修改意见
                </button>
              </div>
            ) : null}

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              ) : null}
              {isPublisher && delivery.status === 'published' ? (
                <p className="rd-aux">
                  发送方视角：已发布，等待 {receiver?.name ?? 'Priya'} 确认接收
                </p>
              ) : null}
            </div>

            {delivery.publishedVersions.length > 1 ? (
              <div className="rd-block" style={{ marginTop: 20 }}>
                <h3 className="rd-section-title">历史版本</h3>
                <ul className="rd-aux">
                  {delivery.publishedVersions.map((version) => (
                    <li key={version.versionId}>
                      {version.version}
                      {version.versionId === delivery.currentVersionId
                        ? '（当前）'
                        : '（旧，不可确认）'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="ctn-tech-details" style={{ marginTop: 12 }}>
              <summary>技术详情</summary>
              <p className="rd-aux">
                发布者 {publisher?.name ?? delivery.publisherId} · 接收者{' '}
                {receiver?.name ?? delivery.receiverId}
              </p>
              <p className="rd-aux">联调目标：{HANDOFF_INTEGRATION_GOAL}</p>
              {analysis ? (
                <p className="rd-aux">分析判定：{verdictLabel(analysis.verdict)}</p>
              ) : null}
              {usageSummary?.trim() ? (
                <p className="rd-aux">使用说明：{usageSummary}</p>
              ) : null}
            </details>
          </aside>
        </div>
      </div>
    </StudentShell>
  );
}
