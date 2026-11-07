/**
 * Demo 视角切换：Alex / Priya / 教师。
 * 切换角色保留本轮交付与反馈数据。
 */

import { useSyncExternalStore } from 'react';
import type { DemoRoleId } from '../types/handoff';
import {
  HANDOFF_PUBLISHER_ID,
  HANDOFF_RECEIVER_ID,
  HANDOFF_TEACHER_ID,
} from './handoffDemoSeed';

import { DEMO_ROLE_KEY } from './demoStorage';

export const DEMO_ROLE_STORAGE_KEY = DEMO_ROLE_KEY;

export type DemoRoleOption = {
  id: DemoRoleId;
  memberId: string;
  label: string;
  shortLabel: string;
};

export const DEMO_ROLE_OPTIONS: DemoRoleOption[] = [
  {
    id: 'alex',
    memberId: HANDOFF_PUBLISHER_ID,
    label: 'Alex Lee · 发布交付',
    shortLabel: 'Alex',
  },
  {
    id: 'priya',
    memberId: HANDOFF_RECEIVER_ID,
    label: 'Priya Shah · 接收联调',
    shortLabel: 'Priya',
  },
  {
    id: 'teacher',
    memberId: HANDOFF_TEACHER_ID,
    label: '周老师 · 课程指导',
    shortLabel: '教师',
  },
];

const DEFAULT_ROLE: DemoRoleId = 'alex';

type Listener = () => void;
const listeners = new Set<Listener>();
let memoryRole: DemoRoleId | null = null;

function canUseStorage(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function isRoleId(value: string): value is DemoRoleId {
  return value === 'alex' || value === 'priya' || value === 'teacher';
}

function readStored(): DemoRoleId {
  if (!canUseStorage()) return DEFAULT_ROLE;
  try {
    const raw = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
    if (raw && isRoleId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_ROLE;
}

function writeStored(role: DemoRoleId): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
}

function ensureMemory(): DemoRoleId {
  if (memoryRole == null) memoryRole = readStored();
  return memoryRole;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getDemoRole(): DemoRoleId {
  return ensureMemory();
}

export function getDemoRoleOption(role: DemoRoleId = getDemoRole()): DemoRoleOption {
  return (
    DEMO_ROLE_OPTIONS.find((item) => item.id === role) ?? DEMO_ROLE_OPTIONS[0]
  );
}

export function getActiveMemberId(): string {
  return getDemoRoleOption().memberId;
}

export function setDemoRole(role: DemoRoleId): void {
  memoryRole = role;
  writeStored(role);
  emit();
}

/** 重置时回到默认视角（Alex），不删业务数据由 demoStorage 统一清 key */
export function resetDemoRoleMemory(): void {
  memoryRole = DEFAULT_ROLE;
  writeStored(DEFAULT_ROLE);
  emit();
}

export function subscribeDemoRole(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDemoRole(): DemoRoleId {
  return useSyncExternalStore(subscribeDemoRole, getDemoRole, () => DEFAULT_ROLE);
}

export function useActiveMemberId(): string {
  const role = useDemoRole();
  return getDemoRoleOption(role).memberId;
}
