import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  getDemoRoleOption,
  setDemoRole,
  useDemoRole,
} from '../../data/demoRoleStore';
import { resetDemoLocalStorage } from '../../data/demoStorage';
import type { DemoRoleId } from '../../types/handoff';
import { parseHash } from '../../next/student/studentRoutes';
import './demoRole.css';

const ROLES: Array<{
  id: DemoRoleId;
  title: string;
  landing: string;
}> = [
  {
    id: 'alex',
    title: 'Alex Lee · 发布交付',
    landing: '保留当前项目与页面，切换为发布视角',
  },
  {
    id: 'priya',
    title: 'Priya Shah · 接收交付',
    landing: '保留当前项目与页面，切换为接收视角',
  },
  {
    id: 'teacher',
    title: '周老师 · 课程指导',
    landing: '进入课程指导台',
  },
];

function displayName(role: DemoRoleId): string {
  if (role === 'teacher') return '周老师';
  if (role === 'priya') return 'Priya Shah';
  return 'Alex Lee';
}

function isStudentHash(hash: string): boolean {
  const { path } = parseHash(hash);
  return (
    path.startsWith('/next/') &&
    path !== '/next/guide' &&
    path !== '/next/stage' &&
    path !== '/next/acceptance'
  );
}

export function DemoRoleMenu() {
  const role = useDemoRole();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const current = getDemoRoleOption(role);

  const choose = (next: DemoRoleId) => {
    setDemoRole(next);
    setOpen(false);
    setConfirmReset(false);

    if (next === 'teacher') {
      window.location.hash = '#/next/guide';
      return;
    }

    if (next === 'priya' || next === 'alex') {
      window.dispatchEvent(new Event('cotrace-ensure-campus'));
    }

    const hash = window.location.hash;
    // 学生角色互切：保留当前项目 ID 与页面（含材料定位参数）
    if (isStudentHash(hash) && hash !== '#/next/projects') {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }

    window.location.hash =
      '#/next/blueprint?project=project-campus-marketplace';
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
          <p className="demo-role-note">
            切换 Alex / Priya 会保留同一份演示数据，并留在当前项目与页面。
          </p>
          {ROLES.map((item) => {
            const selected = item.id === current.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={selected ? 'is-on' : ''}
                onClick={() => choose(item.id)}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.landing}</small>
                </span>
                {selected ? (
                  <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                ) : null}
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
