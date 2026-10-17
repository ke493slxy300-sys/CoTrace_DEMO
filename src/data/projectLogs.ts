/**
 * SeatFlow 项目日志数据适配。
 * 源：demoContent/projectLog（源自 CoTrace_Project_Log_Demo_Pack）。
 * 开发日志 JSON 不接入体验者 UI。
 */

import seatflowCardJson from '../demoContent/projectLog/seatflow-project-card.json';
import seatflowLogJson from '../demoContent/projectLog/seatflow-project-log.json';
import { EXPERIENCE_MEMBER_ID } from './members';

/** 与 content-state-map 对齐的展示用语（勿混用） */
export const PUBLICATION_STATE_LABELS = {
  submitted: '已提交（团队可见快照）',
  not_submitted: '未提交（私人草稿）',
  seeded_shared: '预置共享（Demo 种子）',
} as const;

export const DECISION_STATE_LABELS = {
  confirmed: '已确认（confirmed_memory）',
  pending_confirmation: '待确认（草案）',
  none: '无决定',
} as const;

export const TASK_STATUS_LABELS = {
  completed: '任务已完成',
  'in-progress': '进行中',
} as const;

export type SeatflowProjectCard = {
  id: string;
  name: string;
  subtitle: string;
  projectType: string;
  status: string;
  statusLabel: string;
  dateRange: string;
  summary: string;
  memberCount: number;
  members: Array<{
    memberId: string;
    displayName: string;
    isPlaceholder: boolean;
  }>;
  logStats: {
    decisionCount: number;
    growthCount: number;
    experienceCount: number;
  };
  primaryAction: {
    label: string;
    target: string;
    projectId: string;
  };
  demoNotice: string;
};

export type SeatflowEvidence = {
  kind: string;
  label: string;
  availability: string;
};

export type SeatflowDecision = {
  id: string;
  dateLabel: string;
  title: string;
  recordType: string;
  participants: string[];
  problem: string;
  discussion: string;
  decision: string;
  reason: string;
  taskStatus: string;
  publicationState: string;
  decisionState: string;
  evidence: SeatflowEvidence[];
  /** 展示用：从包内文案推导的 AI 帮助 / 人类理解 */
  aiHelp: string;
  humanReview: string;
};

export type SeatflowProjectLog = {
  projectId: string;
  projectName: string;
  pageTitle: string;
  pageDescription: string;
  status: string;
  demoNotice: string;
  search: {
    placeholder: string;
    suggestedKeywords: string[];
  };
  decisionHistory: SeatflowDecision[];
  personalGrowth: {
    visibility: string;
    ownerId: string;
    notice: string;
    importantDecisions: string[];
    resolvedProblems: string[];
    practicedSkills: string[];
  };
  agentSummary: {
    basis: string;
    aiHelp: string[];
    humanDecisions: string[];
    engineeringExperience: string[];
    footer: string;
  };
};

const AI_HELP_BY_DECISION: Record<string, string> = {
  'seatflow-decision-status':
    '比较单一 booked 与 reserved / confirmed 两阶段状态，并提示界面不能领先于真实业务进度。',
  'seatflow-decision-concurrency':
    '补充并发失败路径分析，帮助区分前端防重复与数据库一致性责任。',
  'seatflow-decision-scope':
    '建议同时加入定时任务、消息通知和签到流程以覆盖超时释放。',
};

const HUMAN_REVIEW_BY_DECISION: Record<string, string> = {
  'seatflow-decision-status':
    '成员筛选后采用两阶段状态：创建接口只表示预约已建立，等待后续确认。',
  'seatflow-decision-concurrency':
    '成员确认前端禁用不足以阻止多客户端并发，必须以数据库约束为准。',
  'seatflow-decision-scope':
    '成员修正 AI 完整方案：保留超时释放为已知风险，本阶段不扩展调度与通知系统。',
};

export const SEATFLOW_PROJECT_ID = 'project-seatflow-demo';

export const DEMO_EVIDENCE_TOAST =
  'Demo 历史证据，仅用于展示项目记忆结构。';

export function getSeatflowProjectCard(): SeatflowProjectCard {
  return seatflowCardJson as SeatflowProjectCard;
}

export function getSeatflowProjectLog(): SeatflowProjectLog {
  const raw = seatflowLogJson as Omit<SeatflowProjectLog, 'decisionHistory'> & {
    decisionHistory: Array<
      Omit<SeatflowDecision, 'aiHelp' | 'humanReview'> & {
        aiHelp?: string;
        humanReview?: string;
      }
    >;
  };

  return {
    ...raw,
    decisionHistory: raw.decisionHistory.map((item) => ({
      ...item,
      aiHelp: item.aiHelp ?? AI_HELP_BY_DECISION[item.id] ?? item.discussion,
      humanReview:
        item.humanReview ?? HUMAN_REVIEW_BY_DECISION[item.id] ?? item.discussion,
    })),
  };
}

export function canViewPersonalGrowth(
  ownerId: string,
  currentMemberId: string = EXPERIENCE_MEMBER_ID,
): boolean {
  return ownerId === currentMemberId;
}

export function formatPublicationState(state: string): string {
  if (state in PUBLICATION_STATE_LABELS) {
    return PUBLICATION_STATE_LABELS[
      state as keyof typeof PUBLICATION_STATE_LABELS
    ];
  }
  return state;
}

export function formatDecisionState(state: string): string {
  if (state === 'confirmed') return DECISION_STATE_LABELS.confirmed;
  if (state === 'pending_confirmation') {
    return DECISION_STATE_LABELS.pending_confirmation;
  }
  return state;
}

export function formatTaskStatus(status: string): string {
  if (status in TASK_STATUS_LABELS) {
    return TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS];
  }
  return status;
}

export function filterDecisions(
  decisions: SeatflowDecision[],
  query: string,
  keyword: string | null,
): SeatflowDecision[] {
  const q = query.trim().toLowerCase();
  const kw = keyword?.trim().toLowerCase() ?? '';

  return decisions.filter((item) => {
    const haystack = [
      item.title,
      item.problem,
      item.discussion,
      item.decision,
      item.reason,
      item.aiHelp,
      item.humanReview,
      ...item.evidence.map((e) => e.label),
    ]
      .join(' ')
      .toLowerCase();

    if (kw && !haystack.includes(kw)) return false;
    if (q && !haystack.includes(q)) return false;
    return true;
  });
}
