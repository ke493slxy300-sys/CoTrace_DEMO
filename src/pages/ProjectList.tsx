import { Plus } from 'lucide-react';
import { getMemberById } from '../data/members';
import { getSessionBlueprintNodes } from '../data/blueprintSession';
import { COURSE_NAME, projectTemplate } from '../data/project';
import { getSeatflowProjectCard } from '../data/projectLogs';
import { useActiveMemberId } from '../data/demoRoleStore';
import { campusMarketplaceDataset } from '../datasets';
import {
  StudentShell,
  type StudentPlace,
} from '../next/student/StudentShell';
import type { CourseProject } from '../types';
import './projectList.css';

type ProjectListProps = {
  project: CourseProject | null;
  onNavigate: (place: StudentPlace) => void;
  onOpenProject: () => void;
  onOpenProjectLog: (projectId: string) => void;
  onStartHandoffDemo: () => void;
  extraProject?: { id: string; name: string; statuses: string[] } | null;
  onOpenExtraProject?: () => void;
};

const CAMPUS_MEMBER_IDS = [
  'member-maya',
  'member-alex',
  'member-priya',
  'member-jordan',
];

function faceMark(name: string): string {
  return name.trim().slice(0, 1);
}

/** 项目整体进度：汇总蓝图节点，不用交付草稿或单个节点。 */
function projectProgressLabel(
  statuses: readonly string[],
): '待开始' | '进行中' | '已完成' {
  if (statuses.length === 0 || statuses.every((status) => status === 'todo')) {
    return '待开始';
  }
  if (statuses.every((status) => status === 'done' || status === 'accepted')) {
    return '已完成';
  }
  return '进行中';
}

export function ProjectList({
  onNavigate,
  onOpenProjectLog,
  onStartHandoffDemo,
  extraProject = null,
  onOpenExtraProject,
}: ProjectListProps) {
  const seatflow = getSeatflowProjectCard();
  const me = getMemberById(useActiveMemberId());

  const campusName = projectTemplate.name;
  const campusMembers = CAMPUS_MEMBER_IDS.map((id) => getMemberById(id)).filter(
    (member) => member != null,
  );
  const progressNodes =
    getSessionBlueprintNodes().length > 0
      ? getSessionBlueprintNodes()
      : campusMarketplaceDataset.blueprintNodes;
  const campusStatus = projectProgressLabel(
    progressNodes.map((node) => node.status),
  );

  const openBlueprint = () => {
    onStartHandoffDemo();
  };

  const openSeatflow = () => {
    onOpenProjectLog(seatflow.id);
  };

  return (
    <StudentShell place="projects" onNavigate={onNavigate}>
      <main className="pl-main" data-home-projects="true">
        <p className="pl-kicker">{COURSE_NAME}</p>
        <div className="pl-head">
          <h1>所有项目</h1>
        </div>

        <div className="pl-grid">
          <button
            type="button"
            className="pl-card"
            onClick={openBlueprint}
            aria-label={`打开项目 ${campusName}`}
          >
            <div className="pl-shot pl-shot-campus" aria-hidden="true">
              <span />
              <i />
              <b />
            </div>
            <h2 className="pl-name">{campusName}</h2>
            <p
              className={`pl-status${
                campusStatus === '已完成'
                  ? ' is-done'
                  : campusStatus === '进行中'
                    ? ' is-live'
                    : ''
              }`}
            >
              <i />
              {campusStatus}
            </p>
            <div className="pl-foot">
              <span className="pl-members">
                <span className="pl-faces" aria-hidden="true">
                  {campusMembers.slice(0, 4).map((member) => (
                    <span key={member.id} className="pl-face">
                      {member.initials.slice(0, 1)}
                    </span>
                  ))}
                </span>
                <span>
                  {campusMembers
                    .slice(0, 3)
                    .map((member) => member.name)
                    .join('、')}
                  {campusMembers.length > 3
                    ? ` 等 ${campusMembers.length} 人`
                    : ''}
                </span>
              </span>
            </div>
          </button>

          <button
            type="button"
            className="pl-card"
            onClick={openSeatflow}
            aria-label={`打开项目 ${seatflow.name}`}
          >
            <div className="pl-shot pl-shot-seat" aria-hidden="true">
              <span />
              <i />
              <b />
            </div>
            <h2 className="pl-name">{seatflow.name}</h2>
            <p className="pl-status is-done">
              <i />
              {seatflow.statusLabel}
            </p>
            <div className="pl-foot">
              <span className="pl-members">
                <span className="pl-faces" aria-hidden="true">
                  {seatflow.members.slice(0, 4).map((member) => (
                    <span key={member.memberId} className="pl-face">
                      {faceMark(member.displayName)}
                    </span>
                  ))}
                </span>
                <span>
                  {seatflow.members
                    .slice(0, 2)
                    .map((member) => member.displayName)
                    .join('、')}
                  {seatflow.memberCount > 2
                    ? ` 等 ${seatflow.memberCount} 人`
                    : ''}
                </span>
              </span>
            </div>
          </button>

          {extraProject ? (
            <button
              type="button"
              className="pl-card"
              onClick={onOpenExtraProject}
              aria-label={`打开项目 ${extraProject.name}`}
            >
              <div className="pl-shot pl-shot-extra" aria-hidden="true">
                <span />
                <i />
                <b />
              </div>
              <h2 className="pl-name">{extraProject.name}</h2>
              <p className="pl-status">
                <i />
                {projectProgressLabel(extraProject.statuses)}
              </p>
              <div className="pl-foot">
                <span className="pl-members">
                  <span>新项目 · 独立于校园二手交易平台</span>
                </span>
              </div>
            </button>
          ) : null}

          <button
            type="button"
            className="pl-card pl-card-new"
            disabled
            title="演示未开放"
            aria-label="新建项目（演示未开放）"
          >
            <span className="pl-card-new-inner" aria-hidden="true">
              <Plus size={22} strokeWidth={1.75} />
              <span>新建项目</span>
            </span>
          </button>
        </div>

        <div className="pl-user" aria-label="当前用户">
          <span className="pl-user-face" aria-hidden="true">
            {me?.initials?.slice(0, 1) ?? 'U'}
          </span>
          <span>{me?.name ?? '当前用户'}</span>
        </div>
      </main>
    </StudentShell>
  );
}
