import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import {
  fetchDemoMaterials,
  fetchHealth,
  fetchMaterialPreview,
  requestHandoffAnalysis,
  type DemoMaterialCatalogItem,
  type MaterialPreview,
} from '../../api/cotraceApi';
import {
  applyDeliveryAnalysis,
  beginDeliveryAnalysis,
  publishDeliveryWithChain,
  setDeliveryMaterials,
  updateCollaborationLog,
  updateDeliveryDraft,
  useDelivery,
} from '../../data/deliveryStore';
import {
  HANDOFF_PROJECT_NAME,
  HANDOFF_TASK_GOAL,
} from '../../data/handoffDemoSeed';
import { getMemberById } from '../../data/members';
import { useActiveMemberId } from '../../data/demoRoleStore';
import type {
  CollaborationLog,
  DeliveryAnalysis,
  MatchVerdict,
} from '../../types/handoff';
import { formatAiSourceLabel } from '../aiMeta';
import { EvidenceChip, evidenceLabel, useEvidenceFocus } from '../EvidenceNav';
import { parseHash } from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import '../readingLayout.css';
import './publish.css';

type AnalysisFinding = {
  title: string;
  body: string;
  refs: number[];
};

function buildPublishFindings(
  analysis: DeliveryAnalysis | null | undefined,
): AnalysisFinding[] {
  if (!analysis) return [];
  const findings: AnalysisFinding[] = [];
  if (analysis.verdict === 'irrelevant') {
    findings.push({
      title: '对话主题不匹配',
      body: '所选对话与当前交付任务目标不一致，请更换对话记录后再分析。',
      refs: [2],
    });
    findings.push({
      title: '代码材料仍属本任务',
      body: '代码摘录与订单创建相关，但不足以在对话选错时发布。',
      refs: [1],
    });
  }
  if (analysis.verdict === 'insufficient-evidence') {
    findings.push({
      title: '缺少测试运行证据',
      body: '当前材料未见可观察的测试运行结果，联调前需补齐或标明风险。',
      refs: [3],
    });
  }
  if (analysis.verdict === 'suspect-wrong-version') {
    findings.push({
      title: '疑似错版材料',
      body:
        analysis.differences[0] ||
        '代码或对话仍体现旧版语义，与当前任务目标矛盾。',
      refs: [1, 2],
    });
  }
  for (const diff of analysis.differences.slice(
    analysis.verdict === 'suspect-wrong-version' ? 1 : 0,
    4,
  )) {
    const refs: number[] = [];
    const lower = diff.toLowerCase();
    if (lower.includes('对话') || lower.includes('chat')) refs.push(2);
    if (lower.includes('测试') || lower.includes('test')) refs.push(3);
    if (refs.length === 0) refs.push(1);
    findings.push({ title: '材料核对发现', body: diff, refs });
  }
  if (
    analysis.verdict === 'match' &&
    findings.length === 0 &&
    analysis.pendingConfirmations.length === 0
  ) {
    findings.push({
      title: '材料与任务目标相符',
      body: '代码与对话可用于本版交付；发布前请确认协作日志摘要。',
      refs: [1, 2],
    });
  }
  for (const item of analysis.pendingConfirmations.slice(0, 3)) {
    const refs: number[] = item.includes('测试') ? [3] : [1, 2];
    findings.push({ title: '待确认项', body: item, refs });
  }
  return findings.slice(0, 6);
}

function statusHeadline(
  analysis: DeliveryAnalysis | null | undefined,
): { title: string; detail: string; tone: 'warn' | 'ok' | 'neutral' } {
  if (!analysis) {
    return {
      title: '尚未分析材料',
      detail: '请先选择代码与对话材料，再点「分析材料」核对是否可发布。',
      tone: 'neutral',
    };
  }
  if (analysis.verdict === 'irrelevant') {
    return {
      title: '暂不能发布',
      detail: '所选对话与订单创建服务无关。代码属于本任务，但对话主题不匹配。',
      tone: 'warn',
    };
  }
  if (analysis.verdict === 'insufficient-evidence') {
    return {
      title: '证据不足，谨慎发布',
      detail: '缺少可观察的测试运行结果；可补材料后重新分析，或确认风险后带风险发布。',
      tone: 'warn',
    };
  }
  if (analysis.verdict === 'suspect-wrong-version') {
    return {
      title: '疑似错版，建议更换材料',
      detail: '材料仍体现旧版语义，与当前任务目标矛盾。可更换材料或确认风险后发布。',
      tone: 'warn',
    };
  }
  return {
    title: '可以确认并发布',
    detail: '材料与任务目标相符。请核对右侧发现与协作日志后发布。',
    tone: 'ok',
  };
}

function blockPublishReason(
  analysis: DeliveryAnalysis | null | undefined,
): string | null {
  if (!analysis) return '请先分析材料';
  if (analysis.verdict === 'irrelevant') return '发布已拦截：请更换对话记录';
  return null;
}

type PublishDeliveryPageProps = {
  onNavigate: (place: StudentPlace) => void;
  onPublished?: () => void;
};

function verdictLabel(verdict: MatchVerdict | undefined): string {
  if (verdict === 'match') return '相符';
  if (verdict === 'suspect-wrong-version') return '疑似错版';
  if (verdict === 'irrelevant') return '所选对话与任务无关';
  if (verdict === 'insufficient-evidence') return '证据不足';
  return '未分析';
}

function materialLabel(
  items: DemoMaterialCatalogItem[],
  id: string | null,
): string {
  if (!id) return '未选择';
  const hit = items.find((item) => item.id === id);
  return hit ? `${hit.title}（${hit.versionLabel}）` : id;
}

function MaterialFolderPicker({
  open,
  codeItems,
  chatItems,
  codeId,
  chatId,
  initialGroup = 'code',
  onClose,
  onConfirm,
}: {
  open: boolean;
  codeItems: DemoMaterialCatalogItem[];
  chatItems: DemoMaterialCatalogItem[];
  codeId: string | null;
  chatId: string | null;
  initialGroup?: 'code' | 'doc' | 'ai-chat';
  onClose: () => void;
  onConfirm: (code: string, chat: string) => void;
}) {
  const [draftCode, setDraftCode] = useState(codeId);
  const [draftChat, setDraftChat] = useState(chatId);
  const [group, setGroup] = useState<'code' | 'doc' | 'ai-chat'>(initialGroup);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MaterialPreview | null>(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftCode(codeId);
    setDraftChat(chatId);
    setGroup(initialGroup);
  }, [open, codeId, chatId, initialGroup]);

  useEffect(() => {
    if (!open || !previewId || group === 'doc') {
      setPreview(null);
      setPreviewError('');
      return;
    }
    let cancelled = false;
    setPreviewError('');
    void fetchMaterialPreview(previewId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPreview(null);
        setPreviewError(result.message);
        return;
      }
      setPreview(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, previewId, group]);

  if (!open) return null;

  const list = group === 'ai-chat' ? chatItems : codeItems;
  const docNotice =
    group === 'doc'
      ? '本演示交付以代码与 AI 对话为主；文档材料可在交付清单查看锁定文件。'
      : null;

  return (
    <div className="ctn-picker-backdrop" role="dialog" aria-modal="true">
      <div className="ctn-picker">
        <div className="ctn-picker-head">
          <h2>从预置材料夹选择</h2>
          <button type="button" className="ctn-btn ctn-btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="ctn-picker-groups" role="tablist">
          {(
            [
              ['code', '代码'],
              ['doc', '文档'],
              ['ai-chat', 'AI 对话'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={group === id ? 'is-on' : ''}
              aria-selected={group === id}
              onClick={() => setGroup(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {docNotice ? (
          <p className="ctn-brief-lead">{docNotice}</p>
        ) : (
          <div className="ctn-picker-stage">
            <ul className="ctn-picker-list">
              {list.map((item) => {
                const selected =
                  group === 'ai-chat'
                    ? draftChat === item.id
                    : draftCode === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={selected ? 'is-on' : ''}
                      onClick={() => {
                        if (group === 'ai-chat') setDraftChat(item.id);
                        else setDraftCode(item.id);
                        setPreviewId(item.id);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.versionLabel}</span>
                      <small>{item.description}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
            <aside
              key={previewId ?? 'picker-preview-empty'}
              className={`ctn-picker-preview motion-smooth${
                previewId ? '' : ' is-empty'
              }`}
              aria-label="材料预览"
            >
              {previewId ? (
                <>
                  <h3>材料预览（服务端正文）</h3>
                  {previewError ? <p>{previewError}</p> : null}
                  {preview ? (
                    <>
                      <p>
                        <strong>{preview.title}</strong> · {preview.versionLabel}
                      </p>
                      {preview.fragmentLabels.length ? (
                        <p>片段：{preview.fragmentLabels.join(' · ')}</p>
                      ) : null}
                      <pre>{preview.preview}</pre>
                    </>
                  ) : !previewError ? (
                    <p>加载预览…</p>
                  ) : null}
                </>
              ) : (
                <p>选中左侧材料后在此预览</p>
              )}
            </aside>
          </div>
        )}
        <div className="ctn-picker-foot">
          <span>
            已选：{materialLabel(codeItems, draftCode)} ·{' '}
            {materialLabel(chatItems, draftChat)}
          </span>
          <button
            type="button"
            className="ctn-btn ctn-btn-primary"
            disabled={!draftCode || !draftChat}
            onClick={() => {
              if (!draftCode || !draftChat) return;
              onConfirm(draftCode, draftChat);
            }}
          >
            确认加入清单
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublishDeliveryPage({
  onNavigate,
  onPublished,
}: PublishDeliveryPageProps) {
  const delivery = useDelivery();
  const actorId = useActiveMemberId();
  const receiver = getMemberById(delivery.receiverId);
  const publisher = getMemberById(delivery.publisherId);
  const receiverName = receiver?.name ?? delivery.receiverId;
  const publisherName = publisher?.name ?? delivery.publisherId;

  const [summary, setSummary] = useState(delivery.summary);
  const [codeMaterials, setCodeMaterials] = useState<DemoMaterialCatalogItem[]>(
    [],
  );
  const [chatMaterials, setChatMaterials] = useState<DemoMaterialCatalogItem[]>(
    [],
  );
  const [aiMode, setAiMode] = useState('mock');
  const [hasLiveKey, setHasLiveKey] = useState(true);
  const [hint, setHint] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [riskAck, setRiskAck] = useState(false);
  const [riskNotes, setRiskNotes] = useState('');
  const [logDraft, setLogDraft] = useState<CollaborationLog | null>(
    delivery.collaborationLog,
  );
  const [openDiff, setOpenDiff] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFocus, setPickerFocus] = useState<'code' | 'ai-chat'>('code');
  const [codePreview, setCodePreview] = useState<MaterialPreview | null>(null);
  const [chatPreview, setChatPreview] = useState<MaterialPreview | null>(null);
  const { activeId, focusEvidence } = useEvidenceFocus();

  const isPublisher = actorId === delivery.publisherId;
  const canEdit =
    isPublisher &&
    (delivery.status === 'draft' || delivery.status === 'needs-revision');
  const isPublishedView =
    delivery.status === 'published' || delivery.status === 'received';

  useEffect(() => {
    setSummary(delivery.summary);
    setLogDraft(delivery.collaborationLog);
    setRiskAck(delivery.riskAcknowledged);
    setRiskNotes(delivery.riskNotes);
  }, [delivery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [code, chat, health] = await Promise.all([
        fetchDemoMaterials('code'),
        fetchDemoMaterials('ai-chat'),
        fetchHealth(),
      ]);
      if (cancelled) return;
      if (health.ok) {
        setAiMode(health.data.aiMode);
        setHasLiveKey(Boolean(health.data.hasLiveKey));
      }
      if (code.ok) {
        setCodeMaterials(code.data.materials);
        if (!health.ok) setAiMode(code.data.aiMode);
      }
      if (chat.ok) setChatMaterials(chat.data.materials);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const codeId = delivery.selectedCodeMaterialId;
    const chatId = delivery.selectedChatMaterialId;
    if (!codeId) setCodePreview(null);
    if (!chatId) setChatPreview(null);
    void (async () => {
      if (codeId) {
        const result = await fetchMaterialPreview(codeId);
        if (!cancelled && result.ok) setCodePreview(result.data);
      }
      if (chatId) {
        const result = await fetchMaterialPreview(chatId);
        if (!cancelled && result.ok) setChatPreview(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [delivery.selectedCodeMaterialId, delivery.selectedChatMaterialId]);

  const needsRisk =
    delivery.analysis?.verdict === 'suspect-wrong-version' ||
    delivery.analysis?.verdict === 'insufficient-evidence' ||
    (delivery.analysis?.risks.length ?? 0) > 0;
  const irrelevant = delivery.analysis?.verdict === 'irrelevant';
  const findings = useMemo(
    () => buildPublishFindings(delivery.analysis),
    [delivery.analysis],
  );
  const statusCard = useMemo(
    () => statusHeadline(delivery.analysis),
    [delivery.analysis],
  );
  const publishBlockReason = blockPublishReason(delivery.analysis);
  const openChatPicker = () => {
    setPickerFocus('ai-chat');
    setPickerOpen(true);
  };

  const handleAnalyze = async () => {
    if (!canEdit || analyzing) return;
    if (!delivery.selectedCodeMaterialId || !delivery.selectedChatMaterialId) {
      setAnalyzeError('请先从代码池和对话池各选一份材料');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError('');
    setHint('正在读取材料正文并分析…');
    const { requestToken } = beginDeliveryAnalysis(actorId);
    const result = await requestHandoffAnalysis({
      projectId: delivery.projectId,
      taskId: delivery.nodeId,
      codeMaterialId: delivery.selectedCodeMaterialId,
      chatMaterialId: delivery.selectedChatMaterialId,
      requestToken,
      taskGoal: HANDOFF_TASK_GOAL,
    });
    setAnalyzing(false);
    if (!result.ok) {
      const liveFail = aiMode === 'live';
      const timedOut = result.message.toLowerCase().includes('timeout');
      setAnalyzeError(
        liveFail
          ? `真实模型调用失败：${result.message}`
          : `调用失败：${result.message}`,
      );
      setHint(
        liveFail
          ? timedOut
            ? '真实模型超时。可再点「生成交付报告」，或手填协作日志后发布（手工路径仍可用）。'
            : '真实模型未返回可用结果。可再点「生成交付报告」，或手填协作日志后发布。'
          : '分析失败。可再点「生成交付报告」，或手填协作日志后发布。',
      );
      return;
    }
    const saved = applyDeliveryAnalysis(actorId, result.analysis, requestToken);
    if (saved.analysisStale || !saved.analysis) {
      setHint('材料已变更，本次分析结果已丢弃');
      return;
    }
    setLogDraft(saved.collaborationLog);
    setHint(
      `判定：${verdictLabel(saved.analysis.verdict)} · ${formatAiSourceLabel(
        saved.analysis.provider,
        saved.analysis.modelLabel,
      )}`,
    );
  };

  const saveLog = () => {
    if (!canEdit || !logDraft) return;
    updateCollaborationLog(actorId, { ...logDraft, manuallyEdited: true });
    updateDeliveryDraft({ summary }, actorId);
    setHint('已保存人工修订的协作日志');
  };

  const handlePublish = () => {
    if (!canEdit || publishing) return;
    setPublishing(true);
    setHint('正在发布…');
    window.setTimeout(() => {
      if (logDraft) {
        updateCollaborationLog(actorId, logDraft);
      }
      updateDeliveryDraft({ summary }, actorId);
      const result = publishDeliveryWithChain(actorId, {
        // 仅在分析结论含风险时写入确认；match 不得标成「含风险确认」
        riskAcknowledged: needsRisk ? riskAck : false,
        riskNotes: needsRisk ? riskNotes : '',
        patch: { summary },
      });
      setPublishing(false);
      if (!result.ok) {
        const messages: Record<string, string> = {
          'risk-required': '当前判定含风险，请勾选风险确认后再发布',
          'no-materials': '请先选择代码与对话材料',
          'irrelevant-blocked': '无关材料不能直接发布，请换料复查',
          'not-publisher': '只有发布人可以发布',
          'already-received': '当前状态不可发布',
        };
        setHint(messages[result.reason] ?? '发布失败');
        return;
      }
      setHint('');
      onPublished?.();
    }, 180);
  };

  const fromPlace = parseHash(window.location.hash).query.get('from');

  return (
    <StudentShell
      place="publish"
      projectName={HANDOFF_PROJECT_NAME}
      onNavigate={onNavigate}
    >
      <div className="ctn-publish">
        <main className="ctn-main">
          <p className="ctn-crumb">
            {HANDOFF_PROJECT_NAME} / 后端接口 / {delivery.title}
          </p>
          {fromPlace === 'work' ? (
            <p style={{ margin: '0 0 12px' }}>
              <button
                type="button"
                className="rd-chip"
                onClick={() => onNavigate('work')}
              >
                ← 返回工作
              </button>
            </p>
          ) : null}
          <p className="ctn-mode-note" role="status">
            {aiMode === 'live'
              ? 'AI 模式：真实模型 (live)'
              : hasLiveKey
                ? 'AI 模式：模拟结果 (mock)'
                : 'AI 模式：模拟结果 (mock) · 未检测到 DEEPSEEK_API_KEY'}
          </p>
          {isPublishedView ? (
            <>
              <div className="ctn-title-row">
                <h1>{delivery.title}</h1>
                <span className="ctn-pill">{delivery.version}</span>
                <span className="ctn-bar" aria-hidden="true" />
                <span className="ctn-flow">
                  {publisherName}
                  <span aria-hidden="true">→</span>
                  {receiverName}
                </span>
              </div>
              <div className="ctn-receipt is-enter">
                <article className="ctn-doc" aria-label="发布回执">
                  <div className="ctn-kicker-row">
                    <strong>人机协作日志（已确认）</strong>
                    <span className="ctn-badge">
                      {delivery.status === 'received'
                        ? '已接收'
                        : delivery.riskAcknowledged
                          ? '已确认风险'
                          : '已发布'}
                    </span>
                  </div>
                  <p className="ctn-lead">
                    {delivery.collaborationLog?.summary || delivery.brief}
                  </p>
                  {delivery.analysis ? (
                    <p className="ctn-brief-lead">
                      材料分析结论：{verdictLabel(delivery.analysis.verdict)}
                      {delivery.analysis.risks.length
                        ? ` · 风险项 ${delivery.analysis.risks.length}`
                        : ''}
                    </p>
                  ) : null}
                  {delivery.riskAcknowledged ? (
                    <p className="ctn-brief-lead">
                      发布时已确认风险：
                      {delivery.riskNotes || '见分析结论'}
                    </p>
                  ) : null}
                  <h2 className="ctn-subhead">交付材料</h2>
                  <ul className="ctn-fold-body">
                    <li>
                      代码：
                      {codeMaterials.find(
                        (item) => item.id === delivery.selectedCodeMaterialId,
                      )?.title ?? delivery.selectedCodeMaterialId}
                    </li>
                    <li>
                      对话：
                      {chatMaterials.find(
                        (item) => item.id === delivery.selectedChatMaterialId,
                      )?.title ?? delivery.selectedChatMaterialId}
                    </li>
                  </ul>
                  <details className="ctn-tech-details">
                    <summary>技术详情</summary>
                    <ul className="ctn-fold-body">
                      <li>代码 ID：{delivery.selectedCodeMaterialId}</li>
                      <li>对话 ID：{delivery.selectedChatMaterialId}</li>
                      <li>版本 ID：{delivery.currentVersionId}</li>
                      {delivery.analysis ? (
                        <li>
                          模型：{delivery.analysis.provider}/
                          {delivery.analysis.modelLabel}
                        </li>
                      ) : null}
                    </ul>
                  </details>
                  <div className="ctn-receipt-status" role="status">
                    <Check size={18} strokeWidth={2.25} aria-hidden="true" />
                    <span>
                      {delivery.status === 'received'
                        ? `已接收 ${delivery.version}`
                        : isPublisher
                          ? '已发布 · 等待确认接收'
                          : '已发布 · 请到接收页确认'}
                    </span>
                  </div>
                  {!isPublisher &&
                  delivery.status === 'published' &&
                  actorId === delivery.receiverId ? (
                    <button
                      type="button"
                      className="ctn-btn ctn-btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={() => onNavigate('receive')}
                    >
                      打开接收页并确认
                    </button>
                  ) : null}
                </article>
                <aside className="ctn-talk" aria-label="历史版本">
                  <h2>已发布版本</h2>
                  {delivery.publishedVersions.map((version) => (
                    <div key={version.versionId} className="ctn-bubble">
                      <span className="ctn-who">{publisherName.slice(0, 1)}</span>
                      <div>
                        <strong>
                          {version.version} · {version.versionId}
                        </strong>
                        <p>{version.brief || version.summary}</p>
                      </div>
                    </div>
                  ))}
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="ctn-title-row">
                <h1 className="rd-page-title">交付给队友</h1>
                <span className="ctn-pill">
                  {delivery.status === 'needs-revision'
                    ? '待修改重发'
                    : `${delivery.version} 上传`}
                </span>
              </div>
              <p className="ctn-mode-note" role="status">
                接收人 {receiverName}
                {aiMode === 'live'
                  ? ' · AI：真实模型 (live)'
                  : hasLiveKey
                    ? ' · AI：模拟结果 (mock)'
                    : ' · AI：模拟结果 · 未检测到 DEEPSEEK_API_KEY'}
              </p>

              <div className="ctn-scroll rd-scroll">
                {delivery.status === 'needs-revision' &&
                delivery.revisionRequest ? (
                  <div className="ctn-field" style={{ marginBottom: 16 }}>
                    <h2 className="rd-section-title">Priya 修改意见</h2>
                    <p className="ctn-brief-error" role="status">
                      {delivery.revisionRequest.note}
                      {delivery.revisionRequest.evidenceLocator
                        ? `（定位：${delivery.revisionRequest.evidenceLocator}）`
                        : ''}
                    </p>
                  </div>
                ) : null}

                <div className="rd-split is-stack-ai-first">
                  <section className="rd-evidence" aria-label="交付证据">
                    <div className="ctn-brief-head" style={{ marginBottom: 16 }}>
                      <h2 className="rd-section-title" style={{ margin: 0 }}>
                        交付证据
                      </h2>
                      <button
                        type="button"
                        className="ctn-btn ctn-btn-ghost"
                        disabled={!canEdit}
                        onClick={() => {
                          setPickerFocus('code');
                          setPickerOpen(true);
                        }}
                      >
                        添加 / 更换材料
                      </button>
                    </div>

                    <article
                      id={`evidence-${evidenceLabel(1)}`}
                      className={`rd-block${activeId === `evidence-${evidenceLabel(1)}` ? ' is-flash' : ''}`}
                    >
                      <div className="rd-block-head">
                        <span className="rd-num">{evidenceLabel(1)}</span>
                        <div className="rd-block-meta">
                          <strong>
                            {materialLabel(
                              codeMaterials,
                              delivery.selectedCodeMaterialId,
                            )}
                          </strong>
                          <span className="rd-aux">代码摘录</span>
                        </div>
                      </div>
                      {codePreview?.preview ? (
                        <pre className="rd-code">
                          {codePreview.preview.slice(0, 1200)}
                        </pre>
                      ) : (
                        <p className="rd-missing">尚未选择代码材料</p>
                      )}
                    </article>

                    <article
                      id={`evidence-${evidenceLabel(2)}`}
                      className={`rd-block${activeId === `evidence-${evidenceLabel(2)}` ? ' is-flash' : ''}`}
                    >
                      <div className="rd-block-head">
                        <span className="rd-num">{evidenceLabel(2)}</span>
                        <div className="rd-block-meta">
                          <strong>
                            {materialLabel(
                              chatMaterials,
                              delivery.selectedChatMaterialId,
                            )}
                          </strong>
                          <span className="rd-aux">对话摘录</span>
                        </div>
                      </div>
                      {chatPreview?.preview ? (
                        <p className="rd-excerpt rd-body">
                          {chatPreview.preview.slice(0, 900)}
                        </p>
                      ) : (
                        <p className="rd-missing">尚未选择对话材料</p>
                      )}
                    </article>

                    <article
                      id={`evidence-${evidenceLabel(3)}`}
                      className={`rd-block${activeId === `evidence-${evidenceLabel(3)}` ? ' is-flash' : ''}`}
                    >
                      <div className="rd-block-head">
                        <span className="rd-num">{evidenceLabel(3)}</span>
                        <div className="rd-block-meta">
                          <strong>测试记录</strong>
                          <span className="rd-aux">运行结果</span>
                        </div>
                      </div>
                      <p className="rd-missing">未提供测试运行结果</p>
                    </article>

                    <div className="rd-block">
                      <h3 className="rd-section-title">使用说明</h3>
                      <textarea
                        className="ctn-note"
                        aria-label="使用说明"
                        value={summary}
                        disabled={!canEdit}
                        onChange={(event) => setSummary(event.target.value)}
                      />
                      <details className="ctn-tech-details">
                        <summary>锁定文件与技术 ID</summary>
                        <ul className="ctn-fold-body">
                          {delivery.files.map((file) => (
                            <li key={file.id}>{file.name}</li>
                          ))}
                          <li>代码 ID：{delivery.selectedCodeMaterialId ?? '—'}</li>
                          <li>对话 ID：{delivery.selectedChatMaterialId ?? '—'}</li>
                          <li>任务目标：{HANDOFF_TASK_GOAL}</li>
                        </ul>
                      </details>
                    </div>
                  </section>

                  <aside
                    className={`rd-ai${
                      statusCard.tone === 'warn'
                        ? ' is-warn'
                        : statusCard.tone === 'ok'
                          ? ' is-ok'
                          : ''
                    }`}
                    aria-label="AI 分析结论"
                  >
                    <div className="ctn-brief-head" style={{ marginBottom: 12 }}>
                      <h2 className="rd-section-title" style={{ margin: 0 }}>
                        AI 分析结论
                      </h2>
                      <button
                        type="button"
                        className={`ctn-btn ctn-btn-ghost${analyzing ? ' is-busy' : ''}`}
                        disabled={!canEdit || analyzing}
                        onClick={() => void handleAnalyze()}
                      >
                        <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
                        {analyzing
                          ? '分析中…'
                          : delivery.analysis
                            ? '重新分析'
                            : '分析材料'}
                      </button>
                    </div>

                    <div className="rd-status">
                      <h3>{statusCard.title}</h3>
                      <p>{statusCard.detail}</p>
                      {irrelevant ? (
                        <button
                          type="button"
                          className="ctn-btn ctn-btn-primary"
                          disabled={!canEdit}
                          onClick={openChatPicker}
                        >
                          更换对话记录
                        </button>
                      ) : null}
                      {analyzeError ? (
                        <p className="ctn-brief-error" role="alert">
                          {analyzeError} 手工路径仍可用：编辑日志后按规则发布。
                        </p>
                      ) : null}
                    </div>

                    {findings.length > 0 ? (
                      <>
                        <h3 className="rd-section-title">关键发现</h3>
                        <ul className="rd-findings">
                          {findings.map((item) => (
                            <li key={`${item.title}-${item.body}`} className="rd-finding">
                              <div className="rd-finding-title">
                                {item.title}
                                {item.refs.map((ref) => (
                                  <EvidenceChip
                                    key={`${item.title}-${ref}`}
                                    index={ref}
                                    onFocus={focusEvidence}
                                  />
                                ))}
                              </div>
                              <p className="rd-finding-body">{item.body}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {delivery.analysis ? (
                      <details className="ctn-tech-details" style={{ marginTop: 16 }}>
                        <summary>查看模型详情</summary>
                        <p className="rd-aux">
                          判定 {verdictLabel(delivery.analysis.verdict)} ·{' '}
                          {formatAiSourceLabel(
                            delivery.analysis.provider,
                            delivery.analysis.modelLabel,
                          )}
                        </p>
                        <button
                          type="button"
                          className="ctn-fold"
                          aria-expanded={openDiff}
                          onClick={() => setOpenDiff((open) => !open)}
                        >
                          <ChevronDown
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden="true"
                            style={{
                              transform: openDiff ? 'none' : 'rotate(-90deg)',
                            }}
                          />
                          原始差异与引用（{delivery.analysis.differences.length}）
                        </button>
                        {openDiff ? (
                          <ul className="ctn-fold-body">
                            {delivery.analysis.differences.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                            {delivery.analysis.citations.map((item, index) => (
                              <li key={`${item.materialId}-${index}`}>
                                引用 {item.excerpt} — {item.note}
                                <details>
                                  <summary>材料 ID</summary>
                                  {item.materialId}
                                </details>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </details>
                    ) : null}

                    {logDraft ? (
                      <div className="rd-block" style={{ marginTop: 20 }}>
                        <h3 className="rd-section-title">
                          可编辑协作日志
                          {logDraft.manuallyEdited ? '（已人工修订）' : ''}
                        </h3>
                        <label className="ctn-brief-label" htmlFor="ctn-log-summary">
                          摘要
                        </label>
                        <textarea
                          id="ctn-log-summary"
                          className="ctn-note"
                          value={logDraft.summary}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setLogDraft({
                              ...logDraft,
                              summary: event.target.value,
                              manuallyEdited: true,
                            })
                          }
                        />
                        <label className="ctn-brief-label">人工动作（每行一条）</label>
                        <textarea
                          className="ctn-note"
                          value={logDraft.humanActions.join('\n')}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setLogDraft({
                              ...logDraft,
                              humanActions: event.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean),
                              manuallyEdited: true,
                            })
                          }
                        />
                        <label className="ctn-brief-label">AI 动作（每行一条）</label>
                        <textarea
                          className="ctn-note"
                          value={logDraft.aiActions.join('\n')}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setLogDraft({
                              ...logDraft,
                              aiActions: event.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean),
                              manuallyEdited: true,
                            })
                          }
                        />
                        <label className="ctn-brief-label">待确认</label>
                        <textarea
                          className="ctn-note"
                          value={logDraft.openItems.join('\n')}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setLogDraft({
                              ...logDraft,
                              openItems: event.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean),
                              manuallyEdited: true,
                            })
                          }
                        />
                      </div>
                    ) : null}

                    {(needsRisk || irrelevant) && delivery.analysis ? (
                      <div className="rd-block" style={{ marginTop: 12 }}>
                        <label className="ctn-brief-label">
                          <input
                            type="checkbox"
                            checked={riskAck}
                            disabled={!canEdit || irrelevant}
                            onChange={(event) => setRiskAck(event.target.checked)}
                          />{' '}
                          {irrelevant
                            ? '对话选错不可带风险发布，请先更换对话'
                            : '确认已知风险并带风险发布'}
                        </label>
                        {!irrelevant ? (
                          <textarea
                            className="ctn-note"
                            aria-label="风险说明"
                            placeholder="风险说明（随快照保存）"
                            value={riskNotes}
                            disabled={!canEdit}
                            onChange={(event) => setRiskNotes(event.target.value)}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </aside>
                </div>
              </div>

              <div className="ctn-actions">
                {publishBlockReason ? (
                  <span className="ctn-hint" role="status">
                    {publishBlockReason}
                  </span>
                ) : null}
                {hint ? <span className="ctn-hint">{hint}</span> : null}
                {!isPublisher ? (
                  <span className="ctn-hint">请切换到 Alex 后再上传发布</span>
                ) : null}
                <button
                  type="button"
                  className="ctn-btn ctn-btn-ghost"
                  disabled={!canEdit}
                  onClick={saveLog}
                >
                  保存修订
                </button>
                {needsRisk && !irrelevant ? (
                  <button
                    type="button"
                    className={`ctn-btn ctn-btn-primary${publishing ? ' is-busy' : ''}`}
                    disabled={!canEdit || publishing || !riskAck}
                    onClick={handlePublish}
                  >
                    {publishing ? '发布中…' : '带风险发布'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`ctn-btn ctn-btn-primary${publishing ? ' is-busy' : ''}`}
                    disabled={!canEdit || publishing || Boolean(publishBlockReason)}
                    onClick={handlePublish}
                  >
                    {publishing
                      ? '发布中…'
                      : delivery.status === 'needs-revision'
                        ? '发布新版本'
                        : '确认并发布'}
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      <MaterialFolderPicker
        open={pickerOpen}
        codeItems={codeMaterials}
        chatItems={chatMaterials}
        codeId={delivery.selectedCodeMaterialId}
        chatId={delivery.selectedChatMaterialId}
        initialGroup={pickerFocus}
        onClose={() => setPickerOpen(false)}
        onConfirm={(code, chat) => {
          if (!canEdit) return;
          setDeliveryMaterials(actorId, code, chat);
          setAnalyzeError('');
          setHint('已更新材料，旧分析已清除；请重新分析材料');
          setRiskAck(false);
          setPickerOpen(false);
        }}
      />
    </StudentShell>
  );
}
