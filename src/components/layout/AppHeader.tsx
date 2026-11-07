import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { resetDemoLocalStorage } from '../../data/demoStorage';
import {
  DEMO_ROLE_OPTIONS,
  setDemoRole,
  useDemoRole,
} from '../../data/demoRoleStore';
import type { DemoRoleId } from '../../types/handoff';

type AppHeaderProps = {
  showRoleSwitcher?: boolean;
};

export function AppHeader({ showRoleSwitcher = true }: AppHeaderProps) {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const role = useDemoRole();

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
          {showRoleSwitcher ? (
            <label className="app-header-role">
              <span className="app-header-role-label">演示视角</span>
              <select
                className="app-header-role-select"
                value={role}
                onChange={(event) =>
                  setDemoRole(event.target.value as DemoRoleId)
                }
                aria-label="切换演示视角"
              >
                {DEMO_ROLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-compact app-header-reset"
            onClick={() => setResetConfirmOpen(true)}
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            重置 Demo 数据
          </button>
          <div className="app-header-meta">课堂演示版 · Handoff v2</div>
        </div>
      </header>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="重置 Demo 数据？"
        message="将清除交付、反馈、核收与协作缓存，恢复 v0.4 草稿与预置时间线，然后重新载入页面。不会执行 localStorage.clear()。"
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
