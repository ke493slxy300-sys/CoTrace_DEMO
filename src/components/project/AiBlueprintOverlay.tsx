import { LoaderCircle, Sparkles } from 'lucide-react';
import { getCollaboratorDisplayLabel } from '../../data/collaborators';
import { getMemberById } from '../../data/members';
import type { ProjectCollaborator } from '../../types';

type AiBlueprintOverlayProps = {
  open: boolean;
  collaborators?: ProjectCollaborator[];
};

export function AiBlueprintOverlay({
  open,
  collaborators = [],
}: AiBlueprintOverlayProps) {
  if (!open) return null;

  const teamLine =
    collaborators.length > 0
      ? collaborators
          .map((item) => {
            const member = getMemberById(item.memberId);
            if (!member) return null;
            return `${member.name}（${getCollaboratorDisplayLabel(item)}）`;
          })
          .filter(Boolean)
          .join('、')
      : null;

  return (
    <div className="modal-backdrop ai-overlay" role="status" aria-live="polite">
      <div className="ai-overlay-card">
        <div className="ai-overlay-icon">
          <Sparkles size={20} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="ai-sim-label">模拟 AI 内容 · 非真实模型计算</p>
        <h2>模拟 AI 项目理解</h2>
        <p>
          正在根据预置业务流程提取业务对象、任务节点、依赖关系与建议负责人。
        </p>
        {teamLine ? (
          <p className="ai-overlay-team">参考协作分工：{teamLine}</p>
        ) : null}
        <ul className="ai-overlay-steps">
          <li>识别核心业务对象与流程节点</li>
          <li>建立节点依赖与验收条件</li>
          <li>按已选成员映射建议负责人（未分配显示「待分配」）</li>
        </ul>
        <div className="ai-overlay-loading">
          <LoaderCircle
            size={18}
            strokeWidth={1.5}
            className="spin"
            aria-hidden="true"
          />
          <span>生成初始任务蓝图…</span>
        </div>
      </div>
    </div>
  );
}
