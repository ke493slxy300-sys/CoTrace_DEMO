/** Demo 主路径共用的 AI 来源 / 失败文案 */

export function formatAiSourceLabel(
  provider: string | undefined,
  modelLabel: string | undefined,
): string {
  const mode = provider === 'live' ? '真实模型' : '模拟结果';
  if (!provider && !modelLabel) return mode;
  return `${mode} · ${provider ?? '?'}/${modelLabel ?? '?'}`;
}

export function formatAiFailureHint(
  providerOrMode: string | undefined,
  message: string,
  manualPath: string,
): string {
  const isLive =
    providerOrMode === 'live' ||
    providerOrMode === '真实模型' ||
    message.includes('真实');
  const head = isLive ? '真实模型调用失败' : '模拟结果调用失败';
  return `${head}：${message}。${manualPath}`;
}
