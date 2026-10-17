import type {
  BlueprintNode,
  BlueprintNodeStatus,
  DutyId,
  ProjectCollaborator,
} from '../types';
import {
  BLUEPRINT_NODE_DUTY,
  resolveOwnerForDuty,
} from './collaborators';
import { getMemberById } from './members';

export const BLUEPRINT_STATUS_LABELS: Record<BlueprintNodeStatus, string> = {
  todo: '待开始',
  'in-progress': '进行中',
  'awaiting-review': '新版本待验收',
  discussing: '讨论中',
  'needs-change': '需要修改',
  accepted: '验收通过',
  done: '已完成',
};

/** 节点无负责人时的展示文案 */
export const BLUEPRINT_OWNER_PENDING_LABEL = '待分配';

/** AI 初始蓝图节点顺序（规范 §14.4） */
export const INITIAL_BLUEPRINT_FLOW = [
  '需求与流程确认',
  '数据库设计',
  '后端 API',
  '前端页面',
  '交易流程联调',
  '集成测试',
  '项目验收',
] as const;

type NodeSeed = {
  id: string;
  name: (typeof INITIAL_BLUEPRINT_FLOW)[number];
  summary: string;
  /** 建议协作者候选（仅当其已在项目协作快照中才会写入） */
  suggestedCollaboratorIds: string[];
  status: BlueprintNodeStatus;
  dependsOn: string[];
  acceptance: string[];
  x: number;
  y: number;
};

const NODE_SEEDS: NodeSeed[] = [
  {
    id: 'node-requirements',
    name: '需求与流程确认',
    summary: '确认校园二手交易核心流程、业务对象与验收边界。',
    suggestedCollaboratorIds: ['member-maya'],
    status: 'done',
    dependsOn: [],
    acceptance: ['核心业务流程已对齐', '业务对象清单已确认'],
    x: 48,
    y: 48,
  },
  {
    id: 'node-database',
    name: '数据库设计',
    summary: '设计 users、listings、orders 等核心表及订单快照规则。',
    suggestedCollaboratorIds: ['member-alex'],
    status: 'done',
    dependsOn: ['node-requirements'],
    acceptance: [
      '订单保存 listing 标题与价格快照',
      '商品与订单状态枚举齐全',
    ],
    x: 280,
    y: 48,
  },
  {
    id: 'node-backend',
    name: '后端 API',
    summary: '实现购买申请等后端接口，处理商品状态与订单创建。',
    suggestedCollaboratorIds: ['member-alex', 'member-priya'],
    status: 'in-progress',
    dependsOn: ['node-database'],
    acceptance: [
      'createOrder 可创建 pending 订单',
      '商品不存在/不可购买返回明确错误',
    ],
    x: 512,
    y: 48,
  },
  {
    id: 'node-frontend',
    name: '前端页面',
    summary: '商品列表、详情与购买申请页面，对接后端接口。',
    suggestedCollaboratorIds: ['member-priya'],
    status: 'in-progress',
    dependsOn: ['node-requirements'],
    acceptance: ['列表筛选可用', '购买申请可发起'],
    x: 280,
    y: 220,
  },
  {
    id: 'node-integration',
    name: '交易流程联调',
    summary: '打通浏览、申请、确认到收货的端到端交易路径。',
    suggestedCollaboratorIds: ['member-jordan', 'member-priya'],
    status: 'todo',
    dependsOn: ['node-backend', 'node-frontend'],
    acceptance: ['主路径可演示', '关键状态流转正确'],
    x: 512,
    y: 220,
  },
  {
    id: 'node-testing',
    name: '集成测试',
    summary: '覆盖订单快照一致性与关键错误场景。',
    suggestedCollaboratorIds: ['member-jordan'],
    status: 'todo',
    dependsOn: ['node-integration'],
    acceptance: ['快照一致性用例通过', '错误码场景有测试'],
    x: 744,
    y: 220,
  },
  {
    id: 'node-acceptance',
    name: '项目验收',
    summary: '对照课程作业要求完成整体验收。',
    suggestedCollaboratorIds: [
      'member-alex',
      'member-priya',
      'member-jordan',
    ],
    status: 'todo',
    dependsOn: ['node-testing'],
    acceptance: ['演示路径完整', '已知限制已记录'],
    x: 744,
    y: 392,
  },
];

function selectedIdSet(collaborators: ProjectCollaborator[]): Set<string> {
  return new Set(collaborators.map((item) => item.memberId));
}

function resolveNodeOwner(
  nodeName: string,
  collaborators: ProjectCollaborator[],
): string | null {
  const dutyId = BLUEPRINT_NODE_DUTY[nodeName] as DutyId | null | undefined;
  if (!dutyId) return null;
  return resolveOwnerForDuty(dutyId, collaborators);
}

function resolveNodeCollaborators(
  suggestedIds: string[],
  selectedIds: Set<string>,
  ownerId: string | null,
): string[] {
  return suggestedIds.filter(
    (id) => selectedIds.has(id) && id !== ownerId,
  );
}

/**
 * 按注册协作快照生成初始蓝图。
 * - 协作快照应已含演示班底（见 mergeDemoCastCollaborators）
 * - 按职责解析负责人；无人承担时 ownerId 为 null（UI：「待分配」）
 * - Maya 仅承担其固定职责对应的节点（含需求确认 / 项目验收）
 */
export function createInitialBlueprintNodes(
  projectId: string,
  collaborators: ProjectCollaborator[],
): BlueprintNode[] {
  const selected = selectedIdSet(collaborators);

  return NODE_SEEDS.map((seed) => {
    const ownerId = resolveNodeOwner(seed.name, collaborators);
    return {
      id: seed.id,
      projectId,
      name: seed.name,
      summary: seed.summary,
      ownerId,
      collaboratorIds: resolveNodeCollaborators(
        seed.suggestedCollaboratorIds,
        selected,
        ownerId,
      ),
      status: seed.status,
      dependsOn: seed.dependsOn,
      acceptance: seed.acceptance,
      x: seed.x,
      y: seed.y,
    };
  });
}

export function formatBlueprintOwnerLabel(ownerId: string | null): string {
  if (!ownerId) return BLUEPRINT_OWNER_PENDING_LABEL;
  return getMemberById(ownerId)?.name ?? BLUEPRINT_OWNER_PENDING_LABEL;
}

function stampNow(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

/** 负责人新增空白节点：无产出、无负责人、待开始 */
export function createBlankBlueprintNode(
  projectId: string,
  position: { x: number; y: number },
): BlueprintNode {
  return {
    id: `node-blank-${Date.now()}`,
    projectId,
    name: '未命名任务',
    summary: '新增空白任务节点，待补充目标与验收。',
    ownerId: null,
    collaboratorIds: [],
    status: 'todo',
    dependsOn: [],
    acceptance: ['待补充验收标准'],
    x: position.x,
    y: position.y,
    isBlank: true,
    editHistory: [
      `${stampNow()} · 负责人新增空白节点（非模拟 AI 初始理解）。`,
    ],
  };
}

export function appendNodeEditHistory(
  node: BlueprintNode,
  entry: string,
): BlueprintNode {
  return {
    ...node,
    editHistory: [...(node.editHistory ?? []), `${stampNow()} · ${entry}`],
  };
}
