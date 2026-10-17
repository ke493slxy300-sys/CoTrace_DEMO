import { useState } from 'react';
import { ChevronUp, MoreHorizontal, Upload } from 'lucide-react';

/**
 * IDE 风底栏空壳（测试 / Debug 仅视觉）。
 *
 * 「提交任务」按钮位置：本文件底部 `.ide-panel-submit` 区域。
 * 若要改到 Tab 行右侧或其它位置，移动该 button 节点即可。
 */
export type IdeBottomTabId = 'test' | 'debug';

type IdeBottomPanelProps = {
  onSubmitTask: () => void;
  submitDisabled?: boolean;
};

const TABS: { id: IdeBottomTabId; label: string }[] = [
  { id: 'test', label: '测试' },
  { id: 'debug', label: 'Debug' },
];

const SHELL_COPY: Record<IdeBottomTabId, string> = {
  test: '尚未检测到测试问题。（演示空壳 · 不可运行）',
  debug: 'Debug 控制台为空。（演示空壳 · 不可运行）',
};

export function IdeBottomPanel({
  onSubmitTask,
  submitDisabled = false,
}: IdeBottomPanelProps) {
  const [activeTab, setActiveTab] = useState<IdeBottomTabId>('test');

  return (
    <div className="ide-bottom-panel" aria-label="测试与调试区（演示空壳）">
      <div className="ide-panel-toolbar">
        <div className="ide-panel-tabs" role="tablist" aria-label="面板标签">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`ide-panel-tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            className="ide-panel-tab ide-panel-tab-more"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(event) => event.preventDefault()}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div className="ide-panel-toolbar-actions" aria-hidden="true">
          <button type="button" className="ide-panel-icon-btn" tabIndex={-1}>
            <ChevronUp size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="ide-panel-filter" aria-hidden="true">
        <input
          type="text"
          readOnly
          tabIndex={-1}
          placeholder="筛选（演示空壳）"
          className="ide-panel-filter-input"
        />
      </div>

      <div className="ide-panel-body" role="tabpanel">
        <p>{SHELL_COPY[activeTab]}</p>
      </div>

      {/* ↓↓↓ 提交任务按钮：改位置时移动这一整块即可 ↓↓↓ */}
      <div className="ide-panel-submit">
        <button
          type="button"
          className="btn btn-primary btn-compact"
          disabled={submitDisabled}
          onClick={onSubmitTask}
        >
          <Upload size={14} strokeWidth={1.5} aria-hidden="true" />
          提交任务
        </button>
        <span className="ide-panel-submit-hint">
          上传至团队协作空间 · 下一阶段页面入口
        </span>
      </div>
      {/* ↑↑↑ 提交任务按钮 ↑↑↑ */}
    </div>
  );
}
