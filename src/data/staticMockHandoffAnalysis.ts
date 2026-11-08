/**
 * Client-side mock handoff analysis for GitHub Pages (no /api).
 * Ports inferPairVerdict + mockHandoffAnalysis from server/ai/mockProvider.ts.
 */

import type {
  CollaborationLog,
  DeliveryAnalysis,
  MatchVerdict,
  MaterialCitation,
} from '../types/handoff';
import { loadStaticMaterialBody } from './staticDemoMaterials';

function cite(
  materialId: string,
  excerpt: string,
  note: string,
  fragmentId?: string,
): MaterialCitation {
  return { materialId, excerpt, note, fragmentId };
}

function emptyLog(summary: string): Omit<CollaborationLog, 'manuallyEdited'> {
  return {
    summary,
    humanActions: [],
    aiActions: [],
    openItems: [],
    citations: [],
  };
}

export function inferPairVerdict(
  codeBody: string,
  chatBody: string,
): MatchVerdict {
  const codeHasV04 =
    /SELF_PURCHASE_NOT_ALLOWED/.test(codeBody) &&
    /updateIfStatus/.test(codeBody) &&
    /itemSnapshot/.test(codeBody);
  const codeIsBaseline =
    /itemRepository\.update\(itemId,\s*\{\s*status:\s*['"]sold['"]/.test(
      codeBody,
    ) && !/SELF_PURCHASE_NOT_ALLOWED/.test(codeBody);
  const codeIsFrontend = /getOrderErrorMessage/.test(codeBody);

  const chatHasTests = /5 个测试全部通过|5\/5|5 passed/.test(chatBody);
  const chatHasScope = /保留 sold|条件更新|itemSnapshot|自购/.test(chatBody);
  const chatIsOld = /商品已售出/.test(chatBody) && !chatHasTests;
  const chatIsSeat = /座位|预约冲突|held/.test(chatBody);
  const chatNoTest =
    /没有测试运行结果|不能声称/.test(chatBody) ||
    (chatHasScope && !chatHasTests && !chatIsOld && !chatIsSeat);

  if (codeIsFrontend || chatIsSeat) return 'irrelevant';
  if (codeIsBaseline || chatIsOld) return 'suspect-wrong-version';
  if (codeHasV04 && chatNoTest) return 'insufficient-evidence';
  if (codeHasV04 && chatHasTests && chatHasScope) return 'match';
  if (codeHasV04 && chatIsOld) return 'suspect-wrong-version';
  if (codeIsBaseline && chatHasTests) return 'suspect-wrong-version';
  if (!codeHasV04 && !chatHasScope) return 'irrelevant';
  return 'insufficient-evidence';
}

function buildMatchLog(
  codeId: string,
  chatId: string,
  codeBody: string,
): Omit<CollaborationLog, 'manuallyEdited'> {
  const codeCite = cite(
    codeId,
    codeBody.includes('SELF_PURCHASE_NOT_ALLOWED')
      ? 'SELF_PURCHASE_NOT_ALLOWED / updateIfStatus / itemSnapshot'
      : codeBody.slice(0, 120),
    '代码可见自购校验、条件更新与商品快照',
    'frag-self-purchase',
  );
  const chatCite = cite(
    chatId,
    '当前 5 个测试全部通过。该恢复不是严格数据库事务',
    '对话记载测试结果与事务限制，非作者身份断言',
    'frag-chat-tests',
  );
  return {
    summary:
      '人机协作后，订单创建服务补充了自购与可售状态校验、条件更新与商品快照；测试 5/5 通过，但仍需联调核对 ITEM_NOT_AVAILABLE 前端提示。',
    humanActions: [
      '确认保留 sold 语义并记录限制，不扩展支付/取消/reserved。',
      '要求公开缺口分析、条件更新、快照与测试结果给队友。',
    ],
    aiActions: [
      '指出自购、可售状态、竞争购买、快照与一致性五处缺口。',
      '说明可用仓储条件更新模拟并发，并给出测试通过与事务限制说明。',
    ],
    openItems: [
      '未见前端联调运行结果，商品详情页提示是否与 ITEM_NOT_AVAILABLE 一致仍待核对。',
      '内存补偿恢复不能当作生产数据库事务保证。',
    ],
    citations: [codeCite, chatCite],
  };
}

export function staticMockHandoffAnalysis(input: {
  codeMaterialId: string;
  chatMaterialId: string;
  requestToken: number;
}):
  | { ok: true; analysis: DeliveryAnalysis }
  | { ok: false; message: string } {
  const code = loadStaticMaterialBody(input.codeMaterialId);
  const chat = loadStaticMaterialBody(input.chatMaterialId);
  if (!code || code.kind !== 'code') {
    return { ok: false, message: '代码材料不存在或不属于代码池' };
  }
  if (!chat || chat.kind !== 'ai-chat') {
    return { ok: false, message: '对话材料不存在或不属于对话池' };
  }

  const verdict = inferPairVerdict(code.body, chat.body);
  const differences: string[] = [];
  const risks: string[] = [];
  const pendingConfirmations: string[] = [];
  let collaborationLog: Omit<CollaborationLog, 'manuallyEdited'>;

  if (verdict === 'match') {
    collaborationLog = buildMatchLog(code.id, chat.id, code.body);
    pendingConfirmations.push(
      '请确认公开给 Priya 的协作日志未包含未共享草稿。',
      '请确认前端联调提示仍标为待验证，而非已验证。',
    );
  } else if (verdict === 'suspect-wrong-version') {
    if (
      /商品已售出/.test(chat.body) ||
      !/SELF_PURCHASE_NOT_ALLOWED/.test(code.body)
    ) {
      differences.push(
        '代码或对话仍体现 v0.3 语义：缺少自购校验/条件更新，或仍使用「商品已售出」旧提示，与 v0.4 任务目标矛盾。',
      );
    }
    if (/updateIfStatus/.test(code.body) && /商品已售出/.test(chat.body)) {
      differences.push(
        '代码已含条件更新，但对话仍讨论旧提示文案，疑似错版对话。',
      );
    }
    if (
      !/SELF_PURCHASE_NOT_ALLOWED/.test(code.body) &&
      /5 个测试全部通过/.test(chat.body)
    ) {
      differences.push(
        '对话声称测试通过并覆盖自购/条件更新，但代码正文未见 SELF_PURCHASE_NOT_ALLOWED，疑似代码错版。',
      );
    }
    collaborationLog = {
      summary:
        '材料疑似错版：正文与 v0.4 订单创建目标存在具体矛盾，协作日志仅保留已观察到的差异，请换料或带风险确认后再发布。',
      humanActions: [],
      aiActions: [],
      openItems: [...differences],
      citations: [
        cite(
          code.id,
          code.fragments[0]?.text || '未见 SELF_PURCHASE_NOT_ALLOWED',
          '代码摘录',
          code.fragments[0]?.id,
        ),
        cite(
          chat.id,
          chat.fragments[0]?.text || '商品已售出',
          '对话摘录',
          chat.fragments[0]?.id,
        ),
      ],
    };
    risks.push('若坚持发布，接收方可能按旧语义联调。');
    pendingConfirmations.push('确认已知错版风险，或更换匹配材料后复查。');
  } else if (verdict === 'irrelevant') {
    differences.push(
      '所选材料未描述校园二手交易订单创建的 v0.4 改动，无法据此整理协作日志。',
    );
    collaborationLog = emptyLog(
      '材料与当前交付任务无关，未生成虚构协作日志。请改选订单相关代码与对话。',
    );
    collaborationLog.citations = [
      cite(code.id, code.body.slice(0, 120), '代码材料主题不符'),
      cite(chat.id, chat.body.slice(0, 120), '对话材料主题不符'),
    ];
    pendingConfirmations.push('请更换与订单创建服务相关的材料。');
  } else {
    differences.push(
      '对话或代码缺少可观察的测试运行结果，证据不足，不能把联调标成已验证。',
    );
    collaborationLog = {
      summary:
        '可见方案讨论（条件更新/快照等），但缺少测试运行记载；协作日志仅列已观察项，测试与联调均待确认。',
      humanActions: [
        /条件更新|updateIfStatus|快照/.test(chat.body)
          ? '讨论了条件更新与快照方案。'
          : '提供了部分实现方向。',
      ],
      aiActions: ['提示补充测试运行结果，并避免在无证据时声称通过。'],
      openItems: ['缺少测试运行结果。', '未见前端联调证据。'],
      citations: [
        cite(code.id, code.body.slice(0, 140), '代码可见实现片段'),
        cite(chat.id, '没有测试运行结果', '对话明确缺少测试证据'),
      ],
    };
    risks.push('证据不足时发布，接收方无法核对已验证范围。');
    pendingConfirmations.push('确认以「证据不足」风险发布，或补测后再整理。');
  }

  const analysis: DeliveryAnalysis = {
    analysisId: `analysis-${input.requestToken}-${Date.now()}`,
    requestToken: input.requestToken,
    verdict,
    differences,
    citations: collaborationLog.citations,
    collaborationLog: {
      ...collaborationLog,
      manuallyEdited: false,
    },
    pendingConfirmations,
    risks,
    codeMaterialId: input.codeMaterialId,
    chatMaterialId: input.chatMaterialId,
    provider: 'mock',
    modelLabel: 'mock-handoff-analysis',
    createdAt: new Date().toISOString(),
  };

  return { ok: true, analysis };
}
