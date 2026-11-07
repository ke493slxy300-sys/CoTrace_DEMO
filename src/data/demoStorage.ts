/**
 * CoTrace Demo localStorage 统一入口。
 * - 禁止 localStorage.clear()
 * - 仅操作 cotrace-demo-* 前缀 key
 * - schemaVersion 变化时丢弃旧缓存并重载预置种子
 *
 * key 字符串与各 store 文件保持一致（勿改一侧漏改另一侧）。
 */

/** 预置数据或存储结构变更时递增；旧缓存将被清除 */
export const DEMO_STORAGE_SCHEMA_VERSION = 4;

export const DEMO_STORAGE_META_KEY = 'cotrace-demo-storage-meta';
export const DEMO_COLLABORATION_KEY = 'cotrace-demo-node-collaboration';
export const DEMO_SUBMISSIONS_KEY = 'cotrace-demo-submissions';
/**
 * 旧交接 key。当前交付写在 cotrace-demo-submissions 的 handoffDelivery 字段。
 * 重置时仍删除这个残留 key，避免旧缓存被误当成第二份交付。
 */
export const DEMO_DELIVERY_KEY = 'cotrace-demo-delivery';
export const DEMO_PROCESS_EVENTS_KEY = 'cotrace-demo-process-events';
export const DEMO_ACCEPTANCE_KEY = 'cotrace-demo-acceptance';
export const DEMO_ROLE_KEY = 'cotrace-demo-role';

/** 当前 Demo 使用的全部 localStorage key（含 meta） */
export const DEMO_STORAGE_KEYS = [
  DEMO_COLLABORATION_KEY,
  DEMO_SUBMISSIONS_KEY,
  DEMO_DELIVERY_KEY,
  DEMO_PROCESS_EVENTS_KEY,
  DEMO_ACCEPTANCE_KEY,
  DEMO_ROLE_KEY,
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
  window.localStorage.removeItem(DEMO_DELIVERY_KEY);
  window.localStorage.removeItem(DEMO_PROCESS_EVENTS_KEY);
  window.localStorage.removeItem(DEMO_ACCEPTANCE_KEY);
  window.localStorage.removeItem(DEMO_ROLE_KEY);
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
