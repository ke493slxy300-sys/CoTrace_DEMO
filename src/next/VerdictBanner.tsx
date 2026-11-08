import type { ReactNode } from 'react';

export type VerdictTone = 'warn' | 'ok' | 'neutral';

export type VerdictBannerProps = {
  title: string;
  detail?: string;
  tone?: VerdictTone;
  children?: ReactNode;
};

/** 一句判定 + 一句行动；窄栏扫描第一落点 */
export function VerdictBanner({
  title,
  detail,
  tone = 'neutral',
  children,
}: VerdictBannerProps) {
  return (
    <div className={`rd-verdict is-${tone}`}>
      <h3 className="rd-verdict-title">{title}</h3>
      {detail ? <p className="rd-verdict-detail">{detail}</p> : null}
      {children ? <div className="rd-verdict-actions">{children}</div> : null}
    </div>
  );
}
