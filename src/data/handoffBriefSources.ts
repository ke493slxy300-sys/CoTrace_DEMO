/**
 * 接手提示默认材料白名单（固定三件套）。
 * 请求只传 sourceIds；正文只读本模块装配，不做上传/自由选库。
 */

import agentSessionJson from '../datasets/built-in/campus-marketplace/content/data/backend-api-agent-session.json';
import diffMapJson from '../datasets/built-in/campus-marketplace/content/data/backend-api-diff-map.json';
import submissionMetaJson from '../datasets/built-in/campus-marketplace/content/data/backend-api-submission-v1.json';

export const HANDOFF_BRIEF_SOURCE_API_SPEC = 'handoff-src-api-spec' as const;
export const HANDOFF_BRIEF_SOURCE_VERSION_DIFF =
  'handoff-src-version-diff' as const;
export const HANDOFF_BRIEF_SOURCE_TEST_RUN = 'handoff-src-test-run' as const;

export type HandoffBriefSourceId =
  | typeof HANDOFF_BRIEF_SOURCE_API_SPEC
  | typeof HANDOFF_BRIEF_SOURCE_VERSION_DIFF
  | typeof HANDOFF_BRIEF_SOURCE_TEST_RUN;

export type HandoffBriefSourceMeta = {
  id: HandoffBriefSourceId;
  title: string;
  kind: 'api-spec' | 'version-diff' | 'test-run';
  /** 仓库相对路径，便于核对与 verify */
  pathLabel: string;
};

/** 公开接口说明正文摘录（与 public/docs 同源要点；完整文件由 verify 另行读盘） */
const API_SPEC_BODY = `# 订单 API 接口规范（v0.4 接手摘录）

## 创建订单
方法：POST  路径：/api/orders

## 错误码（节选）
| HTTP | code | 含义 | 前端建议 |
|---|---|---|---|
| 409 | ITEM_NOT_AVAILABLE | 商品不可购买 | 提示商品已被其他买家购买 |
| 409 | SELF_PURCHASE_NOT_ALLOWED | 用户购买自己的商品 | 提示不能购买自己的商品 |

## 调用约束
- 前端不得仅根据错误消息文字判断类型，应使用 code。
- 后端必须在写入时再次确认商品状态。
`;

type DiffMapLike = {
  changes?: Array<{ file?: string; summary?: string }>;
};

type AgentSessionLike = {
  messages?: Array<{ type?: string; text?: string }>;
};

type SubmissionLike = {
  testResult?: { command?: string; passed?: number; failed?: number };
};

const diffMap = diffMapJson as DiffMapLike;
const agentSession = agentSessionJson as AgentSessionLike;
const submissionMeta = submissionMetaJson as SubmissionLike;

export const HANDOFF_BRIEF_DEFAULT_SOURCES: HandoffBriefSourceMeta[] = [
  {
    id: HANDOFF_BRIEF_SOURCE_API_SPEC,
    title: 'v0.4 接口说明',
    kind: 'api-spec',
    pathLabel: 'public/docs/sources/04_订单API接口规范.md',
  },
  {
    id: HANDOFF_BRIEF_SOURCE_VERSION_DIFF,
    title: '版本变更记录',
    kind: 'version-diff',
    pathLabel:
      'src/datasets/built-in/campus-marketplace/content/data/backend-api-diff-map.json',
  },
  {
    id: HANDOFF_BRIEF_SOURCE_TEST_RUN,
    title: '实际测试运行结果',
    kind: 'test-run',
    pathLabel:
      'backend-api-agent-session.json (type:test-result) + backend-api-submission-v1.json testResult',
  },
];

export const HANDOFF_BRIEF_DEFAULT_SOURCE_IDS: HandoffBriefSourceId[] =
  HANDOFF_BRIEF_DEFAULT_SOURCES.map((source) => source.id);

export function isHandoffBriefSourceId(
  value: string,
): value is HandoffBriefSourceId {
  return HANDOFF_BRIEF_DEFAULT_SOURCE_IDS.includes(
    value as HandoffBriefSourceId,
  );
}

function buildVersionDiffBody(): string {
  const lines = (diffMap.changes ?? []).map((change) => {
    const file = change.file?.trim() || '（未标注文件）';
    const summary = change.summary?.trim() || '（无摘要）';
    return `- ${file}：${summary}`;
  });
  return ['版本变更记录（baseline → submission-v1）', ...lines].join('\n');
}

function buildTestRunBody(): string {
  const testMessage = (agentSession.messages ?? []).find(
    (message) => message.type === 'test-result',
  );
  const result = submissionMeta.testResult;
  const lines = [
    '实际测试运行结果（非测试源码）',
    testMessage?.text?.trim() || '（缺少 type:test-result 正文）',
  ];
  if (result) {
    lines.push(
      `submission testResult：${result.command ?? 'npm test'} → ${result.passed ?? 0} passed / ${result.failed ?? 0} failed`,
    );
  } else {
    lines.push('submission testResult：缺失');
  }
  lines.push(
    '说明：不以 tests/orderService.test.js 等裸测试源码冒充运行证据。',
  );
  return lines.join('\n');
}

export type HandoffBriefSourceBody = HandoffBriefSourceMeta & {
  body: string;
};

/** 同步读出三件套非空正文（供 UI 原始材料区与 mock/校验）。 */
export function loadHandoffBriefSourceBodies(
  sourceIds: readonly string[] = HANDOFF_BRIEF_DEFAULT_SOURCE_IDS,
): HandoffBriefSourceBody[] {
  const wanted = new Set(
    sourceIds.filter(isHandoffBriefSourceId).length > 0
      ? sourceIds.filter(isHandoffBriefSourceId)
      : HANDOFF_BRIEF_DEFAULT_SOURCE_IDS,
  );

  const bodies: Record<HandoffBriefSourceId, string> = {
    [HANDOFF_BRIEF_SOURCE_API_SPEC]: API_SPEC_BODY.trim(),
    [HANDOFF_BRIEF_SOURCE_VERSION_DIFF]: buildVersionDiffBody().trim(),
    [HANDOFF_BRIEF_SOURCE_TEST_RUN]: buildTestRunBody().trim(),
  };

  return HANDOFF_BRIEF_DEFAULT_SOURCES.filter((source) =>
    wanted.has(source.id),
  ).map((source) => ({
    ...source,
    body: bodies[source.id],
  }));
}

export function assertHandoffBriefSourcesReadable(): {
  ok: true;
  bodies: HandoffBriefSourceBody[];
} {
  const bodies = loadHandoffBriefSourceBodies();
  for (const source of bodies) {
    if (!source.body.trim()) {
      throw new Error(`handoff brief source empty: ${source.id}`);
    }
  }
  const testRun = bodies.find(
    (source) => source.id === HANDOFF_BRIEF_SOURCE_TEST_RUN,
  );
  if (testRun && /orderService\.test\.js[\s\S]*describe\s*\(/.test(testRun.body)) {
    throw new Error('test-run body must not embed raw test source');
  }
  return { ok: true, bodies };
}
