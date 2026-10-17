import { Lock, Plus, Settings2, UserMinus, Users } from 'lucide-react';
import {
  createLockedExperienceCollaborator,
  describeExperienceLock,
  getCollaboratorDisplayLabel,
  isDemoCastMember,
} from '../../data/collaborators';
import { DEMO_COLLABORATOR_LOCK_MESSAGE } from '../../data/demoLock';
import { formatDutyLabels } from '../../data/duties';
import { getExperienceMember, getMemberById } from '../../data/members';
import {
  deselectOptionalMember,
  type RegisterCollaboratorDraft,
} from '../../data/registerDraft';
import { MemberAvatar } from '../common/MemberAvatar';

type RegisterCollaboratorsSectionProps = {
  draft: RegisterCollaboratorDraft;
  pickerOpen: boolean;
  lockedHint: string | null;
  onDraftChange: (draft: RegisterCollaboratorDraft) => void;
  onLockedHint: (message: string | null) => void;
  onOpenPicker: () => void;
  onRequestDutyEdit: (memberId: string) => void;
};

export function RegisterCollaboratorsSection({
  draft,
  pickerOpen,
  lockedHint,
  onDraftChange,
  onLockedHint,
  onOpenPicker,
  onRequestDutyEdit,
}: RegisterCollaboratorsSectionProps) {
  const experience = getExperienceMember();
  const lockedCollaborator = createLockedExperienceCollaborator();
  const lockedDutyLabel = getCollaboratorDisplayLabel(lockedCollaborator);

  function handleRemove(memberId: string) {
    const result = deselectOptionalMember(draft, memberId);
    onDraftChange(result.draft);
    onLockedHint(result.lockedHint);
  }

  return (
    <section className="register-section register-collaborators">
      <div className="register-section-head">
        <h3>协作者和职责</h3>
        {draft.selectedIds.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            aria-expanded={pickerOpen}
            aria-controls="collaborator-picker-panel"
            onClick={onOpenPicker}
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            添加协作者
          </button>
        ) : null}
      </div>

      <ul className="collaborator-chip-list">
        <li className="collaborator-chip is-locked">
          <button
            type="button"
            className="collaborator-chip-locked-main"
            onClick={() => onLockedHint(describeExperienceLock())}
            aria-label={`${experience.name}，固定体验角色，不可移除或修改职责`}
          >
            <MemberAvatar member={experience} />
            <span className="collaborator-chip-body">
              <span className="collaborator-chip-title">
                <strong>{experience.name}</strong>
              </span>
              <span className="collaborator-chip-duty">{lockedDutyLabel}</span>
            </span>
          </button>
          <span
            className="collaborator-chip-lock"
            title="固定体验角色，不可移除"
            aria-hidden="true"
          >
            <Lock size={15} strokeWidth={1.5} />
          </span>
        </li>

        {draft.selectedIds.map((memberId) => {
          const member = getMemberById(memberId);
          const duty = draft.dutyByMemberId[memberId];
          if (!member || !duty) return null;
          const dutyLabel = formatDutyLabels(
            duty.primaryDutyId,
            duty.additionalDutyId,
          );
          const demoLocked = isDemoCastMember(memberId);
          return (
            <li
              key={memberId}
              className={`collaborator-chip${demoLocked ? ' is-locked' : ''}`}
            >
              <MemberAvatar member={member} />
              <div className="collaborator-chip-body">
                <div className="collaborator-chip-title">
                  <strong>{member.name}</strong>
                </div>
                <p>{dutyLabel}</p>
              </div>
              <div className="collaborator-chip-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={
                    demoLocked
                      ? `${member.name} 为演示班底，不可修改职责`
                      : `为 ${member.name} 分配职责`
                  }
                  onClick={() => {
                    if (demoLocked) {
                      onLockedHint(DEMO_COLLABORATOR_LOCK_MESSAGE);
                      return;
                    }
                    onOpenPicker();
                    onRequestDutyEdit(memberId);
                  }}
                >
                  <Settings2 size={15} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={
                    demoLocked
                      ? `${member.name} 为演示班底，不可移除`
                      : `移除 ${member.name}`
                  }
                  onClick={() => handleRemove(memberId)}
                >
                  {demoLocked ? (
                    <Lock size={15} strokeWidth={1.5} />
                  ) : (
                    <UserMinus size={15} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft.selectedIds.length === 0 ? (
        <div className="register-empty-collaborators">
          <Users size={18} strokeWidth={1.5} aria-hidden="true" />
          <p>还没有添加协作者</p>
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            onClick={onOpenPicker}
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            添加协作者
          </button>
        </div>
      ) : null}

      {lockedHint ? (
        <p className="register-locked-hint" role="status" aria-live="polite">
          {lockedHint}
        </p>
      ) : null}
    </section>
  );
}
