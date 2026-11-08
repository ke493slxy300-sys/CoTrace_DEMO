import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import {
  fetchHealth,
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
import { TeacherShell, type TeacherPlace } from './TeacherShell';
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
  const actionableEvents = useMemo(
    () =>
      isLiveGroup
        ? events.filter(
            (event) =>
              event.kind === 'stage' ||
              event.kind === 'student-help' ||
              event.kind === 'delivery-published',
          )
        : [],
    [events, isLiveGroup],
  );
  const [selectedId, setSelectedId] = useState(
    () =>
      takeTeacherFocusEvent(HANDOFF_EVENT_EXCEPTION) ??
      actionableEvents.find((event) => event.kind === 'student-help')?.id ??
      HANDOFF_EVENT_EXCEPTION,
  );
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
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
  const [aiMode, setAiMode] = useState('mock');
  const [hasLiveKey, setHasLiveKey] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchHealth().then((health) => {
      if (cancelled || !health.ok) return;
      setAiMode(health.data.aiMode);
      setHasLiveKey(Boolean(health.data.hasLiveKey));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    let cancelled = false;
    (async () => {
      if (!selected || selected.kind !== 'student-help') {
        setAiBrief(null);
        return;
      }
      // 仅使用该版本已确认协作日志，不传未共享草稿
      if (delivery.status === 'draft' || !versionLog) {
        setAiBrief(null);
        setAiError('尚无已确认共享的协作日志，仍可阅读学生原文并手写反馈。');
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
          `AI 情境整理失败（${msg}）。学生原文与共享日志仍可读；可手写正式反馈，不依赖模型。`,
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
      if (!feedback) {
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
      setNotice('请选择学生求助事件后再发送正式反馈');
      return;
    }
    const result = sendTeacherFeedback(selected.id, draft);
    if (result.ok) {
      markDeliveryHelpGuided(selected.id);
      setNotice(
        '正式反馈已写入共享事件。请切换 Alex / Priya，在「项目记录」查看同一原文。',
      );
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
            <p className="cts-quiet" role="status">
              {aiMode === 'live'
                ? 'AI 模式：真实模型 (live)'
                : hasLiveKey
                  ? 'AI 模式：模拟结果 (mock)'
                  : 'AI 模式：模拟结果 (mock) · 未检测到 DEEPSEEK_API_KEY'}
            </p>
          </div>
        </div>

        <div className="cts-tabs" role="tablist" aria-label="小组视图">
          <button type="button" className="is-on" aria-current="page">
            阶段汇报 / 求助
          </button>
          <button type="button" disabled>
            任务蓝图
          </button>
          <button type="button" disabled>
            过程日志
          </button>
        </div>

        <div className="cts-work">
          <section className="cts-time" aria-label="待办与关键变化">
            <h2>待办与关键变化 · {actionableEvents.length} 条</h2>
            {!isLiveGroup ? (
              <p className="cts-quiet" role="status">
                当前打开的是 {group.label}「{group.name}」。该组为示意入口，无联调交付事件；
                返回指导台可再打开第03组查看真实求助与反馈。
              </p>
            ) : null}
            {isLiveGroup ? (
              <details className="cts-quiet" style={{ marginBottom: 10 }}>
                <summary>可选 · AI 阶段汇报整理（非主路径）</summary>
                <p>
                  演示主路径请打开下方求助事件：核对学生原文与共享日志后发送正式反馈。
                </p>
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
                  <p className="ai-struct__meta">
                    {formatAiSourceLabel(stageAi.provider, stageAi.modelLabel)}
                  </p>
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
                            <span className="cts-question">{event.summary}</span>
                            <span className="cts-author">{event.authorLabel}</span>

                            {event.kind === 'delivery-published' ? (
                              <span className="cts-evidence">
                                <span className="cts-ev is-verification">
                                  <span className="cts-ev-top">
                                    <strong>关联交付背景</strong>
                                    <span>Alex 发布记录</span>
                                  </span>
                                  <span className="cts-ev-body">
                                    {event.summary}
                                  </span>
                                  <span className="cts-quiet">
                                    普通发布事件不作为学生原始问题；请从求助待办打开对应求助。
                                  </span>
                                </span>
                              </span>
                            ) : null}

                            {event.kind === 'student-help' ? (
                              <>
                                <span className="cts-evidence">
                                  <span className="cts-ev is-student-edit">
                                    <span className="cts-ev-top">
                                      <strong>学生原始问题</strong>
                                    </span>
                                    <span className="cts-ev-body">
                                      {studentOriginal?.summary || event.summary}
                                    </span>
                                  </span>
                                </span>

                                {aiLoading ? (
                                  <span className="cts-quiet">
                                    AI 正在整理情境…
                                  </span>
                                ) : null}
                                {aiError ? (
                                  <span className="cts-quiet">{aiError}</span>
                                ) : null}
                                {aiBrief ? (
                                  <span className="cts-evidence">
                                    <span className="cts-ev-top">
                                      <strong>AI 补充</strong>
                                      <span>不等于正式反馈</span>
                                    </span>
                                    <AiStructCard
                                      claim={enrichAiProse(
                                        aiBrief.situationSummary,
                                      )}
                                    >
                                      {aiBrief.keyDisagreements.map((item) => (
                                        <AiStructField
                                          key={item}
                                          role="impact"
                                          label="分歧"
                                        >
                                          {enrichAiProse(item)}
                                        </AiStructField>
                                      ))}
                                      {aiBrief.missingInfo.map((item) => (
                                        <AiStructField
                                          key={item}
                                          role="note"
                                          label="缺失"
                                        >
                                          {enrichAiProse(item)}
                                        </AiStructField>
                                      ))}
                                      {aiBrief.guidanceSuggestions.map(
                                        (item) => (
                                          <AiStructField
                                            key={item}
                                            role="check"
                                            label="建议"
                                          >
                                            {enrichAiProse(item)}
                                          </AiStructField>
                                        ),
                                      )}
                                    </AiStructCard>
                                    <p className="ai-struct__meta">
                                      {formatAiSourceLabel(
                                        aiBrief.provider,
                                        aiBrief.modelLabel,
                                      )}
                                      {selected.versionId
                                        ? ` · 版本 ${selected.versionId}`
                                        : ''}
                                    </p>
                                  </span>
                                ) : null}

                                {aiAdopted && aiAdopted.length > 0 ? (
                                  <span className="cts-evidence">
                                    {aiAdopted.map((item) => (
                                      <span
                                        key={item.id}
                                        className="cts-ev is-ai-suggestion"
                                      >
                                        <span className="cts-ev-top">
                                          <strong>学生采纳的 AI 补充</strong>
                                        </span>
                                        <span className="cts-ev-body">
                                          {item.summary}
                                        </span>
                                      </span>
                                    ))}
                                  </span>
                                ) : null}

                                <span className="cts-evidence">
                                  <span className="cts-ev is-verification">
                                    <span className="cts-ev-top">
                                      <strong>
                                        已确认协作日志（本版关联）
                                      </strong>
                                    </span>
                                    <span className="cts-ev-body">
                                      {versionLog?.summary ||
                                        '（无已发布协作日志）'}
                                    </span>
                                    {versionLog?.openItems?.length ? (
                                      <span className="cts-quiet">
                                        待确认：
                                        {versionLog.openItems.join('；')}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </>
                            ) : null}

                            {event.kind === 'stage' ? (
                              <span className="cts-evidence">
                                <span className="cts-ev is-verification">
                                  <span className="cts-ev-top">
                                    <strong>阶段事件</strong>
                                  </span>
                                  <span className="cts-ev-body">
                                    {event.summary}
                                  </span>
                                </span>
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

          <section className="cts-feed" aria-label="反馈意见">
            <div className="cts-feed-top" key={selected?.id ?? 'none'}>
              <p>
                {feedback ? '正在查看' : '正在回应'}：
                {isLiveGroup ? (selected?.title ?? '事件') : `${group.label} ${group.name}`}
              </p>
              <span>历史反馈 {feedbacks.length}</span>
            </div>
            <h2>教师正式反馈</h2>
            <p className="cts-quiet">
              独立署名；发送后学生项目记录回显同一原文与关联任务。
            </p>
            {!isLiveGroup ? (
              <p className="cts-quiet" role="status">
                示意组不写入正式反馈，避免污染第03组共享事件。
              </p>
            ) : feedback ? (
              <div className="cts-sent" data-feedback-event={feedback.eventId}>
                <strong>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  周老师 · 已反馈
                </strong>
                <p>{feedback.content}</p>
              </div>
            ) : selected?.kind === 'delivery-published' ? (
              <p className="cts-quiet" role="status">
                当前为 Alex 发布背景，不在此发送教师反馈。请选中学生求助事件。
              </p>
            ) : (
              <>
                <textarea
                  aria-label="教师反馈意见"
                  value={draft}
                  disabled={!canSendFormalFeedback}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="cts-feed-foot">
                  <span>草稿不会显示为学生可见的教师反馈</span>
                  <button
                    type="button"
                    disabled={!canSendFormalFeedback || !draft.trim()}
                    onClick={send}
                  >
                    发送正式反馈
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
