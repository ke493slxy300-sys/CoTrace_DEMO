import { useEffect, useState } from 'react';
import { Check, ChevronDown, FileCode2, FileText, Sparkles } from 'lucide-react';
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
import type { CollaborationLog, MatchVerdict } from '../../types/handoff';
import { formatAiSourceLabel } from '../aiMeta';
import { StudentShell, type StudentPlace } from './StudentShell';
import './publish.css';

type PublishDeliveryPageProps = {
  onNavigate: (place: StudentPlace) => void;
  onPublished?: () => void;
};

function verdictLabel(verdict: MatchVerdict | undefined): string {
  if (verdict === 'match') return '相符';
  if (verdict === 'suspect-wrong-version') return '疑似错版';
  if (verdict === 'irrelevant') return '无关';
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
  onClose,
  onConfirm,
}: {
  open: boolean;
  codeItems: DemoMaterialCatalogItem[];
  chatItems: DemoMaterialCatalogItem[];
  codeId: string | null;
  chatId: string | null;
  onClose: () => void;
  onConfirm: (code: string, chat: string) => void;
}) {
  const [draftCode, setDraftCode] = useState(codeId);
  const [draftChat, setDraftChat] = useState(chatId);
  const [group, setGroup] = useState<'code' | 'doc' | 'ai-chat'>('code');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MaterialPreview | null>(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftCode(codeId);
    setDraftChat(chatId);
  }, [open, codeId, chatId]);

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

  const needsRisk =
    delivery.analysis?.verdict === 'suspect-wrong-version' ||
    delivery.analysis?.verdict === 'insufficient-evidence' ||
    (delivery.analysis?.risks.length ?? 0) > 0;
  const irrelevant = delivery.analysis?.verdict === 'irrelevant';

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
                <h1>交付给队友</h1>
                <span className="ctn-pill">
                  {delivery.status === 'needs-revision'
                    ? '待修改重发'
                    : `${delivery.version} 上传`}
                </span>
              </div>

              <div className="ctn-scroll">
                {delivery.status === 'needs-revision' && delivery.revisionRequest ? (
                  <div className="ctn-field">
                    <h2 className="ctn-block-title">Priya 修改意见</h2>
                    <p className="ctn-brief-error" role="status">
                      {delivery.revisionRequest.note}
                      {delivery.revisionRequest.evidenceLocator
                        ? `（定位：${delivery.revisionRequest.evidenceLocator}）`
                        : ''}
                    </p>
                  </div>
                ) : null}

                <div className="ctn-field">
                  <div className="ctn-brief-head">
                    <h2 className="ctn-block-title">交付清单</h2>
                    <button
                      type="button"
                      className="ctn-btn ctn-btn-ghost"
                      disabled={!canEdit}
                      onClick={() => setPickerOpen(true)}
                    >
                      添加材料
                    </button>
                  </div>
                  <div className="ctn-files">
                    {delivery.selectedCodeMaterialId ? (
                      <div className="ctn-file">
                        <FileCode2 size={18} strokeWidth={1.75} aria-hidden="true" />
                        <span>
                          {materialLabel(
                            codeMaterials,
                            delivery.selectedCodeMaterialId,
                          )}
                        </span>
                        {canEdit ? (
                          <button
                            type="button"
                            className="ctn-file-remove"
                            onClick={() =>
                              setDeliveryMaterials(
                                actorId,
                                null,
                                delivery.selectedChatMaterialId,
                              )
                            }
                          >
                            移除
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {delivery.selectedChatMaterialId ? (
                      <div className="ctn-file">
                        <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                        <span>
                          {materialLabel(
                            chatMaterials,
                            delivery.selectedChatMaterialId,
                          )}
                        </span>
                        {canEdit ? (
                          <button
                            type="button"
                            className="ctn-file-remove"
                            onClick={() =>
                              setDeliveryMaterials(
                                actorId,
                                delivery.selectedCodeMaterialId,
                                null,
                              )
                            }
                          >
                            移除
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {!delivery.selectedCodeMaterialId &&
                    !delivery.selectedChatMaterialId ? (
                      <p className="ctn-brief-empty">
                        点击「添加材料」从预置文件夹选择代码与 AI 对话。
                      </p>
                    ) : null}
                  </div>
                  <details className="ctn-tech-details">
                    <summary>锁定文件与技术 ID</summary>
                    <ul className="ctn-fold-body">
                      {delivery.files.map((file) => (
                        <li key={file.id}>{file.name}</li>
                      ))}
                      <li>代码 ID：{delivery.selectedCodeMaterialId ?? '—'}</li>
                      <li>对话 ID：{delivery.selectedChatMaterialId ?? '—'}</li>
                    </ul>
                  </details>
                </div>

                <div className="ctn-field">
                  <h2 className="ctn-block-title">接收人</h2>
                  <div className="ctn-select">
                    <span>{receiverName}</span>
                  </div>
                </div>

                <div className="ctn-field">
                  <h2 className="ctn-block-title">使用说明</h2>
                  <textarea
                    className="ctn-note"
                    aria-label="使用说明"
                    value={summary}
                    disabled={!canEdit}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </div>

                <div className="ctn-field ctn-brief-field">
                  <div className="ctn-brief-head">
                    <h2 className="ctn-block-title">分析结论</h2>
                    <div className="ctn-brief-tools">
                      <button
                        type="button"
                        className={`ctn-btn ctn-btn-ghost${analyzing ? ' is-busy' : ''}`}
                        disabled={!canEdit || analyzing}
                        onClick={() => void handleAnalyze()}
                      >
                        <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
                        {analyzing ? '生成中…' : '生成交付报告'}
                      </button>
                    </div>
                  </div>
                  {analyzeError ? (
                    <p className="ctn-brief-error" role="alert">
                      {analyzeError}
                      {' '}
                      手工路径仍可用：编辑下方日志后直接发布。
                    </p>
                  ) : null}

                  {delivery.analysis ? (
                    <div className="ctn-brief-panel">
                      <p>
                        判定：
                        <strong>{verdictLabel(delivery.analysis.verdict)}</strong>
                        {delivery.analysis.risks.length
                          ? ` · 含 ${delivery.analysis.risks.length} 项风险提示`
                          : ' · 未要求额外风险确认'}
                      </p>
                      <details className="ctn-tech-details">
                        <summary>模型详情</summary>
                        <p className="ctn-brief-lead">
                          {formatAiSourceLabel(
                            delivery.analysis.provider,
                            delivery.analysis.modelLabel,
                          )}
                        </p>
                      </details>

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
                        差异与引用（{delivery.analysis.differences.length}）
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

                      {delivery.analysis.pendingConfirmations.length > 0 ? (
                        <div className="ctn-brief-col" aria-label="待确认项">
                          <h3 className="ctn-brief-col-title">待确认项</h3>
                          <ul className="ctn-fold-body">
                            {delivery.analysis.pendingConfirmations.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {logDraft ? (
                        <div className="ctn-brief-col" aria-label="协作日志草稿">
                          <h3 className="ctn-brief-col-title">
                            可编辑日志草稿
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

                      {(needsRisk || irrelevant) && (
                        <div className="ctn-field">
                          {delivery.analysis.verdict === 'suspect-wrong-version' ? (
                            <p className="ctn-brief-error" role="status">
                              疑似错版：请优先更换材料后复查。
                              <button
                                type="button"
                                className="ctn-btn ctn-btn-primary"
                                style={{ marginLeft: 8 }}
                                disabled={!canEdit}
                                onClick={() => setPickerOpen(true)}
                              >
                                更换材料
                              </button>
                            </p>
                          ) : null}
                          <label className="ctn-brief-label">
                            <input
                              type="checkbox"
                              checked={riskAck}
                              disabled={!canEdit || irrelevant}
                              onChange={(event) => setRiskAck(event.target.checked)}
                            />{' '}
                            {irrelevant
                              ? '无关材料不可带风险发布，请换料'
                              : '确认已知风险并带风险发布（次级）'}
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
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="ctn-actions">
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
                {delivery.analysis?.verdict === 'suspect-wrong-version' ? (
                  <button
                    type="button"
                    className="ctn-btn ctn-btn-ghost"
                    disabled={!canEdit}
                    onClick={() => setPickerOpen(true)}
                  >
                    更换材料
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`ctn-btn${needsRisk ? ' ctn-btn-ghost' : ' ctn-btn-primary'}${publishing ? ' is-busy' : ''}`}
                  disabled={!canEdit || publishing}
                  onClick={handlePublish}
                >
                  {publishing
                    ? '发布中…'
                    : needsRisk
                      ? '确认风险并发布'
                      : delivery.status === 'needs-revision'
                        ? '发布新版本'
                        : '确认并发布'}
                </button>
                {needsRisk && !irrelevant ? (
                  <button
                    type="button"
                    className={`ctn-btn ctn-btn-primary${publishing ? ' is-busy' : ''}`}
                    disabled={!canEdit || publishing || !riskAck}
                    onClick={handlePublish}
                  >
                    带风险发布
                  </button>
                ) : null}
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
        onClose={() => setPickerOpen(false)}
        onConfirm={(code, chat) => {
          if (!canEdit) return;
          setDeliveryMaterials(actorId, code, chat);
          setAnalyzeError('');
          setHint('已更新交付清单，请重新生成交付报告');
          setRiskAck(false);
          setPickerOpen(false);
        }}
      />
    </StudentShell>
  );
}
