/**
 * CoTrace Demo localStorage 统一入口。
 * - 禁止 localStorage.clear()
 * - 仅操作 cotrace-demo-* 前缀 key
 * - schemaVersion 变化时丢弃旧缓存并重载预置种子
 *
 * key 字符串与 demoSubmission / nodeCollaborationStore 保持一致。
 */

/** 预置数据或存储结构变更时递增；旧缓存将被清除 */
export const DEMO_STORAGE_SCHEMA_VERSION = 2;

export const DEMO_STORAGE_META_KEY = 'cotrace-demo-storage-meta';
export const DEMO_COLLABORATION_KEY = 'cotrace-demo-node-collaboration';
export const DEMO_SUBMISSIONS_KEY = 'cotrace-demo-submissions';

/** 当前 Demo 使用的全部 localStorage key（含 meta） */
export const DEMO_STORAGE_KEYS = [
  DEMO_COLLABORATION_KEY,
  DEMO_SUBMISSIONS_KEY,
  DEMO_STORAGE_META_KEY,
] as const;

type DemoStorageMeta = {
  schemaVersion: number;
  updatedAt: string;
};

function canUseStorage(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function readMeta(): DemoStorageMeta | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_META_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DemoStorageMeta;
    if (!data || typeof data.schemaVersion !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeMeta(schemaVersion: number): void {
  if (!canUseStorage()) return;
  const meta: DemoStorageMeta = {
    schemaVersion,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(DEMO_STORAGE_META_KEY, JSON.stringify(meta));
}

/** 只删除已知 Demo key，绝不 clear() */
function removeDemoDataKeys(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(DEMO_COLLABORATION_KEY);
  window.localStorage.removeItem(DEMO_SUBMISSIONS_KEY);
}

/**
 * App 启动时调用：schema 落后则清除业务缓存，避免测试用户长期看到旧预置数据。
 */
export function ensureDemoStorageMigrated(): void {
  if (!canUseStorage()) return;
  const meta = readMeta();
  if (meta?.schemaVersion === DEMO_STORAGE_SCHEMA_VERSION) return;
  removeDemoDataKeys();
  writeMeta(DEMO_STORAGE_SCHEMA_VERSION);
}

/**
 * 重置 Demo 数据：仅删除 CoTrace Demo key，然后整页重载。
 */
export function resetDemoLocalStorage(): void {
  if (!canUseStorage()) {
    window.location.reload();
    return;
  }
  removeDemoDataKeys();
  window.localStorage.removeItem(DEMO_STORAGE_META_KEY);
  window.location.reload();
}

export function listDemoStorageKeys(): readonly string[] {
  return DEMO_STORAGE_KEYS;
}
