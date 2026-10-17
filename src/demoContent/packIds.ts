/**
 * Content Pack 节点 ID ↔ 应用蓝图节点 ID。
 * 包内数据使用左侧 ID；运行时一律映射到右侧。
 */
export const PACK_NODE_TO_APP: Record<string, string> = {
  'node-backend-api': 'node-backend',
  'node-database-design': 'node-database',
  'node-product-analysis': 'node-requirements',
  'node-frontend': 'node-frontend',
  'node-trade-integration': 'node-integration',
  'node-testing': 'node-testing',
};

export const APP_NODE_TO_PACK: Record<string, string> = Object.fromEntries(
  Object.entries(PACK_NODE_TO_APP).map(([pack, app]) => [app, pack]),
);

export const BACKEND_APP_NODE_ID = 'node-backend';
export const BACKEND_PACK_NODE_ID = 'node-backend-api';

export function toAppNodeId(packOrAppId: string): string {
  return PACK_NODE_TO_APP[packOrAppId] ?? packOrAppId;
}

export function toPackNodeId(appNodeId: string): string {
  return APP_NODE_TO_PACK[appNodeId] ?? appNodeId;
}
