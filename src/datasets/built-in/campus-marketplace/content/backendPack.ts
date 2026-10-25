import type { CodeFile, CodeLanguage } from "../../../../types";
import { getMemberById } from "../../../../data/members";
import { BACKEND_APP_NODE_ID } from "./packIds";
import type {
  PackAgentMessage,
  PackAgentSession,
  PackCodeSnapshot,
  PackLink,
  PackPublishedTrace,
  PackPublishedTraces,
  PackShareStatus,
  PackSharedDocument,
} from "./types";

import baselineMetaJson from "./data/backend-api-baseline.json";
import submissionMetaJson from "./data/backend-api-submission-v1.json";
import agentSessionJson from "./data/backend-api-agent-session.json";
import publishedTracesJson from "./data/published-ai-traces.json";
import sharedDocumentsJson from "./data/shared-documents.json";
import linkMapJson from "./data/demo-content-link-map.json";
import diffMapJson from "./data/backend-api-diff-map.json";

const baselineRaw = import.meta.glob("./code/backend-api/baseline/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const submissionRaw = import.meta.glob(
  "./code/backend-api/submission-v1/**/*",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

function normalizeLanguage(value: string): CodeLanguage {
  switch (value) {
    case "javascript":
    case "json":
    case "markdown":
    case "sql":
    case "typescript":
    case "python":
    case "html":
    case "css":
    case "text":
      return value;
    default:
      return "text";
  }
}

function resolveRawContent(
  modules: Record<string, string>,
  rootMarker: string,
  relativePath: string,
): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const hit = Object.entries(modules).find(([key]) =>
    key.replace(/\\/g, "/").endsWith(`${rootMarker}/${normalized}`),
  );
  if (!hit) {
    console.warn(`[demoContent] missing file: ${rootMarker}/${normalized}`);
    return `// missing demo content: ${normalized}\n`;
  }
  return hit[1];
}

function snapshotToCodeFiles(
  snapshot: PackCodeSnapshot,
  modules: Record<string, string>,
  rootMarker: string,
  source: "preset" | "upload",
): CodeFile[] {
  return snapshot.files.map((file) => ({
    id: `pack-${snapshot.snapshotId}-${file.path.replace(/[\\/]/g, "-")}`,
    name: file.path,
    language: normalizeLanguage(file.language),
    content: resolveRawContent(modules, rootMarker, file.path),
    taskId: BACKEND_APP_NODE_ID,
    source,
  }));
}

export const backendBaselineSnapshot = baselineMetaJson as PackCodeSnapshot;
export const backendSubmissionSnapshot = submissionMetaJson as PackCodeSnapshot;
export const backendAgentSession = agentSessionJson as PackAgentSession;
export const backendPublishedTraces =
  publishedTracesJson as PackPublishedTraces;
export const packSharedDocuments =
  sharedDocumentsJson.documents as PackSharedDocument[];
export const packContentLinks = linkMapJson.links as PackLink[];
export const backendDiffMap = diffMapJson;

/** 与 AiTraceThemeCard 字段对齐，供节点详情映射 */
export type PublishedTraceCardView = {
  id: string;
  theme: string;
  stage: string;
  summary: string;
  adoption?: string;
  relatedFileLabel?: string;
  changeRelation?: string;
  initiator: string;
  createdAt: string;
  dialogues: Array<{
    id: string;
    role: "user" | "agent";
    author: string;
    content: string;
  }>;
  fileRefs: string[];
  relatedDocumentTitles: string[];
};

export function getBackendBaselineFiles(): CodeFile[] {
  return snapshotToCodeFiles(
    backendBaselineSnapshot,
    baselineRaw,
    "baseline",
    "preset",
  );
}

export function getBackendSubmissionFiles(): CodeFile[] {
  return snapshotToCodeFiles(
    backendSubmissionSnapshot,
    submissionRaw,
    "submission-v1",
    "preset",
  );
}

export function getBackendDefaultFileId(
  files: CodeFile[],
  snapshot: PackCodeSnapshot,
): string | null {
  const match = files.find((file) => file.name === snapshot.defaultFile);
  return match?.id ?? files[0]?.id ?? null;
}

export function findCodeFileByPath(
  files: CodeFile[],
  path: string,
): CodeFile | undefined {
  const normalized = path.replace(/\\/g, "/");
  return (
    files.find((file) => file.name === normalized) ??
    files.find((file) => file.name.endsWith(normalized))
  );
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  text: "对话",
  analysis: "分析",
  explanation: "解释",
  question: "提问",
  constraint: "约束",
  plan: "计划",
  decision: "决定",
  "change-summary": "修改摘要",
  challenge: "质疑",
  alternatives: "方案",
  "test-result": "测试结果",
  "share-selection": "公开选择",
  "submission-summary": "提交摘要",
};

export type WorkspaceAgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  type: string;
  typeLabel: string;
  time: string;
  fileRefs: string[];
  shareStatus: PackShareStatus;
  accepted: boolean | null;
};

export function getBackendAgentWorkspaceMessages(): WorkspaceAgentMessage[] {
  return backendAgentSession.messages.map((msg) => ({
    id: msg.id,
    role: msg.speaker === "agent" ? "agent" : "user",
    content: msg.text,
    type: msg.type,
    typeLabel: MESSAGE_TYPE_LABELS[msg.type] ?? msg.type,
    time: msg.time,
    fileRefs: msg.fileRefs ?? [],
    shareStatus: msg.shareStatus,
    accepted: msg.accepted,
  }));
}

function messageById(id: string): PackAgentMessage | undefined {
  return backendAgentSession.messages.find((item) => item.id === id);
}

const DECISION_LABELS: Record<string, string> = {
  accepted: "已采纳",
  "human-adjusted": "人工调整后采纳",
  "accepted-with-limit": "已采纳（含限制）",
};

export function getBackendPublishedTraceCards(): PublishedTraceCardView[] {
  return backendPublishedTraces.traces.map((trace) =>
    publishedTraceToCard(trace),
  );
}

function publishedTraceToCard(
  trace: PackPublishedTrace,
): PublishedTraceCardView {
  const dialogues = trace.sourceMessageIds
    .map((id) => messageById(id))
    .filter((msg): msg is PackAgentMessage => Boolean(msg))
    .map((msg) => ({
      id: msg.id,
      role: (msg.speaker === "agent" ? "agent" : "user") as "user" | "agent",
      author:
        msg.speaker === "agent"
          ? "编程 Agent"
          : (getMemberById(msg.speakerId ?? "member-maya")?.name ??
            "Maya Chen"),
      content: msg.text,
    }));

  const link = packContentLinks.find((item) =>
    item.traceIds.includes(trace.id),
  );
  const relatedDocs = (link?.documentIds ?? [])
    .map((docId) => packSharedDocuments.find((doc) => doc.id === docId)?.title)
    .filter((title): title is string => Boolean(title));

  return {
    id: trace.id,
    theme: trace.title,
    stage: "公开溯源 · 提交后可见",
    summary: trace.summary,
    adoption: DECISION_LABELS[trace.decision] ?? trace.decision,
    relatedFileLabel: trace.fileRefs.join(" · "),
    changeRelation:
      relatedDocs.length > 0
        ? `关联文档：${relatedDocs.join("、")}`
        : undefined,
    initiator: getMemberById(trace.publishedBy)?.name ?? trace.publishedBy,
    createdAt:
      backendSubmissionSnapshot.submittedAt ?? "2026-10-16T10:13:00+08:00",
    dialogues,
    fileRefs: trace.fileRefs,
    relatedDocumentTitles: relatedDocs,
  };
}

export function getFilePathsForPublishedTrace(traceId: string): string[] {
  const trace = backendPublishedTraces.traces.find(
    (item) => item.id === traceId,
  );
  if (trace?.fileRefs?.length) return trace.fileRefs;
  const link = packContentLinks.find((item) => item.traceIds.includes(traceId));
  return link?.files ?? [];
}

export function getDocumentIdsForPublishedTrace(traceId: string): string[] {
  const link = packContentLinks.find((item) => item.traceIds.includes(traceId));
  return link?.documentIds ?? [];
}

export function getBackendSubmissionSummary() {
  return {
    id: backendSubmissionSnapshot.submissionId ?? "submission-backend-v1",
    title:
      backendSubmissionSnapshot.commitTitle ?? backendSubmissionSnapshot.label,
    author:
      getMemberById(backendSubmissionSnapshot.ownerId)?.name ?? "Maya Chen",
    summary: backendSubmissionSnapshot.commitSummary ?? "",
    createdAt:
      backendSubmissionSnapshot.submittedAt ?? "2026-10-16T10:13:00+08:00",
    relatedOutputs: backendSubmissionSnapshot.files.map((file) => file.path),
  };
}
