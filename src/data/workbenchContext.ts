/**
 * 个人工作区上下文：统一 code / empty 两种形态。
 * 第一阶段只读；不启动 Agent、不自动生成文件。
 */

import type { BlueprintNode, CourseProject } from '../types';
import { getPresetFilesForTask } from './files';
import { EXPERIENCE_MEMBER_ID, getMemberById } from './members';

export type WorkbenchContext = {
  projectId: string;
  nodeId: string;
  nodeTitle: string;
  ownerId?: string;
  workbenchType: 'code' | 'empty';
  repositoryStatus: 'available' | 'empty';
  agentStatus: 'inactive' | 'available';
};

/** 仅当负责人属于当前项目协作快照时才返回 ownerId */
export function resolveWorkbenchOwnerId(
  node: BlueprintNode,
  project: CourseProject,
): string | undefined {
  if (!node.ownerId) return undefined;
  const inProject = project.collaborators.some(
    (item) => item.memberId === node.ownerId,
  );
  return inProject ? node.ownerId : undefined;
}

export function resolveWorkbenchContext(
  node: BlueprintNode,
  project: CourseProject,
): WorkbenchContext {
  const hasCode = getPresetFilesForTask(node.id).length > 0;
  const ownerId = resolveWorkbenchOwnerId(node, project);

  return {
    projectId: project.id,
    nodeId: node.id,
    nodeTitle: node.name,
    ownerId,
    workbenchType: hasCode ? 'code' : 'empty',
    repositoryStatus: hasCode ? 'available' : 'empty',
    agentStatus: 'inactive',
  };
}

/**
 * 是否允许进入个人工作区：
 * - 有代码仓：仅负责人（体验者）可进；
 * - 空白仓：负责人可进；待分配时体验者可进；体验者作为项目负责人可查看待开始空白节点。
 */
export function canEnterWorkbench(
  node: BlueprintNode,
  project: CourseProject,
  memberId: string = EXPERIENCE_MEMBER_ID,
): boolean {
  const ctx = resolveWorkbenchContext(node, project);

  if (ctx.workbenchType === 'code') {
    return node.ownerId === memberId;
  }

  if (node.ownerId === memberId) return true;
  if (!node.ownerId) return memberId === EXPERIENCE_MEMBER_ID;
  // 体验者可进入他人尚未开始的空白工作区（演示「待开始」路径）
  if (node.status === 'todo' && memberId === EXPERIENCE_MEMBER_ID) {
    return true;
  }
  return false;
}

export function formatWorkbenchOwnerLabel(
  ownerId: string | undefined,
): string {
  if (!ownerId) return '待分配';
  return getMemberById(ownerId)?.name ?? '待分配';
}
