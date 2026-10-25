import type {
  BlueprintNode,
  BlueprintNodeStatus,
  DutyId,
  ProjectCollaborator,
} from "../types";
import { BLUEPRINT_NODE_DUTY, resolveOwnerForDuty } from "./collaborators";
import { getMemberById } from "./members";

import blueprintNodeData from "./blueprint-nodes.json";

export const BLUEPRINT_STATUS_LABELS: Record<BlueprintNodeStatus, string> = {
  todo: "待开始",
  "in-progress": "进行中",
  "awaiting-review": "新版本待验收",
  discussing: "讨论中",
  "needs-change": "需要修改",
  accepted: "验收通过",
  done: "已完成",
};

/** 节点无负责人时的展示文案 */
export const BLUEPRINT_OWNER_PENDING_LABEL = "待分配";

type NodeSeed = {
  id: string;
  name: string;
  summary: string;
  /** 建议协作者候选（仅当其已在项目协作快照中才会写入） */
  suggestedCollaboratorIds: string[];
  status: BlueprintNodeStatus;
  dependsOn: string[];
  acceptance: string[];
  x: number;
  y: number;
};

const NODE_SEEDS = blueprintNodeData as unknown as NodeSeed[];

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
  return suggestedIds.filter((id) => selectedIds.has(id) && id !== ownerId);
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
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

/** 负责人新增空白节点：无产出、无负责人、待开始 */
export function createBlankBlueprintNode(
  projectId: string,
  position: { x: number; y: number },
): BlueprintNode {
  return {
    id: `node-blank-${Date.now()}`,
    projectId,
    name: "未命名任务",
    summary: "新增空白任务节点，待补充目标与验收。",
    ownerId: null,
    collaboratorIds: [],
    status: "todo",
    dependsOn: [],
    acceptance: ["待补充验收标准"],
    x: position.x,
    y: position.y,
    isBlank: true,
    editHistory: [`${stampNow()} · 负责人新增空白节点（非模拟 AI 初始理解）。`],
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
