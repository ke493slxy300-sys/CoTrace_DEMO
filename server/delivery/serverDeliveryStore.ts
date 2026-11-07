/**
 * 服务端交付快照与过程事件（内存）。
 * Demo 跨端同源；进程重启后清空。业务写接口做幂等键防双提交。
 */

export type ServerDeliveryVersion = {
  versionId: string;
  version: string;
  publishedAt: string;
  codeMaterialId: string;
  chatMaterialId: string;
  summary: string;
  brief: string;
  collaborationLog: {
    summary: string;
    humanActions: string[];
    aiActions: string[];
    openItems: string[];
    citations: unknown[];
    manuallyEdited: boolean;
  } | null;
  analysis: unknown | null;
  riskAcknowledged: boolean;
  riskNotes: string;
  manuallyEdited: boolean;
  publisherId: string;
  receiverId: string;
  projectId: string;
  deliveryId: string;
  title: string;
  status: string;
};

export type ServerProcessEvent = {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  summary: string;
  authorLabel: string;
  authorId?: string;
  deliveryId?: string;
  deliveryVersionId?: string;
  statusLabel: string;
  statusTone: string;
  dateLabel: string;
  createdAt: string;
  evidence: unknown[];
  relatedEventId?: string;
  feedbackText?: string;
};

type DeliveryRecord = {
  deliveryId: string;
  projectId: string;
  title: string;
  publisherId: string;
  receiverId: string;
  status: string;
  currentVersionId: string | null;
  versions: Map<string, ServerDeliveryVersion>;
  updatedAt: string;
};

const deliveries = new Map<string, DeliveryRecord>();
const events = new Map<string, ServerProcessEvent>();
/** 幂等：同一 key 24h 内不重复写入 */
const idempotency = new Map<string, { at: number; result: unknown }>();

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function peekIdempotent(
  key: string,
): { hit: true; result: unknown } | { hit: false } {
  const existing = idempotency.get(key);
  if (existing && Date.now() - existing.at < IDEMPOTENCY_TTL_MS) {
    return { hit: true, result: existing.result };
  }
  return { hit: false };
}

export function setIdempotent(key: string, result: unknown): void {
  idempotency.set(key, { at: Date.now(), result });
}

export function upsertPublishedVersion(
  snapshot: ServerDeliveryVersion,
): ServerDeliveryVersion {
  let record = deliveries.get(snapshot.deliveryId);
  if (!record) {
    record = {
      deliveryId: snapshot.deliveryId,
      projectId: snapshot.projectId,
      title: snapshot.title,
      publisherId: snapshot.publisherId,
      receiverId: snapshot.receiverId,
      status: 'published',
      currentVersionId: snapshot.versionId,
      versions: new Map(),
      updatedAt: snapshot.publishedAt,
    };
    deliveries.set(snapshot.deliveryId, record);
  }
  record.versions.set(snapshot.versionId, snapshot);
  record.currentVersionId = snapshot.versionId;
  record.status = 'published';
  record.title = snapshot.title;
  record.updatedAt = snapshot.publishedAt;
  return snapshot;
}

export function getVersionSnapshot(
  deliveryId: string,
  versionId: string,
): ServerDeliveryVersion | null {
  return deliveries.get(deliveryId)?.versions.get(versionId) ?? null;
}

export function markReceived(
  deliveryId: string,
  versionId: string,
  at: string,
): { ok: true } | { ok: false; message: string } {
  const record = deliveries.get(deliveryId);
  if (!record) return { ok: false, message: '交付不存在' };
  if (record.currentVersionId !== versionId) {
    return { ok: false, message: '仅可接收当前待接收版本' };
  }
  const version = record.versions.get(versionId);
  if (!version) return { ok: false, message: '版本不存在' };
  record.status = 'received';
  record.updatedAt = at;
  version.status = 'received';
  return { ok: true };
}

export function markNeedsRevision(
  deliveryId: string,
  versionId: string,
  note: string,
  at: string,
): { ok: true } | { ok: false; message: string } {
  const record = deliveries.get(deliveryId);
  if (!record) return { ok: false, message: '交付不存在' };
  const version = record.versions.get(versionId);
  if (!version) return { ok: false, message: '版本不存在' };
  record.status = 'needs-revision';
  record.updatedAt = at;
  version.status = 'needs-revision';
  version.riskNotes = version.riskNotes
    ? `${version.riskNotes}\n修订意见：${note}`
    : `修订意见：${note}`;
  return { ok: true };
}

export function appendEvent(event: ServerProcessEvent): ServerProcessEvent {
  events.set(event.id, event);
  return event;
}

export function listEvents(projectId: string): ServerProcessEvent[] {
  return [...events.values()]
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getEvent(eventId: string): ServerProcessEvent | null {
  return events.get(eventId) ?? null;
}

export function attachTeacherFeedback(
  eventId: string,
  feedback: {
    id: string;
    text: string;
    authorLabel: string;
    authorId: string;
    at: string;
  },
): ServerProcessEvent | null {
  const original = events.get(eventId);
  if (!original) return null;
  original.statusLabel = '已反馈';
  original.statusTone = 'success';
  const feedbackEvent: ServerProcessEvent = {
    id: feedback.id,
    projectId: original.projectId,
    kind: 'teacher-feedback',
    title: '教师反馈',
    summary: feedback.text,
    authorLabel: feedback.authorLabel,
    authorId: feedback.authorId,
    deliveryId: original.deliveryId,
    deliveryVersionId: original.deliveryVersionId,
    statusLabel: '正式反馈',
    statusTone: 'success',
    dateLabel: feedback.at.slice(0, 10),
    createdAt: feedback.at,
    evidence: [],
    relatedEventId: eventId,
    feedbackText: feedback.text,
  };
  events.set(feedbackEvent.id, feedbackEvent);
  return feedbackEvent;
}

export function listDeliveryMeta(deliveryId: string) {
  const record = deliveries.get(deliveryId);
  if (!record) return null;
  return {
    deliveryId: record.deliveryId,
    projectId: record.projectId,
    title: record.title,
    publisherId: record.publisherId,
    receiverId: record.receiverId,
    status: record.status,
    currentVersionId: record.currentVersionId,
    versionIds: [...record.versions.keys()],
    updatedAt: record.updatedAt,
  };
}
