import { useEffect, useId, useRef, useState } from 'react';
import { Check, Search, Settings2, X } from 'lucide-react';
import { isDemoCastMember } from '../../data/collaborators';
import { formatDutyLabels } from '../../data/duties';
import { searchSelectableMembers } from '../../data/members';
import {
  deselectOptionalMember,
  selectOptionalMember,
  type RegisterCollaboratorDraft,
} from '../../data/registerDraft';
import { MemberAvatar } from '../common/MemberAvatar';
import { CollaboratorDutyEditor } from './CollaboratorDutyEditor';

type CollaboratorPickerPanelProps = {
  draft: RegisterCollaboratorDraft;
  dutyEditorMemberId: string | null;
  lockedHint: string | null;
  onDraftChange: (draft: RegisterCollaboratorDraft) => void;
  onLockedHint: (message: string | null) => void;
  onClose: () => void;
  onRequestDutyEdit: (memberId: string) => void;
  onCloseDutyEditor: () => void;
};

export function CollaboratorPickerPanel({
  draft,
  dutyEditorMemberId,
  lockedHint,
  onDraftChange,
  onLockedHint,
  onClose,
  onRequestDutyEdit,
  onCloseDutyEditor,
}: CollaboratorPickerPanelProps) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (dutyEditorMemberId) return;
    searchRef.current?.focus();
  }, [dutyEditorMemberId]);

  const members = searchSelectableMembers(query);
  const hasQuery = query.trim().length > 0;

  function toggleMember(memberId: string) {
    const selected = draft.selectedIds.includes(memberId);
    const result = selected
      ? deselectOptionalMember(draft, memberId)
      : selectOptionalMember(draft, memberId);
    onDraftChange(result.draft);
    onLockedHint(result.lockedHint);
    if (selected && dutyEditorMemberId === memberId) {
      onCloseDutyEditor();
    }
  }

  return (
    <aside
      id="collaborator-picker-panel"
      className="collaborator-picker-panel"
      role="dialog"
      aria-labelledby={titleId}
    >
      <header className="collaborator-picker-header">
        <div>
          <h3 id={titleId}>选择协作者</h3>
          <p>Demo 已锁定 Alex / Priya / Jordan；其余成员仅展示，不可更改。</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="关闭选择面板"
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      {dutyEditorMemberId ? (
        <CollaboratorDutyEditor
          memberId={dutyEditorMemberId}
          draft={draft}
          lockedHint={lockedHint}
          onDraftChange={onDraftChange}
          onLockedHint={onLockedHint}
          onClose={onCloseDutyEditor}
        />
      ) : (
        <>
          <div className="collaborator-picker-search">
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="搜索姓名"
              aria-label="按姓名搜索协作者"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="collaborator-picker-body">
            {members.length === 0 ? (
              <div className="picker-empty">
                <p className="register-empty-hint">
                  {hasQuery ? '没有找到匹配的成员' : '暂无可选成员'}
                </p>
                {hasQuery ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={() => setQuery('')}
                  >
                    清除搜索
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="picker-member-list">
                {members.map((member) => {
                  const selected = draft.selectedIds.includes(member.id);
                  const demoCast = isDemoCastMember(member.id);
                  const duty = draft.dutyByMemberId[member.id];
                  const dutyLabel = duty
                    ? formatDutyLabels(
                        duty.primaryDutyId,
                        duty.additionalDutyId,
                      )
                    : member.roleLabel;

                  return (
                    <li key={member.id}>
                      <div
                        className={`picker-member-row${
                          selected ? ' is-selected' : ''
                        }${demoCast ? ' is-demo-locked' : ' is-display-only'}`}
                      >
                        <button
                          type="button"
                          className="picker-member-main"
                          aria-pressed={selected}
                          onClick={() => toggleMember(member.id)}
                        >
                          <MemberAvatar member={member} />
                          <span className="picker-member-info">
                            <span className="picker-member-name">
                              <strong>{member.name}</strong>
                              {selected ? (
                                <span
                                  className="picker-selected-mark"
                                  aria-hidden="true"
                                >
                                  <Check size={12} strokeWidth={2} />
                                  演示班底
                                </span>
                              ) : (
                                <span className="picker-display-only-mark">
                                  仅展示
                                </span>
                              )}
                            </span>
                            <span className="picker-member-tags">
                              {member.skillTags.join(' · ')}
                            </span>
                            {selected ? (
                              <span className="picker-member-duty">
                                {dutyLabel}
                              </span>
                            ) : (
                              <span className="picker-member-duty is-muted">
                                Demo 模式不可加入
                              </span>
                            )}
                          </span>
                        </button>

                        {selected ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-compact picker-duty-entry"
                            onClick={() => onRequestDutyEdit(member.id)}
                          >
                            <Settings2
                              size={13}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            分配职责
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {lockedHint ? (
            <p
              className="register-locked-hint picker-locked-hint"
              role="status"
              aria-live="polite"
            >
              {lockedHint}
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
}
