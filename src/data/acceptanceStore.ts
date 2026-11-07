/**
 * 教师项目核收：最终提交 v1.0。
 */

import { useSyncExternalStore } from 'react';
import type { AcceptanceRecord, FinalSubmission } from '../types/handoff';
import {
  createFinalSubmission,
  createPendingAcceptance,
  HANDOFF_TEACHER_ID,
} from './handoffDemoSeed';

import { DEMO_ACCEPTANCE_KEY } from './demoStorage';

export const DEMO_ACCEPTANCE_STORAGE_KEY = DEMO_ACCEPTANCE_KEY;

type AcceptanceStoreData = {
  version: 1;
  submission: FinalSubmission;
  acceptance: AcceptanceRecord;
};

type Listener = () => void;
const listeners = new Set<Listener>();
let memory: AcceptanceStoreData | null = null;
let acceptanceSnapshot: AcceptanceRecord | null = null;
let submissionSnapshot: FinalSubmission | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function canUseStorage(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function seedData(): AcceptanceStoreData {
  return {
    version: 1,
    submission: createFinalSubmission(),
    acceptance: createPendingAcceptance(),
  };
}

function parseStored(raw: string | null): AcceptanceStoreData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as AcceptanceStoreData;
    if (!data || data.version !== 1) return null;
    if (!data.submission || !data.acceptance) return null;
    return data;
  } catch {
    return null;
  }
}

function remember(data: AcceptanceStoreData): void {
  acceptanceSnapshot = data.acceptance;
  submissionSnapshot = data.submission;
}

function persist(data: AcceptanceStoreData): void {
  memory = data;
  remember(data);
  if (canUseStorage()) {
    window.localStorage.setItem(
      DEMO_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify(data),
    );
  }
  for (const listener of listeners) listener();
}

function ensure(): AcceptanceStoreData {
  if (memory) return memory;
  if (canUseStorage()) {
    const local = parseStored(
      window.localStorage.getItem(DEMO_ACCEPTANCE_STORAGE_KEY),
    );
    memory = local ?? seedData();
  } else {
    memory = seedData();
  }
  remember(memory);
  return memory;
}

export function getFinalSubmission(): FinalSubmission {
  ensure();
  return submissionSnapshot ?? ensure().submission;
}

export function getAcceptance(): AcceptanceRecord {
  ensure();
  return acceptanceSnapshot ?? ensure().acceptance;
}

export type AcceptResult =
  | { ok: true; acceptance: AcceptanceRecord }
  | { ok: false; reason: 'already-accepted' };

export function confirmAcceptance(
  note: string,
  teacherId: string = HANDOFF_TEACHER_ID,
): AcceptResult {
  const data = ensure();
  if (data.acceptance.status === 'accepted') {
    return { ok: false, reason: 'already-accepted' };
  }

  const next: AcceptanceRecord = {
    ...data.acceptance,
    status: 'accepted',
    note: note.trim(),
    acceptedAt: nowIso(),
    acceptedById: teacherId,
  };
  persist({ ...data, acceptance: next });
  return { ok: true, acceptance: structuredClone(next) };
}

export function resetAcceptanceStore(): void {
  persist(seedData());
}

export function rehydrateAcceptanceStore(): void {
  memory = null;
  acceptanceSnapshot = null;
  submissionSnapshot = null;
  ensure();
}

export function subscribeAcceptance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAcceptance(): AcceptanceRecord {
  return useSyncExternalStore(
    subscribeAcceptance,
    getAcceptance,
    getAcceptance,
  );
}

export function useFinalSubmission(): FinalSubmission {
  return useSyncExternalStore(
    subscribeAcceptance,
    getFinalSubmission,
    getFinalSubmission,
  );
}
