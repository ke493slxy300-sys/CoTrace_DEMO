import type { ReactNode } from 'react';

export type StudentTrailSegment = {
  label: string;
  /** Earlier segments may navigate; omit on the current (last) segment. */
  onClick?: () => void;
};

type StudentTrailProps = {
  segments: StudentTrailSegment[];
  className?: string;
};

/**
 * Content-area context trail above page H1s: 项目 · 栏目 · 当前实体(optional).
 * Collapses consecutive duplicate labels (e.g. 蓝图 · 蓝图).
 */
export function StudentTrail({ segments, className }: StudentTrailProps) {
  const cleaned = collapseDuplicateLabels(segments);
  if (cleaned.length === 0) return null;

  const nodes: ReactNode[] = [];
  cleaned.forEach((segment, index) => {
    if (index > 0) {
      nodes.push(
        <span key={`sep-${index}`} className="stu-trail-sep" aria-hidden="true">
          {' · '}
        </span>,
      );
    }
    const isLast = index === cleaned.length - 1;
    if (!isLast && segment.onClick) {
      nodes.push(
        <button
          key={`seg-${index}`}
          type="button"
          className="stu-trail-link"
          onClick={segment.onClick}
        >
          {segment.label}
        </button>,
      );
    } else {
      nodes.push(
        <span key={`seg-${index}`} className="stu-trail-current">
          {segment.label}
        </span>,
      );
    }
  });

  return (
    <nav
      className={className ? `stu-trail ${className}` : 'stu-trail'}
      aria-label="当前位置"
    >
      {nodes}
    </nav>
  );
}

function collapseDuplicateLabels(
  segments: StudentTrailSegment[],
): StudentTrailSegment[] {
  const out: StudentTrailSegment[] = [];
  for (const segment of segments) {
    const label = segment.label.trim();
    if (!label) continue;
    const prev = out[out.length - 1];
    if (prev && prev.label === label) continue;
    out.push({ ...segment, label });
  }
  return out;
}
