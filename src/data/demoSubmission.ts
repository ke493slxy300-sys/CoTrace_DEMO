/**
 * Demo 提交快照：本地持久化，供队友节点详情优先读取。
 * 不包含 submitted / approved / rejected 等审批状态字段。
 */

import type { CodeFile } from '../types';

export const DEMO_SUBMISSION_STORAGE_KEY = 'cotrace-demo-submissions';

/** 随提交公开的主题溯源卡（不含完整原始对话） */
export type DemoSubmissionTraceCard = {
  id: string;
  title: string;
  fragmentSummary: string;
  humanUnderstanding: string;
  humanDecision: string;
};

export type DemoSubmission = {
  id: string;
  projectId: string;
  nodeId: string;
  taskId: string;
  author: string;
  description: string;
  codeFiles: CodeFile[];
  traceCards: DemoSubmissionTraceCard[];
  createdAt: string;
};

type SubmissionsByNodeId = Record<string, DemoSubmission>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 提交存储格式版本；与 demoStorage schema 配合，旧无 version 数据仍可读 */
export const DEMO_SUBMISSION_FORMAT_VERSION = 1;

export function serializeSubmissions(map: SubmissionsByNodeId): string {
  return JSON.stringify({
    version: DEMO_SUBMISSION_FORMAT_VERSION,
    submissionsByNodeId: map,
  });
}

export function parseSubmissions(raw: string | null): SubmissionsByNodeId {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as {
      version?: number;
      submissionsByNodeId?: SubmissionsByNodeId;
    };
    if (!data || typeof data !== 'object') return {};
    if (
      data.version != null &&
      data.version !== DEMO_SUBMISSION_FORMAT_VERSION
    ) {
      return {};
    }
    return data.submissionsByNodeId ?? {};
  } catch {
    return {};
  }
}

function readMap(): SubmissionsByNodeId {
  if (!canUseStorage()) return {};
  return parseSubmissions(window.localStorage.getItem(DEMO_SUBMISSION_STORAGE_KEY));
}

function writeMap(map: SubmissionsByNodeId): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DEMO_SUBMISSION_STORAGE_KEY, serializeSubmissions(map));
}

/**
 * 读取节点提交快照。
 * 传入 projectId 时必须匹配，避免旧会话数据串入（Demo 项目 id 虽固定，仍作校验）。
 */
export function getSubmission(
  nodeId: string,
  projectId?: string,
): DemoSubmission | null {
  const hit = readMap()[nodeId];
  if (!hit) return null;
  if (projectId && hit.projectId !== projectId) return null;
  return structuredClone(hit);
}

export function saveSubmission(submission: DemoSubmission): DemoSubmission {
  const map = readMap();
  const next = structuredClone(submission);
  map[submission.nodeId] = next;
  writeMap(map);
  return structuredClone(next);
}

export function clearSubmission(nodeId: string): void {
  const map = readMap();
  if (!(nodeId in map)) return;
  delete map[nodeId];
  writeMap(map);
}

/** 新建项目时调用：清空全部 Demo 提交，避免同 nodeId 残留 */
export function clearAllSubmissions(): void {
  writeMap({});
}

export function listSubmissionNodeIds(): string[] {
  return Object.keys(readMap());
}
