import { useEffect, useMemo, useState } from 'react';
import { Check, FileCode2, FileText } from 'lucide-react';
import {
  confirmAcceptance,
  useAcceptance,
  useFinalSubmission,
} from '../../data/acceptanceStore';
import {
  HANDOFF_GROUP_LABEL,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { useDemoRole } from '../../data/demoRoleStore';
import { takeTeacherFocusSubmission } from '../../pages/teacher/teacherFocus';
import { FindingList } from '../FindingList';
import { VerdictBanner } from '../VerdictBanner';
import { TeacherShell, type TeacherPlace } from './TeacherShell';
import '../readingLayout.css';
import './accept.css';

function splitAcceptanceSummary(summary: string): {
  title: string;
  findings: { id: string; title: string; body: string; severity: 'ok' | 'neutral' }[];
} {
  const text = summary.trim();
  if (!text) {
    return { title: '待核收', findings: [] };
  }
  const parts = text
    .split(/[。；;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const head = parts[0] ?? text;
  const rest = parts.slice(1);
  return {
    title: '可核收',
    findings: [
      {
        id: 'ai-summary-0',
        title: '摘要',
        body: head,
        severity: 'ok' as const,
      },
      ...rest.map((body, index) => ({
        id: `ai-summary-${index + 1}`,
        title: '要点',
        body,
        severity: 'neutral' as const,
      })),
    ],
  };
}

type AcceptancePageProps = {
  onNavigate: (place: TeacherPlace) => void;
};

export function AcceptancePage({ onNavigate }: AcceptancePageProps) {
  const role = useDemoRole();
  const submission = useFinalSubmission();
  const acceptance = useAcceptance();
  const [note, setNote] = useState(acceptance.note || '');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    takeTeacherFocusSubmission(null);
  }, []);

  const accepted = acceptance.status === 'accepted';
  const aiBrief = useMemo(
    () => splitAcceptanceSummary(submission.aiSummary),
    [submission.aiSummary],
  );

  const confirm = () => {
    if (role !== 'teacher' || accepted) return;
    const result = confirmAcceptance(note || '确认核收');
    setNotice(
      result.ok
        ? '已核收，结果已写入课程指导台'
        : '这份提交已经核收',
    );
  };

  return (
    <TeacherShell place="acceptance" onNavigate={onNavigate}>
      <div className="cta-page">
        <div className="cta-head">
          <div>
            <p className="cta-kicker">
              <button type="button" onClick={() => onNavigate('guide')}>
                返回指导台
              </button>
              <span>软件工程课程 / 项目核收</span>
            </p>
            <div className="cta-title">
              <span className="cta-group">{HANDOFF_GROUP_LABEL}</span>
              <h1>{HANDOFF_PROJECT_NAME}</h1>
            </div>
          </div>
          <p className="cta-version">
            <span className={accepted ? 'is-ok' : ''}>{accepted ? '已核收' : '待核收'}</span>
          </p>
        </div>

        <div className="cta-work">
          <section className="cta-main" aria-label="最终交付与过程证据">
            <h2>项目材料</h2>
            <ul className="cta-files">
              {submission.files.map((file) => (
                <li key={file.id}>
                  {file.kind === 'code' ? (
                    <FileCode2 size={18} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>{file.name}</span>
                  {file.sizeLabel ? <em>{file.sizeLabel}</em> : null}
                </li>
              ))}
            </ul>

            <h2>核收证据</h2>
            <ul className="cta-evidence">
              {submission.evidence.map((item) => (
                <li key={item.id}>
                  <div className="cta-evidence-row">
                    <span className={`cta-kind is-${item.kind}`}>{item.label}</span>
                    <span>
                      <strong>{item.summary}</strong>
                      <small>{item.at}</small>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="cta-jump" onClick={() => onNavigate('stage')}>
              查看阶段指导 →
            </button>
          </section>

          <aside className="cta-side" aria-label="教师确认">
            <h2>AI 核收摘要</h2>
            <div className="cta-ai-struct">
              <span className="cta-ai-badge">AI 整理 · 待复核</span>
              <VerdictBanner
                title={accepted ? '已核收' : aiBrief.title}
                detail="结论优先；明细可展开核对。"
                tone={accepted ? 'ok' : 'neutral'}
              />
              <FindingList
                items={aiBrief.findings}
                maxVisible={3}
                clampLines={2}
              />
              <details className="cta-ai-raw">
                <summary>原始摘要</summary>
                <p>{submission.aiSummary}</p>
              </details>
            </div>
            <h2>教师核收意见</h2>
            {accepted ? (
              <div className="cta-done">
                <strong>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  已核收
                </strong>
                <p>{acceptance.note || '已确认核收。'}</p>
              </div>
            ) : (
              <>
                <textarea
                  aria-label="教师核收意见"
                  placeholder="请输入核收意见（如：是否通过、需补充的内容等）"
                  value={note}
                  disabled={role !== 'teacher'}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="cta-actions">
                  <button
                    type="button"
                    className="is-primary"
                    disabled={role !== 'teacher'}
                    onClick={confirm}
                  >
                    确认核收
                  </button>
                </div>
              </>
            )}
            {notice ? <p className="cta-notice">{notice}</p> : null}
          </aside>
        </div>
      </div>
    </TeacherShell>
  );
}
