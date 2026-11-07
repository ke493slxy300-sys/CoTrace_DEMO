/** Handoff demo：交付、过程事件、教师核收 */

export type DemoRoleId = 'alex' | 'priya' | 'teacher';

/** draft → published → needs-revision → published(新版本) → received；也可直接接收 */
export type DeliveryStatus =
  | 'draft'
  | 'published'
  | 'needs-revision'
  | 'received';

export type MatchVerdict =
  | 'match'
  | 'suspect-wrong-version'
  | 'irrelevant'
  | 'insufficient-evidence';

export type MaterialCitation = {
  materialId: string;
  fragmentId?: string;
  excerpt: string;
  note: string;
};

export type CollaborationLog = {
  summary: string;
  humanActions: string[];
  aiActions: string[];
  openItems: string[];
  citations: MaterialCitation[];
  manuallyEdited: boolean;
};

export type DeliveryAnalysis = {
  analysisId: string;
  requestToken: number;
  verdict: MatchVerdict;
  differences: string[];
  citations: MaterialCitation[];
  collaborationLog: CollaborationLog;
  pendingConfirmations: string[];
  risks: string[];
  codeMaterialId: string;
  chatMaterialId: string;
  provider: 'mock' | 'live';
  modelLabel: string;
  createdAt: string;
};

export type DeliveryVersionSnapshot = {
  versionId: string;
  version: string;
  publishedAt: string;
  codeMaterialId: string;
  chatMaterialId: string;
  summary: string;
  brief: string;
  collaborationLog: CollaborationLog | null;
  analysis: DeliveryAnalysis | null;
  riskAcknowledged: boolean;
  riskNotes: string;
  manuallyEdited: boolean;
  changes: HandoffBriefBlock[];
  downstreamImpact: HandoffBriefBlock[];
  suggestedChecks: HandoffBriefBlock[];
  evidenceAndOpen: HandoffBriefBlock[];
  sourceIds: string[];
};

export type RevisionRequest = {
  versionId: string;
  note: string;
  evidenceLocator?: string;
  at: string;
  authorId: string;
};

export type HandoffFocusItem = {
  title: string;
  impact: string;
  checkAction: string;
  risk: string;
  uncertainty: string;
  citations: MaterialCitation[];
};

/** 业务层传给 AI 的本版确认日志（不依赖服务端读浏览器快照） */
export type SharedLogPayload = {
  summary: string;
  humanActions: string[];
  aiActions: string[];
  openItems: string[];
};

export type HandoffFocusAnnotation = {
  cacheKey: string;
  items: HandoffFocusItem[];
  provider: 'mock' | 'live';
  modelLabel: string;
  versionId: string;
  createdAt: string;
};

export type StudentHelpRequest = {
  id: string;
  projectId: string;
  taskId: string;
  deliveryId: string;
  versionId: string;
  studentText: string;
  adoptedClarify: string[];
  authorId: string;
  createdAt: string;
  status: 'open' | 'guided';
};

export type DeliveryFile = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: 'code' | 'doc';
};

export type DeliveryDiffLine = {
  version: string;
  text: string;
  highlight?: boolean;
};

/** 接手提示结构化块：事实 / 建议 / 未验证 */
export type HandoffBriefKind = 'fact' | 'suggestion' | 'unverified';

export type HandoffBriefBlock = {
  body: string;
  kind: HandoffBriefKind;
  /** 逐条回查原材料 */
  sourceIds: string[];
};

export type Delivery = {
  id: string;
  projectId: string;
  nodeId: string;
  title: string;
  version: string;
  publisherId: string;
  receiverId: string;
  /** 接收后要推进的蓝图节点（交易流程联调 = node-integration） */
  integrationNodeId: string;
  status: DeliveryStatus;
  usageNote: string;
  /** 交付摘要 / 使用说明（与 brief 并存，互不替换） */
  summary: string;
  /** 短接手提示；Priya 首屏优先展示已发布版 */
  brief: string;
  changes: HandoffBriefBlock[];
  downstreamImpact: HandoffBriefBlock[];
  suggestedChecks: HandoffBriefBlock[];
  evidenceAndOpen: HandoffBriefBlock[];
  /** 本轮整理所用材料 id */
  sourceIds: string[];
  /** 接收后主操作区右侧文案，与 integrationNodeId 的节点名称一致 */
  nextStep: string;
  /** 卡片上的黄色待验证提示 */
  pendingHighlight: string;
  verifiedItems: string[];
  pendingItems: string[];
  files: DeliveryFile[];
  versionDiffs: DeliveryDiffLine[];
  errorCode?: { code: string; meaning: string };
  agentSummaryDraft: string;
  publishedAt: string | null;
  receivedAt: string | null;
  /** —— 跨端交付链扩展 —— */
  selectedCodeMaterialId: string | null;
  selectedChatMaterialId: string | null;
  analysis: DeliveryAnalysis | null;
  analysisRequestToken: number;
  analysisStale: boolean;
  collaborationLog: CollaborationLog | null;
  riskAcknowledged: boolean;
  riskNotes: string;
  currentVersionId: string | null;
  publishedVersions: DeliveryVersionSnapshot[];
  revisionRequest: RevisionRequest | null;
  focusAnnotation: HandoffFocusAnnotation | null;
  helpRequest: StudentHelpRequest | null;
};

export type ProcessEvidenceKind = 'ai-suggestion' | 'student-edit' | 'verification';

export type ProcessEvidence = {
  id: string;
  kind: ProcessEvidenceKind;
  label: string;
  summary: string;
  at: string;
  linkLabel: string;
};

export type ProcessEventKind =
  | 'stage'
  | 'delivery-published'
  | 'delivery-received'
  | 'delivery-revision'
  | 'student-help'
  | 'teacher-feedback';

export type ProcessEvent = {
  id: string;
  projectId: string;
  dateLabel: string;
  title: string;
  statusLabel: string;
  statusTone: 'warning' | 'success' | 'neutral';
  kind: ProcessEventKind;
  summary: string;
  authorLabel: string;
  evidence: ProcessEvidence[];
  /** 关联交付 id（发布/接收事件） */
  deliveryId?: string;
  /** 关联版本 / 原事件（教师反馈回流） */
  versionId?: string;
  relatedEventId?: string;
};

export type TeacherFeedback = {
  id: string;
  eventId: string;
  projectId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export type FinalSubmission = {
  id: string;
  projectId: string;
  version: string;
  title: string;
  aiSummary: string;
  files: DeliveryFile[];
  evidence: ProcessEvidence[];
};

export type AcceptanceRecord = {
  submissionId: string;
  projectId: string;
  status: 'pending' | 'accepted';
  note: string;
  acceptedAt: string | null;
  acceptedById: string | null;
};
