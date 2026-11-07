/**
 * 教师端页间定位桥接。
 * App 尚未透传 focusEventId / focusSubmissionId 时，用 sessionStorage 从待办带入目标。
 * 主窗口接好路由参数后，页面 props 优先；此项作为兜底。
 */

export const TEACHER_FOCUS_EVENT_KEY = 'cotrace-teacher-focus-event';
export const TEACHER_FOCUS_SUBMISSION_KEY = 'cotrace-teacher-focus-submission';

function canUseSession(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function stashTeacherFocusEvent(eventId: string): void {
  if (!canUseSession() || !eventId) return;
  window.sessionStorage.setItem(TEACHER_FOCUS_EVENT_KEY, eventId);
}

export function takeTeacherFocusEvent(fallback?: string | null): string | null {
  if (!canUseSession()) return fallback ?? null;
  const stored = window.sessionStorage.getItem(TEACHER_FOCUS_EVENT_KEY);
  if (stored) {
    window.sessionStorage.removeItem(TEACHER_FOCUS_EVENT_KEY);
    return stored;
  }
  return fallback ?? null;
}

export function stashTeacherFocusSubmission(submissionId: string): void {
  if (!canUseSession() || !submissionId) return;
  window.sessionStorage.setItem(TEACHER_FOCUS_SUBMISSION_KEY, submissionId);
}

export function takeTeacherFocusSubmission(
  fallback?: string | null,
): string | null {
  if (!canUseSession()) return fallback ?? null;
  const stored = window.sessionStorage.getItem(TEACHER_FOCUS_SUBMISSION_KEY);
  if (stored) {
    window.sessionStorage.removeItem(TEACHER_FOCUS_SUBMISSION_KEY);
    return stored;
  }
  return fallback ?? null;
}
