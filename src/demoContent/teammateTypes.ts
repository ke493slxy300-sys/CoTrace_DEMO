import type { DutyId } from '../types';

export type TeammateOwnerRef = {
  memberId: string;
  displayName: string;
  isPlaceholder: boolean;
  resolveFromDuty?: string;
};

export type TeammateTraceFragment = {
  speaker: string;
  text: string;
};

export type TeammateTraceCard = {
  id: string;
  generatedTitle: string;
  displayTitle: string;
  titleEdited: boolean;
  topic: string;
  selectedByCurrentMember: boolean;
  selectionNote: string;
  fragments: TeammateTraceFragment[];
  humanUnderstanding: string;
  humanDecision: string;
  affectedArtifacts: string[];
  unresolved: string;
  memoryCandidate: string;
};

export type TeammateTracePack = {
  nodeId: string;
  sourcePolicy: string;
  organizedBy: string;
  placeholderNotice?: string;
  cards: TeammateTraceCard[];
};

export type TeammateDocumentRef = {
  id: string;
  label: string;
  path: string;
  mimeType: string;
  /** 站点可打开路径（PDF）或内嵌 markdown 内容键 */
  href?: string;
  markdownKey?: string;
};

/** 包内职责 ID → 应用 DutyId */
export const PACK_DUTY_TO_APP: Record<string, DutyId> = {
  'frontend-page': 'frontend-pages',
  'frontend-pages': 'frontend-pages',
  'database-design': 'database-design',
  'product-analysis': 'product-analysis',
  'backend-api': 'backend-api',
};
