import { useEffect, useState } from 'react';
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
import { TeacherShell, type TeacherPlace } from './TeacherShell';
import './accept.css';

type AcceptancePageProps = {
  onNavigate: (place: TeacherPlace) => void;
};

export function AcceptancePage({ onNavigate }: AcceptancePageProps) {
  const role = useDemoRole();
  const submission = useFinalSubmission();
  const acceptance = useAcceptance();
  const [note, setNote] = useState(acceptance.note || '');
  const [openId, setOpenId] = useState<string | null>(submission.evidence[0]?.id ?? null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    takeTeacherFocusSubmission(null);
  }, []);

  const accepted = acceptance.status === 'accepted';

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
              {submission.evidence.map((item) => {
                const open = openId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : item.id)}
                    >
                      <span className={`cta-kind is-${item.kind}`}>{item.label}</span>
                      <span>
                        <strong>{item.summary}</strong>
                        <small>{item.at}</small>
                      </span>
                      <em>{open ? '收起' : item.linkLabel}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="cta-jump" onClick={() => onNavigate('stage')}>
              查看阶段指导 →
            </button>
          </section>

          <aside className="cta-side" aria-label="教师确认">
            <h2>AI 核收摘要</h2>
            <p className="cta-ai">
              <span>AI 整理 · 待复核</span>
              {submission.aiSummary}
            </p>
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
                  <button type="button" className="is-ghost" disabled>
                    需补交
                  </button>
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
