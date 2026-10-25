/**
 * 节点协作统一数据层：ProjectAnnotation + TeamDiscussion。
 * localStorage key: cotrace-demo-node-collaboration
 * 组件禁止直接读写 localStorage。
 */

import { campusMarketplaceDataset } from "../datasets";
import { useSyncExternalStore } from "react";

import type {
  CollaborationMessage,
  CollaborationStoreData,
  DecisionSource,
  DiscussionViewStatus,
  ProjectAnnotation,
  TeamDiscussion,
} from "../types/collaboration";

export const COLLABORATION_STORAGE_KEY = "cotrace-demo-node-collaboration";

const GENERATION_DELAY_MS = 800;

type Listener = () => void;

let memory: CollaborationStoreData | null = null;
const listeners = new Set<Listener>();
const generationTimers = new Map<string, number>();

function nowIso(): string {
  return new Date().toISOString();
}

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function cloneStore(data: CollaborationStoreData): CollaborationStoreData {
  return structuredClone(data);
}

/** —— 三种 Demo 场景种子（固定 id，本地同 id 优先） —— */

export const DEMO_ANNOTATION_IDS = {
  A: "anno-demo-a-order-status",
  B: "anno-demo-b-error-codes",
  C: "anno-demo-c-awaiting-maya",
  DB: "anno-demo-db-order-status",
  FE: "anno-demo-fe-error-copy",
  INT: "anno-demo-int-error-shape",
} as const;

export const DEMO_DISCUSSION_IDS = {
  A: "disc-demo-a-archived-member",
  B: "disc-demo-b-ready-archive",
  C: "disc-demo-c-needs-maya-reply",
  DB: "disc-demo-db-archived-member",
  FE: "disc-demo-fe-waiting-backend",
  INT: "disc-demo-int-waiting-maya",
} as const;

function buildSeedData(): CollaborationStoreData {
  return structuredClone(campusMarketplaceDataset.collaborationSeed);
}

function parseStored(raw: string | null): CollaborationStoreData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as CollaborationStoreData;
    if (!data || data.version !== 1) return null;
    if (!Array.isArray(data.annotations) || !Array.isArray(data.discussions)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function mergeSeedWithLocal(
  seed: CollaborationStoreData,
  local: CollaborationStoreData | null,
): CollaborationStoreData {
  if (!local) return cloneStore(seed);
  const annMap = new Map<string, ProjectAnnotation>();
  for (const item of seed.annotations) annMap.set(item.id, item);
  for (const item of local.annotations) annMap.set(item.id, item);
  const discMap = new Map<string, TeamDiscussion>();
  for (const item of seed.discussions) discMap.set(item.id, item);
  for (const item of local.discussions) discMap.set(item.id, item);
  return {
    version: 1,
    annotations: [...annMap.values()],
    discussions: [...discMap.values()],
  };
}

function persist(data: CollaborationStoreData): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(COLLABORATION_STORAGE_KEY, JSON.stringify(data));
}

function emit(): void {
  for (const listener of listeners) listener();
}

const EMPTY_SNAPSHOT: CollaborationStoreData = Object.freeze({
  version: 1,
  annotations: [],
  discussions: [],
}) as CollaborationStoreData;

function ensureLoaded(): CollaborationStoreData {
  if (memory) return memory;
  const seed = buildSeedData();
  const local = canUseStorage()
    ? parseStored(window.localStorage.getItem(COLLABORATION_STORAGE_KEY))
    : null;
  memory = mergeSeedWithLocal(seed, local);
  persist(memory);
  resumePendingGenerations(memory);
  return memory;
}

/** 开发期：强制把缺失的种子 id 重新补入（不覆盖本地同 id 数据） */
export function rehydrateCollaborationSeeds(): void {
  memory = null;
  ensureLoaded();
  emit();
}

function commit(mutator: (draft: CollaborationStoreData) => void): void {
  const current = cloneStore(ensureLoaded());
  mutator(current);
  memory = current;
  persist(memory);
  emit();
}

function resumePendingGenerations(data: CollaborationStoreData): void {
  for (const disc of data.discussions) {
    if (disc.teamDecision.status === "generating") {
      scheduleDecisionGeneration(disc.id, false);
    }
  }
}

function scheduleDecisionGeneration(
  discussionId: string,
  writeGenerating: boolean,
): void {
  if (generationTimers.has(discussionId)) {
    window.clearTimeout(generationTimers.get(discussionId));
  }
  if (writeGenerating) {
    commit((draft) => {
      const disc = draft.discussions.find((item) => item.id === discussionId);
      if (!disc) return;
      disc.teamDecision.status = "generating";
      disc.teamDecision.generationRequestedAt = nowIso();
      disc.updatedAt = nowIso();
    });
  }
  if (typeof window === "undefined") return;
  const timer = window.setTimeout(() => {
    generationTimers.delete(discussionId);
    commit((draft) => {
      const disc = draft.discussions.find((item) => item.id === discussionId);
      if (!disc) return;
      if (disc.teamDecision.status !== "generating") return;
      const text =
        disc.decisionDraftPreset?.trim() ||
        `根据讨论「${disc.title}」整理：团队确认以对话中已达成的可执行方案为准，并在相关节点落地。`;
      disc.teamDecision.status = "draft";
      disc.teamDecision.source = "project-agent";
      disc.teamDecision.draftContent = text;
      disc.teamDecision.content = undefined;
      disc.updatedAt = nowIso();
    });
  }, GENERATION_DELAY_MS);
  generationTimers.set(discussionId, timer);
}

/** —— 显示状态 —— */

export function getDiscussionViewStatus(
  discussion: TeamDiscussion,
  currentUserId: string,
): DiscussionViewStatus {
  if (discussion.lifecycle === "archived") return "archived";
  if (discussion.lifecycle === "ready_to_archive") return "ready_to_archive";
  if (discussion.waitingOnMemberId === currentUserId) return "needs_my_reply";
  return "waiting_for_teammate";
}

export function getReadyToArchiveHint(
  discussion: TeamDiscussion,
  currentUserId: string,
): string | null {
  if (discussion.lifecycle !== "ready_to_archive") return null;
  if (discussion.waitingOnMemberId === currentUserId) {
    return "等待你确认归档";
  }
  return "等待成员确认归档";
}

export function getDecisionBadge(discussion: TeamDiscussion): string | null {
  if (discussion.lifecycle !== "archived") return null;
  const status = discussion.teamDecision.status;
  if (status === "generating") return "决定生成中";
  if (status === "draft") return "决定待确认";
  if (status === "confirmed") return "已形成团队决定";
  return null;
}

/** —— 订阅 / 快照 —— */

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => listeners.delete(listener);
}

export function getSnapshot(): CollaborationStoreData {
  return ensureLoaded();
}

export function getServerSnapshot(): CollaborationStoreData {
  return EMPTY_SNAPSHOT;
}

export function useNodeCollaborationStore(): CollaborationStoreData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** —— 标注 API —— */

export function getAnnotationsByNode(
  projectId: string,
  nodeId: string,
): ProjectAnnotation[] {
  return ensureLoaded()
    .annotations.filter(
      (item) => item.projectId === projectId && item.nodeId === nodeId,
    )
    .map((item) => structuredClone(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAnnotation(annotationId: string): ProjectAnnotation | null {
  const hit = ensureLoaded().annotations.find(
    (item) => item.id === annotationId,
  );
  return hit ? structuredClone(hit) : null;
}

export function createAnnotation(
  projectId: string,
  input: Omit<
    ProjectAnnotation,
    "id" | "projectId" | "createdAt" | "updatedAt"
  > & {
    id?: string;
  },
): ProjectAnnotation {
  const stamp = nowIso();
  const next: ProjectAnnotation = {
    id:
      input.id ??
      `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    nodeId: input.nodeId,
    authorId: input.authorId,
    typeLabel: input.typeLabel,
    summary: input.summary,
    content: input.content,
    target: input.target,
    affectsCode: input.affectsCode,
    createdAt: stamp,
    updatedAt: stamp,
  };
  commit((draft) => {
    draft.annotations.unshift(next);
  });
  return structuredClone(next);
}

export function updateAnnotation(
  annotationId: string,
  patch: Partial<
    Pick<
      ProjectAnnotation,
      "summary" | "content" | "typeLabel" | "affectsCode" | "target"
    >
  >,
): ProjectAnnotation | null {
  let updated: ProjectAnnotation | null = null;
  commit((draft) => {
    const hit = draft.annotations.find((item) => item.id === annotationId);
    if (!hit) return;
    Object.assign(hit, patch, { updatedAt: nowIso() });
    updated = structuredClone(hit);
  });
  return updated;
}

/** —— 讨论 API —— */

export function getDiscussionsByNode(
  projectId: string,
  nodeId: string,
): TeamDiscussion[] {
  return ensureLoaded()
    .discussions.filter(
      (item) => item.projectId === projectId && item.nodeId === nodeId,
    )
    .map((item) => structuredClone(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDiscussion(discussionId: string): TeamDiscussion | null {
  const hit = ensureLoaded().discussions.find(
    (item) => item.id === discussionId,
  );
  return hit ? structuredClone(hit) : null;
}

export function getDiscussionByAnnotationId(
  annotationId: string,
): TeamDiscussion | null {
  const hit = ensureLoaded().discussions.find(
    (item) => item.annotationId === annotationId,
  );
  return hit ? structuredClone(hit) : null;
}

export function hasDiscussionForAnnotation(annotationId: string): boolean {
  return ensureLoaded().discussions.some(
    (item) => item.annotationId === annotationId,
  );
}

export function createDiscussion(
  projectId: string,
  input: {
    nodeId: string;
    annotationId?: string;
    title: string;
    participantIds: string[];
    waitingOnMemberId: string;
    firstMessage: { authorId: string; content: string };
    decisionDraftPreset?: string;
  },
): TeamDiscussion {
  const stamp = nowIso();
  const message: CollaborationMessage = {
    id: `msg-${Date.now()}`,
    authorId: input.firstMessage.authorId,
    content: input.firstMessage.content,
    createdAt: stamp,
  };
  const next: TeamDiscussion = {
    id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    nodeId: input.nodeId,
    annotationId: input.annotationId,
    title: input.title,
    participantIds: [...new Set(input.participantIds)],
    lifecycle: "open",
    waitingOnMemberId: input.waitingOnMemberId,
    messages: [message],
    teamDecision: { status: "none" },
    decisionDraftPreset: input.decisionDraftPreset,
    createdAt: stamp,
    updatedAt: stamp,
  };
  commit((draft) => {
    draft.discussions.unshift(next);
  });
  return structuredClone(next);
}

export function sendDiscussionMessage(
  discussionId: string,
  message: { authorId: string; content: string },
): TeamDiscussion | null {
  let updated: TeamDiscussion | null = null;
  commit((draft) => {
    const disc = draft.discussions.find((item) => item.id === discussionId);
    if (!disc) return;
    if (disc.lifecycle === "archived") return;
    const stamp = nowIso();
    disc.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: message.authorId,
      content: message.content.trim(),
      createdAt: stamp,
    });
    if (disc.lifecycle === "open") {
      const others = disc.participantIds.filter(
        (id) => id !== message.authorId,
      );
      disc.waitingOnMemberId = others[0] ?? disc.waitingOnMemberId;
    }
    disc.updatedAt = stamp;
    updated = structuredClone(disc);
  });
  return updated;
}

export function markReadyToArchive(
  discussionId: string,
  waitingOnMemberId: string,
): TeamDiscussion | null {
  let updated: TeamDiscussion | null = null;
  commit((draft) => {
    const disc = draft.discussions.find((item) => item.id === discussionId);
    if (!disc || disc.lifecycle === "archived") return;
    disc.lifecycle = "ready_to_archive";
    disc.waitingOnMemberId = waitingOnMemberId;
    disc.updatedAt = nowIso();
    updated = structuredClone(disc);
  });
  return updated;
}

export function archiveDiscussion(
  discussionId: string,
  actorId: string,
): TeamDiscussion | null {
  let updated: TeamDiscussion | null = null;
  let shouldGenerate = false;
  commit((draft) => {
    const disc = draft.discussions.find((item) => item.id === discussionId);
    if (!disc) return;
    if (disc.lifecycle !== "ready_to_archive") return;
    if (disc.waitingOnMemberId !== actorId) return;
    const stamp = nowIso();
    disc.lifecycle = "archived";
    disc.waitingOnMemberId = undefined;
    disc.archivedBy = actorId;
    disc.archivedAt = stamp;
    disc.teamDecision.status = "generating";
    disc.teamDecision.generationRequestedAt = stamp;
    disc.teamDecision.source = undefined;
    disc.teamDecision.draftContent = undefined;
    disc.teamDecision.content = undefined;
    disc.updatedAt = stamp;
    updated = structuredClone(disc);
    shouldGenerate = true;
  });
  if (shouldGenerate) {
    scheduleDecisionGeneration(discussionId, false);
  }
  return updated;
}

export function generateDecisionDraft(discussionId: string): void {
  scheduleDecisionGeneration(discussionId, true);
}

export function confirmTeamDecision(
  discussionId: string,
  content: string,
  actorId: string,
  source: DecisionSource = "project-agent",
): TeamDiscussion | null {
  let updated: TeamDiscussion | null = null;
  commit((draft) => {
    const disc = draft.discussions.find((item) => item.id === discussionId);
    if (!disc) return;
    if (disc.lifecycle !== "archived") return;
    if (
      disc.teamDecision.status !== "draft" &&
      disc.teamDecision.status !== "generating"
    ) {
      return;
    }
    const stamp = nowIso();
    disc.teamDecision.status = "confirmed";
    disc.teamDecision.source = source;
    disc.teamDecision.content = content.trim();
    disc.teamDecision.confirmedBy = actorId;
    disc.teamDecision.confirmedAt = stamp;
    disc.updatedAt = stamp;
    updated = structuredClone(disc);
  });
  return updated;
}

/** 测试 / 演示：清空内存并重载（不删 localStorage，除非调用方自行清理） */
export function __resetCollaborationStoreForTests(): void {
  memory = null;
  for (const timer of generationTimers.values()) {
    window.clearTimeout(timer);
  }
  generationTimers.clear();
}
