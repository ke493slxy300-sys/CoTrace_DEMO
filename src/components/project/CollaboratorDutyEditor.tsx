import { X } from 'lucide-react';
import { ASSIGNABLE_DUTIES, DUTY_LABELS } from '../../data/duties';
import { getMemberById } from '../../data/members';
import {
  setMemberAdditionalDuty,
  setMemberPrimaryDuty,
  type RegisterCollaboratorDraft,
} from '../../data/registerDraft';
import type { DutyId } from '../../types';

type CollaboratorDutyEditorProps = {
  memberId: string;
  draft: RegisterCollaboratorDraft;
  lockedHint: string | null;
  onDraftChange: (draft: RegisterCollaboratorDraft) => void;
  onLockedHint: (message: string | null) => void;
  onClose: () => void;
};

export function CollaboratorDutyEditor({
  memberId,
  draft,
  lockedHint,
  onDraftChange,
  onLockedHint,
  onClose,
}: CollaboratorDutyEditorProps) {
  const member = getMemberById(memberId);
  const duty = draft.dutyByMemberId[memberId];

  if (!member || !duty) return null;

  function handlePrimary(next: DutyId) {
    const result = setMemberPrimaryDuty(draft, memberId, next);
    onDraftChange(result.draft);
    onLockedHint(result.lockedHint);
  }

  function handleAdditional(next: DutyId | null) {
    const result = setMemberAdditionalDuty(draft, memberId, next);
    onDraftChange(result.draft);
    onLockedHint(result.lockedHint);
  }

  return (
    <div
      className="collaborator-duty-editor"
      role="region"
      aria-label={`${member.name} 的职责分配`}
    >
      <header className="collaborator-duty-editor-header">
        <div>
          <h4>分配职责</h4>
          <p>
            {member.name}
            <span className="duty-editor-current">
              当前：{DUTY_LABELS[duty.primaryDutyId]}
              {duty.additionalDutyId
                ? `、${DUTY_LABELS[duty.additionalDutyId]}`
                : ''}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="关闭职责分配"
          onClick={onClose}
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </header>

      <div className="duty-editor-block">
        <span className="duty-editor-label">主要职责</span>
        <div className="duty-chip-row" role="radiogroup" aria-label="主要职责">
          {ASSIGNABLE_DUTIES.map((item) => {
            const active = duty.primaryDutyId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`duty-chip${active ? ' is-active' : ''}`}
                onClick={() => handlePrimary(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="duty-editor-block">
        <span className="duty-editor-label">附加职责（可选，最多 1 项）</span>
        <div className="duty-chip-row" role="group" aria-label="附加职责">
          <button
            type="button"
            className={`duty-chip${duty.additionalDutyId === null ? ' is-active' : ''}`}
            aria-pressed={duty.additionalDutyId === null}
            onClick={() => handleAdditional(null)}
          >
            无
          </button>
          {ASSIGNABLE_DUTIES.map((item) => {
            const disabled = item.id === duty.primaryDutyId;
            const active = duty.additionalDutyId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                className={`duty-chip${active ? ' is-active' : ''}`}
                title={
                  disabled ? '附加职责不能与主要职责相同' : undefined
                }
                onClick={() => handleAdditional(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {lockedHint ? (
        <p className="register-locked-hint" role="status" aria-live="polite">
          {lockedHint}
        </p>
      ) : null}

      <footer className="duty-editor-footer">
        <button type="button" className="btn btn-primary btn-compact" onClick={onClose}>
          完成
        </button>
      </footer>
    </div>
  );
}
