/**
 * 蓝图节点详情页协作数据（队友只读视角）。
 * 复用 files / traces / discussions / blueprintDetail，并补充主题卡片与多轮对话。
 */

import type {
  AiTrace,
  BlueprintNode,
  BlueprintNodeStatus,
  CodeFile,
  CourseProject,
  Discussion,
} from '../types';
import {
  BLUEPRINT_OWNER_PENDING_LABEL,
  formatBlueprintOwnerLabel,
} from './blueprint';
import { getBlueprintNodeDetail } from './blueprintDetail';
import {
  getSelectedTeammateTraceCards,
  getTeammateDatabaseFiles,
  getTeammateFrontendFiles,
  getTeammateNodeTitle,
  getTeammateResearchDocuments,
  getTeammateResolveDuty,
  getTeammateTraceMeta,
  isTeammatePackNode,
  resolveTeammateOwnerLabel,
} from '../demoContent/teammatePack';
import type {
  TeammateDocumentRef,
  TeammateTraceCard,
} from '../demoContent/teammateTypes';
import {
  getSubmission,
  type DemoSubmission,
  type DemoSubmissionTraceCard,
} from './demoSubmission';
import { getPresetDiscussionsForTask } from './discussions';
import { getPresetTracesForTask } from './traces';

export type RelatedOutput = {
  id: string;
  label: string;
  kind: 'code' | 'doc' | 'test';
};

export type AiTraceDialogueTurn = {
  id: string;
  role: 'user' | 'agent';
  author: string;
  content: string;
};

/** 按主题整理的 AI 溯源卡片（内嵌多轮对话，悬停展开） */
export type AiTraceThemeCard = {
  id: string;
  theme: string;
  stage: string;
  summary: string;
  problem?: string;
  agentAdvice?: string;
  adoption?: string;
  relatedFileLabel?: string;
  changeRelation?: string;
  initiator: string;
  createdAt: string;
  dialogues: AiTraceDialogueTurn[];
  /** 关联旧 AiTrace，便于高亮代码行 */
  relatedTraceId?: string;
};

export type AnnotationThreadMessage = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

/**
 * @deprecated 旧内存标注形状。主路径请用 `types/collaboration.ProjectAnnotation`
 * 与 `nodeCollaborationStore`。
 */
export type ProjectAnnotation = {
  id: string;
  typeLabel: string;
  author: string;
  summary: string;
  resolved: boolean;
  decision?: string;
  affectsCode: boolean;
  createdAt: string;
  thread: AnnotationThreadMessage[];
  relatedDiscussionId?: string;
};

export type SubmissionRecord = {
  id: string;
  title: string;
  author: string;
  summary: string;
  createdAt: string;
  relatedOutputs: string[];
};

export type BlueprintNodeDetailData = {
  nodeId: string;
  projectId: string;
  title: string;
  description?: string;
  ownerId?: string;
  ownerLabel: string;
  status: BlueprintNodeStatus;
  relatedOutputs: RelatedOutput[];
  /** 左侧可点选查看的只读文件（复用 CodeFile） */
  viewFiles: CodeFile[];
  /** 兼容旧 AiTrace 列表 */
  aiTraces: AiTrace[];
  /** 主题卡片（展示用；后端等非队友包节点） */
  aiTraceCards: AiTraceThemeCard[];
  /** 队友包：成员选取的片段式溯源卡 */
  teammateTraceCards: TeammateTraceCard[];
  teammateTraceMeta: { sourcePolicy: string; organizedBy: string } | null;
  /** 主区域类型 */
  primaryKind: 'code' | 'document';
  documents: TeammateDocumentRef[];
  /** 兼容旧 Discussion */
  teamDiscussions: Discussion[];
  /**
   * @deprecated 标注/讨论已迁至 nodeCollaborationStore；始终返回空数组。
   */
  annotations: ProjectAnnotation[];
  submissions: SubmissionRecord[];
  updatedAt: string;
  /** 是否使用队友内容包（前端/数据库/需求） */
  usesTeammatePack: boolean;
  /** 当前展示来自本地 DemoSubmission 快照 */
  fromDemoSubmission: boolean;
};

function mapArtifacts(nodeId: string): RelatedOutput[] {
  return getBlueprintNodeDetail(nodeId).artifacts.map((item) => ({
    id: item.id,
    label: item.label,
    kind: item.kind,
  }));
}

function integrationCards(): AiTraceThemeCard[] {
  return [
    {
      id: 'card-int-gate',
      theme: '联调前置条件',
      stage: '协作阶段 · 等待依赖',
      summary: 'Jordan 与 Agent 梳理联调阻塞项。',
      problem: '错误响应结构未稳定，集成用例无法开测。',
      agentAdvice: '待后端提交结构化错误后再启动主路径联调。',
      adoption: '未开始实现',
      initiator: 'Jordan Lin',
      createdAt: '2026-10-15T12:00:00.000Z',
      dialogues: [
        {
          id: 'int1',
          role: 'user',
          author: 'Jordan Lin',
          content: '联调现在可以开始吗？',
        },
        {
          id: 'int2',
          role: 'agent',
          author: '编程 Agent',
          content:
            '建议等待后端错误码与前端提示对齐。当前节点尚无代码仓内容。',
        },
      ],
    },
  ];
}

function cardsForNode(nodeId: string): AiTraceThemeCard[] {
  switch (nodeId) {
    case 'node-backend':
      /** 公开溯源仅在 DemoSubmission 写入后出现 */
      return [];
    case 'node-integration':
      return integrationCards();
    default:
      /** 前端 / 数据库 / 需求改用 teammateTraceCards */
      return [];
  }
}

function submissionsForNode(_nodeId: string): SubmissionRecord[] {
  /** 仅 DemoSubmission 写入后展示提交记录；预置包不再伪装「已提交」 */
  return [];
}

/**
 * 无 DemoSubmission 时的团队可见代码：
 * - 后端 API：空白（等体验者提交工作区内容后再展示）
 * - 其他：队友 Content Pack
 */
function viewFilesForNode(nodeId: string): CodeFile[] {
  if (nodeId === 'node-backend') return [];
  if (nodeId === 'node-frontend') return getTeammateFrontendFiles();
  if (nodeId === 'node-database') return getTeammateDatabaseFiles();
  return [];
}

export function getBlueprintNodeDetailData(
  node: BlueprintNode,
  project: CourseProject,
): BlueprintNodeDetailData {
  const detail = getBlueprintNodeDetail(node);
  const demoSubmission = getSubmission(node.id, project.id);
  const usesTeammatePack = isTeammatePackNode(node.id);

  const ownerResolved = usesTeammatePack
    ? resolveTeammateOwnerLabel(
        project,
        getTeammateResolveDuty(node.id),
        node.ownerId,
      )
    : (() => {
        const ownerInProject = node.ownerId
          ? project.collaborators.some(
              (item) => item.memberId === node.ownerId,
            )
          : false;
        return {
          ownerId: ownerInProject ? (node.ownerId ?? undefined) : undefined,
          ownerLabel: ownerInProject
            ? formatBlueprintOwnerLabel(node.ownerId)
            : BLUEPRINT_OWNER_PENDING_LABEL,
        };
      })();

  const updatedAt =
    node.editHistory && node.editHistory.length > 0
      ? node.editHistory[node.editHistory.length - 1]
      : detail.evolution[detail.evolution.length - 1] ??
        '暂无更新记录';

  const packTitle = getTeammateNodeTitle(node.id);
  const primaryKind =
    node.id === 'node-requirements' ? 'document' : 'code';

  if (demoSubmission) {
    return detailFromDemoSubmission({
      node,
      project,
      detailGoal: detail.goal,
      packTitle,
      ownerResolved,
      teamDiscussions: getPresetDiscussionsForTask(node.id),
      relatedOutputs: mapArtifacts(node.id),
      updatedAt,
      submission: demoSubmission,
    });
  }

  return {
    nodeId: node.id,
    projectId: project.id,
    title: packTitle ?? node.name,
    description: detail.goal,
    ownerId: ownerResolved.ownerId,
    ownerLabel: ownerResolved.ownerLabel,
    status: node.status,
    relatedOutputs: mapArtifacts(node.id),
    viewFiles: viewFilesForNode(node.id),
    aiTraces: usesTeammatePack ? [] : getPresetTracesForTask(node.id),
    aiTraceCards: cardsForNode(node.id),
    teammateTraceCards: usesTeammatePack
      ? getSelectedTeammateTraceCards(node.id)
      : [],
    teammateTraceMeta: usesTeammatePack
      ? getTeammateTraceMeta(node.id)
      : null,
    primaryKind,
    documents:
      node.id === 'node-requirements' ? getTeammateResearchDocuments() : [],
    teamDiscussions: getPresetDiscussionsForTask(node.id),
    annotations: [],
    submissions: submissionsForNode(node.id),
    updatedAt,
    usesTeammatePack,
    fromDemoSubmission: false,
  };
}

function detailFromDemoSubmission(input: {
  node: BlueprintNode;
  project: CourseProject;
  detailGoal: string;
  packTitle: string | null;
  ownerResolved: { ownerId?: string; ownerLabel: string };
  teamDiscussions: Discussion[];
  relatedOutputs: RelatedOutput[];
  updatedAt: string;
  submission: DemoSubmission;
}): BlueprintNodeDetailData {
  const { submission } = input;
  return {
    nodeId: input.node.id,
    projectId: input.project.id,
    title: input.packTitle ?? input.node.name,
    description: input.detailGoal,
    ownerId: input.ownerResolved.ownerId,
    ownerLabel: input.ownerResolved.ownerLabel,
    status: input.node.status,
    relatedOutputs: input.relatedOutputs,
    viewFiles: submission.codeFiles.map((file) => ({ ...file })),
    aiTraces: [],
    aiTraceCards: [],
    teammateTraceCards: submission.traceCards.map(mapDemoTraceToTeammateCard),
    teammateTraceMeta: {
      sourcePolicy:
        '以下仅包含负责人在本次提交中勾选公开的主题溯源，不包含完整原始对话。',
      organizedBy: '项目理解 Agent',
    },
    primaryKind: 'code',
    documents: [],
    teamDiscussions: input.teamDiscussions,
    annotations: [],
    submissions: [
      {
        id: submission.id,
        title: truncateLabel(submission.description, 48),
        author: submission.author,
        summary: submission.description,
        createdAt: submission.createdAt,
        relatedOutputs: submission.codeFiles.map((file) => file.name),
      },
    ],
    updatedAt: `Demo 提交 · ${new Date(submission.createdAt).toLocaleString('zh-CN')}`,
    usesTeammatePack: true,
    fromDemoSubmission: true,
  };
}

function mapDemoTraceToTeammateCard(
  card: DemoSubmissionTraceCard,
): TeammateTraceCard {
  return {
    id: card.id,
    generatedTitle: card.title,
    displayTitle: card.title,
    titleEdited: false,
    topic: '公开溯源',
    selectedByCurrentMember: true,
    selectionNote: card.fragmentSummary,
    fragments: [
      { speaker: '片段摘要', text: card.fragmentSummary },
    ],
    humanUnderstanding: card.humanUnderstanding,
    humanDecision: card.humanDecision,
    affectedArtifacts: [],
    unresolved: '—',
    memoryCandidate: '',
  };
}

function truncateLabel(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
