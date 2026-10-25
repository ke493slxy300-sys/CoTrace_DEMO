/**
 * @deprecated 团队讨论主路径已迁至 nodeCollaborationStore。
 * 此文件仅兼容旧工作台的代码行讨论结构。
 */

import type { Discussion } from "../types";
import { campusMarketplaceDataset } from "../datasets";

const workspaceDiscussionData = campusMarketplaceDataset.workspaceDiscussions;

/** @deprecated 旧工作台代码行讨论 */
export const presetDiscussions: Discussion[] =
  workspaceDiscussionData.discussions;

export function getPresetDiscussionsForTask(taskId: string): Discussion[] {
  if (taskId !== workspaceDiscussionData.taskId) return [];

  return presetDiscussions.map((item) => ({
    ...item,
    replies: item.replies.map((reply) => ({ ...reply })),
  }));
}
