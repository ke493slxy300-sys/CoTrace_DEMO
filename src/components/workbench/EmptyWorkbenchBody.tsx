import { Bot, FolderGit2, FileCode2 } from 'lucide-react';
import type { WorkbenchContext } from '../../data/workbenchContext';
import { formatWorkbenchOwnerLabel } from '../../data/workbenchContext';

type EmptyWorkbenchBodyProps = {
  projectName: string;
  context: WorkbenchContext;
  viewerName: string;
};

export function EmptyWorkbenchBody({
  projectName,
  context,
  viewerName,
}: EmptyWorkbenchBodyProps) {
  const ownerLabel = formatWorkbenchOwnerLabel(context.ownerId);
  const ownerIsYou =
    context.ownerId != null && ownerLabel === viewerName
      ? ' · 你'
      : '';

  return (
    <main className="workbench workbench-empty" aria-label="空白个人工作区">
      <aside className="panel sidebar-panel" aria-label="代码仓">
        <div className="panel-header">
          <h2>代码仓</h2>
        </div>
        <div className="panel-body workbench-empty-panel">
          <div className="workbench-empty-block">
            <FolderGit2 size={22} strokeWidth={1.5} aria-hidden="true" />
            <strong>暂无内容</strong>
            <p>该任务目前还没有代码仓内容。</p>
          </div>
        </div>
      </aside>

      <section className="panel editor-panel" aria-label="代码文件">
        <div className="panel-header">
          <h2>代码文件</h2>
        </div>
        <div className="panel-body workbench-empty-panel">
          <div className="workbench-empty-meta">
            <div>
              <span>项目</span>
              <strong>{projectName}</strong>
            </div>
            <div>
              <span>任务</span>
              <strong>{context.nodeTitle}</strong>
            </div>
            <div>
              <span>负责人</span>
              <strong>
                {ownerLabel}
                {ownerIsYou}
              </strong>
            </div>
          </div>
          <div className="workbench-empty-block is-center">
            <FileCode2 size={28} strokeWidth={1.5} aria-hidden="true" />
            <strong>暂无内容</strong>
            <p>该任务目前还没有代码仓内容。</p>
            <p>代码文件将在关联项目文件后显示。</p>
          </div>
        </div>
      </section>

      <aside className="panel right-panel" aria-label="编程 Agent">
        <div className="panel-header">
          <h2>编程 Agent</h2>
          <span className="badge">未启动</span>
        </div>
        <div className="panel-body workbench-empty-panel">
          <div className="workbench-empty-block">
            <Bot size={22} strokeWidth={1.5} aria-hidden="true" />
            <strong>等待用户发起对话</strong>
            <p>编程 Agent 尚未启动，请由项目负责人发起对话。</p>
            <p className="workbench-empty-hint">
              本阶段仅展示状态，不会自动生成代码或启动 Agent。
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
