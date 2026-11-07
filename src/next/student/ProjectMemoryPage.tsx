import { useMemo, useState } from 'react';
import { FileSearch, Search } from 'lucide-react';
import {
  DEMO_EVIDENCE_TOAST,
  filterDecisions,
  formatDecisionState,
  formatEvidenceKind,
  formatPublicationState,
  formatTaskStatus,
  getSeatflowProjectLog,
  SEATFLOW_PROJECT_ID,
  type SeatflowDecision,
  type SeatflowEvidence,
} from '../../data/projectLogs';
import {
  HANDOFF_PROJECT_ID,
  HANDOFF_PROJECT_NAME,
  HANDOFF_PUBLISHER_ID,
  HANDOFF_RECEIVER_ID,
} from '../../data/handoffDemoSeed';
import {
  getAllFeedbacks,
  useProcessEvents,
} from '../../data/processEventStore';
import { useActiveMemberId } from '../../data/demoRoleStore';
import { getMemberById } from '../../data/members';
import { StudentShell, type StudentPlace } from './StudentShell';
import './projectMemory.css';

type ProjectMemoryPageProps = {
  projectId: string | null;
  onNavigate: (place: StudentPlace) => void;
};

/**
 * 校园项目：从共享过程事件读取交付 / 求助 / 教师反馈。
 * SeatFlow：保留原决策记忆演示。
 */
export function ProjectMemoryPage({
  projectId,
  onNavigate,
}: ProjectMemoryPageProps) {
  const isSeatflow = projectId === SEATFLOW_PROJECT_ID;
  const isCampus =
    !projectId ||
    projectId === HANDOFF_PROJECT_ID ||
    projectId === 'campus' ||
    projectId === 'current';

  if (isSeatflow) {
    return <SeatflowMemory onNavigate={onNavigate} />;
  }

  if (isCampus) {
    return <CampusProcessMemory onNavigate={onNavigate} />;
  }

  return (
    <StudentShell
      place="history"
      projectName="项目记录"
      onNavigate={onNavigate}
    >
      <div className="pm">
        <div className="pm-empty is-quiet" role="status">
          <p>暂无项目记录</p>
        </div>
      </div>
    </StudentShell>
  );
}

function CampusProcessMemory({
  onNavigate,
}: {
  onNavigate: (place: StudentPlace) => void;
}) {
  const events = useProcessEvents();
  const feedbacks = getAllFeedbacks();
  const actorId = useActiveMemberId();
  const campusEvents = useMemo(() => {
    const filtered = events.filter(
      (event) =>
        event.projectId === HANDOFF_PROJECT_ID &&
        (event.kind === 'delivery-published' ||
          event.kind === 'delivery-received' ||
          event.kind === 'delivery-revision' ||
          event.kind === 'student-help' ||
          event.kind === 'teacher-feedback'),
    );

    const score = (kind: string, authorLabel: string) => {
      const mine =
        (actorId === HANDOFF_PUBLISHER_ID && authorLabel.includes('Alex')) ||
        (actorId === HANDOFF_RECEIVER_ID && authorLabel.includes('Priya'));
      // 求助与教师反馈优先展示，便于三角色回看同一原文
      if (kind === 'student-help' || kind === 'teacher-feedback') return 0;
      if (actorId === HANDOFF_PUBLISHER_ID) {
        if (kind === 'delivery-published' || kind === 'delivery-received') {
          return mine ? 1 : 2;
        }
        return 3;
      }
      if (actorId === HANDOFF_RECEIVER_ID) {
        if (kind === 'delivery-published' || kind === 'delivery-received') return 1;
        return 2;
      }
      return 3;
    };

    return [...filtered].sort((a, b) => {
      const diff =
        score(a.kind, a.authorLabel + a.statusLabel) -
        score(b.kind, b.authorLabel + b.statusLabel);
      if (diff !== 0) return diff;
      return 0;
    });
  }, [events, actorId]);

  return (
    <StudentShell
      place="history"
      projectName={HANDOFF_PROJECT_NAME}
      onNavigate={onNavigate}
    >
      <div className="pm">
        <p className="pm-kicker">{HANDOFF_PROJECT_NAME}</p>
        <div className="pm-head">
          <div>
            <h1>项目记录</h1>
            <p>共享事件 · 同一原文与版本（含教师正式反馈回显）</p>
          </div>
        </div>

        {campusEvents.length === 0 ? (
          <div className="pm-empty is-quiet" role="status">
            <p>暂无项目记录</p>
          </div>
        ) : (
          <ol className="pm-list">
            {campusEvents.map((event) => {
              const linkedFeedback = feedbacks.find(
                (item) =>
                  item.eventId === event.id ||
                  (event.kind === 'teacher-feedback' &&
                    item.id === `feedback-${event.relatedEventId}`),
              );
              const relatedFeedback =
                linkedFeedback ||
                feedbacks.find((item) => item.eventId === event.relatedEventId);
              return (
                <li key={event.id} className="pm-card">
                  <div className="pm-card-top">
                    <span className="pm-date">{event.dateLabel}</span>
                    <strong>{event.title}</strong>
                    <em>{event.statusLabel}</em>
                  </div>
                  <p className="pm-author">{event.authorLabel}</p>
                  <p className="pm-summary">{event.summary}</p>
                  <details className="pm-tech">
                    <summary>详情</summary>
                    {event.versionId ? <p>版本 {event.versionId}</p> : null}
                    {event.evidence.map((item) => (
                      <div key={item.id} className="pm-evidence">
                        <strong>{item.label}</strong>
                        <span>{item.summary}</span>
                      </div>
                    ))}
                  </details>
                  {relatedFeedback && event.kind !== 'teacher-feedback' ? (
                    <div className="pm-evidence is-teacher">
                      <strong>
                        教师正式反馈 ·{' '}
                        {getMemberById(relatedFeedback.authorId)?.name ??
                          '周老师'}
                      </strong>
                      <span>{relatedFeedback.content}</span>
                      <time>{relatedFeedback.createdAt}</time>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </StudentShell>
  );
}

function SeatflowMemory({
  onNavigate,
}: {
  onNavigate: (place: StudentPlace) => void;
}) {
  const log = useMemo(() => getSeatflowProjectLog(), []);
  const actorId = useActiveMemberId();
  const actorName = getMemberById(actorId)?.name ?? '';
  const [query, setQuery] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [relatedOnly, setRelatedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const decisions = useMemo(() => {
    const base = filterDecisions(log.decisionHistory, query, activeKeyword);
    if (!relatedOnly || !actorName) return base;
    return base.filter((decision) =>
      decision.participants.some((name) => name.includes(actorName.split(' ')[0])),
    );
  }, [log.decisionHistory, query, activeKeyword, relatedOnly, actorName]);

  const showToast = () => {
    setToast(DEMO_EVIDENCE_TOAST);
    window.setTimeout(() => setToast(null), 2800);
  };

  return (
    <StudentShell
      place="history"
      projectName={log.projectName}
      onNavigate={onNavigate}
    >
      <div className="pm">
        <p className="pm-kicker">{log.projectName}</p>
        <div className="pm-head">
          <div>
            <h1>{log.pageTitle || '项目记忆'}</h1>
            <p>团队共享已确认经验；可用「与我相关」查看角色差异</p>
          </div>
          <div className="pm-tools">
            <label className="pm-search">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder={log.search.placeholder}
                aria-label="搜索项目决策"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={`pm-filter${relatedOnly ? ' is-on' : ''}`}
              onClick={() => setRelatedOnly((value) => !value)}
            >
              与我相关
            </button>
          </div>
        </div>
        <div className="pm-keywords">
          {log.search.suggestedKeywords.map((keyword) => (
            <button
              key={keyword}
              type="button"
              className={activeKeyword === keyword ? 'is-on' : ''}
              onClick={() =>
                setActiveKeyword((prev) => (prev === keyword ? null : keyword))
              }
            >
              {keyword}
            </button>
          ))}
        </div>
        <ol className="pm-list">
          {decisions.map((decision: SeatflowDecision) => {
            const open = openId === decision.id;
            return (
              <li key={decision.id} className="pm-card">
                <button
                  type="button"
                  className="pm-card-top"
                  onClick={() => setOpenId(open ? null : decision.id)}
                >
                  <span>{decision.dateLabel}</span>
                  <strong>{decision.title}</strong>
                  <em>{formatDecisionState(decision.decisionState)}</em>
                </button>
                <p className="pm-summary">{decision.decision}</p>
                <p className="pm-author">
                  参与人 {decision.participants.join('、')} · 任务{' '}
                  {formatTaskStatus(decision.taskStatus)}
                </p>
                {open ? (
                  <div className="pm-detail">
                    <p>{decision.reason}</p>
                    <p>
                      公开 {formatPublicationState(decision.publicationState)}
                    </p>
                    <ul>
                      {decision.evidence.map((item: SeatflowEvidence, index) => (
                        <li key={`${decision.id}-ev-${index}`}>
                          <FileSearch size={14} aria-hidden="true" />
                          <button type="button" onClick={showToast}>
                            {formatEvidenceKind(item.kind)} · {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {toast ? <p className="pm-toast">{toast}</p> : null}
      </div>
    </StudentShell>
  );
}
