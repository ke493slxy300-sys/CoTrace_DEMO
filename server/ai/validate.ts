/**
 * 校验模型输出：拒绝代码/命令，核对引用归属当前请求材料。
 */

import type {
  CollaborationLogDraft,
  HandoffAnalysisResult,
  HandoffFocusItem,
  HandoffFocusResult,
  HelpContextResult,
  MaterialCitation,
  MatchVerdict,
} from './contract';

const CODE_FENCE_RE = /```/;
const COMMAND_RE =
  /\b(?:npm\s+(?:install|test|run)|git\s+\w+|curl\s+|powershell\b|chmod\s+|rm\s+-rf)\b/i;
const PSEUDO_CODE_RE =
  /\b(?:function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|export\s+(?:default\s+)?function|import\s+.+\s+from\s+['"])/;

const VERDICTS = new Set<MatchVerdict>([
  'match',
  'suspect-wrong-version',
  'irrelevant',
  'insufficient-evidence',
]);

/** 发布者侧任务，不应出现在 Priya 联调关注项 */
const PUBLISHER_TASK_RE =
  /确认公开|公开日志|公开协作|日志范围|未共享草稿|发布摘要范围/;

function collectText(parts: string[]): string {
  return parts.filter(Boolean).join('\n');
}

export function textContainsForbiddenCode(text: string): string | null {
  if (CODE_FENCE_RE.test(text)) return 'output contains code fence';
  if (COMMAND_RE.test(text)) return 'output contains command or script';
  if (PSEUDO_CODE_RE.test(text)) return 'output contains code or pseudocode';
  return null;
}

export function citationsBelongToMaterials(
  citations: MaterialCitation[],
  materialIds: readonly string[],
): boolean {
  const allowed = new Set(materialIds);
  return citations.every((item) => allowed.has(item.materialId));
}

export function validateCollaborationLog(
  log: CollaborationLogDraft,
  materialIds: readonly string[],
): { ok: true } | { ok: false; message: string } {
  const narrative = collectText([
    log.summary,
    ...log.humanActions,
    ...log.aiActions,
    ...log.openItems,
    ...log.citations.map((item) => item.note),
  ]);
  const forbidden = textContainsForbiddenCode(narrative);
  if (forbidden) {
    return { ok: false, message: `${forbidden}; discarded` };
  }
  const citationText = collectText(log.citations.map((item) => item.excerpt));
  if (CODE_FENCE_RE.test(citationText) || COMMAND_RE.test(citationText)) {
    return {
      ok: false,
      message: 'citation excerpt contains code fence or command; discarded',
    };
  }
  if (!citationsBelongToMaterials(log.citations, materialIds)) {
    return { ok: false, message: 'citation materialId not in request' };
  }
  return { ok: true };
}

export function validateHandoffAnalysis(
  result: HandoffAnalysisResult,
  materialIds: readonly string[],
): { ok: true; result: HandoffAnalysisResult } | { ok: false; message: string } {
  if (!VERDICTS.has(result.verdict)) {
    return { ok: false, message: 'invalid verdict' };
  }
  if (!citationsBelongToMaterials(result.citations, materialIds)) {
    return { ok: false, message: 'difference citation not in request' };
  }
  const logCheck = validateCollaborationLog(
    result.collaborationLog,
    materialIds,
  );
  if (!logCheck.ok) return logCheck;

  if (result.verdict === 'irrelevant') {
    const summary = result.collaborationLog.summary.trim();
    if (
      summary &&
      /ITEM_NOT_AVAILABLE|order create|self-purchase|自购|订单创建|联调/.test(
        summary,
      ) &&
      result.collaborationLog.humanActions.length > 0
    ) {
      return {
        ok: false,
        message: 'irrelevant materials must not invent collaboration log',
      };
    }
  }

  const allText = collectText([
    ...result.differences,
    ...result.pendingConfirmations,
    ...result.risks,
  ]);
  const forbidden = textContainsForbiddenCode(allText);
  if (forbidden) {
    return { ok: false, message: `${forbidden}; discarded` };
  }

  return { ok: true, result };
}

function normalizeFocusItem(
  raw: Partial<HandoffFocusItem> & Record<string, unknown>,
): HandoffFocusItem {
  return {
    title: String(raw.title ?? ''),
    impact: String(raw.impact ?? ''),
    checkAction: String(raw.checkAction ?? ''),
    risk: String(raw.risk ?? ''),
    uncertainty: String(raw.uncertainty ?? ''),
    citations: Array.isArray(raw.citations)
      ? (raw.citations as MaterialCitation[])
      : [],
  };
}

export function validateHandoffFocus(
  result: HandoffFocusResult,
  materialIds: readonly string[],
): { ok: true; result: HandoffFocusResult } | { ok: false; message: string } {
  const capped = result.items.slice(0, 3).map(normalizeFocusItem);
  const filtered = capped.filter((item) => {
    const blob = `${item.title} ${item.impact} ${item.checkAction}`;
    return !PUBLISHER_TASK_RE.test(blob);
  });
  if (filtered.length === 0) {
    return { ok: false, message: 'focus items empty after publisher-task filter' };
  }

  for (const item of filtered) {
    if (!item.title.trim() || !item.impact.trim() || !item.checkAction.trim()) {
      return { ok: false, message: 'focus item missing required fields' };
    }
    if (!citationsBelongToMaterials(item.citations, materialIds)) {
      return { ok: false, message: 'focus citation materialId not in request' };
    }
    const text = collectText([
      item.title,
      item.impact,
      item.checkAction,
      item.risk,
      item.uncertainty,
      ...item.citations.map((c) => `${c.excerpt} ${c.note}`),
    ]);
    const forbidden = textContainsForbiddenCode(text);
    if (forbidden) {
      return { ok: false, message: `${forbidden}; discarded` };
    }
  }

  return {
    ok: true,
    result: {
      ...result,
      items: filtered,
    },
  };
}

export function validateHelpContext(
  result: HelpContextResult,
): { ok: true; result: HelpContextResult } | { ok: false; message: string } {
  const mode = result.mode;
  const next: HelpContextResult = {
    ...result,
    clarifyPrompts:
      mode === 'student-clarify' ? result.clarifyPrompts : [],
    guidanceSuggestions:
      mode === 'teacher-brief' ? result.guidanceSuggestions : [],
    keyDisagreements:
      mode === 'teacher-brief' ? result.keyDisagreements : [],
    missingInfo: mode === 'teacher-brief' ? result.missingInfo : [],
    situationSummary:
      mode === 'teacher-brief'
        ? result.situationSummary
        : result.situationSummary ||
          '可补充已尝试步骤、预期表现与实际页面提示后再提交。',
  };

  if (mode === 'student-clarify' && next.clarifyPrompts.length === 0) {
    return { ok: false, message: 'student-clarify requires clarifyPrompts' };
  }
  if (mode === 'teacher-brief' && !next.situationSummary.trim()) {
    return { ok: false, message: 'teacher-brief requires situationSummary' };
  }

  const text = collectText([
    next.situationSummary,
    ...next.keyDisagreements,
    ...next.missingInfo,
    ...next.guidanceSuggestions,
    ...next.clarifyPrompts,
  ]);
  const forbidden = textContainsForbiddenCode(text);
  if (forbidden) {
    return { ok: false, message: `${forbidden}; discarded` };
  }
  return { ok: true, result: next };
}
