import { useDelivery } from '../../data/deliveryStore';
import { useAcceptance } from '../../data/acceptanceStore';
import { getMemberById } from '../../data/members';
import {
  HANDOFF_EVENT_EXCEPTION,
  HANDOFF_FINAL_SUBMISSION_ID,
  HANDOFF_PUBLISHER_ID,
  HANDOFF_RECEIVER_ID,
} from '../../data/handoffDemoSeed';
import {
  getProcessEventById,
  useFeedbacksForEvent,
  useProcessEvents,
} from '../../data/processEventStore';
import {
  getTeacherGroup,
  TEACHER_GROUPS,
  TEACHER_LIVE_GROUP_ID,
} from '../../data/teacherGroups';
import {
  stashTeacherFocusEvent,
  stashTeacherFocusSubmission,
} from '../../pages/teacher/teacherFocus';
import { Calendar } from 'lucide-react';
import { TeacherShell, type TeacherPlace } from './TeacherShell';
import './guide.css';

type CourseGuidePageProps = {
  onOpenStageReport: (groupId: string) => void;
  onOpenAcceptance: () => void;
  onNavigate: (place: TeacherPlace) => void;
};

export function CourseGuidePage({
  onOpenStageReport,
  onOpenAcceptance,
  onNavigate,
}: CourseGuidePageProps) {
  const delivery = useDelivery();
  const acceptance = useAcceptance();
  const events = useProcessEvents();
  const liveGroup = getTeacherGroup(TEACHER_LIVE_GROUP_ID);
  const faces = [HANDOFF_PUBLISHER_ID, HANDOFF_RECEIVER_ID, 'member-jordan']
    .map((id) => getMemberById(id))
    .filter((member) => member != null);
  const helpEvent = events.find(
    (event) => event.kind === 'student-help' && event.statusTone === 'warning',
  );
  const helpGuided = useFeedbacksForEvent(helpEvent?.id ?? '').length > 0;
  const stageEvent = getProcessEventById(HANDOFF_EVENT_EXCEPTION);
  const focusEventId = helpEvent && !helpGuided ? helpEvent.id : HANDOFF_EVENT_EXCEPTION;
  const stageQuestion =
    helpEvent && !helpGuided
      ? helpEvent.summary
      : (stageEvent?.summary ?? '库存不足场景，应该补充哪些测试？');
  const stageAuthor =
    helpEvent && !helpGuided
      ? helpEvent.authorLabel
      : (stageEvent?.authorLabel ?? '阶段记录');
  const stageGuided = useFeedbacksForEvent(focusEventId).length > 0;
  const stageStatus = stageGuided ? '已反馈' : '待指导';
  const pendingTodoCount =
    (stageGuided ? 0 : 1) + (acceptance.status === 'accepted' ? 0 : 1);

  const groupSummary =
    delivery.status === 'received'
      ? '已确认'
      : delivery.status === 'published'
        ? '已交给 Priya，等她确认'
        : delivery.status === 'needs-revision'
          ? 'Priya 要改这一版'
          : '订单创建已更新，可上传材料发布';

  const openStage = (groupId: string) => {
    if (groupId === TEACHER_LIVE_GROUP_ID) {
      stashTeacherFocusEvent(focusEventId);
    }
    onOpenStageReport(groupId);
  };

  const openAcceptance = () => {
    stashTeacherFocusSubmission(HANDOFF_FINAL_SUBMISSION_ID);
    onOpenAcceptance();
  };

  const sortedGroups = [...TEACHER_GROUPS].sort((a, b) => {
    const rank = (group: (typeof TEACHER_GROUPS)[number]) => {
      if (group.id === TEACHER_LIVE_GROUP_ID || group.live) return 0;
      if (group.tone === 'warn') return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  return (
    <TeacherShell place="guide" onNavigate={onNavigate} contentClassName="is-board">
          <div className="ctg-head">
            <div>
              <p className="ctg-kicker">课程指导台 · 第二阶段</p>
              <h1>软件工程</h1>
            </div>
          </div>

          <section className="ctg-board" aria-label="小组项目">
              <div className="ctg-toolbar">
                <h2>
                  小组项目
                  <span className="ctg-count">全部小组 {TEACHER_GROUPS.length}</span>
                </h2>
                <span className="ctg-filter" aria-hidden="true">
                  全部阶段
                </span>
              </div>
              <div className="ctg-grid">
                {sortedGroups.map((group) => {
                  const isLive = group.id === TEACHER_LIVE_GROUP_ID;
                  const summary = isLive ? groupSummary : group.summary;
                  const status = isLive ? stageStatus : group.status;
                  const guided = isLive ? stageGuided : group.tone === 'ok';
                  const needsAttention =
                    isLive || group.live || group.tone === 'warn';
                  return (
                    <article
                      key={group.id}
                      className={`ctg-card${needsAttention ? ' is-attention' : ''}`}
                      data-group-id={group.id}
                    >
                      <button
                        type="button"
                        className="ctg-card-hit"
                        aria-label={`打开 ${group.label} ${group.name}`}
                        onClick={() => openStage(group.id)}
                      >
                        <div
                          className={`ctg-shot ${isLive ? 'is-campus' : `is-${group.id}`}`}
                          aria-hidden="true"
                        >
                          <span />
                          <i />
                          <b />
                        </div>
                        <p className="ctg-card-label">{group.label}</p>
                        <h3>{group.name}</h3>
                        <p>{summary}</p>
                      </button>
                      <div className="ctg-card-foot">
                        {isLive ? (
                          <span className="ctg-faces">
                            {faces.map((member) => (
                              <span
                                key={member.id}
                                className="ctg-face"
                                title={member.name}
                              >
                                {member.initials.slice(0, 1)}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span className={`ctg-tag${guided ? ' is-ok' : ''}`}>
                          <i />
                          {status}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
          </section>

          <aside className="ctg-rail" aria-label="待处理">
              <div className="ctg-rail-head">
                <h2>
                  待处理
                  <span className="ctg-dot">{pendingTodoCount}</span>
                </h2>
              </div>
              <button
                type="button"
                className="ctg-todo is-stage"
                aria-label="阶段汇报待办"
                onClick={() => openStage(TEACHER_LIVE_GROUP_ID)}
              >
                <span className="ctg-todo-meta">
                  <span>阶段汇报待办 · {liveGroup.label}</span>
                  <span>{stageAuthor}</span>
                </span>
                <strong>{stageQuestion}</strong>
                <span className={`ctg-tag${stageGuided ? ' is-ok' : ''}`}>
                  <i />
                  {stageStatus}
                </span>
              </button>

              <button
                type="button"
                className="ctg-todo is-accept"
                aria-label="核收待办"
                onClick={openAcceptance}
              >
                <span className="ctg-todo-meta">
                  <span>核收待办 · 最终提交 v1.0</span>
                  <span>项目后期示例</span>
                </span>
                <strong>
                  {acceptance.status === 'accepted'
                    ? '示例 v1.0 已核收'
                    : '打开示例 v1.0 并确认核收'}
                </strong>
                <span className={`ctg-tag${acceptance.status === 'accepted' ? ' is-ok' : ''}`}>
                  <i />
                  {acceptance.status === 'accepted' ? '已核收' : '待核收'}
                </span>
              </button>

              <div className="ctg-cal">
                <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <strong>11月15日 · 第二阶段汇报</strong>
                  <p>各组提交后可查看确认版本</p>
                </div>
              </div>
          </aside>
    </TeacherShell>
  );
}
