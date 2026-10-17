/**
 * 蓝图页右侧「模拟 AI · 项目理解助手」静默内容（未选中节点时）。
 */

export type AiSilentSuggestion = {
  id: string;
  title: string;
  detail: string;
  /** 可选：一键跳到相关节点 */
  relatedNodeId?: string;
};

export const AI_ASSISTANT_INTRO =
  '根据预置业务流程与当前协作分工，已生成初始任务蓝图。以下为静默建议，不会自动修改任务或责任归属。';

export const AI_NEXT_STEP_HINT =
  '建议先打开「后端 API」节点，确认错误码约定，再处理团队提出的待办事项。';

export const AI_NEXT_STEP_NODE_ID = 'node-backend';

export function buildAiSilentSuggestions(params: {
  unassignedCount: number;
  ownedCount: number;
}): AiSilentSuggestion[] {
  const items: AiSilentSuggestion[] = [
    {
      id: 'sug-error-codes',
      title: '前端错误提示仍缺明确错误码',
      detail:
        '购买失败目前可能只显示通用失败。建议后端约定 LISTING_NOT_FOUND / LISTING_UNAVAILABLE。',
      relatedNodeId: 'node-backend',
    },
    {
      id: 'sug-integration',
      title: '联调依赖后端与前端接口对齐',
      detail: '交易流程联调节点仍待开始，建议先稳定错误响应结构再开测。',
      relatedNodeId: 'node-integration',
    },
  ];

  if (params.unassignedCount > 0) {
    items.unshift({
      id: 'sug-unassigned',
      title: `有 ${params.unassignedCount} 个任务尚未指定负责人`,
      detail: '可在节点详情中指定负责人，或先处理你负责的后端 API。',
    });
  }

  if (params.ownedCount > 0) {
    items.push({
      id: 'sug-owned',
      title: `你当前负责 ${params.ownedCount} 个任务`,
      detail: '可从底部「我负责的任务」快速跳转，或点击下一步打开后端 API。',
      relatedNodeId: AI_NEXT_STEP_NODE_ID,
    });
  }

  return items;
}
