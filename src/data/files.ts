import { getBackendBaselineFiles } from '../demoContent/backendPack';
import { BACKEND_APP_NODE_ID } from '../demoContent/packIds';
import type { CodeFile } from '../types';

/** @deprecated 使用 BACKEND_APP_NODE_ID；保留别名兼容旧引用 */
export const BACKEND_TASK_ID = BACKEND_APP_NODE_ID;

/**
 * 个人工作区预置文件。
 * 后端 API 使用 Content Pack baseline；其他任务暂无仓内容。
 */
export function getPresetFilesForTask(taskId: string): CodeFile[] {
  if (taskId === BACKEND_APP_NODE_ID) {
    return getBackendBaselineFiles();
  }
  return [];
}
