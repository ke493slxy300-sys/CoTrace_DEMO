import type { DutyId } from '../types';
import {
  DEMO_CAST_SEEDS,
  isDemoCastMember,
  type CollaboratorSelectionInput,
} from './collaborators';
import { DEMO_COLLABORATOR_LOCK_MESSAGE } from './demoLock';
import {
  EXPERIENCE_MEMBER_ID,
  getMemberDefaultPrimaryDuty,
} from './members';

export type DutyAssignment = {
  primaryDutyId: DutyId;
  additionalDutyId: DutyId | null;
};

/** 注册弹窗内的协作草稿（不含锁定的 Maya，提交时再合并） */
export type RegisterCollaboratorDraft = {
  selectedIds: string[];
  dutyByMemberId: Record<string, DutyAssignment>;
};

export function createEmptyRegisterDraft(): RegisterCollaboratorDraft {
  return {
    selectedIds: [],
    dutyByMemberId: {},
  };
}

/** Demo：预选并锁定 Alex / Priya / Jordan */
export function createDemoRegisterDraft(): RegisterCollaboratorDraft {
  const dutyByMemberId: Record<string, DutyAssignment> = {};
  const selectedIds: string[] = [];
  for (const seed of DEMO_CAST_SEEDS) {
    selectedIds.push(seed.memberId);
    dutyByMemberId[seed.memberId] = {
      primaryDutyId: seed.primaryDutyId,
      additionalDutyId: seed.additionalDutyId ?? null,
    };
  }
  return { selectedIds, dutyByMemberId };
}

/** 协作草稿是否相对基线有变更（选人 / 职责） */
export function isRegisterDraftChanged(
  draft: RegisterCollaboratorDraft,
  baseline: RegisterCollaboratorDraft = createEmptyRegisterDraft(),
): boolean {
  if (draft.selectedIds.length !== baseline.selectedIds.length) return true;

  for (let index = 0; index < draft.selectedIds.length; index += 1) {
    if (draft.selectedIds[index] !== baseline.selectedIds[index]) return true;
  }

  for (const memberId of draft.selectedIds) {
    const current = draft.dutyByMemberId[memberId];
    const initial = baseline.dutyByMemberId[memberId];
    if (!current) return true;
    if (!initial) {
      const defaults = getMemberDefaultPrimaryDuty(memberId);
      if (
        current.primaryDutyId !== defaults ||
        current.additionalDutyId !== null
      ) {
        return true;
      }
      continue;
    }
    if (
      current.primaryDutyId !== initial.primaryDutyId ||
      current.additionalDutyId !== initial.additionalDutyId
    ) {
      return true;
    }
  }

  return false;
}

export function getRegisterCloseConfirmMessage(
  draft: RegisterCollaboratorDraft,
): string {
  const count = draft.selectedIds.length;
  if (count > 0) {
    return `已选择 ${count} 名协作者及其职责尚未提交。关闭后将返回项目列表，本次选择不会保存。`;
  }
  return '当前注册内容尚未提交。关闭后将返回项目列表，可再次打开查看预置内容。';
}

export function draftToSelectionInputs(
  draft: RegisterCollaboratorDraft,
): CollaboratorSelectionInput[] {
  return draft.selectedIds.map((memberId) => {
    const duty = draft.dutyByMemberId[memberId];
    const fallback = getMemberDefaultPrimaryDuty(memberId) ?? 'database-design';
    return {
      memberId,
      primaryDutyId: duty?.primaryDutyId ?? fallback,
      additionalDutyId: duty?.additionalDutyId ?? null,
    };
  });
}

export type DraftMutationResult = {
  draft: RegisterCollaboratorDraft;
  /** 尝试操作锁定体验者时的轻量提示 */
  lockedHint: string | null;
};

/** 选中可选成员；Demo 下仅班底可处于已选，禁止增删 */
export function selectOptionalMember(
  draft: RegisterCollaboratorDraft,
  memberId: string,
): DraftMutationResult {
  if (memberId === EXPERIENCE_MEMBER_ID) {
    return {
      draft,
      lockedHint: 'Maya Chen 为固定体验角色，已在项目中，无需选择。',
    };
  }

  if (isDemoCastMember(memberId)) {
    if (draft.selectedIds.includes(memberId)) {
      return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
    }
    return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
  }

  return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
}

/** 取消选择可选成员；Demo 班底不可取消 */
export function deselectOptionalMember(
  draft: RegisterCollaboratorDraft,
  memberId: string,
): DraftMutationResult {
  if (memberId === EXPERIENCE_MEMBER_ID) {
    return {
      draft,
      lockedHint: '不能取消 Maya Chen：其为固定的项目负责人与后端 API 负责人。',
    };
  }

  if (isDemoCastMember(memberId) || draft.selectedIds.includes(memberId)) {
    return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
  }

  return { draft, lockedHint: null };
}

export type DutyMutationResult = {
  draft: RegisterCollaboratorDraft;
  lockedHint: string | null;
};

export function setMemberPrimaryDuty(
  draft: RegisterCollaboratorDraft,
  memberId: string,
  _primaryDutyId: DutyId,
): DutyMutationResult {
  if (memberId === EXPERIENCE_MEMBER_ID || isDemoCastMember(memberId)) {
    return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
  }
  return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
}

export function setMemberAdditionalDuty(
  draft: RegisterCollaboratorDraft,
  memberId: string,
  _additionalDutyId: DutyId | null,
): DutyMutationResult {
  if (memberId === EXPERIENCE_MEMBER_ID || isDemoCastMember(memberId)) {
    return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
  }
  return { draft, lockedHint: DEMO_COLLABORATOR_LOCK_MESSAGE };
}
