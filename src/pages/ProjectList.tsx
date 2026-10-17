import { BookOpen, FolderKanban, Plus } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import type { CourseProject } from '../types';
import { COURSE_NAME } from '../data/project';
import { getExperienceMember } from '../data/members';
import { getSeatflowProjectCard } from '../data/projectLogs';

type ProjectListProps = {
  project: CourseProject | null;
  onOpenRegister: () => void;
  onOpenProject: () => void;
  onOpenProjectLog: (projectId: string) => void;
};

export function ProjectList({
  project,
  onOpenRegister,
  onOpenProject,
  onOpenProjectLog,
}: ProjectListProps) {
  const me = getExperienceMember();
  const seatflow = getSeatflowProjectCard();

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="page-title-bar">
        <div>
          <h1>项目列表</h1>
          <p className="subtitle">
            {COURSE_NAME} · 体验角色 {me.name}（{me.roleLabel}）
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenRegister}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          新建项目
        </button>
      </div>

      <div className="project-list-page">
        <div className="project-list-grid">
          {project?.created ? (
            <button
              type="button"
              className="project-card"
              onClick={onOpenProject}
            >
              <div className="project-card-icon" aria-hidden="true">
                <FolderKanban size={20} strokeWidth={1.5} />
              </div>
              <div className="project-card-body">
                <h2>{project.name}</h2>
                <p>{project.goal}</p>
                <div className="project-card-meta">
                  <span>{project.courseName}</span>
                  <span>已生成任务蓝图</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="project-list-empty is-inline">
              <FolderKanban size={24} strokeWidth={1.5} aria-hidden="true" />
              <strong>还没有进行中的课程项目</strong>
              <p>
                点击「新建项目」创建《校园二手交易平台》并生成任务蓝图。下方可查看虚构历史项目日志。
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenRegister}
              >
                新建项目
              </button>
            </div>
          )}

          <article className="project-card is-completed is-history">
            <div className="project-card-icon is-history" aria-hidden="true">
              <BookOpen size={20} strokeWidth={1.5} />
            </div>
            <div className="project-card-body">
              <div className="project-card-title-row">
                <h2>
                  {seatflow.name}
                  <span className="project-card-subtitle">
                    {seatflow.subtitle}
                  </span>
                </h2>
                <span className="status-chip status-node-done">
                  {seatflow.statusLabel}
                </span>
              </div>
              <p>{seatflow.summary}</p>
              <p className="project-card-demo-notice">{seatflow.demoNotice}</p>
              <div className="project-card-meta">
                <span>{seatflow.dateRange}</span>
                <span>参与 {seatflow.memberCount} 人</span>
                <span>决策 {seatflow.logStats.decisionCount}</span>
                <span>项目经验 {seatflow.logStats.experienceCount}</span>
              </div>
              <div className="project-card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onOpenProjectLog(seatflow.id)}
                >
                  {seatflow.primaryAction.label}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer className="app-footer">
        <span>会话内演示数据 · SeatFlow 为虚构历史项目</span>
        <span>当前视角：{me.name}</span>
      </footer>
    </div>
  );
}
