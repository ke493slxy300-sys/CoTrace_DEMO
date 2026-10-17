import type { BlueprintNode } from '../types';

/** 会话内蓝图节点缓存（创建项目时写入；蓝图页接入后读取） */
let sessionBlueprintNodes: BlueprintNode[] = [];

export function setSessionBlueprintNodes(nodes: BlueprintNode[]): void {
  sessionBlueprintNodes = nodes;
}

export function getSessionBlueprintNodes(): BlueprintNode[] {
  return sessionBlueprintNodes;
}

export function clearSessionBlueprintNodes(): void {
  sessionBlueprintNodes = [];
}
