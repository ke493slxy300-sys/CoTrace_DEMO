import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { resetDemoLocalStorage } from '../../data/demoStorage';

export function AppHeader() {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            CT
          </span>
          <span>CoTrace</span>
        </div>
        <div className="app-header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-compact app-header-reset"
            onClick={() => setResetConfirmOpen(true)}
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            重置 Demo 数据
          </button>
          <div className="app-header-meta">团队协作编码测试版 · Demo v0.2</div>
        </div>
      </header>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="重置 Demo 数据？"
        message="将仅清除 CoTrace Demo 使用的本地缓存（提交快照与协作标注/讨论），然后重新载入页面以恢复预置体验状态。不会执行 localStorage.clear()，也不会影响浏览器其他网站数据。"
        confirmLabel="确认重置"
        cancelLabel="取消"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          setResetConfirmOpen(false);
          resetDemoLocalStorage();
        }}
      />
    </>
  );
}
