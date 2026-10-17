export type CodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'sql'
  | 'text';

export type CodeFile = {
  id: string;
  name: string;
  language: CodeLanguage;
  content: string;
  taskId: string;
  source: 'preset' | 'upload';
};

export type DiscussionType = 'question' | 'discussion' | 'review';

/** @deprecated 旧讨论状态；协作主路径见 types/collaboration DiscussionLifecycle */
export type DiscussionStatus = 'open' | 'resolved';

export type LineSelection = {
  lineStart: number;
  lineEnd: number;
};

export type DiscussionReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

export type Discussion = {
  id: string;
  type: DiscussionType;
  author: string;
  fileId: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  status: DiscussionStatus;
  relatedTraceId?: string | null;
  replies: DiscussionReply[];
  createdAt: string;
};

/** 兼容工作台现有溯源面板；后续可扩展为完整 Agent 对话链 */
export type AiTrace = {
  id: string;
  fileId: string;
  lineStart: number;
  lineEnd: number;
  sourceType: 'simulated';
  label: string;
  input: string;
  suggestion: string;
  status: 'ai-suggestion' | 'viewed' | 'pending-confirm';
};

/** @deprecated 兼容旧引用；新逻辑请使用 DutyId */
export type MemberRole =
  | 'owner'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'qa';

/** 预置职责 ID（注册分配 + 蓝图节点映射） */
export type DutyId =
  | 'project-owner'
  | 'backend-api'
  | 'database-design'
  | 'frontend-pages'
  | 'test-acceptance'
  | 'trade-integration'
  | 'product-analysis';

export type DutyDefinition = {
  id: DutyId;
  label: string;
  /** 可选成员能否在注册时分配该职责 */
  assignable: boolean;
  /** 仅体验者 Maya 固定承担 */
  lockedToExperience?: boolean;
};

export type MemberSlot = 'preset' | 'reserved' | 'easter-egg';

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  /** 专业方向 / 能力标签（仅展示，不参与搜索） */
  skillTags: string[];
  /** 选中时的默认主职责；锁定体验者可为 null（使用固定双职责） */
  defaultPrimaryDutyId: DutyId | null;
  selectable: boolean;
  locked: boolean;
  /** false = 预留/彩蛋槽，不出现在搜索列表 */
  enabled: boolean;
  slot: MemberSlot;
  /** 列表/页眉展示用短标签 */
  roleLabel: string;
  /** @deprecated 使用项目内 ProjectCollaborator.duty */
  roles: MemberRole[];
};

/** 写入项目的协作快照：主职责 + 至多一个附加职责 */
export type ProjectCollaborator = {
  memberId: string;
  primaryDutyId: DutyId;
  additionalDutyId: DutyId | null;
  locked: boolean;
};

export type BlueprintNodeStatus =
  | 'todo'
  | 'in-progress'
  | 'awaiting-review'
  | 'discussing'
  | 'needs-change'
  | 'accepted'
  | 'done';

export type BlueprintNode = {
  id: string;
  projectId: string;
  name: string;
  summary: string;
  ownerId: string | null;
  collaboratorIds: string[];
  status: BlueprintNodeStatus;
  dependsOn: string[];
  acceptance: string[];
  x: number;
  y: number;
  /** 负责人新增的空白节点（非 AI 初始理解） */
  isBlank?: boolean;
  /** 负责人修改记录（追加到任务演进） */
  editHistory?: string[];
};

export type CourseProject = {
  id: string;
  name: string;
  goal: string;
  courseName: string;
  processSteps: string[];
  created: boolean;
  /** 注册时固化的协作成员与职责；未选成员不会出现 */
  collaborators: ProjectCollaborator[];
};
