import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  getDemoRoleOption,
  setDemoRole,
  useDemoRole,
} from '../../data/demoRoleStore';
import { resetDemoLocalStorage } from '../../data/demoStorage';
import type { DemoRoleId } from '../../types/handoff';
import './demoRole.css';

const ROLES: Array<{
  id: DemoRoleId;
  title: string;
  landing: string;
  hash: string;
}> = [
  {
    id: 'alex',
    title: 'Alex Lee · 发布交付',
    landing: '进入校园二手交易平台的工作蓝图',
    hash: '#/next/blueprint?project=project-campus-marketplace',
  },
  {
    id: 'priya',
    title: 'Priya Shah · 接收交付',
    landing: '进入校园二手交易平台的工作蓝图',
    hash: '#/next/blueprint?project=project-campus-marketplace',
  },
  {
    id: 'teacher',
    title: '周老师 · 课程指导',
    landing: '进入课程指导台',
    hash: '#/next/guide',
  },
];

function displayName(role: DemoRoleId): string {
  if (role === 'teacher') return '周老师';
  if (role === 'priya') return 'Priya Shah';
  return 'Alex Lee';
}

export function DemoRoleMenu() {
  const role = useDemoRole();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const current = getDemoRoleOption(role);

  const choose = (next: DemoRoleId, hash: string) => {
    setDemoRole(next);
    if (next === 'priya' || next === 'alex') {
      window.dispatchEvent(new Event('cotrace-ensure-campus'));
    }
    setOpen(false);
    setConfirmReset(false);
    if (window.location.hash === hash) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    window.location.hash = hash;
  };

  const reset = () => {
    window.location.hash =
      '#/next/blueprint?project=project-campus-marketplace';
    resetDemoLocalStorage();
  };

  return (
    <div className="demo-role">
      <button
        type="button"
        className="demo-role-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        演示视角 · {displayName(role)} ▾
      </button>
      {open ? (
        <div className="demo-role-menu" role="menu" aria-label="演示视角">
          <p className="demo-role-note">切换角色会保留同一份演示数据，并前往对应页面。</p>
          {ROLES.map((item) => {
            const selected = item.id === current.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={selected ? 'is-on' : ''}
                onClick={() => choose(item.id, item.hash)}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.landing}</small>
                </span>
                {selected ? <Check size={16} strokeWidth={2.4} aria-hidden="true" /> : null}
              </button>
            );
          })}
          <div className="demo-role-reset">
            <p>重置演示会清除交付、反馈和核收进度。这不是切换角色。</p>
            {confirmReset ? (
              <div className="demo-role-reset-actions">
                <button type="button" onClick={() => setConfirmReset(false)}>
                  取消
                </button>
                <button type="button" className="is-danger" onClick={reset}>
                  确认清除进度
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)}>
                重置演示
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
