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
import {
  createLockedExperienceCollaborator,
  mergeDemoCastCollaborators,
} from './data/collaborators';
import { DEMO_LOCKED_MESSAGE } from './data/demoLock';
import { ensureDemoStorageMigrated } from './data/demoStorage';
import { rehydrateCollaborationSeeds } from './data/nodeCollaborationStore';
import { projectTemplate } from './data/project';
import { clearAllSubmissions } from './data/demoSubmission';
import { EXPERIENCE_MEMBER_ID } from './data/members';
import {
  applyDeliveryToBlueprint,
  markIntegrationInProgress,
} from './data/handoffBlueprint';
import { getDemoRole, setDemoRole } from './data/demoRoleStore';
import { rehydrateDeliveryStore } from './data/deliveryStore';
import { rehydrateProcessEventStore } from './data/processEventStore';
import { rehydrateAcceptanceStore } from './data/acceptanceStore';
import {
  buildEntryToPersonalCoding,
  workspaceEntryToView,
  type WorkspaceEntry,
} from './data/workspaceEntry';
import {
  HANDOFF_NODE_BACKEND,
  HANDOFF_PROJECT_ID,
  HANDOFF_PROJECT_NAME,
} from './data/handoffDemoSeed';
import {
  getSeatflowProjectCard,
  SEATFLOW_PROJECT_ID,
} from './data/projectLogs';
import { BlueprintNodeDetailPage } from './pages/BlueprintNodeDetailPage';
import { BlueprintPage } from './pages/BlueprintPage';
import {
  PersonalCodingWorkspace,
  type CodingWorkspaceSession,
} from './pages/PersonalCodingWorkspace';
import { ProjectList } from './pages/ProjectList';
import { ProjectLogPage } from './pages/ProjectLogPage';
import { TaskSubmitPage } from './pages/TaskSubmitPage';
import { DeliveryPublishPage } from './pages/DeliveryPublishPage';
import { DeliveryReceivePage } from './pages/DeliveryReceivePage';
import { ClassroomGuidePage } from './pages/teacher/ClassroomGuidePage';
import { PublishDeliveryPage } from './next/student/PublishDeliveryPage';
import { ReceiveDeliveryPage } from './next/student/ReceiveDeliveryPage';
import {
  ProjectSpaceUnavailable,
  WorkBlueprintPage,
} from './next/student/WorkBlueprintPage';
import { ProjectMemoryPage } from './next/student/ProjectMemoryPage';
import type { StudentPlace } from './next/student/StudentShell';
import { CourseGuidePage } from './next/teacher/CourseGuidePage';
import { StageReportPage } from './next/teacher/StageReportPage';
import { AcceptancePage } from './next/teacher/AcceptancePage';
import type { TeacherPlace } from './next/teacher/TeacherShell';
import type { BlueprintNode, CourseProject, ProjectCollaborator } from './types';

type AppView =
  | 'project-list'
  | 'blueprint'
  | 'personal-coding-workspace'
  | 'blueprint-node-detail'
  | 'task-submit'
  | 'project-log'
  | 'delivery-publish'
  | 'delivery-receive'
  | 'classroom-guide'
  | 'group-stage-report'
  | 'project-acceptance'
  | 'next-publish'
  | 'next-receive'
  | 'next-blueprint'
  | 'next-guide'
  | 'next-log';

const AI_OVERLAY_MS = 2200;

function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryPart = ''] = raw.split('?');
  return { path: pathPart || '/', query: new URLSearchParams(queryPart) };
}

function viewFromHash(hash: string): AppView | null {
  const { path } = parseHash(hash);
  if (path === '/next/projects') return 'project-list';
  if (path === '/next/blueprint') return 'next-blueprint';
  if (path === '/next/publish') return 'next-publish';
  if (path === '/next/receive') return 'next-receive';
  if (path === '/next/log') return 'next-log';
  if (path === '/next/guide') return 'next-guide';
  if (path === '/next/stage') return 'group-stage-report';
  if (path === '/next/acceptance') return 'project-acceptance';
  return null;
}

function projectIdFromHash(hash: string): string {
  const { query } = parseHash(hash);
  const fromQuery = query.get('project');
  if (fromQuery) return fromQuery;
  return HANDOFF_PROJECT_ID;
}

function hashForStudentPlace(place: StudentPlace, projectId: string): string {
  if (place === 'projects') return '#/next/projects';
  const encoded = encodeURIComponent(projectId);
  if (place === 'history') return `#/next/log?project=${encoded}`;
  if (place === 'publish') return `#/next/publish?project=${encoded}`;
  if (place === 'receive') return `#/next/receive?project=${encoded}`;
  // blueprint / work 共用蓝图入口，项目标识写在 query
  return `#/next/blueprint?project=${encoded}`;
}

function hashForTeacher(place: TeacherPlace, groupId?: string | null): string {
  if (place === 'stage') {
    return groupId
      ? `#/next/stage?group=${encodeURIComponent(groupId)}`
      : '#/next/stage';
  }
  if (place === 'acceptance') return '#/next/acceptance';
  return '#/next/guide';
}

function isCampusProjectId(projectId: string): boolean {
  return (
    projectId === HANDOFF_PROJECT_ID ||
    projectId === 'campus' ||
    projectId === 'current'
  );
}

const STUDENT_SHELL: AppView[] = [
  'project-list',
  'next-blueprint',
  'next-publish',
  'next-receive',
  'next-log',
];

const TEACHER_SHELL: AppView[] = [
  'next-guide',
  'group-stage-report',
  'project-acceptance',
];

function shellHome(role: ReturnType<typeof getDemoRole>): {
  hash: string;
  view: AppView;
} {
  if (role === 'teacher') return { hash: '#/next/guide', view: 'next-guide' };
  // Demo 启动 / 空 hash → 校园项目完整蓝图；项目列表走独立地址 #/next/projects
  return {
    hash: hashForStudentPlace('blueprint', HANDOFF_PROJECT_ID),
    view: 'next-blueprint',
  };
}

function viewMatchesRole(view: AppView, role: ReturnType<typeof getDemoRole>): boolean {
  if (STUDENT_SHELL.includes(view)) return role !== 'teacher';
  if (TEACHER_SHELL.includes(view)) return role === 'teacher';
  return true;
}

function isBareHash(hash: string): boolean {
  return !hash || hash === '#' || hash === '#/';
}

function readInitialView(): AppView {
  if (typeof window === 'undefined') return 'project-list';
  const role = getDemoRole();
  const hash = window.location.hash;
  if (isBareHash(hash)) return shellHome(role).view;
  const next = viewFromHash(hash);
  if (!next || !viewMatchesRole(next, role)) return shellHome(role).view;
  return next;
}

export default function App() {
  const [view, setView] = useState<AppView>(readInitialView);
  const [shellProjectId, setShellProjectId] = useState<string>(() =>
    typeof window === 'undefined'
      ? HANDOFF_PROJECT_ID
      : projectIdFromHash(window.location.hash),
  );
  const [logProjectId, setLogProjectId] = useState<string>(() =>
    typeof window === 'undefined'
      ? HANDOFF_PROJECT_ID
      : projectIdFromHash(window.location.hash),
  );
  const [teacherGroupId, setTeacherGroupId] = useState<string | null>(null);
  const [project, setProject] = useState<CourseProject | null>(null);
  const [blueprintNodes, setBlueprintNodes] = useState<BlueprintNode[]>([]);
  const [campusSnapshot, setCampusSnapshot] = useState<{
    project: CourseProject;
    nodes: BlueprintNode[];
  } | null>(null);
  const [customSnapshot, setCustomSnapshot] = useState<{
    project: CourseProject;
    nodes: BlueprintNode[];
  } | null>(null);
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

  /** schema 迁移后重载协作与 handoff 种子 */
  useEffect(() => {
    ensureDemoStorageMigrated();
    rehydrateCollaborationSeeds();
    rehydrateDeliveryStore();
    rehydrateProcessEventStore();
    rehydrateAcceptanceStore();
  }, []);

  useEffect(() => {
    if (!aiOpen) return;
    const timer = window.setTimeout(() => {
      setAiOpen(false);
      window.location.hash = hashForStudentPlace('blueprint', HANDOFF_PROJECT_ID);
    }, AI_OVERLAY_MS);
    return () => window.clearTimeout(timer);
  }, [aiOpen]);

  useEffect(() => {
    if (project?.id === HANDOFF_PROJECT_ID && blueprintNodes.length > 0) {
      setSessionBlueprintNodes(blueprintNodes);
      setCampusSnapshot({ project, nodes: blueprintNodes });
    } else if (project && project.id !== HANDOFF_PROJECT_ID && blueprintNodes.length > 0) {
      setCustomSnapshot({ project, nodes: blueprintNodes });
    }
  }, [blueprintNodes, project]);

  const bootstrapCampusProject = useCallback(
    (
      collaborators?: ProjectCollaborator[],
      options?: { clearSubmissions?: boolean },
    ) => {
      const base =
        collaborators && collaborators.length > 0
          ? collaborators
          : project?.collaborators?.length
            ? project.collaborators
            : [createLockedExperienceCollaborator()];
      const merged = mergeDemoCastCollaborators(base);
      const nextProject: CourseProject = {
        ...projectTemplate,
        created: true,
        collaborators: merged,
      };
      if (options?.clearSubmissions !== false) {
        clearAllSubmissions();
      }
      const nodes = applyDeliveryToBlueprint(
        createInitialBlueprintNodes(nextProject.id, merged),
      );
      setProject(nextProject);
      setBlueprintNodes(nodes);
      setWorkspaceEntry(null);
      setCodingSession(null);
      return nextProject;
    },
    [project?.collaborators],
  );

  const ensureCampus = useCallback(() => {
    if (!project?.created) {
      bootstrapCampusProject(undefined, { clearSubmissions: false });
      return;
    }
    setBlueprintNodes((current) => applyDeliveryToBlueprint(current));
  }, [project?.created, bootstrapCampusProject]);

  const applyHash = useCallback(() => {
    const role = getDemoRole();
    const hash = window.location.hash;
    if (isBareHash(hash)) {
      const home = shellHome(role);
      if (window.location.hash !== home.hash) {
        window.location.hash = home.hash;
        return;
      }
      if (home.view === 'next-blueprint') {
        setBlueprintFocusNodeId(null);
        setShellProjectId(HANDOFF_PROJECT_ID);
        setLogProjectId(HANDOFF_PROJECT_ID);
        ensureCampus();
      }
      setView(home.view);
      return;
    }
    const next = viewFromHash(hash);
    if (!next) return;
    if (!viewMatchesRole(next, role)) {
      const home = shellHome(role);
      if (window.location.hash !== home.hash) {
        window.location.hash = home.hash;
        return;
      }
      if (home.view === 'next-blueprint') {
        setBlueprintFocusNodeId(null);
        setShellProjectId(HANDOFF_PROJECT_ID);
        setLogProjectId(HANDOFF_PROJECT_ID);
        ensureCampus();
      }
      setView(home.view);
      return;
    }

    const nextProjectId = projectIdFromHash(hash);
    setShellProjectId(nextProjectId);
    if (next === 'next-log') {
      setLogProjectId(nextProjectId);
    }

    const { query } = parseHash(hash);
    const groupFromHash = query.get('group');
    if (next === 'group-stage-report') {
      setTeacherGroupId(groupFromHash);
    }

    const campusShell =
      isCampusProjectId(nextProjectId) ||
      (!query.get('project') &&
        (next === 'next-blueprint' ||
          next === 'next-publish' ||
          next === 'next-receive'));

    if (
      campusShell &&
      (next === 'next-blueprint' ||
        next === 'next-publish' ||
        next === 'next-receive')
    ) {
      ensureCampus();
    }
    setView(next);
  }, [ensureCampus]);

  const goHash = useCallback(
    (hash: string) => {
      if (window.location.hash === hash) {
        applyHash();
        return;
      }
      window.location.hash = hash;
    },
    [applyHash],
  );

  const goTeacher = useCallback(
    (place: TeacherPlace, groupId?: string | null) => {
      if (place === 'stage' && groupId) {
        setTeacherGroupId(groupId);
      }
      goHash(hashForTeacher(place, groupId));
    },
    [goHash],
  );

  const goStudent = useCallback(
    (place: StudentPlace) => {
      if (place === 'projects') {
        goHash('#/next/projects');
        return;
      }

      // 侧栏导航一律沿用当前 shell 项目，避免 SeatFlow ↔ 校园串跳
      const activeId = shellProjectId || project?.id || HANDOFF_PROJECT_ID;

      if (activeId === SEATFLOW_PROJECT_ID) {
        if (place === 'history') {
          setLogProjectId(SEATFLOW_PROJECT_ID);
          goHash(hashForStudentPlace('history', SEATFLOW_PROJECT_ID));
          return;
        }
        // SeatFlow 无蓝图 / 交付；蓝图·工作·发布·接收均留在本项目空态
        goHash(hashForStudentPlace('blueprint', SEATFLOW_PROJECT_ID));
        return;
      }

      if (isCampusProjectId(activeId)) {
        ensureCampus();
        setShellProjectId(HANDOFF_PROJECT_ID);
        if (place === 'history') {
          setLogProjectId(HANDOFF_PROJECT_ID);
        }
        goHash(hashForStudentPlace(place, HANDOFF_PROJECT_ID));
        return;
      }

      // 自定义项目：记录页可读；蓝图用当前内存项目
      if (place === 'history') {
        setLogProjectId(activeId);
        goHash(hashForStudentPlace('history', activeId));
        return;
      }
      goHash(hashForStudentPlace(place === 'work' ? 'blueprint' : place, activeId));
    },
    [ensureCampus, goHash, project?.id, shellProjectId],
  );

  const openProjectLog = useCallback(
    (projectId: string) => {
      setShellProjectId(projectId);
      setLogProjectId(projectId);
      goHash(hashForStudentPlace('history', projectId));
    },
    [goHash],
  );

  useEffect(() => {
    applyHash();
    const onEnsure = () => ensureCampus();
    window.addEventListener('hashchange', applyHash);
    window.addEventListener('popstate', applyHash);
    window.addEventListener('cotrace-ensure-campus', onEnsure);
    return () => {
      window.removeEventListener('hashchange', applyHash);
      window.removeEventListener('popstate', applyHash);
      window.removeEventListener('cotrace-ensure-campus', onEnsure);
    };
  }, [applyHash, ensureCampus]);

  const handleCreate = useCallback((collaborators: ProjectCollaborator[]) => {
    const merged = mergeDemoCastCollaborators(collaborators);
    const id = `project-custom-${Date.now()}`;
    const nextProject: CourseProject = {
      id,
      name: '新课程项目',
      goal: '按课程流程生成的初始项目，待团队补充各节点目标与验收。',
      courseName: projectTemplate.courseName,
      processSteps: [...projectTemplate.processSteps],
      created: true,
      collaborators: merged,
    };
    const nodes = nextProject.processSteps.map((step, index) => ({
      id: `${id}-step-${index + 1}`,
      projectId: id,
      name: step,
      summary: `完成「${step}」，并留下队友可以回看的结果。`,
      ownerId: merged[index % Math.max(merged.length, 1)]?.memberId ?? null,
      collaboratorIds: [],
      status: 'todo' as const,
      dependsOn: index === 0 ? [] : [`${id}-step-${index}`],
      acceptance: [`${step}的结果可被队友查看`, '前置步骤已经完成'],
      x: 48 + (index % 4) * 240,
      y: 88 + Math.floor(index / 4) * 150,
    }));
    setBlueprintFocusNodeId(null);
    setShellProjectId(id);
    setLogProjectId(id);
    setProject(nextProject);
    setBlueprintNodes(nodes);
    setWorkspaceEntry(null);
    setCodingSession(null);
    setRegisterOpen(false);
    setAiOpen(true);
  }, []);

  const handleStartHandoffDemo = useCallback(() => {
    setBlueprintFocusNodeId(null);
    setShellProjectId(HANDOFF_PROJECT_ID);
    setLogProjectId(HANDOFF_PROJECT_ID);
    if (campusSnapshot) {
      setProject(campusSnapshot.project);
      setBlueprintNodes(applyDeliveryToBlueprint(campusSnapshot.nodes));
      goHash(hashForStudentPlace('blueprint', HANDOFF_PROJECT_ID));
      return;
    }
    if (!project?.created || project.id !== HANDOFF_PROJECT_ID) {
      bootstrapCampusProject(undefined, { clearSubmissions: false });
    } else {
      setBlueprintNodes((current) => applyDeliveryToBlueprint(current));
    }
    goHash(hashForStudentPlace('blueprint', HANDOFF_PROJECT_ID));
  }, [campusSnapshot, project?.created, project?.id, bootstrapCampusProject, goHash]);

  const handleOpenCustomProject = useCallback(() => {
    if (!customSnapshot) return;
    setBlueprintFocusNodeId(null);
    setShellProjectId(customSnapshot.project.id);
    setLogProjectId(customSnapshot.project.id);
    setProject(customSnapshot.project);
    setBlueprintNodes(customSnapshot.nodes);
    goHash(hashForStudentPlace('blueprint', customSnapshot.project.id));
  }, [customSnapshot, goHash]);

  const handleOpenBlueprint = useCallback(() => {
    if (!project?.created || blueprintNodes.length === 0) return;
    setBlueprintNodes((current) => applyDeliveryToBlueprint(current));
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
    if (focusId) setBlueprintFocusNodeId(focusId);
    setWorkspaceEntry(null);
    setCodingSession(null);
    const backId = project?.id ?? shellProjectId ?? HANDOFF_PROJECT_ID;
    if (backId === HANDOFF_PROJECT_ID) {
      setBlueprintNodes((current) => applyDeliveryToBlueprint(current));
    }
    setShellProjectId(backId);
    goHash(hashForStudentPlace('blueprint', backId));
  }, [workspaceEntry?.nodeId, project?.id, shellProjectId, goHash]);

  const handleOpenTaskSubmit = useCallback(
    (session: CodingWorkspaceSession) => {
      // 后端节点主演示是「发布交付」给指定队友；避免落入旧深色提交流程
      if (workspaceEntry?.nodeId === HANDOFF_NODE_BACKEND) {
        setCodingSession(session);
        goStudent('publish');
        return;
      }
      setCodingSession(session);
      setView('task-submit');
    },
    [workspaceEntry?.nodeId, goStudent],
  );

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

  /** 节点详情 → 个人工作区（可回看材料；「你」= 当前演示视角，非固定 Maya） */
  const handleContinueWorkFromDetail = useCallback(() => {
    if (
      !project ||
      !activeNode ||
      !workspaceEntry ||
      workspaceEntry.type !== 'blueprint-detail'
    ) {
      return;
    }
    setCodingSession(null);
    setWorkspaceEntry(
      buildEntryToPersonalCoding(
        project,
        activeNode,
        activeNode.ownerId ?? EXPERIENCE_MEMBER_ID,
      ),
    );
    setView('personal-coding-workspace');
  }, [project, activeNode, workspaceEntry]);

  const handleDeliveryReceived = useCallback((integrationNodeId: string) => {
    setBlueprintNodes((current) =>
      markIntegrationInProgress(current, integrationNodeId),
    );
    setToast('已接收交付 · 交易流程联调进入进行中');
  }, []);

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

  const seatflowName = getSeatflowProjectCard().name;
  const shellIsSeatflow = shellProjectId === SEATFLOW_PROJECT_ID;
  const activeCampusProject =
    project && isCampusProjectId(project.id) ? project : null;

  return (
    <>
      {view === 'next-blueprint' ? (
        shellIsSeatflow ? (
          <ProjectSpaceUnavailable
            projectName={seatflowName}
            reason="SeatFlow 为已完成项目，仅开放项目记忆；本阶段不提供可编辑工作蓝图。"
            onNavigate={goStudent}
          />
        ) : activeCampusProject ||
          (project && project.id === shellProjectId) ? (
          <WorkBlueprintPage
            nodes={blueprintNodes}
            projectId={project!.id}
            projectName={project!.name}
            selectedId={blueprintFocusNodeId}
            onSelect={setBlueprintFocusNodeId}
            onNavigate={goStudent}
            onOpenNode={(nodeId) => {
              const target = blueprintNodes.find((node) => node.id === nodeId);
              setBlueprintFocusNodeId(nodeId);
              if (
                target &&
                target.status !== 'todo' &&
                target.status !== 'done' &&
                target.status !== 'accepted'
              ) {
                // 「进入个人工作」→ 材料/版本/批注阅读，不再先落旧详情再进伪 IDE
                handleOpenWorkspace(
                  buildEntryToPersonalCoding(
                    project!,
                    target,
                    target.ownerId ?? EXPERIENCE_MEMBER_ID,
                  ),
                );
                return;
              }
              handleOpenWorkspace({
                type: 'blueprint-detail',
                projectId: project!.id,
                nodeId,
              });
            }}
          />
        ) : (
          <ProjectSpaceUnavailable
            projectName={HANDOFF_PROJECT_NAME}
            reason="暂无工作蓝图"
            onNavigate={goStudent}
          />
        )
      ) : view === 'next-log' ? (
        <ProjectMemoryPage
          projectId={logProjectId}
          onNavigate={goStudent}
        />
      ) : view === 'next-publish' ? (
        shellIsSeatflow ? (
          <ProjectSpaceUnavailable
            projectName={seatflowName}
            reason="SeatFlow 无交付发布入口；请从项目记忆回看已确认经验。"
            onNavigate={goStudent}
          />
        ) : (
          <PublishDeliveryPage onNavigate={goStudent} />
        )
      ) : view === 'next-receive' ? (
        shellIsSeatflow ? (
          <ProjectSpaceUnavailable
            projectName={seatflowName}
            reason="SeatFlow 无交付接收入口；请从项目记忆回看已确认经验。"
            onNavigate={goStudent}
          />
        ) : (
          <ReceiveDeliveryPage
            onNavigate={goStudent}
            onReceived={handleDeliveryReceived}
          />
        )
      ) : view === 'next-guide' ? (
        <CourseGuidePage
          onOpenStageReport={(groupId) => goTeacher('stage', groupId)}
          onOpenAcceptance={() => goTeacher('acceptance')}
          onNavigate={goTeacher}
        />
      ) : view === 'delivery-publish' ? (
        <DeliveryPublishPage
          onBack={() => {
            if (project?.created) setView('blueprint');
            else setView('project-list');
          }}
          onGoReceiveHint={() => {
            setDemoRole('priya');
            setToast('已切换到 Priya · 请打开接收页确认');
            setView('delivery-receive');
          }}
        />
      ) : view === 'delivery-receive' ? (
        <DeliveryReceivePage
          onBack={() => {
            if (project?.created) setView('blueprint');
            else setView('project-list');
          }}
          onReceived={handleDeliveryReceived}
        />
      ) : view === 'classroom-guide' ? (
        <ClassroomGuidePage
          onBack={() => setView('project-list')}
          onOpenStageReport={() => goTeacher('stage')}
          onOpenAcceptance={() => goTeacher('acceptance')}
        />
      ) : view === 'group-stage-report' ? (
        <StageReportPage
          onNavigate={goTeacher}
          focusGroupId={teacherGroupId}
        />
      ) : view === 'project-acceptance' ? (
        <AcceptancePage onNavigate={goTeacher} />
      ) : view === 'task-submit' &&
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
          onNavigate={goStudent}
          onSubmitTask={handleOpenTaskSubmit}
          onOpenDeliveryPublish={() => goStudent('publish')}
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
          onNavigate={goStudent}
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
          onOpenDeliveryPublish={() => setView('delivery-publish')}
          onOpenDeliveryReceive={() => setView('delivery-receive')}
          onToast={setToast}
        />
      ) : view === 'project-log' ? (
        <ProjectLogPage onBack={() => goHash('#/next/projects')} />
      ) : (
        <ProjectList
          project={project}
          onNavigate={goStudent}
          onOpenRegister={() => setRegisterOpen(true)}
          onOpenProject={handleOpenBlueprint}
          onOpenProjectLog={openProjectLog}
          onStartHandoffDemo={handleStartHandoffDemo}
          extraProject={
            customSnapshot
              ? {
                  id: customSnapshot.project.id,
                  name: customSnapshot.project.name,
                  statuses: customSnapshot.nodes.map((node) => node.status),
                }
              : null
          }
          onOpenExtraProject={handleOpenCustomProject}
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
