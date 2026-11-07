/**
 * Demo 提交快照：本地持久化，供队友节点详情优先读取。
 * 交接交付与节点快照写在同一个 localStorage 文档里（key 仍是 cotrace-demo-submissions）。
 * 不包含 submitted / approved / rejected 等审批状态字段。
 */

import type { Delivery } from '../types/handoff';
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

type SubmissionDocument = {
  version: number;
  submissionsByNodeId: SubmissionsByNodeId;
  /** 订单 v0.4 交接的唯一记录；缺省表示草稿尚未落盘 */
  handoffDelivery: Delivery | null;
};

type Listener = () => void;

/** 提交存储格式版本；旧文档没有 handoffDelivery 时仍可读 */
export const DEMO_SUBMISSION_FORMAT_VERSION = 1;

const listeners = new Set<Listener>();
let memoryDoc: SubmissionDocument | null = null;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emptyDocument(): SubmissionDocument {
  return {
    version: DEMO_SUBMISSION_FORMAT_VERSION,
    submissionsByNodeId: {},
    handoffDelivery: null,
  };
}

export function serializeSubmissionDocument(doc: SubmissionDocument): string {
  return JSON.stringify({
    version: DEMO_SUBMISSION_FORMAT_VERSION,
    submissionsByNodeId: doc.submissionsByNodeId,
    handoffDelivery: doc.handoffDelivery,
  });
}

export function parseSubmissionDocument(raw: string | null): SubmissionDocument {
  if (!raw) return emptyDocument();
  try {
    const data = JSON.parse(raw) as {
      version?: number;
      submissionsByNodeId?: SubmissionsByNodeId;
      handoffDelivery?: Delivery | null;
    };
    if (!data || typeof data !== 'object') return emptyDocument();
    if (
      data.version != null &&
      data.version !== DEMO_SUBMISSION_FORMAT_VERSION
    ) {
      return emptyDocument();
    }
    return {
      version: DEMO_SUBMISSION_FORMAT_VERSION,
      submissionsByNodeId: data.submissionsByNodeId ?? {},
      handoffDelivery: data.handoffDelivery ?? null,
    };
  } catch {
    return emptyDocument();
  }
}

export function serializeSubmissions(map: SubmissionsByNodeId): string {
  return serializeSubmissionDocument({
    version: DEMO_SUBMISSION_FORMAT_VERSION,
    submissionsByNodeId: map,
    handoffDelivery: null,
  });
}

export function parseSubmissions(raw: string | null): SubmissionsByNodeId {
  return parseSubmissionDocument(raw).submissionsByNodeId;
}

function readDoc(): SubmissionDocument {
  if (memoryDoc) return memoryDoc;
  if (!canUseStorage()) {
    memoryDoc = emptyDocument();
    return memoryDoc;
  }
  memoryDoc = parseSubmissionDocument(
    window.localStorage.getItem(DEMO_SUBMISSION_STORAGE_KEY),
  );
  return memoryDoc;
}

function writeDoc(doc: SubmissionDocument): void {
  memoryDoc = doc;
  if (canUseStorage()) {
    window.localStorage.setItem(
      DEMO_SUBMISSION_STORAGE_KEY,
      serializeSubmissionDocument(doc),
    );
  }
  for (const listener of listeners) listener();
}

export function subscribeSubmissionDocument(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 从 localStorage 重新装载。重置页面重载前也可调用。 */
export function rehydrateSubmissionDocument(): void {
  memoryDoc = null;
  if (canUseStorage()) {
    memoryDoc = parseSubmissionDocument(
      window.localStorage.getItem(DEMO_SUBMISSION_STORAGE_KEY),
    );
  }
  for (const listener of listeners) listener();
}

/**
 * 读取节点提交快照。
 * 传入 projectId 时必须匹配，避免旧会话数据串入（Demo 项目 id 虽固定，仍作校验）。
 */
export function getSubmission(
  nodeId: string,
  projectId?: string,
): DemoSubmission | null {
  const hit = readDoc().submissionsByNodeId[nodeId];
  if (!hit) return null;
  if (projectId && hit.projectId !== projectId) return null;
  return structuredClone(hit);
}

export function saveSubmission(submission: DemoSubmission): DemoSubmission {
  const doc = readDoc();
  const next = structuredClone(submission);
  writeDoc({
    ...doc,
    submissionsByNodeId: {
      ...doc.submissionsByNodeId,
      [submission.nodeId]: next,
    },
  });
  return structuredClone(next);
}

export function clearSubmission(nodeId: string): void {
  const doc = readDoc();
  if (!(nodeId in doc.submissionsByNodeId)) return;
  const submissionsByNodeId = { ...doc.submissionsByNodeId };
  delete submissionsByNodeId[nodeId];
  writeDoc({ ...doc, submissionsByNodeId });
}

/** 新建项目或重置演示时调用：清空节点快照和交接记录 */
export function clearAllSubmissions(): void {
  writeDoc(emptyDocument());
}

export function listSubmissionNodeIds(): string[] {
  return Object.keys(readDoc().submissionsByNodeId);
}

export function getHandoffDelivery(): Delivery | null {
  const delivery = readDoc().handoffDelivery;
  return delivery ? structuredClone(delivery) : null;
}

/**
 * 写入唯一交接记录。publicSnapshot 非空时同步覆盖对应节点的公开快照（同一 id）。
 * 草稿传 null，避免节点详情把未发布内容当成已提交。
 */
export function commitHandoffDelivery(
  delivery: Delivery,
  publicSnapshot: DemoSubmission | null,
): Delivery {
  const doc = readDoc();
  const next = structuredClone(delivery);
  const submissionsByNodeId = { ...doc.submissionsByNodeId };
  if (
    publicSnapshot &&
    (next.status === 'published' || next.status === 'received')
  ) {
    submissionsByNodeId[publicSnapshot.nodeId] = structuredClone(publicSnapshot);
  }
  writeDoc({
    version: DEMO_SUBMISSION_FORMAT_VERSION,
    submissionsByNodeId,
    handoffDelivery: next,
  });
  return structuredClone(next);
}
