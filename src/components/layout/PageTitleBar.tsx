import type { ReactNode } from 'react';

type PageTitleBarProps = {
  title: string;
  subtitle?: string;
  /** 顶栏左侧操作（如「返回任务蓝图」） */
  leading?: ReactNode;
  /** 顶栏右侧操作 */
  actions?: ReactNode;
};

export function PageTitleBar({
  title,
  subtitle,
  leading,
  actions,
}: PageTitleBarProps) {
  return (
    <div className="page-title-bar">
      <div className="page-title-bar-start">
        {leading ? (
          <div className="page-title-bar-leading">{leading}</div>
        ) : null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-title-bar-actions">{actions}</div> : null}
    </div>
  );
}
