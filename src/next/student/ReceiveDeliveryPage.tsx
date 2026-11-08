import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
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
import {
  getVersionSnapshot,
  handoffStatusLine,
} from '../../data/deliveryChain';
import { formatAiFailureHint, formatAiSourceLabel } from '../aiMeta';
import { CollabLogBuckets } from '../CollabLogBuckets';
import { evidenceLabel, useEvidenceFocus } from '../EvidenceNav';
import { FindingList, type FindingItem } from '../FindingList';
import { VerdictBanner } from '../VerdictBanner';
import { parseHash } from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import { StudentTrail } from './StudentTrail';
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

function receiveVerdict(
  canAct: boolean,
  status: string,
  hasFocus: boolean,
): { title: string; detail: string; tone: 'warn' | 'ok' | 'neutral' } {
  if (status === 'received') {
    return {
      title: '已确认接收',
      detail: '可继续联调或查看历史版本。',
      tone: 'ok',
    };
  }
  if (canAct) {
    return {
      title: '待你确认',
      detail: hasFocus
        ? '先扫关键发现，再确认接收或提出修改。'
        : '核对这版材料后确认接收，或提出修改。',
      tone: 'neutral',
    };
  }
  return {
    title: '仅可查看',
    detail: '当前身份不能确认本版交付。',
    tone: 'neutral',
  };
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
  const [hint, setHint] = useState('');
  const revisionEditorRef = useRef<HTMLDivElement | null>(null);
  const [helpText, setHelpText] = useState('');
  const [clarify, setClarify] = useState<string[]>([]);
  const [adopted, setAdopted] = useState<string[]>([]);
  const [focusError, setFocusError] = useState('');
  const [focusRetryNonce, setFocusRetryNonce] = useState(0);
  const [aiMode, setAiMode] = useState('mock');
  const aiModeRef = useRef(aiMode);
  aiModeRef.current = aiMode;
  const focusRequestGenRef = useRef(0);
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
            '仍可阅读已发布的这版说明，并手工求助或确认接收。',
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
    return '未命名材料';
  };

  const audience =
    actorId === delivery.receiverId ? 'receiver' : 'publisher';
  const statusLine = handoffStatusLine(delivery.status, audience);

  const focusItems = delivery.focusAnnotation?.items;
  const confirmVerdict = receiveVerdict(
    canAct,
    delivery.status,
    Boolean(focusItems?.length),
  );

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

  const readRevisionDraft = () => {
    const root = revisionEditorRef.current;
    if (!root) return { note: '', locator: '' };
    const cites = Array.from(root.querySelectorAll('.rcv-cite'))
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean);
    const note = (root.innerText || '').replace(/\u00a0/g, ' ').trim();
    return {
      note,
      locator: cites.join('；'),
    };
  };

  const clearRevisionEditor = () => {
    const root = revisionEditorRef.current;
    if (root) root.innerHTML = '';
  };

  const sendRevision = () => {
    if (!canAct) return;
    const { note, locator } = readRevisionDraft();
    if (!note) return;
    const result = requestDeliveryRevision(
      actorId,
      note,
      locator || undefined,
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
    clearRevisionEditor();
  };

  const insertCite = (params: {
    evidenceId: string;
    label: string;
  }) => {
    if (!canAct) return;
    const root = revisionEditorRef.current;
    if (!root) return;
    root.focus();
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'rcv-cite';
    chip.dataset.evidenceId = params.evidenceId;
    chip.textContent = params.label;
    chip.addEventListener('click', (event) => {
      event.preventDefault();
      focusEvidence(params.evidenceId);
    });
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount > 0 &&
      root.contains(selection.anchorNode)
    ) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      root.appendChild(document.createTextNode(' '));
      root.appendChild(chip);
      root.appendChild(document.createTextNode(' '));
    }
  };

  const citeFindingToRevision = (params: {
    index: number;
    title: string;
  }) => {
    if (!canAct) return;
    const root = revisionEditorRef.current;
    if (!root) return;
    const label = evidenceLabel(params.index);
    const evidenceId = `evidence-${label}`;
    if (root.childNodes.length > 0) {
      root.appendChild(document.createElement('br'));
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'rcv-cite';
    chip.dataset.evidenceId = evidenceId;
    chip.textContent = `[${label}]`;
    chip.addEventListener('click', (event) => {
      event.preventDefault();
      focusEvidence(evidenceId);
    });
    root.appendChild(chip);
    root.appendChild(document.createTextNode(` ${params.title}`));
    root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    root.focus();
    setHint('已写入修改意见，可继续补充后提交');
  };

  const focusFindings = useMemo<FindingItem[]>(() => {
    const items = focusItems ?? [];
    if (!items.length) return [];
    return items.map((item, index) => {
      const evidenceIndex = Math.min(index + 1, 3);
      const evidenceBits = [
        item.checkAction ? `先查：${item.checkAction}` : '',
        item.impact ? `预期：${item.impact}` : '',
        item.citations?.[0]?.excerpt
          ? `依据：${item.citations[0].excerpt}`
          : item.risk
            ? `依据：${item.risk}`
            : '',
      ].filter(Boolean);
      return {
        id: item.title,
        title: item.title,
        body: evidenceBits.join(' · '),
        refs: [evidenceIndex],
        severity: (item.risk ? 'warn' : 'neutral') as FindingItem['severity'],
        actions: canAct ? (
          <button
            type="button"
            className="rd-finding-cite"
            onClick={() =>
              citeFindingToRevision({
                index: evidenceIndex,
                title: item.title,
              })
            }
          >
            引用
          </button>
        ) : null,
      };
    });
  }, [focusItems, canAct]);

  const onEvidenceContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!canAct) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button, a, textarea, input, summary')) return;
    const block = target.closest<HTMLElement>('.rd-block[id^="evidence-"]');
    if (!block?.id) return;
    event.preventDefault();
    const num = block.querySelector('.rd-num')?.textContent?.trim();
    const title =
      block.querySelector('.rd-block-meta strong')?.textContent?.trim() ||
      '证据';
    const selected = window.getSelection()?.toString().trim();
    const label = selected
      ? `${num ? `[${num}] ` : ''}${selected.slice(0, 28)}${
          selected.length > 28 ? '…' : ''
        }`
      : `${num ? `[${num}] ` : ''}${title}`;
    insertCite({ evidenceId: block.id, label });
    setHint('已引用到修改意见');
  };

  const loadClarify = async () => {
    if (!helpText.trim() || !delivery.currentVersionId) return;
    const sharedLog = toSharedLogPayload(
      log,
      log?.summary || delivery.brief || '',
    );
    const { locator } = readRevisionDraft();
    const selectedEvidence = [
      ...(locator ? [locator] : []),
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
    setHint('已生成可编辑澄清建议，勾选后再发给老师');
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
        <StudentTrail
          segments={[
            { label: HANDOFF_PROJECT_NAME },
            { label: '工作', onClick: () => onNavigate('work') },
            { label: '接收交付' },
          ]}
        />
        <div className="rcv-head">
          <h1 className="rd-page-title">接收交付</h1>
          <span className="rcv-pill">{delivery.version}</span>
        </div>
        <p className="rd-aux" role="status" style={{ marginBottom: 16 }}>
          {statusLine}
        </p>

        <div className="rcv-grid rd-split is-stack-ai-first">
          <article
            className="rd-evidence"
            aria-label="这版材料"
            onContextMenu={onEvidenceContextMenu}
          >
            <h2 className="rd-section-title">这版材料</h2>
            <article
              id={`evidence-${evidenceLabel(1)}`}
              className={`rd-block is-citable${activeId === `evidence-${evidenceLabel(1)}` ? ' is-flash' : ''}`}
            >
              <div className="rd-block-head">
                <span className="rd-num">{evidenceLabel(1)}</span>
                <div className="rd-block-meta">
                  <strong>这版说明</strong>
                </div>
              </div>
              {log ? (
                <CollabLogBuckets value={log} readOnly title="" />
              ) : hasBrief ? (
                <p className="rd-excerpt rd-body">{delivery.brief}</p>
              ) : (
                <p className="rd-missing">发布人尚未确认这版说明。</p>
              )}
              {riskAck ? (
                <p className="rd-aux" style={{ marginTop: 8 }}>
                  已确认风险：{riskNotes || '见分析结论'}
                </p>
              ) : null}
            </article>

            <article
              id={`evidence-${evidenceLabel(2)}`}
              className={`rd-block is-citable${activeId === `evidence-${evidenceLabel(2)}` ? ' is-flash' : ''}`}
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
              className={`rd-block is-citable${activeId === `evidence-${evidenceLabel(3)}` ? ' is-flash' : ''}`}
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
              <details className="rcv-progress-qa">
                <summary>向教师求助</summary>
                <textarea
                  style={{ width: '100%', minHeight: 72 }}
                  value={helpText}
                  placeholder="学生原文：描述联调卡点"
                  onChange={(event) => setHelpText(event.target.value)}
                />
                <div className="rcv-progress-actions">
                  <button
                    type="button"
                    className="rcv-btn"
                    onClick={() => void loadClarify()}
                  >
                    获取 AI 澄清建议
                  </button>
                  <button
                    type="button"
                    className="rcv-btn"
                    onClick={submitHelp}
                  >
                    发给老师
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
              </details>
            )}

            <details className="rcv-progress-qa">
              <summary>进度问答</summary>
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

          <aside className="rd-ai" aria-label="确认这版">
            <div className="rd-ai-stack">
              <div className="rcv-aside-primary">
                <h2 className="rd-section-title">确认这版</h2>
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
                        <Check
                          size={16}
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                        确认接收
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              <VerdictBanner
                title={confirmVerdict.title}
                detail={confirmVerdict.detail}
                tone={confirmVerdict.tone}
              >
                {hint ? <p className="rcv-note">{hint}</p> : null}
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
              </VerdictBanner>

              {focusFindings.length > 0 ? (
                <>
                  <h3 className="rd-section-title">关键发现</h3>
                  <FindingList
                    items={focusFindings}
                    maxVisible={3}
                    onFocusEvidence={focusEvidence}
                  />
                </>
              ) : null}

              {log ? (
                <CollabLogBuckets value={log} readOnly title="协作说明" />
              ) : null}

              {canAct ? (
                <div className="rd-block">
                  <h3 className="rd-section-title">提出修改意见</h3>
                  <div
                    ref={revisionEditorRef}
                    className="rcv-brief is-editor"
                    contentEditable
                    role="textbox"
                    aria-multiline="true"
                    aria-label="修改意见"
                    data-placeholder="说明需要修改的点 · 点「引用」或右键左侧证据插入引用"
                    suppressContentEditableWarning
                    onClick={(event) => {
                      const cite = (event.target as HTMLElement).closest(
                        '.rcv-cite',
                      ) as HTMLElement | null;
                      const evidenceId = cite?.dataset.evidenceId;
                      if (evidenceId) {
                        event.preventDefault();
                        focusEvidence(evidenceId);
                      }
                    }}
                  />
                  <div className="rcv-revision-actions">
                    <button
                      type="button"
                      className="rcv-btn"
                      onClick={sendRevision}
                    >
                      发送修改意见
                    </button>
                  </div>
                </div>
              ) : null}

              {delivery.publishedVersions.length > 1 ? (
                <div className="rd-block">
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

              <details className="ctn-tech-details">
                <summary>技术详情</summary>
                <p className="rd-aux">
                  发布者 {publisher?.name ?? delivery.publisherId} · 接收者{' '}
                  {receiver?.name ?? delivery.receiverId}
                </p>
                {delivery.currentVersionId ? (
                  <p className="rd-aux">版本 ID：{delivery.currentVersionId}</p>
                ) : null}
                <p className="rd-aux">联调目标：{HANDOFF_INTEGRATION_GOAL}</p>
                {analysis ? (
                  <p className="rd-aux">
                    分析判定：{verdictLabel(analysis.verdict)}
                  </p>
                ) : null}
                {usageSummary?.trim() ? (
                  <p className="rd-aux">使用说明：{usageSummary}</p>
                ) : null}
                {delivery.focusAnnotation ? (
                  <p className="rd-aux">
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
              </details>
            </div>
          </aside>
        </div>
      </div>
    </StudentShell>
  );
}
