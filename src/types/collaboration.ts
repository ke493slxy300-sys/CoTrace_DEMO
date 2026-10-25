/**
 * 节点协作：项目标注 + 团队讨论（方案 C）。
 * 与旧 types/index.ts 中 Discussion / open|resolved 并存。
 */

export type DiscussionLifecycle = "open" | "ready_to_archive" | "archived";

/** 相对当前查看者；不入库 */
export type DiscussionViewStatus =
  | "needs_my_reply"
  | "waiting_for_teammate"
  | "ready_to_archive"
  | "archived";

export type DecisionStatus = "none" | "generating" | "draft" | "confirmed";
export type DecisionSource = "member" | "project-agent";

export type TeamDecision = {
  status: DecisionStatus;
  source?: DecisionSource;
  draftContent?: string;
  content?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  /** 进入 generating 的时间，用于刷新后恢复模拟生成 */
  generationRequestedAt?: string;
};

export type CollaborationMessage = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export type AnnotationTarget =
  | { kind: "node" }
  | { kind: "file"; fileId: string; fileLabel?: string }
  | {
      kind: "lines";
      fileId: string;
      lineStart: number;
      lineEnd: number;
      fileLabel?: string;
    }
  | {
      kind: "trace";
      traceCardId: string;
      traceTitle?: string;
    };

export type ProjectAnnotation = {
  id: string;
  projectId: string;
  nodeId: string;
  authorId: string;
  typeLabel: string;
  summary: string;
  content: string;
  target: AnnotationTarget;
  affectsCode: boolean;
  /** true 表示只有节点产生提交后才显示 */
  visibleAfterSubmissionOnly?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamDiscussion = {
  id: string;
  projectId: string;
  nodeId: string;
  annotationId?: string;
  title: string;
  participantIds: string[];
  lifecycle: DiscussionLifecycle;
  waitingOnMemberId?: string;
  messages: CollaborationMessage[];
  teamDecision: TeamDecision;
  archivedBy?: string;
  archivedAt?: string;
  decisionDraftPreset?: string;
  createdAt: string;
  updatedAt: string;
};

export type CollaborationStoreData = {
  version: 1;
  annotations: ProjectAnnotation[];
  discussions: TeamDiscussion[];
};
