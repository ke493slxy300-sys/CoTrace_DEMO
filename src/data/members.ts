import type { DutyId, TeamMember } from "../types";
import { campusMarketplaceDataset } from "../datasets";

const memberData = campusMarketplaceDataset.members;
/** 体验角色固定为 Maya Chen */
export const EXPERIENCE_MEMBER_ID = "member-maya";

/**
 * 头像放在 public/avatars/，JPG 命名与下方 avatarUrl 一致。
 * 未放置文件或加载失败时，UI 自动回退为姓名缩写。
 */
export const teamMembers = memberData as TeamMember[];

export function getMemberById(id: string): TeamMember | undefined {
  return teamMembers.find((member) => member.id === id);
}

export function getExperienceMember(): TeamMember {
  return teamMembers.find((member) => member.id === EXPERIENCE_MEMBER_ID)!;
}

/** 侧板可选成员：已启用且非锁定体验者 */
export function getSelectableMembers(): TeamMember[] {
  return teamMembers.filter(
    (member) => member.enabled && member.selectable && !member.locked,
  );
}

/** 仅按姓名 / 缩写过滤（不按职责或能力标签搜索） */
export function searchSelectableMembers(query: string): TeamMember[] {
  const normalized = query.trim().toLowerCase();
  const pool = getSelectableMembers();
  if (!normalized) return pool;

  return pool.filter((member) => {
    const name = member.name.toLowerCase();
    const initials = member.initials.toLowerCase();
    return name.includes(normalized) || initials.includes(normalized);
  });
}

export function getMemberDefaultPrimaryDuty(memberId: string): DutyId | null {
  return getMemberById(memberId)?.defaultPrimaryDutyId ?? null;
}
