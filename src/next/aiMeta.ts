/** Demo 主路径共用的 AI 来源 / 失败文案 */

export function formatAiSourceLabel(
  provider: string | undefined,
  modelLabel: string | undefined,
): string {
  if (provider === 'live') {
    if (!modelLabel) return '真实模型';
    return `真实模型 · ${provider}/${modelLabel}`;
  }
  if (!provider && !modelLabel) return 'AI 整理';
  return `${provider ?? 'AI'}/${modelLabel ?? '?'}`;
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
  const head = isLive ? '真实模型调用失败' : '调用失败';
  return `${head}：${message}。${manualPath}`;
}
