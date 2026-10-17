/**
 * 工作区入口：
 * - 蓝图画布 / 侧栏 → 一律节点详情（团队可见成果）
 * - 底栏「我负责」→ 个人编码工作区（产品例外）
 * - 节点详情「开始/继续工作」→ 个人编码工作区
 */

import type { BlueprintNode, CourseProject } from '../types';
import { getSubmission } from './demoSubmission';
import { getPresetFilesForTask } from './files';
import { EXPERIENCE_MEMBER_ID } from './members';

export const CURRENT_USER_ID = EXPERIENCE_MEMBER_ID;

export type WorkspaceEntry =
  | {
      type: 'personal-coding';
      projectId: string;
      nodeId: string;
      ownerId: string;
    }
  | {
      type: 'blueprint-detail';
      projectId: string;
      nodeId: string;
    };

export type AppWorkspaceView =
  | 'personal-coding-workspace'
  | 'blueprint-node-detail';

export function workspaceEntryToView(entry: WorkspaceEntry): AppWorkspaceView {
  return entry.type === 'personal-coding'
    ? 'personal-coding-workspace'
    : 'blueprint-node-detail';
}

/** 底栏「我负责」：仍直达个人编码工作区 */
export function buildEntryFromPersonalTodo(
  project: CourseProject,
  node: BlueprintNode,
  currentUserId: string = CURRENT_USER_ID,
): WorkspaceEntry {
  return {
    type: 'personal-coding',
    projectId: project.id,
    nodeId: node.id,
    ownerId: node.ownerId ?? currentUserId,
  };
}

/** 画布 / 侧栏：一律进入节点详情 */
export function buildEntryFromBlueprintNode(
  project: CourseProject,
  node: BlueprintNode,
): WorkspaceEntry {
  return {
    type: 'blueprint-detail',
    projectId: project.id,
    nodeId: node.id,
  };
}

/** 节点详情「开始工作 / 继续工作」→ 个人编码工作区 */
export function buildEntryToPersonalCoding(
  project: CourseProject,
  node: BlueprintNode,
  currentUserId: string = CURRENT_USER_ID,
): WorkspaceEntry {
  return {
    type: 'personal-coding',
    projectId: project.id,
    nodeId: node.id,
    ownerId: node.ownerId ?? currentUserId,
  };
}

export function isNodeOwner(
  node: BlueprintNode,
  currentUserId: string = CURRENT_USER_ID,
): boolean {
  return node.ownerId === currentUserId;
}

/**
 * 负责人 CTA 文案：
 * - 尚无个人工作内容（无 baseline / 无提交）→ 开始工作
 * - 已有个人仓内容或已提交公开快照 → 继续工作
 */
export function getOwnerWorkspaceCtaLabel(
  nodeId: string,
  projectId?: string,
): '开始工作' | '继续工作' {
  if (getSubmission(nodeId, projectId)) return '继续工作';
  if (getPresetFilesForTask(nodeId).length > 0) return '继续工作';
  return '开始工作';
}
