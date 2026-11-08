/**
 * 学生端 hash 路由约定（与 App.tsx viewFromHash / hashForStudentPlace 对齐）。
 *
 * 形状示例：
 *   #/next/projects
 *   #/next/blueprint?project=<id>[&node=<nodeId>][&from=work|materials|history]
 *   #/next/node?project=<id>&node=<nodeId>[&from=work|materials|blueprint]
 *   #/next/work?project=<id>
 *   #/next/log?project=<id>
 *   #/next/materials?project=<id>[&folder=][&file=][&version=][&from=][&retNode=]
 *   #/next/publish?project=<id>[&from=work]
 *   #/next/receive?project=<id>[&from=work]
 */

import type { StudentPlace } from './StudentShell';

export type StudentNavFrom =
  | 'work'
  | 'blueprint'
  | 'materials'
  | 'history'
  | 'publish'
  | 'receive'
  | 'projects';

export type MaterialsQuery = {
  folder?: string | null;
  file?: string | null;
  version?: string | null;
  q?: string | null;
  from?: string | null;
  /** 从蓝图节点跳入材料库时，返回该节点 */
  retNode?: string | null;
};

function enc(value: string): string {
  return encodeURIComponent(value);
}

function withProject(
  path: string,
  projectId: string,
  extra?: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams();
  params.set('project', projectId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `#${path}?${params.toString()}`;
}

export function hashForStudentPlace(
  place: StudentPlace,
  projectId: string,
): string {
  if (place === 'projects') return '#/next/projects';
  if (place === 'history') return withProject('/next/log', projectId);
  if (place === 'publish') return withProject('/next/publish', projectId);
  if (place === 'receive') return withProject('/next/receive', projectId);
  if (place === 'work') return withProject('/next/work', projectId);
  if (place === 'materials') return withProject('/next/materials', projectId);
  return withProject('/next/blueprint', projectId);
}

export function hashBlueprint(
  projectId: string,
  opts?: { node?: string | null; from?: string | null },
): string {
  return withProject('/next/blueprint', projectId, {
    node: opts?.node,
    from: opts?.from,
  });
}

/** 直接打开节点详情（BlueprintNodeDetailPage），非仅蓝图选中 */
export function hashNodeDetail(
  projectId: string,
  opts: { node: string; from?: string | null },
): string {
  return withProject('/next/node', projectId, {
    node: opts.node,
    from: opts.from,
  });
}

export function hashWork(projectId: string): string {
  return withProject('/next/work', projectId);
}

export function hashMaterials(
  projectId: string,
  opts?: MaterialsQuery,
): string {
  return withProject('/next/materials', projectId, {
    folder: opts?.folder,
    file: opts?.file,
    version: opts?.version,
    q: opts?.q,
    from: opts?.from,
    retNode: opts?.retNode,
  });
}

export function hashPublish(
  projectId: string,
  opts?: { from?: string | null },
): string {
  return withProject('/next/publish', projectId, { from: opts?.from });
}

export function hashReceive(
  projectId: string,
  opts?: { from?: string | null },
): string {
  return withProject('/next/receive', projectId, { from: opts?.from });
}

export function hashHistory(projectId: string): string {
  return withProject('/next/log', projectId);
}

/** 解析材料库定位参数；缺失字段为 null */
export function parseMaterialsQuery(query: URLSearchParams): MaterialsQuery {
  return {
    folder: query.get('folder'),
    file: query.get('file'),
    version: query.get('version'),
    q: query.get('q'),
    from: query.get('from'),
    retNode: query.get('retNode'),
  };
}

export function parseHash(hash: string): {
  path: string;
  query: URLSearchParams;
} {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryPart = ''] = raw.split('?');
  return { path: pathPart || '/', query: new URLSearchParams(queryPart) };
}

/** 从 from= 回到对应项目页；无法识别时回工作页 */
export function hashFromNavHint(
  from: string | null | undefined,
  projectId: string,
  materialsRestore?: MaterialsQuery,
): string {
  if (from === 'materials') {
    return hashMaterials(projectId, materialsRestore);
  }
  if (from === 'blueprint') {
    return hashBlueprint(projectId, {
      node: materialsRestore?.retNode,
      from: 'materials',
    });
  }
  if (from === 'history') return hashHistory(projectId);
  if (from === 'publish') return hashPublish(projectId);
  if (from === 'receive') return hashReceive(projectId);
  if (from === 'work') return hashWork(projectId);
  if (from === 'projects') return '#/next/projects';
  return hashWork(projectId);
}

export function studentPlaceFromPath(path: string): StudentPlace | null {
  if (path === '/next/projects') return 'projects';
  if (path === '/next/blueprint') return 'blueprint';
  if (path === '/next/work') return 'work';
  if (path === '/next/log') return 'history';
  if (path === '/next/materials') return 'materials';
  if (path === '/next/publish') return 'publish';
  if (path === '/next/receive') return 'receive';
  return null;
}

export { enc };
