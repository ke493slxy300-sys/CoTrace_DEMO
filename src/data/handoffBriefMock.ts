/**
 * 本地 mock「整理接手提示」。不调用外部模型、不读 API Key。
 * 输出仅限理解/接手文字；含代码围栏或命令则整份作废。
 */

import type { HandoffBriefBlock } from '../types/handoff';
import {
  HANDOFF_BRIEF_DEFAULT_SOURCE_IDS,
  HANDOFF_BRIEF_SOURCE_API_SPEC,
  HANDOFF_BRIEF_SOURCE_TEST_RUN,
  HANDOFF_BRIEF_SOURCE_VERSION_DIFF,
  isHandoffBriefSourceId,
  loadHandoffBriefSourceBodies,
  type HandoffBriefSourceId,
} from './handoffBriefSources';

export type HandoffBriefOrganizeMode =
  | 'success'
  | 'code-request'
  | 'failure';

export type HandoffBriefOrganizeRequest = {
  sourceIds?: readonly string[];
  /** 测试钩子：默认 success */
  mode?: HandoffBriefOrganizeMode;
};

export type HandoffBriefPayload = {
  brief: string;
  changes: HandoffBriefBlock[];
  downstreamImpact: HandoffBriefBlock[];
  suggestedChecks: HandoffBriefBlock[];
  evidenceAndOpen: HandoffBriefBlock[];
  sourceIds: HandoffBriefSourceId[];
};

export type HandoffBriefOrganizeResult =
  | { ok: true; payload: HandoffBriefPayload }
  | {
      ok: false;
      reason: 'invalid-sources' | 'generation-failed' | 'out-of-bounds';
      message: string;
    };

const CODE_FENCE_RE = /```/;
const COMMAND_RE =
  /\b(?:npm\s+(?:install|test|run)|git\s+\w+|curl\s+|powershell\b|chmod\s+|rm\s+-rf)\b/i;
const PSEUDO_CODE_RE =
  /\b(?:function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|export\s+(?:default\s+)?function|import\s+.+\s+from\s+['"])/;

function block(
  body: string,
  kind: HandoffBriefBlock['kind'],
  sourceIds: HandoffBriefSourceId[],
): HandoffBriefBlock {
  return { body, kind, sourceIds: [...sourceIds] };
}

function buildCompliantPayload(
  sourceIds: HandoffBriefSourceId[],
): HandoffBriefPayload {
  const all = sourceIds;
  const api = [HANDOFF_BRIEF_SOURCE_API_SPEC] as HandoffBriefSourceId[];
  const diff = [HANDOFF_BRIEF_SOURCE_VERSION_DIFF] as HandoffBriefSourceId[];
  const test = [HANDOFF_BRIEF_SOURCE_TEST_RUN] as HandoffBriefSourceId[];

  return {
    brief:
      '联调请先核对待售商品在商品详情页发起购买时，ITEM_NOT_AVAILABLE（商品已被其他买家购买）的前端提示是否与接口约定一致。后端单测已有运行结果（5 passed），但未见前端联调运行结果，请按未验证联调继续检查。',
    changes: [
      block(
        '事实：v0.4 相对基线补充了自购校验、可售状态条件更新与商品快照；库存不足提示改为「暂时无法购买」。',
        'fact',
        [...diff, ...api],
      ),
      block(
        '事实：接口约定商品不可购买时返回 ITEM_NOT_AVAILABLE，前端应按 code 分支提示「商品已被其他买家购买」。',
        'fact',
        api,
      ),
    ],
    downstreamImpact: [
      block(
        '建议：商品详情页购买流程需按错误码展示，不能只显示通用失败或仅比对错误文案。',
        'suggestion',
        api,
      ),
      block(
        '建议：交易流程联调以「创建订单 → 结果反馈」同一套状态与错误语义为准。',
        'suggestion',
        all,
      ),
    ],
    suggestedChecks: [
      block(
        '建议：先构造「商品已被其他买家购买」场景，确认商品详情页提示与 ITEM_NOT_AVAILABLE 一致。',
        'suggestion',
        [...api, ...test],
      ),
      block(
        '建议：再核对自购与商品缺失等异常是否仍走稳定 code，而不是裸消息字符串。',
        'suggestion',
        api,
      ),
    ],
    evidenceAndOpen: [
      block(
        '事实：agent 会话 type:test-result 写明当前 5 个测试全部通过；submission testResult 为 5 passed / 0 failed。',
        'fact',
        test,
      ),
      block(
        '未验证：材料中未见前端联调运行结果，不得标成已验证前后端联调打通。',
        'unverified',
        test,
      ),
      block(
        '事实：内存仓储补偿恢复不是严格数据库事务——联调可用，但不要当成生产事务保证。',
        'fact',
        test,
      ),
    ],
    sourceIds: [...sourceIds],
  };
}

/** 模拟材料要求「写代码」时，mock 若输出代码围栏则应被校验整份丢弃。 */
function buildCodeLikePayload(
  sourceIds: HandoffBriefSourceId[],
): HandoffBriefPayload {
  return {
    brief: '请在商品详情页补丁如下代码后继续联调。',
    changes: [
      block(
        '请直接改文件 PurchasePanel.jsx，并执行 npm test。\n\n```js\nif (error.code === "ITEM_NOT_AVAILABLE") {\n  showToast("商品已被其他买家购买");\n}\n```',
        'suggestion',
        sourceIds,
      ),
    ],
    downstreamImpact: [
      block('function handlePurchase() { return fetch("/api/orders"); }', 'suggestion', sourceIds),
    ],
    suggestedChecks: [
      block('curl -X POST /api/orders', 'suggestion', sourceIds),
    ],
    evidenceAndOpen: [
      block('（越界示例，应被拒绝）', 'unverified', sourceIds),
    ],
    sourceIds: [...sourceIds],
  };
}

function collectText(payload: HandoffBriefPayload): string {
  const parts = [
    payload.brief,
    ...payload.changes.map((item) => item.body),
    ...payload.downstreamImpact.map((item) => item.body),
    ...payload.suggestedChecks.map((item) => item.body),
    ...payload.evidenceAndOpen.map((item) => item.body),
  ];
  return parts.join('\n');
}

/**
 * 拒绝代码围栏、命令行与明显伪代码；越界则整份作废。
 */
export function validateHandoffBriefOutput(
  payload: HandoffBriefPayload,
): { ok: true } | { ok: false; reason: 'out-of-bounds'; message: string } {
  const text = collectText(payload);
  if (CODE_FENCE_RE.test(text)) {
    return {
      ok: false,
      reason: 'out-of-bounds',
      message: '整理结果含代码围栏，已整份丢弃，请改用手填接手提示。',
    };
  }
  if (COMMAND_RE.test(text)) {
    return {
      ok: false,
      reason: 'out-of-bounds',
      message: '整理结果含命令或脚本，已整份丢弃，请改用手填接手提示。',
    };
  }
  if (PSEUDO_CODE_RE.test(text)) {
    return {
      ok: false,
      reason: 'out-of-bounds',
      message: '整理结果含代码/伪代码，已整份丢弃，请改用手填接手提示。',
    };
  }
  if (!payload.brief.trim()) {
    return {
      ok: false,
      reason: 'out-of-bounds',
      message: '接手提示正文为空，已丢弃。',
    };
  }
  return { ok: true };
}

function resolveSourceIds(
  raw: readonly string[] | undefined,
): HandoffBriefSourceId[] | null {
  const ids = (raw?.length ? raw : HANDOFF_BRIEF_DEFAULT_SOURCE_IDS).filter(
    isHandoffBriefSourceId,
  );
  if (ids.length === 0) return null;
  return ids;
}

/**
 * 本地整理接手提示。mode=code-request 用于回归：模拟越界输出并拒绝。
 */
export function organizeHandoffBriefMock(
  request: HandoffBriefOrganizeRequest = {},
): HandoffBriefOrganizeResult {
  const sourceIds = resolveSourceIds(request.sourceIds);
  if (!sourceIds) {
    return {
      ok: false,
      reason: 'invalid-sources',
      message: '仅支持默认三件套材料，请勿传入白名单外 sourceIds。',
    };
  }

  // 确保材料可读（缺正文时也不要把联调标成已验证）
  const bodies = loadHandoffBriefSourceBodies(sourceIds);
  if (bodies.some((source) => !source.body.trim())) {
    return {
      ok: false,
      reason: 'generation-failed',
      message: '默认材料正文不完整，整理失败；可手填接手提示后发布。',
    };
  }

  const mode = request.mode ?? 'success';
  if (mode === 'failure') {
    return {
      ok: false,
      reason: 'generation-failed',
      message: '整理接手提示失败（模拟）。未改动你已填写的内容，可继续手填后发布。',
    };
  }

  const draft =
    mode === 'code-request'
      ? buildCodeLikePayload(sourceIds)
      : buildCompliantPayload(sourceIds);

  const checked = validateHandoffBriefOutput(draft);
  if (!checked.ok) {
    return {
      ok: false,
      reason: checked.reason,
      message: checked.message,
    };
  }

  return { ok: true, payload: draft };
}
