import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { AppHeader } from '../../components/layout/AppHeader';
import { getCurrentMember } from '../../data/members';
import {
  getAllFeedbacks,
  sendTeacherFeedback,
  useFeedbacksForEvent,
  useProcessEvents,
} from '../../data/processEventStore';
import {
  HANDOFF_EVENT_EXCEPTION,
  HANDOFF_FINAL_SUBMISSION_ID,
  HANDOFF_GROUP_LABEL,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { useDemoRole } from '../../data/demoRoleStore';
import type { ProcessEvent, ProcessEvidence } from '../../types/handoff';
import { stashTeacherFocusSubmission, takeTeacherFocusEvent } from './teacherFocus';
import './teacherPages.css';

type GroupStageReportPageProps = {
  onBack: () => void;
  onOpenAcceptance: (submissionId?: string) => void;
  /** 主窗口可透传；缺省时读取待办桥接 / 默认异常验证事件 */
  focusEventId?: string;
};

const DEFAULT_DRAFT =
  '建议补充库存为0及多人同时购买的测试，并记录预期与实际结果。';

function evidenceChecklist(event: ProcessEvent): {
  done: string[];
  pending: string[];
} {
  if (event.id === HANDOFF_EVENT_EXCEPTION) {
    return {
      done: ['已完成：支付失败回退验证'],
      pending: ['待补充：库存为0与多人同时购买的测试'],
    };
  }

  const done: string[] = [];
  const pending: string[] = [];
  for (const item of event.evidence) {
    if (item.kind === 'verification') {
      done.push(item.summary);
    } else if (item.kind === 'student-edit') {
      done.push(item.summary);
    }
  }
  if (event.statusTone === 'warning') {
    pending.push(event.summary);
  }
  if (done.length === 0) done.push(event.summary);
  return { done, pending };
}

export function GroupStageReportPage({
  onBack,
  onOpenAcceptance,
  focusEventId,
}: GroupStageReportPageProps) {
  const me = getCurrentMember();
  const role = useDemoRole();
  const events = useProcessEvents();

  const [selectedId, setSelectedId] = useState(() => {
    const fromProp = focusEventId?.trim();
    if (fromProp) return fromProp;
    return (
      takeTeacherFocusEvent(HANDOFF_EVENT_EXCEPTION) ?? HANDOFF_EVENT_EXCEPTION
    );
  });
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusEventId) return;
    setSelectedId(focusEventId);
    setDetailKey((key) => key + 1);
  }, [focusEventId]);

  useEffect(() => {
    if (!events.some((event) => event.id === selectedId) && events[0]) {
      setSelectedId(events[0].id);
    }
  }, [events, selectedId]);

  const selected =
    events.find((event) => event.id === selectedId) ?? events[0] ?? null;
  const feedbacks = useFeedbacksForEvent(selected?.id ?? '');
  const existingFeedback = feedbacks[0] ?? null;

  const studentVisibleCount = useMemo(
    () => getAllFeedbacks().length,
    [feedbacks, justSent, events],
  );

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setAnimatingId(selectedId);
    setSelectedId(id);
    setJustSent(false);
    setOpenEvidenceId(null);
    setDetailKey((key) => key + 1);
    window.setTimeout(() => setAnimatingId(null), 260);
  };

  const handleSend = () => {
    if (!selected || role !== 'teacher' || existingFeedback || sending) return;
    setSending(true);
    window.setTimeout(() => {
      const result = sendTeacherFeedback(selected.id, draft);
      setSending(false);
      if (result.ok) setJustSent(true);
    }, 160);
  };

  const toggleEvidence = (item: ProcessEvidence) => {
    setOpenEvidenceId((current) => (current === item.id ? null : item.id));
  };

  const openAcceptance = () => {
    stashTeacherFocusSubmission(HANDOFF_FINAL_SUBMISSION_ID);
    onOpenAcceptance(HANDOFF_FINAL_SUBMISSION_ID);
  };

  return (
    <div className="demo-light">
      <AppHeader />
      <div className="demo-light-page">
        <div className="teacher-page">
          <button
            type="button"
            className="btn btn-ghost btn-compact demo-light-back"
            onClick={onBack}
          >
            返回课程指导台
          </button>
          <div className="demo-light-title-bar teacher-title-group">
            <div>
              <h1>
                <span className="group-mark">{HANDOFF_GROUP_LABEL}</span>
                <span className="project-mark">{HANDOFF_PROJECT_NAME}</span>
              </h1>
              <p className="subtitle">阶段汇报 · 本次关键变化 · AI 高度参与</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openAcceptance}
            >
              项目核收
            </button>
          </div>

          <nav className="teacher-shell-nav" aria-label="小组视图">
            <button type="button" className="is-active">
              阶段汇报
            </button>
            <button type="button" disabled>
              任务蓝图
            </button>
            <button type="button" disabled>
              过程日志
            </button>
          </nav>

          <div className="stage-report-shell">
            <section aria-label="本次关键变化">
              <p className="dl-section-label">
                本次关键变化 · {events.length} 条
              </p>
              <div className="stage-timeline-rail">
                {events.map((event) => {
                  const selectedNow = selected?.id === event.id;
                  const animClass =
                    animatingId === event.id && !selectedNow
                      ? ' is-collapsing'
                      : selectedNow
                        ? ' is-expanding'
                        : '';
                  const marks = evidenceChecklist(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`stage-event-card${selectedNow ? ' is-selected' : ''}${animClass}`}
                      onClick={() => handleSelect(event.id)}
                      aria-pressed={selectedNow}
                    >
                      <div className="stage-event-head">
                        <span>{event.dateLabel}</span>
                        <span
                          className={`dl-tag${event.statusTone === 'success' ? ' is-success' : ''}`}
                        >
                          {event.statusLabel}
                        </span>
                      </div>
                      <h3>{event.title}</h3>
                      <p className="stage-event-summary">{event.summary}</p>
                      <p className="stage-event-author">{event.authorLabel}</p>
                      <div
                        className="stage-event-expand"
                        aria-hidden={!selectedNow}
                      >
                        <ul className="stage-event-checklist">
                          {marks.done.slice(0, 2).map((line) => (
                            <li key={`d-${line}`} className="done">
                              {line}
                            </li>
                          ))}
                          {marks.pending.slice(0, 2).map((line) => (
                            <li key={`p-${line}`} className="pending">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="stage-detail-panel" aria-label="事件详情">
              {selected ? (
                <div key={detailKey} className="stage-detail-body">
                  <p className="responding-label">
                    {existingFeedback || justSent
                      ? `正在查看：${selected.title}`
                      : `正在回应：${selected.title}`}
                  </p>
                  <h2>{selected.title}</h2>
                  <p className="detail-summary">{selected.summary}</p>

                  {selected.evidence.length > 0 ? (
                    <div className="stage-evidence-grid">
                      {selected.evidence.map((item) => {
                        const open = openEvidenceId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`stage-evidence-card${open ? ' is-open' : ''}`}
                          >
                            <span
                              className={`dl-tag label${
                                item.kind === 'ai-suggestion'
                                  ? ' is-ai'
                                  : item.kind === 'verification'
                                    ? ' is-success'
                                    : ''
                              }`}
                            >
                              {item.label}
                            </span>
                            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
                              {item.summary}
                            </p>
                            <span className="dl-muted">
                              {item.at}
                              {open ? ` · ${item.linkLabel}` : ''}
                            </span>
                            <div>
                              <button
                                type="button"
                                className="linkish"
                                onClick={() => toggleEvidence(item)}
                              >
                                {open ? '收起证据' : item.linkLabel}
                              </button>
                            </div>
                            {open ? (
                              <div className="evidence-body">
                                {item.kind === 'ai-suggestion'
                                  ? '该建议来自阶段材料整理：把库存边界与并发购买列为必测项，并要求保留预期/实际对照。'
                                  : item.kind === 'student-edit'
                                    ? '学生在接口文案与错误码说明中做了同步修改，可与交付摘要对照。'
                                    : '验证记录覆盖已完成项；待补充项仍是本阶段指导重点。'}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="dl-muted" style={{ margin: '16px 0' }}>
                      本条事件暂无展开证据（多为交付或反馈记录）。
                    </p>
                  )}

                  {selected.evidence.length > 0 ? (
                    <p className="dl-muted" style={{ marginBottom: 12 }}>
                      证据覆盖：AI 建议 / 学生修改 / 验证结果 · 可点开查看
                    </p>
                  ) : null}

                  <div className="stage-feedback-panel">
                    {existingFeedback || justSent ? (
                      <div className="stage-feedback-result">
                        <strong>
                          <Check size={16} strokeWidth={2} aria-hidden="true" />
                          反馈已发送
                        </strong>
                        <p className="detail-summary">
                          {existingFeedback?.content ?? draft}
                        </p>
                        <p className="dl-muted" style={{ marginTop: 8 }}>
                          等待第 03 组回应 · 学生视角可读到同一条反馈（共{' '}
                          {studentVisibleCount} 条）
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`stage-feedback-compose${sending ? ' is-sending' : ''}`}
                      >
                        <p className="dl-section-label">反馈意见</p>
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          disabled={role !== 'teacher' || sending}
                          aria-label="教师反馈意见"
                        />
                        <div className="compose-foot">
                          <span className="dl-muted">
                            {sending
                              ? '正在发送…'
                              : '草稿已保存 · 反馈将关联当前事件'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={
                              role !== 'teacher' || sending || !draft.trim()
                            }
                            onClick={handleSend}
                          >
                            {sending ? '发送中' : '发送反馈'}
                          </button>
                        </div>
                        {role !== 'teacher' ? (
                          <p className="dl-muted" style={{ marginTop: 8 }}>
                            请切换到教师视角后再发送反馈。
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="dl-muted">暂无关键事件</p>
              )}
            </section>
          </div>
        </div>
      </div>
      <footer className="app-footer">
        <span>教师端 · 阶段汇报与 AI 参与记录</span>
        <span>当前视角：{me.name}</span>
      </footer>
    </div>
  );
}
