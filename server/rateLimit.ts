/**
 * 简易内存限流：按客户端 IP + 路由桶。
 * Demo 用；不替代生产网关。
 */

import type { IncomingMessage } from 'node:http';
import { clientKey } from './httpUtil';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

export function checkRateLimit(
  req: IncomingMessage,
  routeKey: string,
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = `${clientKey(req)}:${routeKey}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}
