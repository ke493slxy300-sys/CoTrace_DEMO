/**
 * 个人编码工作区 · 编程 Agent 预置状态（本地模拟，非真实模型）。
 */

import {
  getBackendAgentWorkspaceMessages,
  type WorkspaceAgentMessage,
} from "../datasets/built-in/campus-marketplace/content/backendPack";
import { BACKEND_APP_NODE_ID } from "../datasets/built-in/campus-marketplace/content/packIds";

export type CodingAgentStatus =
  | "waiting-user"
  | "understanding"
  | "suggestion-ready"
  | "awaiting-confirm";

export const CODING_AGENT_STATUS_LABELS: Record<CodingAgentStatus, string> = {
  "waiting-user": "等待用户发起对话",
  understanding: "正在理解任务",
  "suggestion-ready": "已提出修改建议",
  "awaiting-confirm": "等待负责人确认",
};

/** 兼容旧面板；工作区优先使用 WorkspaceAgentMessage */
export type CodingAgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
};

export type { WorkspaceAgentMessage };

export function getCodingAgentPreset(nodeId: string): {
  status: CodingAgentStatus;
  messages: WorkspaceAgentMessage[];
} {
  if (nodeId === BACKEND_APP_NODE_ID) {
    return {
      status: "awaiting-confirm",
      messages: getBackendAgentWorkspaceMessages(),
    };
  }
  return {
    status: "waiting-user",
    messages: [],
  };
}
