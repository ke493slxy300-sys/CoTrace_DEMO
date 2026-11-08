import { useState } from 'react';
import type { CollaborationLog } from '../types/handoff';

export type CollabLogValue = Pick<
  CollaborationLog,
  'summary' | 'humanActions' | 'aiActions' | 'openItems'
> & {
  manuallyEdited?: boolean;
};

export type CollabLogBucketsProps = {
  value: CollabLogValue;
  /** 强制只读（无编辑入口） */
  readOnly?: boolean;
  disabled?: boolean;
  title?: string;
  onChange?: (next: CollabLogValue) => void;
};

type BucketKey = 'humanActions' | 'aiActions' | 'openItems';

const BUCKETS: { key: BucketKey; label: string; openTone?: boolean }[] = [
  { key: 'humanActions', label: '我做的' },
  { key: 'aiActions', label: '模型做的' },
  { key: 'openItems', label: '还没定', openTone: true },
];

function linesToText(lines: string[]): string {
  return lines.join('\n');
}

function textToLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** 协作说明三桶：默认只读列表，点编辑再变输入；未决浅警告底 */
export function CollabLogBuckets({
  value,
  readOnly = false,
  disabled = false,
  title = '这版说明',
  onChange,
}: CollabLogBucketsProps) {
  const [editing, setEditing] = useState(false);
  const canEdit = !readOnly && Boolean(onChange) && !disabled;
  const showEditor = canEdit && editing;
  const showHead = Boolean(title) || canEdit;

  const patch = (partial: Partial<CollabLogValue>) => {
    if (!onChange) return;
    onChange({
      ...value,
      ...partial,
      manuallyEdited: true,
    });
  };

  return (
    <div className="rd-collab">
      {showHead ? (
        <div className="rd-collab-head">
          {title ? (
            <h3 className="rd-section-title">
              {title}
              {value.manuallyEdited ? '（改过）' : ''}
            </h3>
          ) : (
            <span />
          )}
          {canEdit ? (
            <button
              type="button"
              className="rd-collab-edit"
              aria-pressed={editing}
              onClick={() => setEditing((open) => !open)}
            >
              {editing ? '完成' : '编辑'}
            </button>
          ) : null}
        </div>
      ) : null}

      {value.summary?.trim() ? (
        <p className="rd-collab-summary">{value.summary}</p>
      ) : showEditor ? null : (
        <p className="rd-collab-empty">暂无摘要</p>
      )}

      {showEditor ? (
        <>
          <label className="rd-collab-label" htmlFor="rd-collab-summary">
            摘要
          </label>
          <textarea
            id="rd-collab-summary"
            className="rd-collab-input"
            value={value.summary}
            disabled={disabled}
            onChange={(event) => patch({ summary: event.target.value })}
          />
        </>
      ) : null}

      <div className="rd-collab-buckets">
        {BUCKETS.map((bucket) => {
          const items = value[bucket.key] ?? [];
          return (
            <div
              key={bucket.key}
              className={`rd-collab-bucket${bucket.openTone ? ' is-open' : ''}`}
            >
              <div className="rd-collab-bucket-label">{bucket.label}</div>
              {showEditor ? (
                <textarea
                  className="rd-collab-input"
                  aria-label={bucket.label}
                  value={linesToText(items)}
                  disabled={disabled}
                  placeholder="每行一条"
                  onChange={(event) =>
                    patch({ [bucket.key]: textToLines(event.target.value) })
                  }
                />
              ) : items.length > 0 ? (
                <ul className="rd-collab-items">
                  {items.map((item) => (
                    <li key={`${bucket.key}-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="rd-collab-empty">无</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
