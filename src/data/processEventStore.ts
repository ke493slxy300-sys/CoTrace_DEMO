/**
 * 教师阶段汇报时间线 + 教师反馈。与交付共用项目 ID。
 */

import { useSyncExternalStore } from 'react';
import type { ProcessEvent, TeacherFeedback } from '../types/handoff';
import { syncTeacherFeedback } from '../api/cotraceApi';
import {
  createSeedProcessEvents,
  EMPTY_FEEDBACKS,
  HANDOFF_TEACHER_ID,
} from './handoffDemoSeed';

import { DEMO_PROCESS_EVENTS_KEY as PROCESS_EVENTS_KEY } from './demoStorage';

export const DEMO_PROCESS_EVENTS_KEY = PROCESS_EVENTS_KEY;

type ProcessStoreData = {
  version: 1;
  events: ProcessEvent[];
  feedbacks: TeacherFeedback[];
};

type Listener = () => void;
const listeners = new Set<Listener>();
let memory: ProcessStoreData | null = null;
let feedbackSnapshot: TeacherFeedback[] = [];
let eventSnapshot: ProcessEvent[] = [];
const feedbacksByEvent = new Map<string, TeacherFeedback[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function canUseStorage(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function seedData(): ProcessStoreData {
  return {
    version: 1,
    events: createSeedProcessEvents(),
    feedbacks: [...EMPTY_FEEDBACKS],
  };
}

function parseStored(raw: string | null): ProcessStoreData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ProcessStoreData;
    if (!data || data.version !== 1) return null;
    if (!Array.isArray(data.events) || !Array.isArray(data.feedbacks)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function rememberSnapshots(data: ProcessStoreData): void {
  eventSnapshot = data.events;
  feedbackSnapshot = data.feedbacks;
  feedbacksByEvent.clear();
}

function persist(data: ProcessStoreData): void {
  memory = data;
  rememberSnapshots(data);
  if (canUseStorage()) {
    window.localStorage.setItem(DEMO_PROCESS_EVENTS_KEY, JSON.stringify(data));
  }
  for (const listener of listeners) listener();
}

function ensure(): ProcessStoreData {
  if (memory) return memory;
  if (canUseStorage()) {
    const local = parseStored(
      window.localStorage.getItem(DEMO_PROCESS_EVENTS_KEY),
    );
    memory = local ?? seedData();
  } else {
    memory = seedData();
  }
  feedbackSnapshot = memory.feedbacks;
  eventSnapshot = memory.events;
  feedbacksByEvent.clear();
  return memory;
}

export function getProcessEvents(): ProcessEvent[] {
  ensure();
  return eventSnapshot;
}

export function getProcessEventById(id: string): ProcessEvent | null {
  return getProcessEvents().find((event) => event.id === id) ?? null;
}

export function getFeedbacksForEvent(eventId: string): TeacherFeedback[] {
  ensure();
  const cached = feedbacksByEvent.get(eventId);
  if (cached) return cached;
  const next = feedbackSnapshot.filter((item) => item.eventId === eventId);
  feedbacksByEvent.set(eventId, next);
  return next;
}

export function getAllFeedbacks(): TeacherFeedback[] {
  ensure();
  return feedbackSnapshot;
}

/** 幂等追加：同 id 已存在则忽略 */
export function appendProcessEvent(event: ProcessEvent): boolean {
  const data = ensure();
  if (data.events.some((item) => item.id === event.id)) return false;
  persist({
    ...data,
    events: [event, ...data.events],
  });
  return true;
}

export type SendFeedbackResult =
  | { ok: true; feedback: TeacherFeedback }
  | { ok: false; reason: 'empty' | 'duplicate' };

export function sendTeacherFeedback(
  eventId: string,
  content: string,
  authorId: string = HANDOFF_TEACHER_ID,
): SendFeedbackResult {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const data = ensure();
  const event = data.events.find((item) => item.id === eventId);
  if (!event) return { ok: false, reason: 'empty' };

  const feedbackId = `feedback-${eventId}`;
  if (data.feedbacks.some((item) => item.id === feedbackId)) {
    return { ok: false, reason: 'duplicate' };
  }

  const feedback: TeacherFeedback = {
    id: feedbackId,
    eventId,
    projectId: event.projectId,
    authorId,
    content: trimmed,
    createdAt: nowIso(),
  };

  const feedbackEvent: ProcessEvent = {
    id: `event-feedback-${eventId}`,
    projectId: event.projectId,
    dateLabel: '今天',
    title: `教师反馈 · ${event.title}`,
    statusLabel: '等待回应',
    statusTone: 'warning',
    kind: 'teacher-feedback',
    summary: trimmed,
    authorLabel: '周老师 · 回复',
    evidence: [
      {
        id: `ev-feedback-body-${eventId}`,
        kind: 'verification',
        label: '教师回复',
        summary: trimmed,
        at: nowIso(),
        linkLabel: '查看反馈',
      },
    ],
    deliveryId: event.deliveryId,
    versionId: event.versionId,
    relatedEventId: eventId,
  };

  const nextEvents = data.events.some((item) => item.id === feedbackEvent.id)
    ? data.events
    : [feedbackEvent, ...data.events];

  persist({
    version: 1,
    events: nextEvents,
    feedbacks: [...data.feedbacks, feedback],
  });

  void syncTeacherFeedback({
    eventId,
    id: feedback.id,
    text: trimmed,
    authorId,
    authorLabel: '周老师 · 回复',
    at: feedback.createdAt,
  });

  return { ok: true, feedback };
}

export function resetProcessEventStore(): void {
  persist(seedData());
}

export function rehydrateProcessEventStore(): void {
  memory = null;
  feedbackSnapshot = [];
  eventSnapshot = [];
  feedbacksByEvent.clear();
  ensure();
}

export function subscribeProcessEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProcessEvents(): ProcessEvent[] {
  return useSyncExternalStore(
    subscribeProcessEvents,
    getProcessEvents,
    getProcessEvents,
  );
}

export function useFeedbacksForEvent(eventId: string): TeacherFeedback[] {
  return useSyncExternalStore(
    subscribeProcessEvents,
    () => getFeedbacksForEvent(eventId),
    () => getFeedbacksForEvent(eventId),
  );
}
