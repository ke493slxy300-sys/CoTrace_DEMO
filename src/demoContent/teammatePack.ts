import type { CodeFile, CodeLanguage, CourseProject, DutyId } from '../types';
import {
  BLUEPRINT_OWNER_PENDING_LABEL,
  formatBlueprintOwnerLabel,
} from '../data/blueprint';
import {
  collaboratorHasDuty,
} from '../data/collaborators';
import { EXPERIENCE_MEMBER_ID, getMemberById } from '../data/members';
import { toAppNodeId } from './packIds';
import {
  PACK_DUTY_TO_APP,
  type TeammateDocumentRef,
  type TeammateTraceCard,
  type TeammateTracePack,
} from './teammateTypes';

import frontendTracesJson from './teammate/traces/teammate-a-frontend-traces.json';
import databaseTracesJson from './teammate/traces/teammate-b-database-traces.json';
import researchTracesJson from './teammate/traces/teammate-c-research-traces.json';
import researchMarkdownRaw from './teammate/research/sources/用户需求与分析.md?raw';

const frontendRaw = import.meta.glob('./teammate/frontend/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const databaseRaw = import.meta.glob('./teammate/database/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FRONTEND_FILES = [
  'src/pages/ItemDetailPage.jsx',
  'src/components/PurchasePanel.jsx',
  'src/components/OrderResultPanel.jsx',
  'src/services/orderApi.js',
  'src/utils/orderErrorMessages.js',
  'tests/PurchasePanel.test.jsx',
  'README.md',
] as const;

const DATABASE_FILES = [
  'sql/001_create_users_items.sql',
  'sql/002_create_orders.sql',
  'sql/003_add_order_constraints.sql',
  'sql/create_order_transaction.sql',
  'sql/seed_demo_data.sql',
  'README.md',
] as const;

const TEAMMATE_APP_NODES = new Set([
  'node-frontend',
  'node-database',
  'node-requirements',
]);

export function isTeammatePackNode(appNodeId: string): boolean {
  return TEAMMATE_APP_NODES.has(appNodeId);
}

function normalizeLanguage(path: string): CodeLanguage {
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  return 'text';
}

function resolveRaw(
  modules: Record<string, string>,
  marker: string,
  relativePath: string,
): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const hit = Object.entries(modules).find(([key]) =>
    key.replace(/\\/g, '/').endsWith(`${marker}/${normalized}`),
  );
  if (!hit) {
    console.warn(`[teammatePack] missing: ${marker}/${normalized}`);
    return `// missing teammate content: ${normalized}\n`;
  }
  return hit[1];
}

function toCodeFiles(
  taskId: string,
  modules: Record<string, string>,
  marker: string,
  paths: readonly string[],
): CodeFile[] {
  return paths.map((path) => ({
    id: `teammate-${taskId}-${path.replace(/[\\/]/g, '-')}`,
    name: path,
    language: normalizeLanguage(path),
    content: resolveRaw(modules, marker, path),
    taskId,
    source: 'preset' as const,
  }));
}

export function getTeammateFrontendFiles(): CodeFile[] {
  return toCodeFiles('node-frontend', frontendRaw, 'frontend', FRONTEND_FILES);
}

export function getTeammateDatabaseFiles(): CodeFile[] {
  return toCodeFiles('node-database', databaseRaw, 'database', DATABASE_FILES);
}

export function getTeammateDefaultFileId(
  files: CodeFile[],
  preferredPath: string,
): string | null {
  const hit = files.find((file) => file.name === preferredPath);
  return hit?.id ?? files[0]?.id ?? null;
}

export function getTeammateResearchDocuments(): TeammateDocumentRef[] {
  return [
    {
      id: 'doc-research-pdf',
      label: '用户需求与分析（PDF）',
      path: 'research/pdfs/用户需求与分析.pdf',
      mimeType: 'application/pdf',
      href: '/docs/research/用户需求与分析.pdf',
    },
    {
      id: 'doc-research-md',
      label: 'Markdown 源文档',
      path: 'research/sources/用户需求与分析.md',
      mimeType: 'text/markdown',
      markdownKey: 'research-md',
    },
  ];
}

export function getTeammateResearchMarkdown(): string {
  return researchMarkdownRaw;
}

function asTracePack(raw: unknown): TeammateTracePack {
  return raw as TeammateTracePack;
}

export function getTeammateTracePack(appNodeId: string): TeammateTracePack | null {
  switch (appNodeId) {
    case 'node-frontend':
      return asTracePack(frontendTracesJson);
    case 'node-database':
      return asTracePack(databaseTracesJson);
    case 'node-requirements':
      return asTracePack(researchTracesJson);
    default:
      return null;
  }
}

export function getSelectedTeammateTraceCards(
  appNodeId: string,
): TeammateTraceCard[] {
  const pack = getTeammateTracePack(appNodeId);
  if (!pack) return [];
  return pack.cards.filter((card) => card.selectedByCurrentMember);
}

export function getTeammateTraceMeta(appNodeId: string): {
  sourcePolicy: string;
  organizedBy: string;
} | null {
  const pack = getTeammateTracePack(appNodeId);
  if (!pack) return null;
  return {
    sourcePolicy: pack.sourcePolicy,
    organizedBy: pack.organizedBy,
  };
}

/** 按包内 resolveFromDuty 解析展示用负责人（占位 A/B/C → 真实协作者） */
export function resolveTeammateOwnerLabel(
  project: CourseProject,
  packDutyId: string | undefined,
  fallbackOwnerId: string | null | undefined,
): { ownerId?: string; ownerLabel: string } {
  /**
   * Demo 决定：product-analysis 暂归 Maya（体验者），需求与流程确认节点展示 Maya。
   * 真实产品中该职责未必属于项目负责人——见 PROJECT_STATUS 风险项。
   */
  if (packDutyId === 'product-analysis') {
    const maya = getMemberById(EXPERIENCE_MEMBER_ID);
    return {
      ownerId: EXPERIENCE_MEMBER_ID,
      ownerLabel: maya?.name ?? 'Maya Chen',
    };
  }

  if (packDutyId) {
    const duty = PACK_DUTY_TO_APP[packDutyId] ?? (packDutyId as DutyId);
    const hit = project.collaborators.find((item) =>
      collaboratorHasDuty(item, duty),
    );
    if (hit) {
      return {
        ownerId: hit.memberId,
        ownerLabel: getMemberById(hit.memberId)?.name ?? hit.memberId,
      };
    }
    return { ownerLabel: BLUEPRINT_OWNER_PENDING_LABEL };
  }

  if (fallbackOwnerId) {
    const inProject = project.collaborators.some(
      (item) => item.memberId === fallbackOwnerId,
    );
    if (inProject) {
      return {
        ownerId: fallbackOwnerId,
        ownerLabel: formatBlueprintOwnerLabel(fallbackOwnerId),
      };
    }
  }

  return { ownerLabel: BLUEPRINT_OWNER_PENDING_LABEL };
}

export function getTeammateResolveDuty(appNodeId: string): string | undefined {
  switch (appNodeId) {
    case 'node-frontend':
      return 'frontend-page';
    case 'node-database':
      return 'database-design';
    case 'node-requirements':
      return 'product-analysis';
    default:
      return undefined;
  }
}

export function getTeammateNodeTitle(appNodeId: string): string | null {
  switch (appNodeId) {
    case 'node-frontend':
      return '商品详情与下单反馈';
    case 'node-database':
      return '交易数据模型与创建订单事务';
    case 'node-requirements':
      return '用户需求与交易流程分析';
    default:
      return null;
  }
}

export function findTeammateFileByArtifactPath(
  files: CodeFile[],
  artifactPath: string,
): CodeFile | undefined {
  const normalized = artifactPath.replace(/\\/g, '/');
  const bare = normalized
    .replace(/^frontend\//, '')
    .replace(/^database\//, '');
  return (
    files.find((file) => file.name === bare) ??
    files.find((file) => normalized.endsWith(file.name))
  );
}

/** 仅用于说明：包节点 ID 与应用 ID 对照 */
export function describePackNodeMapping(packNodeId: string): string {
  return `${packNodeId} → ${toAppNodeId(packNodeId)}`;
}
