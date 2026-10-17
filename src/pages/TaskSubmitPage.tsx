import { useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { PageTitleBar } from '../components/layout/PageTitleBar';
import { CodeViewer } from '../components/editor/CodeViewer';
import { BACKEND_APP_NODE_ID } from '../demoContent/packIds';
import {
  saveSubmission,
  type DemoSubmission,
  type DemoSubmissionTraceCard,
} from '../data/demoSubmission';
import { getExperienceMember, getMemberById } from '../data/members';
import { getSubmitTraceCandidates } from '../data/submitTraceCandidates';
import type { BlueprintNode, CodeFile, CourseProject } from '../types';

type SubmitStep = 1 | 2 | 3;

export type TaskSubmitSuccessOptions = {
  /** 勾选后将当前节点状态刷新为「已完成」 */
  markTaskComplete: boolean;
};

type TaskSubmitPageProps = {
  project: CourseProject;
  node: BlueprintNode;
  files: CodeFile[];
  initialActiveFileId: string | null;
  onBackToWorkspace: (activeFileId: string | null) => void;
  onBackToBlueprint: () => void;
  /** 确认写入后进入对应节点详情（长期入口） */
  onSubmitSuccess: (options: TaskSubmitSuccessOptions) => void;
};

export function TaskSubmitPage({
  project,
  node,
  files,
  initialActiveFileId,
  onBackToWorkspace,
  onBackToBlueprint,
  onSubmitSuccess,
}: TaskSubmitPageProps) {
  const me = getExperienceMember();
  const owner = getMemberById(node.ownerId ?? me.id);
  const ownerLabel = owner?.name ?? me.name;
  const isBackendNode = node.id === BACKEND_APP_NODE_ID;
  const candidates = useMemo(
    () => getSubmitTraceCandidates(node.id),
    [node.id],
  );

  const [step, setStep] = useState<SubmitStep>(1);
  const [description, setDescription] = useState(
    () => `完善「${node.name}」相关实现，供团队在节点详情中只读查看。`,
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(
    () => initialActiveFileId ?? files[0]?.id ?? null,
  );
  /** 不自动公开：默认不勾选，由用户自主选择 */
  const [selectedTraceIds, setSelectedTraceIds] = useState<string[]>([]);
  const [markTaskComplete, setMarkTaskComplete] = useState(false);

  const activeFile = files.find((file) => file.id === activeFileId) ?? null;
  const selectedTraces = candidates.filter((card) =>
    selectedTraceIds.includes(card.id),
  );

  function toggleTrace(id: string) {
    setSelectedTraceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleConfirmWrite() {
    if (files.length === 0) return;
    const submission: DemoSubmission = {
      id: `demo-sub-${node.id}-${Date.now()}`,
      projectId: project.id,
      nodeId: node.id,
      taskId: node.id,
      author: me.name,
      description: description.trim(),
      codeFiles: files.map((file) => ({ ...file })),
      traceCards: selectedTraces.map(cloneTrace),
      createdAt: new Date().toISOString(),
    };
    saveSubmission(submission);
    onSubmitSuccess({ markTaskComplete });
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <PageTitleBar
        title="提交任务"
        subtitle={`${project.name} · ${node.name} · 写入队友可见快照`}
        leading={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onBackToWorkspace(activeFileId)}
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            返回个人工作区
          </button>
        }
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onBackToBlueprint}
          >
            返回工作蓝图
          </button>
        }
      />

      <nav className="submit-steps" aria-label="提交进度">
        <StepPill index={1} label="提交说明" active={step === 1} done={step > 1} />
        <StepPill index={2} label="选择公开溯源" active={step === 2} done={step > 2} />
        <StepPill index={3} label="预览确认" active={step === 3} done={false} />
      </nav>

      {step === 1 ? (
        <main className="submit-step-panel" aria-label="步骤一：提交说明">
          <section className="panel submit-desc-card">
            <div className="panel-header">
              <h2>本次提交说明</h2>
            </div>
            <div className="panel-body submit-desc-body">
              <dl className="submit-meta-grid">
                <div>
                  <dt>任务 / 节点</dt>
                  <dd>{node.name}</dd>
                </div>
                <div>
                  <dt>负责人</dt>
                  <dd>
                    {ownerLabel}
                    {node.ownerId === me.id ? ' · 你' : ''}
                  </dd>
                </div>
                <div>
                  <dt>项目</dt>
                  <dd>{project.name}</dd>
                </div>
              </dl>
              <label className="submit-field">
                <span>提交说明</span>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="简要说明本次提交给团队查看的内容与边界"
                />
              </label>
              <p className="submit-hint">
                {isBackendNode
                  ? '后端 API 节点详情提交前为空；确认后写入本次工作区代码，并可选公开主题溯源。'
                  : '代码仓将随提交一并写入节点详情；下一步只选择允许公开的 AI 主题溯源卡片，不会公开完整原始对话。'}
              </p>
              <div className="submit-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onBackToWorkspace(activeFileId)}
                >
                  返回个人工作区
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    description.trim().length === 0 || files.length === 0
                  }
                  onClick={() => setStep(2)}
                >
                  下一步
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : null}

      {step === 2 ? (
        <main className="workbench submit-select-layout" aria-label="步骤二：选择公开内容">
          <aside className="panel sidebar-panel" aria-label="将提交的代码仓">
            <div className="panel-header">
              <h2>代码仓</h2>
              <span className="panel-meta">全部写入 · 不可取消</span>
            </div>
            <div className="panel-body node-file-list">
              {files.length === 0 ? (
                <p className="blueprint-detail-note">暂无代码文件，无法提交。</p>
              ) : (
                <ul>
                  {files.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className={`node-file-item${
                          file.id === activeFileId ? ' is-active' : ''
                        }`}
                        onClick={() => setActiveFileId(file.id)}
                      >
                        {file.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="panel editor-panel" aria-label="代码预览">
            <CodeViewer
              file={activeFile}
              selection={null}
              ideChrome
              onSelectionChange={() => undefined}
            />
          </section>

          <aside className="panel right-panel" aria-label="选择公开溯源">
            <div className="panel-header">
              <h2>公开溯源</h2>
              <span className="badge">自主勾选</span>
            </div>
            <div className="panel-body submit-trace-pick-body">
              <p className="submit-hint">
                以下由项目理解 Agent 整理的主题卡。勾选后随本次提交公开；
                <strong>不会公开完整原始对话</strong>。
              </p>
              {candidates.length === 0 ? (
                <p className="blueprint-detail-note">
                  当前节点暂无可选主题溯源卡，可直接进入预览（仅提交代码）。
                </p>
              ) : (
                <ul className="submit-trace-pick-list">
                  {candidates.map((card) => {
                    const checked = selectedTraceIds.includes(card.id);
                    return (
                      <li key={card.id}>
                        <label
                          className={`submit-trace-pick-card${
                            checked ? ' is-checked' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTrace(card.id)}
                          />
                          <span className="submit-trace-pick-title">
                            {card.title}
                          </span>
                          <span className="submit-trace-pick-summary">
                            {card.fragmentSummary}
                          </span>
                          <span className="submit-trace-pick-line">
                            <strong>人的理解：</strong>
                            {card.humanUnderstanding}
                          </span>
                          <span className="submit-trace-pick-line">
                            <strong>人的决定：</strong>
                            {card.humanDecision}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="submit-actions is-sticky">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(1)}
                >
                  上一步
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={files.length === 0}
                  onClick={() => setStep(3)}
                >
                  下一步
                </button>
              </div>
            </div>
          </aside>
        </main>
      ) : null}

      {step === 3 ? (
        <main className="submit-step-panel" aria-label="步骤三：预览确认">
          <section className="panel submit-preview-card">
            <div className="panel-header">
              <h2>提交预览（队友将看到的结构）</h2>
              <span className="badge">未写入</span>
            </div>
            <div className="panel-body submit-preview-body">
              <div className="submit-preview-block">
                <h3>提交说明</h3>
                <p>{description.trim()}</p>
              </div>
              <div className="submit-preview-block">
                <h3>代码文件（{files.length}）</h3>
                <ul className="submit-preview-files">
                  {files.map((file) => (
                    <li key={file.id}>{file.name}</li>
                  ))}
                </ul>
              </div>
              <div className="submit-preview-block">
                <h3>公开主题溯源（{selectedTraces.length}）</h3>
                {selectedTraces.length === 0 ? (
                  <p className="submit-hint">本次不公开任何主题溯源卡。</p>
                ) : (
                  <ul className="submit-preview-traces">
                    {selectedTraces.map((card) => (
                      <li key={card.id}>
                        <strong>{card.title}</strong>
                        <span>{card.fragmentSummary}</span>
                        <span>
                          <em>理解</em> {card.humanUnderstanding}
                        </span>
                        <span>
                          <em>决定</em> {card.humanDecision}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="submit-complete-check">
                <input
                  type="checkbox"
                  checked={markTaskComplete}
                  onChange={(event) =>
                    setMarkTaskComplete(event.target.checked)
                  }
                />
                <span>
                  确认本任务已完成
                  {isBackendNode
                    ? '（勾选后，蓝图中「后端 API」节点状态变为已完成）'
                    : '（勾选后，蓝图中该节点状态变为已完成）'}
                </span>
              </label>
              <p className="submit-hint">
                确认前不会写入本地 Demo 数据。确认后将进入节点详情；刷新后仍可查看。
              </p>
              <div className="submit-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(2)}
                >
                  返回修改
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={files.length === 0}
                  onClick={handleConfirmWrite}
                >
                  <Check size={15} strokeWidth={1.5} aria-hidden="true" />
                  确认写入节点详情
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : null}

      <footer className="app-footer">
        <span>提交闭环 Demo · 无真实后端 · 不接真模型</span>
        <span>当前成员：{me.name}</span>
      </footer>
    </div>
  );
}

function StepPill({
  index,
  label,
  active,
  done,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`submit-step-pill${active ? ' is-active' : ''}${
        done ? ' is-done' : ''
      }`}
    >
      <span className="submit-step-index">{index}</span>
      {label}
    </span>
  );
}

function cloneTrace(card: DemoSubmissionTraceCard): DemoSubmissionTraceCard {
  return { ...card };
}
