/**
 * 材料库左侧「项目代码仓」结构树。
 * 路径与 teammate/backend pack、docs 对齐；叶子可挂 materialFileId 做预览/筛选。
 */

import { HANDOFF_PROJECT_ID } from './handoffDemoSeed';
import { SEATFLOW_PROJECT_ID } from './projectLogs';
import {
  listProjectMaterialFiles,
  MATERIALS_ALL_ID,
  type MaterialFile,
  type MaterialsTreeId,
} from './teamMaterials';

export type RepoTreeKind = 'dir' | 'file';

export type RepoTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: RepoTreeKind;
  /** 关联材料库文件；结构占位文件可为空 */
  materialFileId?: string;
  children?: RepoTreeNode[];
};

/** 校园二手仓：顶层目录骨架（空目录也会展示） */
const CAMPUS_SKELETON_PATHS: string[] = [
  'docs/requirements',
  'docs/flows',
  'docs/database',
  'docs/api',
  'docs/integration',
  'docs/testing',
  'docs/demo',
  'docs/course',
  'backend/src/controllers',
  'backend/src/domain',
  'backend/src/errors',
  'backend/src/repositories',
  'backend/src/services',
  'backend/tests',
  'frontend/src/pages',
  'frontend/src/components',
  'frontend/src/services',
  'frontend/src/utils',
  'frontend/tests',
  'sql',
  'research/sources',
  'tests',
];

const CAMPUS_SKELETON_FILES: string[] = [
  'README.md',
  'backend/package.json',
  'backend/src/controllers/orderController.js',
  'backend/src/domain/orderStatus.js',
  'backend/src/errors/BusinessError.js',
  'backend/src/repositories/itemRepository.js',
  'backend/src/repositories/orderRepository.js',
  'backend/tests/orderService.test.js',
  'frontend/README.md',
  'frontend/src/pages/ItemDetailPage.jsx',
  'frontend/src/components/PurchasePanel.jsx',
  'frontend/src/components/OrderResultPanel.jsx',
  'frontend/src/services/orderApi.js',
  'frontend/src/utils/orderErrorMessages.js',
  'frontend/tests/PurchasePanel.test.jsx',
  'sql/001_create_users_items.sql',
  'sql/002_create_orders.sql',
  'sql/003_add_order_constraints.sql',
  'sql/create_order_transaction.sql',
  'sql/seed_demo_data.sql',
  'sql/README.md',
  'research/sources/用户需求与分析.md',
];

const SEATFLOW_SKELETON_PATHS: string[] = ['docs/protocol', 'docs/course'];

type MutableNode = {
  id: string;
  name: string;
  path: string;
  kind: RepoTreeKind;
  materialFileId?: string;
  children: Map<string, MutableNode>;
};

function ensureDir(root: MutableNode, dirPath: string): MutableNode {
  if (!dirPath) return root;
  const parts = dirPath.split('/').filter(Boolean);
  let cursor = root;
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    let next = cursor.children.get(part);
    if (!next) {
      next = {
        id: `dir:${acc}`,
        name: part,
        path: acc,
        kind: 'dir',
        children: new Map(),
      };
      cursor.children.set(part, next);
    }
    cursor = next;
  }
  return cursor;
}

function ensureFile(
  root: MutableNode,
  filePath: string,
  materialFileId?: string,
): void {
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length === 0) return;
  const fileName = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join('/');
  const parent = ensureDir(root, parentPath);
  const existing = parent.children.get(fileName);
  if (existing && existing.kind === 'file') {
    if (materialFileId) existing.materialFileId = materialFileId;
    return;
  }
  parent.children.set(fileName, {
    id: materialFileId ? `file:${materialFileId}` : `file:${filePath}`,
    name: fileName,
    path: filePath,
    kind: 'file',
    materialFileId,
    children: new Map(),
  });
}

function freezeNode(node: MutableNode): RepoTreeNode {
  if (node.kind === 'file') {
    return {
      id: node.id,
      name: node.name,
      path: node.path,
      kind: 'file',
      materialFileId: node.materialFileId,
    };
  }
  const children = [...node.children.values()]
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh');
    })
    .map(freezeNode);
  return {
    id: node.id,
    name: node.name,
    path: node.path,
    kind: 'dir',
    children,
  };
}

function buildTree(
  skeletonDirs: string[],
  skeletonFiles: string[],
  materials: MaterialFile[],
): RepoTreeNode {
  const root: MutableNode = {
    id: 'dir:',
    name: '',
    path: '',
    kind: 'dir',
    children: new Map(),
  };
  for (const dir of skeletonDirs) ensureDir(root, dir);
  for (const file of skeletonFiles) ensureFile(root, file);
  for (const file of materials) {
    if (file.repoPath) ensureFile(root, file.repoPath, file.id);
  }
  return freezeNode(root);
}

/** 仓库根节点（全部材料）+ 子树 */
export function getProjectRepoTree(projectId: string): RepoTreeNode {
  const materials = listProjectMaterialFiles(projectId);
  if (projectId === SEATFLOW_PROJECT_ID) {
    return buildTree(SEATFLOW_SKELETON_PATHS, [], materials);
  }
  if (projectId === HANDOFF_PROJECT_ID || projectId === 'campus' || projectId === 'current') {
    return buildTree(CAMPUS_SKELETON_PATHS, CAMPUS_SKELETON_FILES, materials);
  }
  return buildTree([], [], materials);
}

export function collectMaterialIdsUnderPath(
  projectId: string,
  pathPrefix: string,
): Set<string> {
  const ids = new Set<string>();
  const prefix = pathPrefix.replace(/\/$/, '');
  for (const file of listProjectMaterialFiles(projectId)) {
    if (!file.repoPath) continue;
    if (!prefix || file.repoPath === prefix || file.repoPath.startsWith(`${prefix}/`)) {
      ids.add(file.id);
    }
  }
  return ids;
}

export function findRepoNodeByPath(
  tree: RepoTreeNode,
  path: string,
): RepoTreeNode | null {
  if (!path) return tree;
  const parts = path.split('/').filter(Boolean);
  let cursor: RepoTreeNode = tree;
  for (const part of parts) {
    const next = cursor.children?.find((child) => child.name === part);
    if (!next) return null;
    cursor = next;
  }
  return cursor;
}

/** URL folder：阶段 id / 仓路径 / all */
export function resolveRepoFolderSelection(
  projectId: string,
  folderParam: string | null | undefined,
): MaterialsTreeId | string {
  if (!folderParam || folderParam === MATERIALS_ALL_ID) return MATERIALS_ALL_ID;
  if (
    folderParam === 'folder-req' ||
    folderParam === 'folder-api' ||
    folderParam === 'folder-integration' ||
    folderParam === 'folder-demo'
  ) {
    return folderParam;
  }
  const tree = getProjectRepoTree(projectId);
  if (findRepoNodeByPath(tree, folderParam)) return folderParam;
  return MATERIALS_ALL_ID;
}

export function materialMatchesRepoSelection(
  file: MaterialFile,
  selected: MaterialsTreeId | string,
): boolean {
  if (selected === MATERIALS_ALL_ID) return true;
  // 阶段卡片仍按 folderId 筛选
  if (
    selected === 'folder-req' ||
    selected === 'folder-api' ||
    selected === 'folder-integration' ||
    selected === 'folder-demo'
  ) {
    return file.folderId === selected;
  }
  if (!file.repoPath) return false;
  return (
    file.repoPath === selected || file.repoPath.startsWith(`${selected}/`)
  );
}

/** 默认展开：仓库一级目录 */
export function defaultExpandedPaths(tree: RepoTreeNode): string[] {
  return (tree.children ?? [])
    .filter((child) => child.kind === 'dir')
    .map((child) => child.path);
}
