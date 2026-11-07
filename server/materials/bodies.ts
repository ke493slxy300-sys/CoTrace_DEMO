/**
 * Material bodies: server-only. Resolved by materialId; fixtureTag is not sent to models.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDemoMaterialMeta, type DemoMaterialMeta } from './catalog';

function resolveCampusRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/datasets/built-in/campus-marketplace/content'),
    path.resolve(
      process.cwd(),
      '../src/datasets/built-in/campus-marketplace/content',
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

const campus = resolveCampusRoot();

export type DemoMaterialBody = DemoMaterialMeta & {
  body: string;
  fragments: Array<{ id: string; label: string; text: string }>;
};

function readText(rel: string): string {
  return fs.readFileSync(path.join(campus, rel), 'utf8');
}

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
  const raw = JSON.parse(
    readText('data/backend-api-agent-session.json'),
  ) as {
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
  () => { body: string; fragments: DemoMaterialBody['fragments'] }
> = {
  'mat-code-order-v04': () => {
    const body = readText(
      'code/backend-api/submission-v1/src/services/orderService.js',
    ).trim();
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
    const body = readText(
      'code/backend-api/baseline/src/services/orderService.js',
    ).trim();
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
    const body = readText(
      'teammate/frontend/src/utils/orderErrorMessages.js',
    ).trim();
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

export function loadMaterialBody(id: string): DemoMaterialBody | null {
  const meta = getDemoMaterialMeta(id);
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

export function loadMaterialBodies(
  ids: readonly string[],
): DemoMaterialBody[] {
  const out: DemoMaterialBody[] = [];
  for (const id of ids) {
    const body = loadMaterialBody(id);
    if (body) out.push(body);
  }
  return out;
}

export function assertMaterialBodiesReadable(): {
  ok: true;
  count: number;
} {
  const ids = Object.keys(BODY_BUILDERS);
  for (const id of ids) {
    const body = loadMaterialBody(id);
    if (!body?.body.trim()) {
      throw new Error(`material body empty: ${id}`);
    }
  }
  return { ok: true, count: ids.length };
}
