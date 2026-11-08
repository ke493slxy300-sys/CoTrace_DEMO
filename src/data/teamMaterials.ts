/**
 * 团队材料库：按项目隔离的目录 / 文件 / 版本。
 * ID 稳定，可供 URL 定位与跨页引用。
 */

import { HANDOFF_PROJECT_ID } from './handoffDemoSeed';
import { SEATFLOW_PROJECT_ID } from './projectLogs';
import { getMemberById } from './members';

export type MaterialFolderId =
  | 'folder-req'
  | 'folder-api'
  | 'folder-integration'
  | 'folder-demo';

export type MaterialFolder = {
  id: MaterialFolderId;
  name: string;
  /** 卡片低饱和背景 */
  accent: string;
  /** 卡片图标色 */
  ink: string;
  sort: number;
};

export type MaterialVersionSource =
  | { kind: 'href'; href: string }
  | { kind: 'api-material'; materialId: string }
  | { kind: 'inline'; body: string; mime?: string };

export type MaterialVersion = {
  id: string;
  label: string;
  /** 下载时保留的文件名（含扩展名） */
  fileName: string;
  submitterId: string;
  submittedAt: string;
  source: MaterialVersionSource;
  /** 与交付选用材料 ID 对齐，供跨页历史定位 */
  demoMaterialId?: string;
};

export type MaterialFile = {
  id: string;
  projectId: string;
  folderId: MaterialFolderId;
  /** 列表展示名 */
  displayName: string;
  nodeIds: string[];
  currentVersionId: string;
  versions: MaterialVersion[];
};

export const MATERIAL_FOLDERS: MaterialFolder[] = [
  {
    id: 'folder-req',
    name: '需求与原型',
    accent: '#e7f5ef',
    ink: '#1b7a58',
    sort: 1,
  },
  {
    id: 'folder-api',
    name: '接口与开发',
    accent: '#e8f1fb',
    ink: '#2b6cb0',
    sort: 2,
  },
  {
    id: 'folder-integration',
    name: '联调与测试',
    accent: '#f7efe4',
    ink: '#ad5d00',
    sort: 3,
  },
  {
    id: 'folder-demo',
    name: 'Demo 与汇报',
    accent: '#efe8f8',
    ink: '#6b46c1',
    sort: 4,
  },
];

const ALL_FOLDER_ID = 'all' as const;
export type MaterialsTreeId = typeof ALL_FOLDER_ID | MaterialFolderId;
export const MATERIALS_ALL_ID: MaterialsTreeId = ALL_FOLDER_ID;

const CAMPUS_FILES: MaterialFile[] = [
  {
    id: 'matfile-req-scope',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-req',
    displayName: '项目需求与范围说明.pdf',
    nodeIds: ['node-requirements'],
    currentVersionId: 'matver-req-scope-v1',
    versions: [
      {
        id: 'matver-req-scope-v1',
        label: 'v1.0',
        fileName: '项目需求与范围说明.pdf',
        submitterId: 'member-maya',
        submittedAt: '2026-10-16T09:10:00+08:00',
        source: { kind: 'href', href: '/docs/01_项目需求与范围说明.pdf' },
      },
    ],
  },
  {
    id: 'matfile-biz-flow',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-req',
    displayName: '二手交易核心业务流程.pdf',
    nodeIds: ['node-integration'],
    currentVersionId: 'matver-biz-flow-v1',
    versions: [
      {
        id: 'matver-biz-flow-v1',
        label: 'v1.0',
        fileName: '二手交易核心业务流程.pdf',
        submitterId: 'member-alex',
        submittedAt: '2026-10-16T09:20:00+08:00',
        source: { kind: 'href', href: '/docs/02_二手交易核心业务流程.pdf' },
      },
    ],
  },
  {
    id: 'matfile-order-api',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-api',
    displayName: '订单API接口规范.pdf',
    nodeIds: ['node-backend'],
    currentVersionId: 'matver-order-api-v1',
    versions: [
      {
        id: 'matver-order-api-v04',
        label: 'v0.4',
        fileName: '订单接口约定.md',
        submitterId: 'member-alex',
        submittedAt: '2026-10-16T10:00:00+08:00',
        source: {
          kind: 'href',
          href: '/materials/订单接口约定-v0.4.md',
        },
      },
      {
        id: 'matver-order-api-v1',
        label: 'v1.0',
        fileName: '订单API接口规范.pdf',
        submitterId: 'member-maya',
        submittedAt: '2026-10-16T10:13:00+08:00',
        source: { kind: 'href', href: '/docs/04_订单API接口规范.pdf' },
      },
    ],
  },
  {
    id: 'matfile-order-service',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-api',
    displayName: 'orderService.js',
    nodeIds: ['node-backend'],
    currentVersionId: 'matver-order-svc-v04',
    versions: [
      {
        id: 'matver-order-svc-v03',
        label: 'v0.3',
        fileName: 'orderService.js',
        submitterId: 'member-alex',
        submittedAt: '2026-10-14T16:00:00+08:00',
        demoMaterialId: 'mat-code-order-v03',
        source: {
          kind: 'href',
          href: '/materials/orderService-v0.3.mjs',
        },
      },
      {
        id: 'matver-order-svc-v04',
        label: 'v0.4',
        fileName: 'orderService.js',
        submitterId: 'member-alex',
        submittedAt: '2026-10-16T11:00:00+08:00',
        demoMaterialId: 'mat-code-order-v04',
        source: {
          kind: 'href',
          href: '/materials/orderService-v0.4.mjs',
        },
      },
    ],
  },
  {
    id: 'matfile-db-schema',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-api',
    displayName: '数据库结构设计.pdf',
    nodeIds: ['node-database'],
    currentVersionId: 'matver-db-schema-v1',
    versions: [
      {
        id: 'matver-db-schema-v1',
        label: 'v1.0',
        fileName: '数据库结构设计.pdf',
        submitterId: 'member-alex',
        submittedAt: '2026-10-16T09:25:00+08:00',
        source: { kind: 'href', href: '/docs/03_数据库结构设计.pdf' },
      },
    ],
  },
  {
    id: 'matfile-integration-guide',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-integration',
    displayName: '前后端联调说明.pdf',
    nodeIds: ['node-frontend', 'node-integration'],
    currentVersionId: 'matver-integration-v1',
    versions: [
      {
        id: 'matver-integration-v1',
        label: 'v1.0',
        fileName: '前后端联调说明.pdf',
        submitterId: 'member-priya',
        submittedAt: '2026-10-16T10:20:00+08:00',
        source: { kind: 'href', href: '/docs/05_前后端联调说明.pdf' },
      },
    ],
  },
  {
    id: 'matfile-test-run',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-integration',
    displayName: '订单服务测试结果.txt',
    nodeIds: ['node-backend', 'node-integration'],
    currentVersionId: 'matver-test-run-v04',
    versions: [
      {
        id: 'matver-test-run-v04',
        label: 'v0.4',
        fileName: '订单服务测试结果.txt',
        submitterId: 'member-alex',
        submittedAt: '2026-10-16T11:05:00+08:00',
        source: {
          kind: 'href',
          href: '/materials/订单服务测试结果-v0.4.txt',
        },
      },
    ],
  },
  {
    id: 'matfile-test-checklist',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-integration',
    displayName: '测试与验收清单.pdf',
    nodeIds: ['node-testing'],
    currentVersionId: 'matver-test-checklist-v1',
    versions: [
      {
        id: 'matver-test-checklist-v1',
        label: 'v1.0',
        fileName: '测试与验收清单.pdf',
        submitterId: 'member-jordan',
        submittedAt: '2026-10-16T10:25:00+08:00',
        source: { kind: 'href', href: '/docs/06_测试与验收清单.pdf' },
      },
    ],
  },
  {
    id: 'matfile-demo-script',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-demo',
    displayName: '角色走查说明.pdf',
    nodeIds: ['node-acceptance'],
    currentVersionId: 'matver-demo-script-v1',
    versions: [
      {
        id: 'matver-demo-script-v1',
        label: 'v1.0',
        fileName: '角色走查说明.pdf',
        submitterId: 'member-alex',
        submittedAt: '2026-10-17T09:00:00+08:00',
        source: { kind: 'href', href: '/docs/role-review-guide.pdf' },
      },
    ],
  },
  {
    id: 'matfile-course-req',
    projectId: HANDOFF_PROJECT_ID,
    folderId: 'folder-demo',
    displayName: '课程需求说明.pdf',
    nodeIds: ['node-acceptance'],
    currentVersionId: 'matver-course-req-v1',
    versions: [
      {
        id: 'matver-course-req-v1',
        label: 'v1.0',
        fileName: '课程需求说明.pdf',
        submitterId: 'member-teacher',
        submittedAt: '2026-10-10T09:00:00+08:00',
        source: { kind: 'href', href: '/docs/se-course-requirements.pdf' },
      },
    ],
  },
];

const SEATFLOW_FILES: MaterialFile[] = [
  {
    id: 'matfile-seat-consensus',
    projectId: SEATFLOW_PROJECT_ID,
    folderId: 'folder-req',
    displayName: 'AI 共识协议.pdf',
    nodeIds: [],
    currentVersionId: 'matver-seat-consensus-v1',
    versions: [
      {
        id: 'matver-seat-consensus-v1',
        label: 'v1.0',
        fileName: 'AI 共识协议.pdf',
        submitterId: 'member-alex',
        submittedAt: '2026-09-20T10:00:00+08:00',
        source: { kind: 'href', href: '/docs/ai-consensus-protocol.pdf' },
      },
    ],
  },
  {
    id: 'matfile-seat-course',
    projectId: SEATFLOW_PROJECT_ID,
    folderId: 'folder-demo',
    displayName: '课程需求说明.pdf',
    nodeIds: [],
    currentVersionId: 'matver-seat-course-v1',
    versions: [
      {
        id: 'matver-seat-course-v1',
        label: 'v1.0',
        fileName: '课程需求说明.pdf',
        submitterId: 'member-maya',
        submittedAt: '2026-09-18T10:00:00+08:00',
        source: { kind: 'href', href: '/docs/se-course-requirements.pdf' },
      },
    ],
  },
];

const BY_PROJECT: Record<string, MaterialFile[]> = {
  [HANDOFF_PROJECT_ID]: CAMPUS_FILES,
  [SEATFLOW_PROJECT_ID]: SEATFLOW_FILES,
};

export function listMaterialFolders(): MaterialFolder[] {
  return [...MATERIAL_FOLDERS].sort((a, b) => a.sort - b.sort);
}

export function listProjectMaterialFiles(projectId: string): MaterialFile[] {
  return (BY_PROJECT[projectId] ?? []).map((file) => ({
    ...file,
    versions: file.versions.map((version) => ({ ...version })),
    nodeIds: [...file.nodeIds],
  }));
}

export function getMaterialFile(
  projectId: string,
  fileId: string,
): MaterialFile | null {
  return listProjectMaterialFiles(projectId).find((f) => f.id === fileId) ?? null;
}

export function getMaterialVersion(
  file: MaterialFile,
  versionId?: string | null,
): MaterialVersion | null {
  if (versionId) {
    return file.versions.find((v) => v.id === versionId) ?? null;
  }
  return (
    file.versions.find((v) => v.id === file.currentVersionId) ??
    file.versions[file.versions.length - 1] ??
    null
  );
}

export function folderFileCount(
  projectId: string,
  folderId: MaterialFolderId,
): number {
  return listProjectMaterialFiles(projectId).filter(
    (file) => file.folderId === folderId,
  ).length;
}

export function submitterLabel(submitterId: string): string {
  if (submitterId === 'team') return '团队';
  return getMemberById(submitterId)?.name ?? submitterId;
}

export function fileExtensionIcon(
  fileName: string,
): 'pdf' | 'md' | 'code' | 'txt' | 'other' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.md')) return 'md';
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx')
  ) {
    return 'code';
  }
  if (lower.endsWith('.txt')) return 'txt';
  return 'other';
}

/** 节点关联的团队材料（稳定排序） */
export function listMaterialsForNode(
  projectId: string,
  nodeId: string,
): MaterialFile[] {
  return listProjectMaterialFiles(projectId)
    .filter((file) => file.nodeIds.includes(nodeId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh'));
}

/** 交付材料 ID → 材料库文件/版本（历史引用定位） */
export function locateByDemoMaterialId(
  projectId: string,
  demoMaterialId: string,
): { fileId: string; versionId: string } | null {
  for (const file of listProjectMaterialFiles(projectId)) {
    for (const version of file.versions) {
      if (version.demoMaterialId === demoMaterialId) {
        return { fileId: file.id, versionId: version.id };
      }
      if (
        version.source.kind === 'api-material' &&
        version.source.materialId === demoMaterialId
      ) {
        return { fileId: file.id, versionId: version.id };
      }
    }
  }
  return null;
}

export function triggerHrefDownload(href: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function triggerBlobDownload(
  body: string,
  fileName: string,
  mime = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  triggerHrefDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 同源拉取后按展示文件名下载，确保扩展名不被服务器路径改写 */
export async function downloadHrefAsNamedFile(
  href: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(href);
  if (!response.ok) {
    throw new Error(`下载失败（HTTP ${response.status}）`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  triggerHrefDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
