import type { DutyId, TeamMember } from '../types';
import { DUTY_LABELS } from './duties';

/** 体验角色固定为 Maya Chen */
export const EXPERIENCE_MEMBER_ID = 'member-maya';

/**
 * 头像放在 public/avatars/，JPG 命名与下方 avatarUrl 一致。
 * 未放置文件或加载失败时，UI 自动回退为姓名缩写。
 */
export const teamMembers: TeamMember[] = [
  {
    id: 'member-maya',
    name: 'Maya Chen',
    initials: 'MC',
    avatarUrl: '/avatars/maya.jpg',
    skillTags: ['项目负责人', '后端 API', 'Node.js'],
    defaultPrimaryDutyId: null,
    selectable: false,
    locked: true,
    enabled: true,
    slot: 'preset',
    roleLabel: '项目负责人、后端 API',
    roles: ['owner', 'backend'],
  },
  {
    id: 'member-alex',
    name: 'Alex Lee',
    initials: 'AL',
    avatarUrl: '/avatars/alex.jpg',
    skillTags: ['数据库', 'SQL', '数据建模'],
    defaultPrimaryDutyId: 'database-design',
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'preset',
    roleLabel: DUTY_LABELS['database-design'],
    roles: ['database'],
  },
  {
    id: 'member-priya',
    name: 'Priya Shah',
    initials: 'PS',
    avatarUrl: '/avatars/priya.jpg',
    skillTags: ['前端', 'React', '界面交互'],
    defaultPrimaryDutyId: 'frontend-pages',
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'preset',
    roleLabel: DUTY_LABELS['frontend-pages'],
    roles: ['frontend'],
  },
  {
    id: 'member-jordan',
    name: 'Jordan Lin',
    initials: 'JL',
    avatarUrl: '/avatars/jordan.jpg',
    skillTags: ['测试', '质量保障', '集成'],
    defaultPrimaryDutyId: 'test-acceptance',
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'preset',
    roleLabel: DUTY_LABELS['test-acceptance'],
    roles: ['qa'],
  },
  {
    id: 'member-david',
    name: 'David Tao',
    initials: 'DT',
    avatarUrl: '/avatars/david.jpg',
    skillTags: ['未填写'],
    defaultPrimaryDutyId: null,
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'reserved',
    roleLabel: '预留位',
    roles: [],
  },
  {
    id: 'member-reserved-2',
    name: 'Duck Xv',
    initials: 'DX',
    avatarUrl: '/avatars/duck.jpg',
    skillTags: ['前端开发'],
    defaultPrimaryDutyId: 'frontend-pages',
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'reserved',
    roleLabel: '预留位',
    roles: [],
  },
  {
    id: 'member-celinia',
    name: 'Celinia Texas',
    initials: 'CT',
    avatarUrl: '/avatars/celinia.jpg',
    skillTags: ['数据分析'],
    defaultPrimaryDutyId: 'product-analysis',
    selectable: true,
    locked: false,
    enabled: true,
    slot: 'easter-egg',
    roleLabel: '彩蛋',
    roles: [],
  },
];

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
