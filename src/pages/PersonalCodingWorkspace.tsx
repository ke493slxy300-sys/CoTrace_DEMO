import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CodeEditorMock } from "../components/coding/CodeEditorMock";
import { CodingAgentPanel } from "../components/coding/CodingAgentPanel";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTitleBar } from "../components/layout/PageTitleBar";
import { FileNav } from "../components/sidebar/FileNav";
import { getCodingAgentPreset } from "../data/codingAgent";
import { getPresetFilesForTask } from "../data/files";
import { getExperienceMember, getMemberById } from "../data/members";
import { resolveWorkbenchContext } from "../data/workbenchContext";
import {
  backendBaselineSnapshot,
  findCodeFileByPath,
  getBackendDefaultFileId,
} from "../datasets/built-in/campus-marketplace/content/backendPack";
import { BACKEND_APP_NODE_ID } from "../datasets/built-in/campus-marketplace/content/packIds";
import type { BlueprintNode, CodeFile, CourseProject } from "../types";

export type CodingWorkspaceSession = {
  files: CodeFile[];
  activeFileId: string | null;
};

type PersonalCodingWorkspaceProps = {
  project: CourseProject;
  node: BlueprintNode;
  ownerId: string;
  /** 从提交页返回时恢复 */
  restoreSession?: CodingWorkspaceSession | null;
  onBack: () => void;
  onSubmitTask: (session: CodingWorkspaceSession) => void;
};

export function PersonalCodingWorkspace({
  project,
  node,
  ownerId,
  restoreSession = null,
  onBack,
  onSubmitTask,
}: PersonalCodingWorkspaceProps) {
  const me = getExperienceMember();
  const context = useMemo(
    () => resolveWorkbenchContext(node, project),
    [node, project],
  );
  const agentPreset = useMemo(() => getCodingAgentPreset(node.id), [node.id]);
  const initialFiles = useMemo(() => getPresetFilesForTask(node.id), [node.id]);
  const [files, setFiles] = useState<CodeFile[]>(
    () => restoreSession?.files ?? initialFiles,
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    if (restoreSession?.activeFileId) return restoreSession.activeFileId;
    if (node.id === BACKEND_APP_NODE_ID) {
      return getBackendDefaultFileId(initialFiles, backendBaselineSnapshot);
    }
    return initialFiles[0]?.id ?? null;
  });

  useEffect(() => {
    if (!restoreSession) return;
    setFiles(restoreSession.files);
    setActiveFileId(restoreSession.activeFileId);
  }, [restoreSession]);

  const activeFile = files.find((file) => file.id === activeFileId) ?? null;
  const owner = getMemberById(ownerId);
  const ownerLabel = owner?.name ?? "待分配";
  const isEmptyRepo = context.repositoryStatus === "empty";

  function openFileByPath(path: string) {
    const hit = findCodeFileByPath(files, path);
    if (hit) setActiveFileId(hit.id);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <PageTitleBar
        title={node.name}
        subtitle={`${project.name} · 个人编码工作区 · 负责人 ${ownerLabel}${
          ownerId === me.id ? " · 你" : ""
        }`}
        leading={
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            返回任务蓝图
          </button>
        }
      />

      <main className="workbench" aria-label="个人编码工作区">
        <aside className="panel sidebar-panel" aria-label="代码仓文件">
          {isEmptyRepo ? (
            <>
              <div className="panel-header">
                <h2>代码仓</h2>
              </div>
              <div className="panel-body coding-repo-empty">
                <strong>暂无内容</strong>
                <p>该任务目前还没有代码仓内容。</p>
              </div>
            </>
          ) : (
            <FileNav
              files={files}
              activeFileId={activeFileId}
              taskId={node.id}
              onSelectFile={setActiveFileId}
              onFilesAdded={(incoming) => {
                setFiles((prev) => [...prev, ...incoming]);
              }}
            />
          )}
        </aside>

        <CodeEditorMock
          file={activeFile}
          empty={isEmptyRepo}
          onSubmitTask={() => onSubmitTask({ files, activeFileId })}
        />

        <CodingAgentPanel
          messages={isEmptyRepo ? [] : agentPreset.messages}
          inputDisabled
          onFileRefClick={openFileByPath}
        />
      </main>

      <footer className="app-footer">
        <span>
          {node.id === BACKEND_APP_NODE_ID
            ? "Content Pack · baseline 代码 + 原始 Agent 对话 · 不接入真实大模型"
            : "个人编码工作区骨架 · 本地预置 · 不接入真实大模型"}
        </span>
        <span>当前成员：{me.name}</span>
      </footer>
    </div>
  );
}
