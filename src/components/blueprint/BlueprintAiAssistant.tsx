import { Sparkles } from 'lucide-react';
import {
  AI_ASSISTANT_INTRO,
  AI_NEXT_STEP_HINT,
  AI_NEXT_STEP_NODE_ID,
  buildAiSilentSuggestions,
} from '../../data/aiAssistant';
import type { CourseProject } from '../../types';

type BlueprintAiAssistantProps = {
  project: CourseProject;
  unassignedCount: number;
  ownedCount: number;
  onOpenNode: (nodeId: string) => void;
};

export function BlueprintAiAssistant({
  project,
  unassignedCount,
  ownedCount,
  onOpenNode,
}: BlueprintAiAssistantProps) {
  const suggestions = buildAiSilentSuggestions({
    unassignedCount,
    ownedCount,
  });

  return (
    <div className="blueprint-ai-assistant">
      <div className="blueprint-sim-badge">模拟 AI · 项目理解助手</div>
      <h3>校园二手交易平台</h3>
      <p className="blueprint-detail-summary">{project.goal}</p>
      <p className="blueprint-detail-note">{AI_ASSISTANT_INTRO}</p>

      <section className="blueprint-detail-block">
        <h4>静默建议</h4>
        <ul className="blueprint-ai-suggestions">
          {suggestions.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              {item.relatedNodeId ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-compact"
                  onClick={() => onOpenNode(item.relatedNodeId!)}
                >
                  查看相关节点
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="blueprint-detail-block blueprint-ai-next">
        <h4>下一步提示</h4>
        <p className="blueprint-detail-summary">{AI_NEXT_STEP_HINT}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenNode(AI_NEXT_STEP_NODE_ID)}
        >
          <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />
          打开后端 API 节点
        </button>
      </section>

      <p className="blueprint-detail-note">
        仅提供建议，不会自动修改任务、负责人或验收标准。
      </p>
    </div>
  );
}
