import { useMemo, useState } from 'react';
import { ArrowLeft, FileSearch, Lock, Search } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { PageTitleBar } from '../components/layout/PageTitleBar';
import { Toast } from '../components/common/Toast';
import { EXPERIENCE_MEMBER_ID, getExperienceMember } from '../data/members';
import {
  DEMO_EVIDENCE_TOAST,
  filterDecisions,
  formatDecisionState,
  formatPublicationState,
  formatTaskStatus,
  getSeatflowProjectLog,
  canViewPersonalGrowth,
  type SeatflowDecision,
  type SeatflowEvidence,
} from '../data/projectLogs';

type ProjectLogPageProps = {
  onBack: () => void;
};

export function ProjectLogPage({ onBack }: ProjectLogPageProps) {
  const me = getExperienceMember();
  const log = useMemo(() => getSeatflowProjectLog(), []);
  const [query, setQuery] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const decisions = useMemo(
    () => filterDecisions(log.decisionHistory, query, activeKeyword),
    [log.decisionHistory, query, activeKeyword],
  );

  const showGrowth = canViewPersonalGrowth(
    log.personalGrowth.ownerId,
    EXPERIENCE_MEMBER_ID,
  );

  function showEvidenceToast() {
    setToast(DEMO_EVIDENCE_TOAST);
    window.setTimeout(() => setToast(null), 2800);
  }

  function toggleKeyword(keyword: string) {
    setActiveKeyword((prev) => (prev === keyword ? null : keyword));
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <PageTitleBar
        title={log.pageTitle}
        subtitle={`${log.projectName} · ${log.pageDescription}`}
        leading={
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            返回项目列表
          </button>
        }
      />

      <div className="project-log-toolbar">
        <p className="project-log-demo-notice">{log.demoNotice}</p>
        <label className="project-log-search">
          <Search size={14} strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={log.search.placeholder}
            aria-label="搜索项目决策"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="project-log-keywords" role="group" aria-label="建议关键词">
          {log.search.suggestedKeywords.map((keyword) => (
            <button
              key={keyword}
              type="button"
              className={`project-log-keyword${
                activeKeyword === keyword ? ' is-active' : ''
              }`}
              onClick={() => toggleKeyword(keyword)}
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>

      <main className="project-log-layout" aria-label="项目日志">
        <section className="project-log-decisions" aria-label="项目决策日志">
          <header className="project-log-section-head">
            <h2>项目决策日志</h2>
            <span>
              {decisions.length} / {log.decisionHistory.length}
            </span>
          </header>

          {decisions.length === 0 ? (
            <p className="project-log-empty">没有匹配的决策记录。</p>
          ) : (
            <ol className="project-log-timeline">
              {decisions.map((item) => (
                <li key={item.id} className="project-log-timeline-item">
                  <div className="project-log-timeline-rail" aria-hidden="true">
                    <span className="project-log-timeline-node" />
                    <span className="project-log-timeline-line" />
                  </div>
                  <div className="project-log-timeline-body">
                    <time className="project-log-timeline-date">
                      {item.dateLabel}
                    </time>
                    <DecisionHistoryCard
                      decision={item}
                      onEvidenceClick={showEvidenceToast}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="project-log-aside" aria-label="个人成长归档">
          {showGrowth ? (
            <section className="panel project-log-side-card">
              <div className="panel-header">
                <h2>个人成长归档</h2>
                <span className="badge">
                  <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
                  私密
                </span>
              </div>
              <div className="panel-body project-log-side-body">
                <p className="project-log-private-notice">
                  {log.personalGrowth.notice}
                </p>
                <GrowthBlock
                  title="参与的重要技术决策"
                  items={log.personalGrowth.importantDecisions}
                />
                <GrowthBlock
                  title="已解决的问题"
                  items={log.personalGrowth.resolvedProblems}
                />
                <GrowthBlock
                  title="实践的技能"
                  items={log.personalGrowth.practicedSkills}
                />
              </div>
            </section>
          ) : (
            <p className="project-log-empty">个人成长归档仅当前成员可见。</p>
          )}
        </aside>
      </main>

      <footer className="app-footer">
        <span>虚构历史项目日志 · 不含未提交私人内容</span>
        <span>当前视角：{me.name}</span>
      </footer>

      <Toast message={toast} />
    </div>
  );
}

function DecisionHistoryCard({
  decision,
  onEvidenceClick,
}: {
  decision: SeatflowDecision;
  onEvidenceClick: () => void;
}) {
  return (
    <article className="project-log-decision-card">
      <header className="project-log-decision-head">
        <h3>{decision.title}</h3>
        <span className="project-log-record-type">{decision.recordType}</span>
      </header>

      <dl className="project-log-decision-fields">
        <div>
          <dt>决策背景</dt>
          <dd>{decision.problem}</dd>
        </div>
        <div>
          <dt>AI 提供的帮助</dt>
          <dd>{decision.aiHelp}</dd>
        </div>
        <div>
          <dt>成员如何理解、筛选或修正</dt>
          <dd>{decision.humanReview}</dd>
        </div>
        <div>
          <dt>最终团队决定</dt>
          <dd>{decision.decision}</dd>
        </div>
        <div>
          <dt>理由</dt>
          <dd>{decision.reason}</dd>
        </div>
      </dl>

      <div className="project-log-decision-status">
        <span>{formatTaskStatus(decision.taskStatus)}</span>
        <span>{formatPublicationState(decision.publicationState)}</span>
        <span>{formatDecisionState(decision.decisionState)}</span>
      </div>

      <div className="project-log-evidence" aria-label="对应任务及证据">
        <p className="project-log-evidence-label">对应任务及证据</p>
        <ul>
          {decision.evidence.map((item) => (
            <li key={`${item.kind}-${item.label}`}>
              <EvidenceButton evidence={item} onClick={onEvidenceClick} />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function EvidenceButton({
  evidence,
  onClick,
}: {
  evidence: SeatflowEvidence;
  onClick: () => void;
}) {
  return (
    <button type="button" className="project-log-evidence-btn" onClick={onClick}>
      <FileSearch size={13} strokeWidth={1.5} aria-hidden="true" />
      <span>{evidence.label}</span>
      <em>{evidence.kind}</em>
    </button>
  );
}

function GrowthBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="project-log-growth-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
