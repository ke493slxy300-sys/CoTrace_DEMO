export function getDisplayLines(content: string): string[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    return lines.slice(0, -1);
  }
  return lines;
}

export function normalizeSelection(
  a: number,
  b: number,
): { lineStart: number; lineEnd: number } {
  return {
    lineStart: Math.min(a, b),
    lineEnd: Math.max(a, b),
  };
}

export function formatLineRange(lineStart: number, lineEnd: number): string {
  return lineStart === lineEnd
    ? `第 ${lineStart} 行`
    : `第 ${lineStart}–${lineEnd} 行`;
}
