/**
 * DeepSeek 服务端配置。密钥仅进程内使用，禁止写入日志或响应。
 */

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-flash';

export type DeepseekConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export type DeepseekConfigError = {
  ok: false;
  errorType: 'missing_key';
};

export type DeepseekConfigResult =
  | { ok: true; config: DeepseekConfig }
  | DeepseekConfigError;

/** 将 Vite loadEnv 读到的服务端变量显式写入 process.env（不覆盖已有值）。 */
export function applyServerEnv(loaded: Record<string, string>): void {
  for (const [key, value] of Object.entries(loaded)) {
    if (!key || value == null) continue;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function resolveDeepseekConfig(
  env: NodeJS.ProcessEnv = process.env,
): DeepseekConfigResult {
  const apiKey = (env.DEEPSEEK_API_KEY ?? '').trim();
  if (!apiKey) {
    return { ok: false, errorType: 'missing_key' };
  }
  const model =
    (env.DEEPSEEK_MODEL ?? '').trim() || DEEPSEEK_DEFAULT_MODEL;
  return {
    ok: true,
    config: {
      apiKey,
      model,
      baseUrl: DEEPSEEK_BASE_URL,
    },
  };
}

/** 从任意字符串中抹去疑似密钥，避免日志/错误二次泄露。 */
export function redactSecrets(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let out = text;
  const key = (env.DEEPSEEK_API_KEY ?? '').trim();
  if (key.length >= 8) {
    out = out.split(key).join('[REDACTED]');
  }
  out = out.replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]');
  return out;
}
