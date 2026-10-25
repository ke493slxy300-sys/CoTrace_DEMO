import type { DutyId, ProjectCollaborator, TeamMember } from "../types";
import { formatDutyLabels } from "./duties";
import {
  EXPERIENCE_MEMBER_ID,
  getExperienceMember,
  getMemberById,
  getSelectableMembers,
} from "./members";
import collaboratorSeedData from "./collaborators-seeds.json";
import blueprintNodeDutyData from "./blueprint-node-duty.json";
import experienceCollaboratorData from "./experience-collaborator.json";

export function createLockedExperienceCollaborator(): ProjectCollaborator {
  return {
    ...experienceCollaboratorData,
  } as ProjectCollaborator;
}

export type CollaboratorSelectionInput = {
  memberId: string;
  primaryDutyId: DutyId;
  additionalDutyId?: DutyId | null;
};

/**
 * 由注册草稿组装项目协作快照。
 * Maya 始终置顶且锁定；未选成员不会进入结果。
 */
export function buildProjectCollaborators(
  selections: CollaboratorSelectionInput[],
): ProjectCollaborator[] {
  const locked = createLockedExperienceCollaborator();
  const optional: ProjectCollaborator[] = [];

  for (const selection of selections) {
    if (selection.memberId === EXPERIENCE_MEMBER_ID) continue;
    /** Demo：仅允许演示班底进入协作快照 */
    if (!isDemoCastMember(selection.memberId)) continue;

    const member = getMemberById(selection.memberId);
    if (!member || !member.enabled || !member.selectable) continue;

    const primary =
      selection.primaryDutyId ||
      member.defaultPrimaryDutyId ||
      "database-design";
    const additional = selection.additionalDutyId ?? null;

    if (additional && additional === primary) {
      optional.push({
        memberId: selection.memberId,
        primaryDutyId: primary,
        additionalDutyId: null,
        locked: false,
      });
      continue;
    }

    optional.push({
      memberId: selection.memberId,
      primaryDutyId: primary,
      additionalDutyId: additional,
      locked: false,
    });
  }

  return [locked, ...optional];
}

/** 成员是否承担某职责（主职责或附加职责） */
export function collaboratorHasDuty(
  collaborator: ProjectCollaborator,
  dutyId: DutyId,
): boolean {
  return (
    collaborator.primaryDutyId === dutyId ||
    collaborator.additionalDutyId === dutyId
  );
}

/**
 * 按职责解析蓝图节点负责人。
 * 规则：仅已选协作成员可命中；Maya 不自动填补其他未分配职责；无人则 null（UI 显示「待分配」）。
 */
export function resolveOwnerForDuty(
  dutyId: DutyId,
  collaborators: ProjectCollaborator[],
): string | null {
  const hit = collaborators.find((item) => collaboratorHasDuty(item, dutyId));
  return hit?.memberId ?? null;
}

/** 当前Demo的蓝图节点与职责对应关系 */
export const BLUEPRINT_NODE_DUTY = blueprintNodeDutyData as Record<
  string,
  DutyId | null
>;

/**
 * 伪项目演示协作班底（Demo 锁定）：仅此三人可选入协作。
 * 注册未选手动成员时仍并入；注册侧禁止增删改。
 */
export const DEMO_CAST_SEEDS =
  collaboratorSeedData as CollaboratorSelectionInput[];

export const DEMO_CAST_MEMBER_IDS = DEMO_CAST_SEEDS.map(
  (seed) => seed.memberId,
) as readonly string[];

export function isDemoCastMember(memberId: string): boolean {
  return DEMO_CAST_MEMBER_IDS.includes(memberId);
}

/** 创建项目时合并演示班底，便于开箱展示预置节点负责人 */
export function mergeDemoCastCollaborators(
  collaborators: ProjectCollaborator[],
): ProjectCollaborator[] {
  const byId = new Map(
    collaborators.map((item) => [item.memberId, item] as const),
  );

  for (const seed of DEMO_CAST_SEEDS) {
    if (byId.has(seed.memberId)) continue;
    const member = getMemberById(seed.memberId);
    if (!member?.enabled) continue;
    byId.set(seed.memberId, {
      memberId: seed.memberId,
      primaryDutyId: seed.primaryDutyId,
      additionalDutyId: seed.additionalDutyId ?? null,
      locked: false,
    });
  }

  const locked = byId.get(EXPERIENCE_MEMBER_ID);
  const rest = [...byId.values()].filter(
    (item) => item.memberId !== EXPERIENCE_MEMBER_ID,
  );
  return locked ? [locked, ...rest] : rest;
}

export function getCollaboratorDisplayLabel(
  collaborator: ProjectCollaborator,
): string {
  return formatDutyLabels(
    collaborator.primaryDutyId,
    collaborator.additionalDutyId,
  );
}

export function getDefaultSelectionForMember(
  member: TeamMember,
): CollaboratorSelectionInput | null {
  if (!member.enabled || !member.selectable || !member.defaultPrimaryDutyId) {
    return null;
  }
  return {
    memberId: member.id,
    primaryDutyId: member.defaultPrimaryDutyId,
    additionalDutyId: null,
  };
}

/** 注册侧板默认展示的可选成员（不含锁定体验者、不含未启用槽位） */
export function listPickerMembers(): TeamMember[] {
  return getSelectableMembers();
}

export function describeExperienceLock(): string {
  const me = getExperienceMember();
  return `${me.name} 为固定体验角色（项目负责人、后端 API），不可取消或修改。`;
}
