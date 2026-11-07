import { AppHeader } from '../../components/layout/AppHeader';
import { getCurrentMember } from '../../data/members';
import { useAcceptance } from '../../data/acceptanceStore';
import { useDelivery } from '../../data/deliveryStore';
import { useProcessEvents, getAllFeedbacks } from '../../data/processEventStore';
import {
  HANDOFF_EVENT_EXCEPTION,
  HANDOFF_FINAL_SUBMISSION_ID,
  HANDOFF_GROUP_LABEL,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import {
  stashTeacherFocusEvent,
  stashTeacherFocusSubmission,
} from './teacherFocus';
import './teacherPages.css';

type ClassroomGuidePageProps = {
  onBack: () => void;
  /** 可选 eventId：主窗口未透传时，本页用 sessionStorage 桥接 */
  onOpenStageReport: (eventId?: string) => void;
  onOpenAcceptance: (submissionId?: string) => void;
};

export function ClassroomGuidePage({
  onBack,
  onOpenStageReport,
  onOpenAcceptance,
}: ClassroomGuidePageProps) {
  const me = getCurrentMember();
  const delivery = useDelivery();
  const acceptance = useAcceptance();
  const events = useProcessEvents();
  const feedbackCount = getAllFeedbacks().length;

  const focusEvent =
    events.find((event) => event.id === HANDOFF_EVENT_EXCEPTION) ??
    events.find((event) => event.statusTone === 'warning') ??
    events[0] ??
    null;

  const groupStatus =
    acceptance.status === 'accepted'
      ? '项目后期 v1.0 已核收'
      : delivery.status === 'received'
        ? '联调已开始 · 可查看交接与阶段记录'
        : delivery.status === 'published'
          ? '订单服务已更新，等待 Priya 接收'
          : '订单服务已更新，异常测试待补充';

  const stageTodoLabel = focusEvent
    ? focusEvent.statusLabel === '待指导' || feedbackCount === 0
      ? '待指导'
      : '已有反馈'
    : '待指导';

  const openStage = (eventId?: string) => {
    const target = eventId ?? focusEvent?.id ?? HANDOFF_EVENT_EXCEPTION;
    stashTeacherFocusEvent(target);
    onOpenStageReport(target);
  };

  const openAcceptance = (submissionId?: string) => {
    const target = submissionId ?? HANDOFF_FINAL_SUBMISSION_ID;
    stashTeacherFocusSubmission(target);
    onOpenAcceptance(target);
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
            返回项目列表
          </button>
          <div className="demo-light-title-bar teacher-title-group">
            <div>
              <h1>
                <span className="group-mark">课程指导台</span>
              </h1>
              <p className="subtitle">软件工程课程 · 第二阶段</p>
            </div>
          </div>

          <nav className="teacher-shell-nav" aria-label="教师导航">
            <button type="button" className="is-active">
              阶段汇报
            </button>
            <button type="button" onClick={() => openAcceptance()}>
              项目核收
            </button>
          </nav>

          <section className="teacher-todo-rail" aria-label="教师待办">
            <p className="teacher-todo-rail-label">阶段 / 核收待办</p>
            <div className="teacher-todo-list">
              <button
                type="button"
                className="teacher-todo-card"
                onClick={() => openStage(HANDOFF_EVENT_EXCEPTION)}
              >
                <span className="teacher-todo-kind">阶段待办 · 时间线定位</span>
                <p className="teacher-todo-title">
                  {focusEvent?.summary ?? '库存不足场景，应该补充哪些测试？'}
                </p>
                <div className="teacher-todo-meta">
                  <span
                    className={`dl-tag${stageTodoLabel === '已有反馈' ? ' is-success' : ''}`}
                  >
                    {stageTodoLabel}
                  </span>
                  <span>{HANDOFF_GROUP_LABEL}</span>
                  <span className="dl-muted">进入并定位事件</span>
                </div>
              </button>

              <button
                type="button"
                className="teacher-todo-card"
                onClick={() => openAcceptance(HANDOFF_FINAL_SUBMISSION_ID)}
              >
                <span className="teacher-todo-kind">核收待办 · 最终提交</span>
                <p className="teacher-todo-title">
                  最终提交 v1.0 · 展开证据并确认核收
                </p>
                <div className="teacher-todo-meta">
                  <span
                    className={`dl-tag${acceptance.status === 'accepted' ? ' is-success' : ''}`}
                  >
                    {acceptance.status === 'accepted' ? '已核收' : '待核收'}
                  </span>
                  <span>项目后期示例</span>
                  <span className="dl-muted">进入并定位提交</span>
                </div>
              </button>
            </div>
          </section>

          <div className="classroom-grid">
            <button
              type="button"
              className="dl-card classroom-card is-focus-target"
              onClick={() => openStage()}
            >
              <h2>
                {HANDOFF_GROUP_LABEL}
                <span
                  className="dl-muted"
                  style={{ marginLeft: 8, fontWeight: 400 }}
                >
                  {HANDOFF_PROJECT_NAME}
                </span>
              </h2>
              <p>{groupStatus}</p>
              <div className="classroom-card-meta">
                <span
                  className={`dl-tag${feedbackCount > 0 ? ' is-success' : ''}`}
                >
                  {feedbackCount > 0 ? `已反馈 ${feedbackCount}` : '待指导'}
                </span>
                <span className="dl-muted">查看汇报</span>
              </div>
            </button>

            <article className="dl-card classroom-card" style={{ cursor: 'default' }}>
              <h2>第01组 · 校园活动平台</h2>
              <p>已按建议更新报名流程</p>
              <div className="classroom-card-meta">
                <span className="dl-tag is-success">已回应</span>
              </div>
            </article>

            <article className="dl-card classroom-card" style={{ cursor: 'default' }}>
              <h2>第02组 · 自习室预约系统</h2>
              <p>预约冲突处理已提交验证</p>
              <div className="classroom-card-meta">
                <span className="dl-muted">下次汇报 · 11月15日</span>
              </div>
            </article>

            <button
              type="button"
              className="dl-card classroom-card"
              onClick={() => openAcceptance()}
            >
              <h2>
                {HANDOFF_GROUP_LABEL}
                <span
                  className="dl-muted"
                  style={{ marginLeft: 8, fontWeight: 400 }}
                >
                  项目核收
                </span>
              </h2>
              <p>最终提交 v1.0 · 项目后期示例</p>
              <div className="classroom-card-meta">
                <span
                  className={`dl-tag${acceptance.status === 'accepted' ? ' is-success' : ''}`}
                >
                  {acceptance.status === 'accepted' ? '已核收' : '待核收'}
                </span>
                <span className="dl-muted">
                  {acceptance.status === 'accepted'
                    ? '结果已同步'
                    : '确认后同步到此'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
      <footer className="app-footer">
        <span>教师端 · 课堂分组入口</span>
        <span>当前视角：{me.name}</span>
      </footer>
    </div>
  );
}
