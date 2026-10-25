import { campusMarketplaceDataset } from "../datasets";

export type AiSilentSuggestion = {
  id: string;
  title: string;
  detail: string;
  relatedNodeId?: string;
};

const aiAssistantData = campusMarketplaceDataset.aiAssistant;

export const AI_ASSISTANT_INTRO = aiAssistantData.intro;
export const AI_NEXT_STEP_HINT = aiAssistantData.nextStepHint;
export const AI_NEXT_STEP_NODE_ID = aiAssistantData.nextStepNodeId;

export function buildAiSilentSuggestions(params: {
  unassignedCount: number;
  ownedCount: number;
}): AiSilentSuggestion[] {
  const items: AiSilentSuggestion[] = aiAssistantData.suggestions.map(
    (item) => ({ ...item }),
  );

  if (params.unassignedCount > 0) {
    items.unshift({
      id: "sug-unassigned",
      title: `有 ${params.unassignedCount} 个任务尚未指定负责人`,
      detail: "可在节点详情中指定负责人，或先处理你负责的后端 API。",
    });
  }

  if (params.ownedCount > 0) {
    items.push({
      id: "sug-owned",
      title: `你当前负责 ${params.ownedCount} 个任务`,
      detail: "可从底部「我负责的任务」快速跳转，或点击下一步打开后端 API。",
      relatedNodeId: AI_NEXT_STEP_NODE_ID,
    });
  }

  return items;
}
