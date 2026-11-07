import type { ReactNode } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Clock3,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
} from 'lucide-react';
import { getMemberById } from '../../data/members';
import { DemoRoleMenu } from '../../components/demo/DemoRoleMenu';
import './guide.css';

export type TeacherPlace = 'guide' | 'stage' | 'acceptance';

type TeacherShellProps = {
  place: TeacherPlace;
  onNavigate: (place: TeacherPlace) => void;
  contentClassName?: string;
  children: ReactNode;
};

export function TeacherShell({
  place,
  onNavigate,
  contentClassName,
  children,
}: TeacherShellProps) {
  const teacher = getMemberById('member-teacher');
  const face = teacher?.initials.slice(0, 1) ?? '周';

  return (
    <div className="ctn-guide" data-teacher-place={place}>
      <header className="ctg-top">
        <div className="ctg-brand">
          <span className="ctg-mark">CT</span>
          <span>CoTrace 共迹</span>
          <span className="ctg-role">教师端</span>
        </div>
        <div className="ctg-top-tools">
          <DemoRoleMenu />
          <span className="ctg-term">
            本学期
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="ctg-teacher">
            <span className="ctg-teacher-face">{face}</span>
            {teacher?.name ?? '周老师'}
          </span>
          <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
        </div>
      </header>
      <div className="ctg-body">
        <nav className="ctg-side" aria-label="教师导航">
          <button
            type="button"
            className={`ctg-nav${place === 'guide' ? ' is-on' : ''}`}
            aria-current={place === 'guide' ? 'page' : undefined}
            onClick={() => onNavigate('guide')}
          >
            <LayoutGrid size={18} strokeWidth={1.75} aria-hidden="true" />
            课程
          </button>
          <button
            type="button"
            className={`ctg-nav${place === 'stage' ? ' is-on' : ''}`}
            aria-current={place === 'stage' ? 'page' : undefined}
            onClick={() => onNavigate('stage')}
          >
            <ClipboardList size={18} strokeWidth={1.75} aria-hidden="true" />
            阶段汇报
          </button>
          <button type="button" className="ctg-nav" disabled>
            <Clock3 size={18} strokeWidth={1.75} aria-hidden="true" />
            指导记录
          </button>
          <button
            type="button"
            className={`ctg-nav${place === 'acceptance' ? ' is-on' : ''}`}
            aria-current={place === 'acceptance' ? 'page' : undefined}
            onClick={() => onNavigate('acceptance')}
          >
            <FolderOpen size={18} strokeWidth={1.75} aria-hidden="true" />
            项目核收
          </button>
        </nav>
        <div className={`ctg-content${contentClassName ? ` ${contentClassName}` : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
