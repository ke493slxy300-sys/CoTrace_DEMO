import type { ReactNode } from 'react';
import {
  ArrowLeft,
  FileText,
  History,
  ListChecks,
  SquareKanban,
} from 'lucide-react';
import { DemoRoleMenu } from '../../components/demo/DemoRoleMenu';
import './studentShell.css';

/** projects = 学生首页；其余均属项目空间内导航 */
export type StudentPlace =
  | 'projects'
  | 'blueprint'
  | 'work'
  | 'publish'
  | 'receive'
  | 'history'
  | 'materials';

type StudentShellProps = {
  place: StudentPlace;
  onNavigate: (place: StudentPlace) => void;
  children: ReactNode;
  /** 项目空间标题；首页不传 */
  projectName?: string;
};

export function StudentShell({
  place,
  onNavigate,
  children,
  projectName,
}: StudentShellProps) {
  const isHome = place === 'projects';
  const blueprintOn = place === 'blueprint';
  const workOn =
    place === 'work' || place === 'publish' || place === 'receive';
  const historyOn = place === 'history';
  const materialsOn = place === 'materials';

  if (isHome) {
    return (
      <div className="stu-shell stu-shell-home" data-student-place="projects">
        <header className="stu-top">
          <div className="stu-brand">
            <span className="stu-mark">CT</span>
            <span>CoTrace 共迹</span>
          </div>
          <DemoRoleMenu />
        </header>
        <div className="stu-home-body">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="stu-shell stu-shell-project"
      data-student-place={place}
      data-project-space="true"
    >
      <header className="stu-top">
        <div className="stu-brand">
          <span className="stu-mark">CT</span>
          <span>CoTrace 共迹</span>
        </div>
        <DemoRoleMenu />
      </header>
      <div className="stu-body">
        <nav className="stu-side" aria-label="项目导航">
          <button
            type="button"
            className="stu-back"
            onClick={() => onNavigate('projects')}
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            所有项目
          </button>
          {projectName ? (
            <p className="stu-project-name" title={projectName}>
              {projectName}
            </p>
          ) : null}
          <button
            type="button"
            className={`stu-nav${blueprintOn ? ' is-on' : ''}`}
            aria-current={blueprintOn ? 'page' : undefined}
            onClick={() => onNavigate('blueprint')}
          >
            <SquareKanban size={18} strokeWidth={1.75} aria-hidden="true" />
            蓝图
          </button>
          <button
            type="button"
            className={`stu-nav${workOn ? ' is-on' : ''}`}
            aria-current={workOn ? 'page' : undefined}
            onClick={() => onNavigate('work')}
          >
            <ListChecks size={18} strokeWidth={1.75} aria-hidden="true" />
            工作
          </button>
          <button
            type="button"
            className={`stu-nav${historyOn ? ' is-on' : ''}`}
            aria-current={historyOn ? 'page' : undefined}
            onClick={() => onNavigate('history')}
          >
            <History size={18} strokeWidth={1.75} aria-hidden="true" />
            记录
          </button>
          <button
            type="button"
            className={`stu-nav${materialsOn ? ' is-on' : ''}`}
            aria-current={materialsOn ? 'page' : undefined}
            onClick={() => onNavigate('materials')}
          >
            <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
            材料
          </button>
        </nav>
        <div className="stu-content">{children}</div>
      </div>
    </div>
  );
}
