/**
 * 提交页可选的主题溯源候选：由 Content Pack 公开溯源主题卡映射而来。
 * 不暴露完整原始 Agent session。
 */

import {
  getBackendPublishedTraceCards,
  type PublishedTraceCardView,
} from "../datasets/built-in/campus-marketplace/content/backendPack";
import { BACKEND_APP_NODE_ID } from "../datasets/built-in/campus-marketplace/content/packIds";
import type { DemoSubmissionTraceCard } from "./demoSubmission";

export type SubmitTraceCandidate = DemoSubmissionTraceCard;

function mapPublishedCard(card: PublishedTraceCardView): SubmitTraceCandidate {
  const userTurns = card.dialogues.filter((item) => item.role === "user");
  const agentTurns = card.dialogues.filter((item) => item.role === "agent");
  const fragmentBits = [
    ...agentTurns.slice(0, 1).map((item) => item.content),
    ...userTurns.slice(0, 1).map((item) => item.content),
  ]
    .map((text) => text.trim())
    .filter(Boolean);

  return {
    id: card.id,
    title: card.theme,
    fragmentSummary:
      fragmentBits.length > 0
        ? fragmentBits.map((text) => truncate(text, 96)).join(" / ")
        : truncate(card.summary, 140),
    humanUnderstanding: truncate(card.summary, 200),
    humanDecision:
      card.adoption ??
      userTurns[userTurns.length - 1]?.content ??
      "负责人已确认纳入本次公开范围。",
  };
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** 个人工作区当前节点上可供勾选公开的主题卡 */
export function getSubmitTraceCandidates(
  nodeId: string,
): SubmitTraceCandidate[] {
  if (nodeId === BACKEND_APP_NODE_ID) {
    return getBackendPublishedTraceCards().map(mapPublishedCard);
  }
  return [];
}
