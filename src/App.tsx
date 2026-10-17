import { useCallback, useEffect, useState } from 'react';
import { AiBlueprintOverlay } from './components/project/AiBlueprintOverlay';
import { ProjectRegisterModal } from './components/project/ProjectRegisterModal';
import { Toast } from './components/common/Toast';
import {
  appendNodeEditHistory,
  createBlankBlueprintNode,
  createInitialBlueprintNodes,
  formatBlueprintOwnerLabel,
} from './data/blueprint';
import { setSessionBlueprintNodes } from './data/blueprintSession';
import { mergeDemoCastCollaborators } from './data/collaborators';
import { DEMO_LOCKED_MESSAGE } from './data/demoLock';
import { ensureDemoStorageMigrated } from './data/demoStorage';
import { rehydrateCollaborationSeeds } from './data/nodeCollaborationStore';
import { projectTemplate } from './data/project';
import { clearAllSubmissions } from './data/demoSubmission';
import { EXPERIENCE_MEMBER_ID } from './data/members';
import {
  buildEntryToPersonalCoding,
  workspaceEntryToView,
  type WorkspaceEntry,
} from './data/workspaceEntry';
import { BlueprintNodeDetailPage } from './pages/BlueprintNodeDetailPage';
import { BlueprintPage } from './pages/BlueprintPage';
import {
  PersonalCodingWorkspace,
  type CodingWorkspaceSession,
} from './pages/PersonalCodingWorkspace';
import { ProjectList } from './pages/ProjectList';
import { ProjectLogPage } from './pages/ProjectLogPage';
import { TaskSubmitPage } from './pages/TaskSubmitPage';
import type { BlueprintNode, CourseProject, ProjectCollaborator } from './types';

type AppView =
  | 'project-list'
  | 'blueprint'
  | 'personal-coding-workspace'
  | 'blueprint-node-detail'
  | 'task-submit'
  | 'project-log';

const AI_OVERLAY_MS = 2200;

export default function App() {
  const [view, setView] = useState<AppView>('project-list');
  const [project, setProject] = useState<CourseProject | null>(null);
  const [blueprintNodes, setBlueprintNodes] = useState<BlueprintNode[]>([]);
  const [workspaceEntry, setWorkspaceEntry] = useState<WorkspaceEntry | null>(
    null,
  );
  const [codingSession, setCodingSession] =
    useState<CodingWorkspaceSession | null>(null);
  const [blueprintFocusNodeId, setBlueprintFocusNodeId] = useState<
    string | null
  >(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** schema 迁移后重载协作种子（不覆盖同 id 用户数据） */
  useEffect(() => {
    ensureDemoStorageMigrated();
    rehydrateCollaborationSeeds();
  }, []);

  useEffect(() => {
    if (!aiOpen) return;
    const timer = window.setTimeout(() => {
      setAiOpen(false);
      setView('blueprint');
    }, AI_OVERLAY_MS);
    return () => window.clearTimeout(timer);
  }, [aiOpen]);

  useEffect(() => {
    setSessionBlueprintNodes(blueprintNodes);
  }, [blueprintNodes]);

  const handleCreate = useCallback((collaborators: ProjectCollaborator[]) => {
    const merged = mergeDemoCastCollaborators(collaborators);
    const nextProject: CourseProject = {
      ...projectTemplate,
      created: true,
      collaborators: merged,
    };
    /** Demo 项目 id 固定，须清空旧提交，否则后端节点会直接露出上次快照 */
    clearAllSubmissions();
    const nodes = createInitialBlueprintNodes(nextProject.id, merged);
    setProject(nextProject);
    setBlueprintNodes(nodes);
    setWorkspaceEntry(null);
    setCodingSession(null);
    setRegisterOpen(false);
    setAiOpen(true);
  }, []);

  const handleOpenBlueprint = useCallback(() => {
    if (!project?.created || blueprintNodes.length === 0) return;
    setView('blueprint');
  }, [project, blueprintNodes.length]);

  const handleAddBlankNode = useCallback(() => {
    if (!project) return '';
    let blankId = '';
    setBlueprintNodes((current) => {
      const offset = current.filter((node) => node.isBlank).length;
      const blank = createBlankBlueprintNode(project.id, {
        x: 64 + offset * 24,
        y: 420 + offset * 24,
      });
      blankId = blank.id;
      return [...current, blank];
    });
    setToast('已新增空白节点，可在右侧指定负责人。');
    return blankId;
  }, [project]);

  const handleAssignOwner = useCallback(
    (nodeId: string, ownerId: string | null) => {
      setBlueprintNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const label = formatBlueprintOwnerLabel(ownerId);
          const next = appendNodeEditHistory(
            { ...node, ownerId },
            ownerId
              ? `负责人修改：指定负责人为 ${label}。`
              : '负责人修改：清除负责人，状态恢复为待分配。',
          );
          return next;
        }),
      );
    },
    [],
  );

  const handleRenameBlankNode = useCallback((nodeId: string, name: string) => {
    let locked = false;
    setBlueprintNodes((current) => {
      const target = current.find((node) => node.id === nodeId);
      if (!target) return current;
      if (!target.isBlank) {
        locked = true;
        return current;
      }
      return current.map((node) =>
        node.id === nodeId ? { ...node, name } : node,
      );
    });
    if (locked) setToast(DEMO_LOCKED_MESSAGE);
  }, []);

  const handleDeleteBlankNode = useCallback((nodeId: string) => {
    let deleted = false;
    let locked = false;
    setBlueprintNodes((current) => {
      const target = current.find((node) => node.id === nodeId);
      if (!target) return current;
      if (!target.isBlank) {
        locked = true;
        return current;
      }
      deleted = true;
      return current.filter((node) => node.id !== nodeId);
    });
    if (locked) {
      setToast(DEMO_LOCKED_MESSAGE);
    } else if (deleted) {
      setToast('已删除空白节点。');
    }
  }, []);

  const handleOpenWorkspace = useCallback((entry: WorkspaceEntry) => {
    setCodingSession(null);
    setWorkspaceEntry(entry);
    setView(workspaceEntryToView(entry));
  }, []);

  const handleBackToBlueprint = useCallback(() => {
    const focusId = workspaceEntry?.nodeId ?? null;
    setBlueprintFocusNodeId(focusId);
    setWorkspaceEntry(null);
    setCodingSession(null);
    setView('blueprint');
  }, [workspaceEntry?.nodeId]);

  const handleOpenTaskSubmit = useCallback((session: CodingWorkspaceSession) => {
    setCodingSession(session);
    setView('task-submit');
  }, []);

  const handleBackFromTaskSubmit = useCallback(
    (activeFileId: string | null) => {
      setCodingSession((prev) =>
        prev
          ? { ...prev, activeFileId }
          : { files: [], activeFileId },
      );
      setView('personal-coding-workspace');
    },
    [],
  );

  /** 确认提交后：可选标记已完成，并直接进入对应节点详情 */
  const handleSubmitSuccessToNodeDetail = useCallback(
    (options: { markTaskComplete: boolean }) => {
      if (!workspaceEntry || workspaceEntry.type !== 'personal-coding') return;
      const nodeId = workspaceEntry.nodeId;
      if (options.markTaskComplete) {
        setBlueprintNodes((current) =>
          current.map((node) =>
            node.id === nodeId ? { ...node, status: 'done' } : node,
          ),
        );
      }
      setCodingSession(null);
      setWorkspaceEntry({
        type: 'blueprint-detail',
        projectId: workspaceEntry.projectId,
        nodeId,
      });
      setView('blueprint-node-detail');
    },
    [workspaceEntry],
  );

  const activeNode =
    workspaceEntry == null
      ? null
      : (blueprintNodes.find((node) => node.id === workspaceEntry.nodeId) ??
        null);

  /** 节点详情 → 负责人个人工作区 */
  const handleContinueWorkFromDetail = useCallback(() => {
    if (
      !project ||
      !activeNode ||
      !workspaceEntry ||
      workspaceEntry.type !== 'blueprint-detail'
    ) {
      return;
    }
    if (activeNode.ownerId !== EXPERIENCE_MEMBER_ID) return;
    setCodingSession(null);
    setWorkspaceEntry(buildEntryToPersonalCoding(project, activeNode));
    setView('personal-coding-workspace');
  }, [project, activeNode, workspaceEntry]);

  useEffect(() => {
    if (
      (view === 'personal-coding-workspace' ||
        view === 'blueprint-node-detail' ||
        view === 'task-submit') &&
      (!activeNode || !project)
    ) {
      setWorkspaceEntry(null);
      setView(project ? 'blueprint' : 'project-list');
    }
  }, [view, activeNode, project]);

  return (
    <>
      {view === 'task-submit' &&
      project &&
      activeNode &&
      workspaceEntry?.type === 'personal-coding' &&
      codingSession &&
      codingSession.files.length > 0 ? (
        <TaskSubmitPage
          project={project}
          node={activeNode}
          files={codingSession.files}
          initialActiveFileId={codingSession.activeFileId}
          onBackToWorkspace={handleBackFromTaskSubmit}
          onBackToBlueprint={handleBackToBlueprint}
          onSubmitSuccess={handleSubmitSuccessToNodeDetail}
        />
      ) : view === 'personal-coding-workspace' &&
        project &&
        activeNode &&
        workspaceEntry?.type === 'personal-coding' ? (
        <PersonalCodingWorkspace
          project={project}
          node={activeNode}
          ownerId={workspaceEntry.ownerId}
          restoreSession={codingSession}
          onBack={handleBackToBlueprint}
          onSubmitTask={handleOpenTaskSubmit}
        />
      ) : view === 'blueprint-node-detail' &&
        project &&
        activeNode &&
        workspaceEntry?.type === 'blueprint-detail' ? (
        <BlueprintNodeDetailPage
          project={project}
          node={activeNode}
          nodes={blueprintNodes}
          onBack={handleBackToBlueprint}
          onContinueWork={handleContinueWorkFromDetail}
        />
      ) : view === 'blueprint' && project ? (
        <BlueprintPage
          project={project}
          nodes={blueprintNodes}
          preferredSelectedNodeId={blueprintFocusNodeId}
          onBack={() => setView('project-list')}
          onMoveNode={(nodeId, x, y) => {
            setBlueprintNodes((current) =>
              current.map((node) =>
                node.id === nodeId ? { ...node, x, y } : node,
              ),
            );
          }}
          onAddBlankNode={handleAddBlankNode}
          onAssignOwner={handleAssignOwner}
          onRenameBlankNode={handleRenameBlankNode}
          onDeleteBlankNode={handleDeleteBlankNode}
          onOpenWorkspace={handleOpenWorkspace}
          onToast={setToast}
        />
      ) : view === 'project-log' ? (
        <ProjectLogPage onBack={() => setView('project-list')} />
      ) : (
        <ProjectList
          project={project}
          onOpenRegister={() => setRegisterOpen(true)}
          onOpenProject={handleOpenBlueprint}
          onOpenProjectLog={() => setView('project-log')}
        />
      )}

      <ProjectRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreate={handleCreate}
      />

      <AiBlueprintOverlay
        open={aiOpen}
        collaborators={project?.collaborators}
      />

      <Toast message={toast} />
    </>
  );
}
