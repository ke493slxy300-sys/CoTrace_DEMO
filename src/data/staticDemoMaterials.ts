/**
 * Browser-side demo materials catalog + bodies for GitHub Pages (no /api).
 * Mirrors server/materials/{catalog,bodies}.ts; fixtureTag stays internal.
 */

import orderServiceV04Raw from '../datasets/built-in/campus-marketplace/content/code/backend-api/submission-v1/src/services/orderService.js?raw';
import orderServiceV03Raw from '../datasets/built-in/campus-marketplace/content/code/backend-api/baseline/src/services/orderService.js?raw';
import orderErrorMessagesRaw from '../datasets/built-in/campus-marketplace/content/teammate/frontend/src/utils/orderErrorMessages.js?raw';
import agentSessionJson from '../datasets/built-in/campus-marketplace/content/data/backend-api-agent-session.json';

export type MaterialKind = 'code' | 'ai-chat';

/** Internal only — used by mock heuristics; never exposed via list/preview APIs. */
export type MaterialFixtureTag =
  | 'correct'
  | 'wrong-version'
  | 'irrelevant'
  | 'no-test';

export type StaticDemoMaterialMeta = {
  id: string;
  title: string;
  kind: MaterialKind;
  versionLabel: string;
  description: string;
  fixtureTag: MaterialFixtureTag;
};

export type StaticDemoMaterialCatalogItem = {
  id: string;
  title: string;
  kind: MaterialKind;
  versionLabel: string;
  description: string;
};

export type StaticMaterialBody = StaticDemoMaterialMeta & {
  body: string;
  fragments: Array<{ id: string; label: string; text: string }>;
};

export type StaticMaterialPreview = {
  id: string;
  title: string;
  kind: MaterialKind;
  versionLabel: string;
  preview: string;
  fragmentLabels: string[];
};

const DEMO_MATERIALS: StaticDemoMaterialMeta[] = [
  {
    id: 'mat-code-order-v04',
    title: 'orderService.js · v0.4 正确版',
    kind: 'code',
    versionLabel: 'v0.4',
    description: '含自购校验、条件更新与商品快照的创建订单实现',
    fixtureTag: 'correct',
  },
  {
    id: 'mat-code-order-v03',
    title: 'orderService.js · v0.3 旧版',
    kind: 'code',
    versionLabel: 'v0.3',
    description: '缺少自购校验与条件更新的旧实现（错版材料）',
    fixtureTag: 'wrong-version',
  },
  {
    id: 'mat-code-unrelated-frontend',
    title: 'orderErrorMessages.js · 前端文案',
    kind: 'code',
    versionLabel: 'n/a',
    description: '前端错误文案映射，与后端交付任务无关',
    fixtureTag: 'irrelevant',
  },
  {
    id: 'mat-chat-order-v04',
    title: 'AI 对话 · 订单接口联调准备',
    kind: 'ai-chat',
    versionLabel: 'v0.4',
    description: '含缺口分析、范围决定与 5/5 测试结果的协作对话',
    fixtureTag: 'correct',
  },
  {
    id: 'mat-chat-order-v03',
    title: 'AI 对话 · v0.3 库存提示讨论',
    kind: 'ai-chat',
    versionLabel: 'v0.3',
    description: '围绕旧版「商品已售出」提示的对话（错版材料）',
    fixtureTag: 'wrong-version',
  },
  {
    id: 'mat-chat-unrelated-seat',
    title: 'AI 对话 · 自习室座位预约',
    kind: 'ai-chat',
    versionLabel: 'n/a',
    description: '另一项目的预约冲突讨论，与订单交付无关',
    fixtureTag: 'irrelevant',
  },
  {
    id: 'mat-chat-order-no-test',
    title: 'AI 对话 · 仅方案讨论（无测试）',
    kind: 'ai-chat',
    versionLabel: 'v0.4-draft',
    description: '讨论了条件更新，但没有测试运行结果（证据不足）',
    fixtureTag: 'no-test',
  },
];

function chatFromMessages(
  title: string,
  messages: Array<{ time: string; speaker: string; text: string }>,
): string {
  const lines = [title, ''];
  for (const message of messages) {
    lines.push(`[${message.time}] ${message.speaker}: ${message.text}`);
  }
  return lines.join('\n');
}

function loadAgentSessionExcerpt(): string {
  const raw = agentSessionJson as {
    messages?: Array<{
      id?: string;
      time?: string;
      speaker?: string;
      type?: string;
      text?: string;
    }>;
  };
  const selected = (raw.messages ?? []).filter(
    (message) =>
      [
        'analysis',
        'explanation',
        'decision',
        'test-result',
        'plan',
        'constraint',
      ].includes(message.type ?? '') || message.speaker === 'user',
  );
  return chatFromMessages(
    'AI chat excerpt · create-order API',
    selected.map((message) => ({
      time: message.time ?? '',
      speaker: message.speaker === 'agent' ? 'AI' : 'Alex',
      text: message.text ?? '',
    })),
  );
}

const BODY_BUILDERS: Record<
  string,
  () => { body: string; fragments: StaticMaterialBody['fragments'] }
> = {
  'mat-code-order-v04': () => {
    const body = String(orderServiceV04Raw).trim();
    return {
      body,
      fragments: [
        {
          id: 'frag-self-purchase',
          label: 'self-purchase check',
          text: 'SELF_PURCHASE_NOT_ALLOWED',
        },
        {
          id: 'frag-conditional',
          label: 'conditional update',
          text: 'updateIfStatus',
        },
        {
          id: 'frag-snapshot',
          label: 'item snapshot',
          text: 'itemSnapshot',
        },
      ],
    };
  },
  'mat-code-order-v03': () => {
    const body = String(orderServiceV03Raw).trim();
    return {
      body,
      fragments: [
        {
          id: 'frag-missing-self',
          label: 'missing self-purchase check',
          text: 'SELF_PURCHASE_NOT_ALLOWED missing',
        },
        {
          id: 'frag-direct-sold',
          label: 'direct sold update',
          text: "itemRepository.update(itemId, { status: 'sold' })",
        },
      ],
    };
  },
  'mat-code-unrelated-frontend': () => {
    const body = String(orderErrorMessagesRaw).trim();
    return {
      body,
      fragments: [
        {
          id: 'frag-frontend-map',
          label: 'frontend message map',
          text: 'getOrderErrorMessage',
        },
      ],
    };
  },
  'mat-chat-order-v04': () => {
    const body = loadAgentSessionExcerpt();
    return {
      body,
      fragments: [
        {
          id: 'frag-chat-tests',
          label: 'test result',
          text: '当前 5 个测试全部通过',
        },
        {
          id: 'frag-chat-scope',
          label: 'scope decision',
          text: '选保留 sold 的方案，但必须留下限制',
        },
      ],
    };
  },
  'mat-chat-order-v03': () => {
    const body = chatFromMessages('AI chat · v0.3 inventory copy', [
      {
        time: '14:02',
        speaker: 'Alex',
        text: '库存不足时前端还在显示「商品已售出」，要不要改文案？',
      },
      {
        time: '14:03',
        speaker: 'AI',
        text: '可以改成「商品已售出」。这一版还没有自购校验和条件更新，也没有 ITEM_NOT_AVAILABLE 错误码分支。',
      },
      {
        time: '14:05',
        speaker: 'Alex',
        text: '先只改提示文字，别动仓储层。',
      },
      {
        time: '14:06',
        speaker: 'AI',
        text: '已记录：v0.3 仅调整提示为「商品已售出」，未覆盖并发购买与自购。',
      },
    ]);
    return {
      body,
      fragments: [
        {
          id: 'frag-old-copy',
          label: 'old copy',
          text: '商品已售出',
        },
      ],
    };
  },
  'mat-chat-unrelated-seat': () => {
    const body = chatFromMessages('AI chat · study-room seats', [
      {
        time: '09:10',
        speaker: 'Priya',
        text: '两个同学同时预约同一座位时，应该怎么处理冲突？',
      },
      {
        time: '09:11',
        speaker: 'AI',
        text: '建议用预约时间段唯一约束。座位状态从 available 变为 held，超时释放。这与订单创建无关。',
      },
      {
        time: '09:12',
        speaker: 'Priya',
        text: '请直接帮我写座位锁定的 SQL 和前端组件代码。',
      },
    ]);
    return {
      body,
      fragments: [
        {
          id: 'frag-seat',
          label: 'seat booking',
          text: '座位状态从 available 变为 held',
        },
      ],
    };
  },
  'mat-chat-order-no-test': () => {
    const body = chatFromMessages('AI chat · plan only', [
      {
        time: '16:20',
        speaker: 'Alex',
        text: '准备用 updateIfStatus 防止重复成交，并保存 itemSnapshot。',
      },
      {
        time: '16:21',
        speaker: 'AI',
        text: '方案合理。还建议补充自购校验。当前对话没有测试运行结果，不能声称 5/5 通过。',
      },
      {
        time: '16:22',
        speaker: 'Alex',
        text: '测试回头再跑。先把方案记下。',
      },
    ]);
    return {
      body,
      fragments: [
        {
          id: 'frag-no-test',
          label: 'missing tests',
          text: '没有测试运行结果',
        },
      ],
    };
  },
};

function getMeta(id: string): StaticDemoMaterialMeta | null {
  return DEMO_MATERIALS.find((item) => item.id === id) ?? null;
}

function toCatalogItem(
  meta: StaticDemoMaterialMeta,
): StaticDemoMaterialCatalogItem {
  return {
    id: meta.id,
    title: meta.title,
    kind: meta.kind,
    versionLabel: meta.versionLabel,
    description: meta.description,
  };
}

export function listStaticDemoMaterials(
  kind?: MaterialKind,
): StaticDemoMaterialCatalogItem[] {
  const items = DEMO_MATERIALS.map(toCatalogItem);
  if (kind === 'code' || kind === 'ai-chat') {
    return items.filter((item) => item.kind === kind);
  }
  return items;
}

export function loadStaticMaterialBody(id: string): StaticMaterialBody | null {
  const meta = getMeta(id);
  const builder = BODY_BUILDERS[id];
  if (!meta || !builder) return null;
  const built = builder();
  if (!built.body.trim()) return null;
  return {
    ...meta,
    body: built.body,
    fragments: built.fragments,
  };
}

export function getStaticMaterialPreview(
  id: string,
): StaticMaterialPreview | null {
  const body = loadStaticMaterialBody(id);
  if (!body) return null;
  return {
    id: body.id,
    title: body.title,
    kind: body.kind,
    versionLabel: body.versionLabel,
    preview: body.body.slice(0, 400),
    fragmentLabels: body.fragments.map((item) => item.label),
  };
}
