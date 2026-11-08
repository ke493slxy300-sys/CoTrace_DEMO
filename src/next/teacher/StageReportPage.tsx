import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Check } from 'lucide-react';
import {
  requestHelpContext,
  requestStageBriefAi,
  toSharedLogPayload,
} from '../../api/cotraceApi';
import {
  markDeliveryHelpGuided,
  useDelivery,
} from '../../data/deliveryStore';
import { getVersionSnapshot } from '../../data/deliveryChain';
import {
  getAllFeedbacks,
  sendTeacherFeedback,
  subscribeProcessEvents,
  useFeedbacksForEvent,
  useProcessEvents,
} from '../../data/processEventStore';
import {
  HANDOFF_EVENT_EXCEPTION,
} from '../../data/handoffDemoSeed';
import { useDemoRole } from '../../data/demoRoleStore';
import {
  getTeacherGroup,
  TEACHER_LIVE_GROUP_ID,
} from '../../data/teacherGroups';
import type { ProcessEvent, TeacherFeedback } from '../../types/handoff';
import { takeTeacherFocusEvent } from '../../pages/teacher/teacherFocus';
import {
  AiStructCard,
  AiStructField,
  enrichAiProse,
} from '../AiStruct';
import { formatAiSourceLabel } from '../aiMeta';
import { CollabLogBuckets } from '../CollabLogBuckets';
import { FindingList } from '../FindingList';
import { VerdictBanner } from '../VerdictBanner';
import { TeacherShell, type TeacherPlace } from './TeacherShell';
import '../readingLayout.css';
import './stage.css';

type StageReportPageProps = {
  onNavigate: (place: TeacherPlace) => void;
  focusGroupId?: string | null;
};

const DEFAULT_DRAFT =
  '建议先核对联调使用的接口版本，再补充错误码与页面提示的对照记录。';

function statusFromFeedback(
  event: ProcessEvent,
  feedbacks: readonly TeacherFeedback[],
): { label: string; tone: ProcessEvent['statusTone'] } {
  if (feedbacks.some((item) => item.eventId === event.id)) {
    return { label: '已反馈', tone: 'success' };
  }
  return { label: event.statusLabel, tone: event.statusTone };
}

export function StageReportPage({
  onNavigate,
  focusGroupId = null,
}: StageReportPageProps) {
  const role = useDemoRole();
  const delivery = useDelivery();
  const events = useProcessEvents();
  const group = getTeacherGroup(focusGroupId);
  const isLiveGroup = group.id === TEACHER_LIVE_GROUP_ID;
  const allFeedbacks = useSyncExternalStore(
    subscribeProcessEvents,
    getAllFeedbacks,
    getAllFeedbacks,
  );
  const actionableEvents = useMemo(() => {
    if (!isLiveGroup) return [];
    const filtered = events.filter(
      (event) =>
        event.kind === 'stage' ||
        event.kind === 'student-help' ||
        event.kind === 'delivery-published',
    );
    const seenPublish = new Set<string>();
    return filtered.filter((event) => {
      if (event.kind !== 'delivery-published') return true;
      const key = `${event.title}\n${event.summary}`;
      if (seenPublish.has(key)) return false;
      seenPublish.add(key);
      return true;
    });
  }, [events, isLiveGroup]);
  const [selectedId, setSelectedId] = useState(
    () =>
      takeTeacherFocusEvent(HANDOFF_EVENT_EXCEPTION) ??
      actionableEvents.find((event) => event.kind === 'student-help')?.id ??
      HANDOFF_EVENT_EXCEPTION,
  );
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  /** Once the teacher edits, AI brief must not clobber the formal feedback draft. */
  const draftTouchedRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [aiBrief, setAiBrief] = useState<{
    situationSummary: string;
    keyDisagreements: string[];
    missingInfo: string[];
    guidanceSuggestions: string[];
    provider: string;
    modelLabel: string;
  } | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [stageAi, setStageAi] = useState<{
    stageSummary: string;
    evidenceGaps: string[];
    teachingHints: string[];
    provider: string;
    modelLabel: string;
  } | null>(null);
  const [stageAiError, setStageAiError] = useState('');
  const [stageAiLoading, setStageAiLoading] = useState(false);

  const selected =
    actionableEvents.find((event) => event.id === selectedId) ??
    actionableEvents.find((event) => event.id === HANDOFF_EVENT_EXCEPTION) ??
    actionableEvents[0] ??
    null;
  const feedbacks = useFeedbacksForEvent(selected?.id ?? '');
  const feedback = feedbacks[0] ?? null;

  const versionLog = useMemo(() => {
    const versionId = selected?.versionId || delivery.currentVersionId;
    if (!versionId) return delivery.collaborationLog;
    return (
      getVersionSnapshot(delivery, versionId)?.collaborationLog ??
      delivery.collaborationLog
    );
  }, [selected?.versionId, delivery]);

  useEffect(() => {
    // Switching help events resets draft ownership so a new AI brief may seed once.
    draftTouchedRef.current = false;
    setDraft(DEFAULT_DRAFT);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected || selected.kind !== 'student-help') {
        setAiBrief(null);
        return;
      }
      // 仅使用该版本已确认协作日志，不传未共享草稿
      if (delivery.status === 'draft' || !versionLog) {
        setAiBrief(null);
        setAiError('尚无已确认的这版说明，仍可阅读学生原文并手写回复。');
        return;
      }
      setAiLoading(true);
      setAiError('');
      const sharedLog = toSharedLogPayload(versionLog, versionLog.summary);
      const adoptedSupplements = selected.evidence
        .filter((item) => item.kind === 'ai-suggestion')
        .map((item) => item.summary);
      const selectedEvidence = selected.evidence
        .filter((item) => item.label === '学生原文')
        .map((item) => item.summary);
      const result = await requestHelpContext({
        mode: 'teacher-brief',
        projectId: selected.projectId,
        taskId: delivery.integrationNodeId,
        deliveryVersionId: selected.versionId || delivery.currentVersionId || '',
        studentText: selected.summary,
        collaborationSummary: sharedLog.summary,
        sharedEvidence: [
          ...sharedLog.openItems,
          ...selected.evidence.map((item) => item.summary),
        ],
        selectedEvidence,
        adoptedSupplements,
        sharedLog,
      });
      if (cancelled) return;
      setAiLoading(false);
      if (!result.ok || !result.data.help) {
        const msg = result.ok
          ? '情境整理失败'
          : result.message;
        setAiError(
          `AI 情境整理失败（${msg}）。学生原文与这版说明仍可读；可手写回复，不依赖模型。`,
        );
        setAiBrief(null);
        return;
      }
      setAiBrief({
        situationSummary: result.data.help.situationSummary,
        keyDisagreements: result.data.help.keyDisagreements,
        missingInfo: result.data.help.missingInfo,
        guidanceSuggestions: result.data.help.guidanceSuggestions,
        provider: result.data.help.provider,
        modelLabel: result.data.help.modelLabel,
      });
      // Seed draft only when teacher has not started editing (avoid clobbering manual formal feedback).
      if (!feedback && !draftTouchedRef.current) {
        setDraft(
          result.data.help.guidanceSuggestions[0] || DEFAULT_DRAFT,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, delivery, feedback, versionLog]);

  const send = () => {
    if (!selected || role !== 'teacher' || feedback) return;
    if (selected.kind !== 'student-help') {
      setNotice('请选择学生求助事件后再回复');
      return;
    }
    const result = sendTeacherFeedback(selected.id, draft);
    if (result.ok) {
      markDeliveryHelpGuided(selected.id);
      setNotice('回复已发送，学生可在「记录」中查看。');
    } else {
      setNotice('这条事件已经有反馈');
    }
  };

  const studentOriginal = selected?.evidence.find(
    (item) => item.label === '学生原文',
  );
  const aiAdopted = selected?.evidence.filter(
    (item) => item.kind === 'ai-suggestion',
  );
  const canSendFormalFeedback =
    isLiveGroup &&
    role === 'teacher' &&
    selected?.kind === 'student-help' &&
    !feedback;

  return (
    <TeacherShell place="stage" onNavigate={onNavigate}>
      <div className="cts-page">
        <div className="cts-head">
          <div>
            <p className="cts-kicker">
              <button type="button" onClick={() => onNavigate('guide')}>
                返回指导台
              </button>
              <span>软件工程课程</span>
            </p>
            <div className="cts-title">
              <span className="cts-group">{group.label}</span>
              <h1>{group.name}</h1>
            </div>
          </div>
        </div>

        <div className="cts-tabs" role="tablist" aria-label="小组视图">
          <button type="button" className="is-on" aria-current="page">
            阶段汇报 / 求助
          </button>
        </div>

        <div className="cts-work">
          <section className="cts-time" aria-label="待办与关键变化">
            <h2>待办与关键变化 · {actionableEvents.length} 条</h2>
            {!isLiveGroup ? (
              <p className="cts-quiet" role="status">
                这一组是示例，不能在这里回复。
              </p>
            ) : null}
            {isLiveGroup ? (
              <details className="cts-quiet" style={{ marginBottom: 10 }}>
                <summary>让 AI 先整理这一阶段</summary>
                <button
                  type="button"
                  className="cts-send"
                  disabled={stageAiLoading}
                  onClick={() => {
                    void (async () => {
                      setStageAiLoading(true);
                      setStageAiError('');
                      const summary = actionableEvents
                        .map(
                          (event) =>
                            `${event.kind}: ${event.title} — ${event.summary}`,
                        )
                        .join('\n');
                      const result = await requestStageBriefAi({
                        projectId: delivery.projectId,
                        eventsSummary: summary,
                      });
                      setStageAiLoading(false);
                      if (!result.ok || !result.data.stage) {
                        setStageAiError(
                          result.ok
                            ? '阶段整理失败（可忽略，仍可手工反馈）'
                            : `阶段整理失败：${result.message}（可忽略，仍可手工反馈）`,
                        );
                        return;
                      }
                      const stage = result.data.stage as {
                        stageSummary: string;
                        evidenceGaps: string[];
                        teachingHints: string[];
                        provider: string;
                        modelLabel: string;
                      };
                      setStageAi(stage);
                    })();
                  }}
                >
                  {stageAiLoading ? '整理中…' : '生成阶段整理'}
                </button>
                {stageAiError ? <p role="alert">{stageAiError}</p> : null}
                {stageAi ? (
                  <AiStructCard claim={enrichAiProse(stageAi.stageSummary)}>
                    {stageAi.evidenceGaps.map((item) => (
                      <AiStructField key={item} role="note" label="缺口">
                        {enrichAiProse(item)}
                      </AiStructField>
                    ))}
                    {stageAi.teachingHints.map((item) => (
                      <AiStructField key={item} role="check" label="提示">
                        {enrichAiProse(item)}
                      </AiStructField>
                    ))}
                  </AiStructCard>
                ) : null}
                {stageAi ? (
                  <details className="cts-quiet">
                    <summary>技术来源</summary>
                    <p>
                      {formatAiSourceLabel(stageAi.provider, stageAi.modelLabel)}
                    </p>
                  </details>
                ) : null}
              </details>
            ) : null}
            <ol>
              {actionableEvents.map((event) => {
                const active = selected?.id === event.id;
                const status = statusFromFeedback(event, allFeedbacks);
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={active ? 'is-on' : ''}
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedId(event.id);
                        setNotice('');
                        setAiBrief(null);
                      }}
                    >
                      <span className="cts-date">{event.dateLabel}</span>
                      <span className="cts-body">
                        <span className="cts-line">
                          <em className={status.tone === 'success' ? 'is-ok' : ''}>
                            {status.label}
                          </em>
                          <strong>{event.title}</strong>
                          {active ? null : (
                            <span className="cts-quiet">{event.summary}</span>
                          )}
                        </span>
                        {active ? (
                          <span className="cts-open">
                            {event.kind === 'student-help' ? null : (
                              <span className="cts-question">{event.summary}</span>
                            )}
                            <span className="cts-author">{event.authorLabel}</span>

                            {event.kind === 'delivery-published' ? (
                              <span className="cts-evidence">
                                <VerdictBanner
                                  title="关联交付背景"
                                  detail="普通发布事件不是求助原文；请从求助待办打开对应求助。"
                                  tone="neutral"
                                />
                                <FindingList
                                  items={[
                                    {
                                      id: event.id,
                                      title: 'Alex 发布记录',
                                      body: event.summary,
                                      severity: 'neutral',
                                    },
                                  ]}
                                  maxVisible={1}
                                  clampLines={2}
                                />
                              </span>
                            ) : null}

                            {event.kind === 'student-help' ? (
                              <>
                                <span className="cts-evidence">
                                  <AiStructCard
                                    claim={enrichAiProse(
                                      studentOriginal?.summary || event.summary,
                                    )}
                                  >
                                    <AiStructField role="note" label="原话">
                                      Priya 求助原文
                                    </AiStructField>
                                  </AiStructCard>
                                </span>

                                {versionLog ? (
                                  <span className="cts-evidence">
                                    <CollabLogBuckets
                                      value={versionLog}
                                      readOnly
                                      title="这版说明"
                                    />
                                  </span>
                                ) : (
                                  <span className="cts-quiet">
                                    （尚无这版说明）
                                  </span>
                                )}

                                {aiAdopted && aiAdopted.length > 0 ? (
                                  <span className="cts-evidence">
                                    <FindingList
                                      items={aiAdopted.map((item) => ({
                                        id: item.id,
                                        title: '她采纳的补充',
                                        body: item.summary,
                                        severity: 'ok' as const,
                                      }))}
                                      maxVisible={3}
                                      clampLines={2}
                                    />
                                  </span>
                                ) : null}
                              </>
                            ) : null}

                            {event.kind === 'stage' ? (
                              <span className="cts-evidence">
                                <FindingList
                                  items={[
                                    {
                                      id: event.id,
                                      title: '阶段事件',
                                      body: event.summary,
                                      severity: 'neutral',
                                    },
                                  ]}
                                  maxVisible={1}
                                  clampLines={2}
                                />
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="cts-feed" aria-label="回复">
            <div className="cts-feed-top" key={selected?.id ?? 'none'}>
              <p>
                {feedback ? '正在查看' : '正在回应'}：
                {isLiveGroup ? (selected?.title ?? '事件') : `${group.label} ${group.name}`}
              </p>
              <span>历史反馈 {feedbacks.length}</span>
            </div>

            {selected?.kind === 'student-help' ? (
              <div className="cts-ai-panel">
                <h2 className="rd-section-title">AI 梳理</h2>
                {aiLoading ? (
                  <p className="cts-quiet">AI 正在整理情境…</p>
                ) : null}
                {aiError ? <p className="cts-quiet">{aiError}</p> : null}
                {aiBrief ? (
                  <>
                    <AiStructCard
                      claim={enrichAiProse(aiBrief.situationSummary)}
                    >
                      {aiBrief.keyDisagreements.map((item) => (
                        <AiStructField key={item} role="impact" label="分歧">
                          {enrichAiProse(item)}
                        </AiStructField>
                      ))}
                      {aiBrief.missingInfo.map((item) => (
                        <AiStructField key={item} role="note" label="缺失">
                          {enrichAiProse(item)}
                        </AiStructField>
                      ))}
                      {aiBrief.guidanceSuggestions.map((item) => (
                        <AiStructField key={item} role="check" label="建议">
                          {enrichAiProse(item)}
                        </AiStructField>
                      ))}
                    </AiStructCard>
                    <details className="cts-quiet">
                      <summary>技术来源</summary>
                      <p>
                        {formatAiSourceLabel(
                          aiBrief.provider,
                          aiBrief.modelLabel,
                        )}
                        {selected.versionId
                          ? ` · 版本 ${selected.versionId}`
                          : ''}
                      </p>
                    </details>
                  </>
                ) : !aiLoading ? (
                  <p className="cts-quiet">打开求助后会自动整理情境。</p>
                ) : null}
              </div>
            ) : null}

            <h2 className="rd-section-title">回复</h2>
            {!isLiveGroup ? (
              <p className="cts-quiet" role="status">
                这一组是示例，不能在这里回复。
              </p>
            ) : feedback ? (
              <div className="cts-sent" data-feedback-event={feedback.eventId}>
                <strong>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  周老师 · 已回复
                </strong>
                <p>{feedback.content}</p>
              </div>
            ) : selected?.kind === 'delivery-published' ||
              selected?.kind === 'stage' ? (
              <p className="cts-quiet" role="status">
                当前为发布/阶段背景，不在此回复。请选中学生求助事件。
              </p>
            ) : (
              <>
                <textarea
                  aria-label="回复"
                  value={draft}
                  disabled={!canSendFormalFeedback}
                  onChange={(event) => {
                    draftTouchedRef.current = true;
                    setDraft(event.target.value);
                  }}
                />
                <div className="cts-feed-foot">
                  <span>草稿对学生不可见</span>
                  <button
                    type="button"
                    disabled={!canSendFormalFeedback || !draft.trim()}
                    onClick={send}
                  >
                    回复
                  </button>
                </div>
              </>
            )}
            {notice ? <p className="cts-notice">{notice}</p> : null}
          </section>
        </div>
      </div>
    </TeacherShell>
  );
}
