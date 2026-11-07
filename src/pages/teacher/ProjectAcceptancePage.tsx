import { useEffect, useState } from 'react';
import { Check, ChevronDown, FileCode2, FileText } from 'lucide-react';
import { AppHeader } from '../../components/layout/AppHeader';
import { getCurrentMember } from '../../data/members';
import {
  confirmAcceptance,
  useAcceptance,
  useFinalSubmission,
} from '../../data/acceptanceStore';
import { getAllFeedbacks } from '../../data/processEventStore';
import {
  HANDOFF_EVENT_EXCEPTION,
  HANDOFF_FINAL_SUBMISSION_ID,
  HANDOFF_GROUP_LABEL,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { useDemoRole } from '../../data/demoRoleStore';
import {
  stashTeacherFocusEvent,
  takeTeacherFocusSubmission,
} from './teacherFocus';
import './teacherPages.css';

type ProjectAcceptancePageProps = {
  onBack: () => void;
  onOpenStageReport: (eventId?: string) => void;
  /** 主窗口可透传；缺省时读取核收待办桥接 */
  focusSubmissionId?: string;
};

export function ProjectAcceptancePage({
  onBack,
  onOpenStageReport,
  focusSubmissionId,
}: ProjectAcceptancePageProps) {
  const me = getCurrentMember();
  const role = useDemoRole();
  const submission = useFinalSubmission();
  const acceptance = useAcceptance();
  const [note, setNote] = useState(acceptance.note || '');
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [openEvidenceIds, setOpenEvidenceIds] = useState<string[]>([]);
  const [highlightSubmission, setHighlightSubmission] = useState(false);
  const historyFeedbacks = getAllFeedbacks();

  useEffect(() => {
    const focused =
      focusSubmissionId?.trim() || takeTeacherFocusSubmission(null);
    if (!focused) return undefined;
    if (
      focused !== submission.id &&
      focused !== HANDOFF_FINAL_SUBMISSION_ID
    ) {
      return undefined;
    }
    setHighlightSubmission(true);
    const firstEvidenceId = submission.evidence[0]?.id;
    if (firstEvidenceId) {
      setOpenEvidenceIds([firstEvidenceId]);
    }
    const timer = window.setTimeout(() => setHighlightSubmission(false), 1600);
    return () => window.clearTimeout(timer);
    // 仅在进入页 / 路由透传变化时定位一次；submission 取自 store 快照
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSubmissionId]);

  useEffect(() => {
    if (acceptance.status === 'accepted' && acceptance.note) {
      setNote(acceptance.note);
    }
  }, [acceptance.status, acceptance.note]);

  const toggleEvidence = (id: string) => {
    setOpenEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handleAccept = () => {
    if (role !== 'teacher' || confirming) return;
    setConfirming(true);
    window.setTimeout(() => {
      const result = confirmAcceptance(note);
      setConfirming(false);
      if (!result.ok) {
        setMessage('已核收，可继续回看最终提交与过程反馈。');
        return;
      }
      setMessage('已核收 · 结果已同步到课程指导台');
    }, 160);
  };

  const openStageHistory = () => {
    stashTeacherFocusEvent(HANDOFF_EVENT_EXCEPTION);
    onOpenStageReport(HANDOFF_EVENT_EXCEPTION);
  };

  return (
    <div className="demo-light">
      <AppHeader />
      <div className="demo-light-page">
        <div className="acceptance-shell">
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
              <p className="subtitle">
                项目核收 · 最终提交 {submission.version}（项目后期示例）
              </p>
            </div>
          </div>

          <article
            className={`acceptance-hero${acceptance.status === 'accepted' ? ' is-accepted' : ''}${highlightSubmission ? ' classroom-card is-focus-target' : ''}`}
            id={`submission-${submission.id}`}
          >
            <div className="acceptance-hero-top">
              <span
                className={`dl-tag${acceptance.status === 'accepted' ? ' is-success' : ''}`}
              >
                {acceptance.status === 'accepted' ? '已核收' : '待核收'}
              </span>
              <span className="dl-tag is-ai">AI 整理 · 待复核</span>
              <span className="dl-muted">提交 id · {submission.id}</span>
            </div>

            <div className="acceptance-primary-block">
              <div>
                <h2>最终成果</h2>
                <p className="delivery-receive-summary">{submission.aiSummary}</p>
              </div>

              <div>
                <p className="acceptance-section-label">最终交付</p>
                <div className="acceptance-file-list">
                  {submission.files.map((file) => (
                    <div key={file.id} className="acceptance-file-row">
                      {file.kind === 'code' ? (
                        <FileCode2
                          size={18}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      ) : (
                        <FileText
                          size={18}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      )}
                      <span>{file.name}</span>
                      <span className="size">{file.sizeLabel}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="acceptance-section-label">
                  核收证据 · 点击展开
                </p>
                <div className="acceptance-evidence-list">
                  {submission.evidence.map((item) => {
                    const open = openEvidenceIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`acceptance-evidence-item${open ? ' is-open' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleEvidence(item.id)}
                          aria-expanded={open}
                        >
                          <div className="ev-main">
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
                            <p className="ev-summary-preview">{item.summary}</p>
                          </div>
                          <ChevronDown
                            className="ev-chevron"
                            size={18}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </button>
                        {open ? (
                          <div className="acceptance-evidence-body">
                            <p style={{ margin: 0 }}>
                              {item.kind === 'ai-suggestion'
                                ? '阶段汇报中的 AI 建议已落到最终提交：库存并发与零库存用例成为核收对照项。'
                                : item.kind === 'student-edit'
                                  ? '学生在 v1.0 中补充了测试用例与报告，可与阶段反馈「请补充前端联调验证结果」对照。'
                                  : '验证证据显示库存为 0 时拒绝下单，并发购买仅一笔成功，满足本轮核收要点。'}
                            </p>
                            <p className="meta">
                              {item.at} · {item.linkLabel}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={openStageHistory}
              >
                查看阶段指导 / 历史反馈（{historyFeedbacks.length}）
              </button>
            </div>
          </article>

          <article className="acceptance-action-card">
            <p className="acceptance-section-label">教师核收意见</p>
            {acceptance.status === 'accepted' ? (
              <div className="acceptance-result">
                <p className="delivery-receive-summary">
                  {acceptance.note || '已确认核收。'}
                </p>
                <p className="stamp">
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  已核收
                </p>
                <p className="dl-muted">
                  刷新后仍保留核收结果；课程指导台卡片同步为「已核收」。
                </p>
              </div>
            ) : (
              <>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="请输入核收意见（如：是否通过、需补充的内容等）"
                  disabled={role !== 'teacher' || confirming}
                  aria-label="教师核收意见"
                />
                <div className="acceptance-action-row">
                  <button type="button" className="btn btn-secondary" disabled>
                    需补交
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={role !== 'teacher' || confirming}
                    onClick={handleAccept}
                  >
                    {confirming ? '确认中…' : '确认核收'}
                  </button>
                </div>
                {role !== 'teacher' ? (
                  <p className="dl-muted" style={{ marginTop: 8 }}>
                    请切换到教师视角后再确认核收。
                  </p>
                ) : null}
              </>
            )}
            {message ? (
              <p className="dl-muted" style={{ marginTop: 8 }}>
                {message}
              </p>
            ) : null}
          </article>
        </div>
      </div>
      <footer className="app-footer">
        <span>教师端 · 项目后期核收</span>
        <span>当前视角：{me.name}</span>
      </footer>
    </div>
  );
}
