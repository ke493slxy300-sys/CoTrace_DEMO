export type PackShareStatus = 'private' | 'selected';

export type PackAgentMessage = {
  id: string;
  time: string;
  speaker: 'user' | 'agent';
  speakerId?: string;
  type: string;
  text: string;
  fileRefs: string[];
  accepted: boolean | null;
  shareStatus: PackShareStatus;
  traceId?: string;
};

export type PackAgentSession = {
  sessionId: string;
  projectId: string;
  nodeId: string;
  ownerId: string;
  title: string;
  status: string;
  startedAt: string;
  submittedAt: string;
  messages: PackAgentMessage[];
};

export type PackSnapshotFile = {
  path: string;
  language: string;
  change?: string;
};

export type PackCodeSnapshot = {
  snapshotId: string;
  submissionId?: string;
  projectId: string;
  nodeId: string;
  ownerId: string;
  label: string;
  version: string;
  editable: boolean;
  root: string;
  defaultFile: string;
  files: PackSnapshotFile[];
  commitTitle?: string;
  commitSummary?: string;
  submittedAt?: string;
  testResult?: { command: string; passed: number; failed: number };
  limitations?: string[];
  knownGaps?: string[];
};

export type PackPublishedTrace = {
  id: string;
  title: string;
  summary: string;
  sourceMessageIds: string[];
  fileRefs: string[];
  decision: string;
  publishedBy: string;
};

export type PackPublishedTraces = {
  projectId: string;
  nodeId: string;
  submissionId: string;
  traces: PackPublishedTrace[];
};

export type PackSharedDocument = {
  id: string;
  title: string;
  ownerIds: string[];
  nodeIds: string[];
  version: string;
  status: string;
  updatedAt: string;
  summary: string;
  sourcePath: string;
  pdfPath: string;
};

export type PackLink = {
  concept: string;
  messageIds: string[];
  traceIds: string[];
  files: string[];
  documentIds: string[];
};
