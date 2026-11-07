/**
 * Local handoff analysis based on material bodies. Same contract as live.
 */

import { loadMaterialBody } from '../materials/bodies';
import type {
  CollaborationLogDraft,
  HandoffAnalysisRequest,
  HandoffAnalysisResult,
  HandoffFocusRequest,
  HandoffFocusResult,
  HelpContextRequest,
  HelpContextResult,
  MatchVerdict,
  MaterialCitation,
} from './contract';
import {
  validateHandoffAnalysis,
  validateHandoffFocus,
  validateHelpContext,
} from './validate';

function cite(
  materialId: string,
  excerpt: string,
  note: string,
  fragmentId?: string,
): MaterialCitation {
  return { materialId, excerpt, note, fragmentId };
}

function emptyLog(summary: string): CollaborationLogDraft {
  return {
    summary,
    humanActions: [],
    aiActions: [],
    openItems: [],
    citations: [],
  };
}

function inferPairVerdict(
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
): CollaborationLogDraft {
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

export async function mockHandoffAnalysis(
  request: HandoffAnalysisRequest,
): Promise<
  | { ok: true; result: HandoffAnalysisResult }
  | { ok: false; message: string }
> {
  const started = Date.now();
  const code = loadMaterialBody(request.codeMaterialId);
  const chat = loadMaterialBody(request.chatMaterialId);
  if (!code || code.kind !== 'code') {
    return { ok: false, message: '代码材料不存在或不属于代码池' };
  }
  if (!chat || chat.kind !== 'ai-chat') {
    return { ok: false, message: '对话材料不存在或不属于对话池' };
  }

  const materialIds = [code.id, chat.id];
  const verdict = inferPairVerdict(code.body, chat.body);
  const differences: string[] = [];
  const risks: string[] = [];
  const pendingConfirmations: string[] = [];
  let collaborationLog: CollaborationLogDraft;

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

  const draft: HandoffAnalysisResult = {
    verdict,
    differences,
    citations: collaborationLog.citations,
    collaborationLog,
    pendingConfirmations,
    risks,
    provider: 'mock',
    modelLabel: 'mock-handoff-analysis',
    latencyMs: Date.now() - started,
  };

  const checked = validateHandoffAnalysis(draft, materialIds);
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, result: checked.result };
}

export async function mockHandoffFocus(
  request: HandoffFocusRequest,
): Promise<
  { ok: true; result: HandoffFocusResult } | { ok: false; message: string }
> {
  const started = Date.now();
  const logSummary =
    request.sharedLog.summary || request.collaborationSummary || '';
  const openHint = request.sharedLog.openItems[0] || '';
  const riskFromPublish =
    request.riskAcknowledged && request.riskNotes
      ? `发布带风险：${request.riskNotes}`
      : request.risks[0] || '';

  const items = [
    {
      title: '核对 ITEM_NOT_AVAILABLE 提示',
      impact:
        '商品详情页购买失败时，若只显示通用错误，买家会误解库存状态；直接影响联调验收。',
      checkAction:
        '构造「商品已被其他买家购买」场景，对照接口 code 与页面提示是否一致。',
      risk: riskFromPublish || '若提示不一致，联调会被打回。',
      uncertainty: openHint
        ? `发布日志仍标待确认：${openHint.slice(0, 80)}`
        : '未见前端联调运行结果时，不得标成已验证。',
      citations: [
        cite(
          request.codeMaterialId,
          'ITEM_NOT_AVAILABLE',
          '与本版发布材料中的错误码约定对照',
        ),
      ],
    },
    {
      title: '对照已确认协作日志中的待确认项',
      impact: `联调目标：${request.integrationGoal.slice(0, 60) || '交易流程联调'}。日志摘要影响接手范围。`,
      checkAction: `按 Alex 确认摘要核对联调范围：${logSummary.slice(0, 80) || '（无摘要）'}`,
      risk: riskFromPublish
        ? `带风险发布如何影响接手：${riskFromPublish}`
        : '若忽略待确认项，可能把未验证范围当成已完成。',
      uncertainty: request.sharedLog.openItems.length
        ? `仍有 ${request.sharedLog.openItems.length} 条开放项未关闭。`
        : '摘要未列出开放项，需自行核对材料是否完整。',
      citations: [
        cite(
          request.chatMaterialId,
          logSummary.slice(0, 100) || '(empty)',
          'Alex 确认后的协作日志摘要',
        ),
      ],
    },
    {
      title: '核对条件更新与竞争购买语义',
      impact: '若联调仍按旧「商品已售出」语义，会与 v0.4 接口行为冲突。',
      checkAction: '用同一商品并发购买或二次购买，观察是否返回约定错误码而非旧文案。',
      risk: '错版语义会导致前后端互相指责。',
      uncertainty: '本项依赖发布材料正文；若材料缺测试，结论需标注推断。',
      citations: [
        cite(
          request.codeMaterialId,
          'updateIfStatus / SELF_PURCHASE',
          '对照本版代码是否含条件更新与自购校验',
        ),
      ],
    },
  ];

  const draft: HandoffFocusResult = {
    items,
    provider: 'mock',
    modelLabel: 'mock-handoff-focus',
    latencyMs: Date.now() - started,
    cacheKey: `${request.deliveryId}:${request.versionId}:mock-focus-v1`,
  };
  const checked = validateHandoffFocus(draft, [
    request.codeMaterialId,
    request.chatMaterialId,
  ]);
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, result: checked.result };
}

export async function mockHelpContext(
  request: HelpContextRequest,
): Promise<
  { ok: true; result: HelpContextResult } | { ok: false; message: string }
> {
  const started = Date.now();
  const logSummary =
    request.sharedLog.summary || request.collaborationSummary || '';
  const evidencePool = [
    ...request.selectedEvidence,
    ...request.adoptedSupplements,
    ...request.sharedEvidence,
    ...request.sharedLog.openItems,
  ];
  const draft: HelpContextResult = {
    mode: request.mode,
    studentOriginal: request.studentText,
    situationSummary:
      request.mode === 'teacher-brief'
        ? `学生围绕已发布交付求助：${request.studentText.slice(0, 120)}。可对照本版共享日志：${logSummary.slice(0, 100)}。${
            request.adoptedSupplements.length
              ? `学生已采纳补充 ${request.adoptedSupplements.length} 条。`
              : ''
          }`
        : '可补充已尝试步骤、预期表现与实际页面提示后再提交。',
    keyDisagreements:
      request.mode === 'teacher-brief'
        ? ['前端提示文案是否必须绑定错误码而非裸字符串。']
        : [],
    missingInfo:
      request.mode === 'teacher-brief'
        ? [
            '错误码与页面提示的对照记录。',
            '联调使用的接口版本号。',
            ...(request.selectedEvidence.length
              ? []
              : ['学生未附带所选证据摘录。']),
          ]
        : [],
    guidanceSuggestions:
      request.mode === 'teacher-brief'
        ? [
            '先核对联调使用的接口版本，再让学生补充错误码与页面提示的对照记录。',
            '提醒学生区分「对话记载」与「已验证联调结果」。',
          ]
        : [],
    clarifyPrompts:
      request.mode === 'student-clarify'
        ? [
            '你已经尝试了哪些步骤？',
            '预期提示是什么，实际看到了什么？',
            ...(request.selectedEvidence.length
              ? [`对照你选中的证据：${request.selectedEvidence[0].slice(0, 60)}，还有哪些现象未写清？`]
              : ['是否有错误码、截图或日志可作为证据？']),
          ]
        : [],
    citations: evidencePool.slice(0, 4).map((item, index) =>
      cite('shared-evidence', item.slice(0, 120), `evidence ${index + 1}`),
    ),
    provider: 'mock',
    modelLabel: 'mock-help-context',
    latencyMs: Date.now() - started,
  };

  const checked = validateHelpContext(draft);
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, result: checked.result };
}
