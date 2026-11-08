/**
 * Handoff 课堂演示预置数据：订单创建服务 v0.4、阶段事件、最终提交 v1.0。
 */

import type {
  AcceptanceRecord,
  Delivery,
  FinalSubmission,
  ProcessEvent,
  TeacherFeedback,
} from '../types/handoff';

export const HANDOFF_PROJECT_ID = 'project-campus-marketplace';
export const HANDOFF_DELIVERY_ID = 'delivery-order-service-v04';
export const HANDOFF_NODE_BACKEND = 'node-backend';
export const HANDOFF_NODE_INTEGRATION = 'node-integration';
export const HANDOFF_EVENT_EXCEPTION = 'event-exception-validation';
export const HANDOFF_EVENT_RULES = 'event-confirm-error-rules';
export const HANDOFF_EVENT_DATA = 'event-data-structure';
export const HANDOFF_FINAL_SUBMISSION_ID = 'final-submission-v1';
export const HANDOFF_PUBLISHER_ID = 'member-alex';
export const HANDOFF_RECEIVER_ID = 'member-priya';
export const HANDOFF_TEACHER_ID = 'member-teacher';
export const HANDOFF_GROUP_LABEL = '第03组';
export const HANDOFF_PROJECT_NAME = '校园二手交易平台';

/** 与服务端 CAMPUS_ORDER_HANDOFF_TASK_GOAL 对齐，供业务层传入 handoff-analysis */
export const HANDOFF_TASK_GOAL =
  '校园二手交易平台 · 订单创建服务 v0.4 交付：材料应体现自购校验、条件更新（可售状态）、商品快照，以及可观察的测试运行结果；联调侧还需核对 ITEM_NOT_AVAILABLE 与前端提示一致。';

/** 下游联调目标，供业务层传入 handoff-focus */
export const HANDOFF_INTEGRATION_GOAL =
  '交易流程联调：商品详情页购买 → 创建订单接口 → 结果反馈使用同一套状态与错误语义；优先核对 ITEM_NOT_AVAILABLE（商品已被其他买家购买）的前端提示是否与接口约定一致。';

export function createDraftDelivery(): Delivery {
  return {
    id: HANDOFF_DELIVERY_ID,
    projectId: HANDOFF_PROJECT_ID,
    nodeId: HANDOFF_NODE_BACKEND,
    title: '订单创建服务',
    version: 'v0.4',
    publisherId: HANDOFF_PUBLISHER_ID,
    receiverId: HANDOFF_RECEIVER_ID,
    status: 'draft',
    integrationNodeId: HANDOFF_NODE_INTEGRATION,
    usageNote:
      '确保商品详情页的购买操作、创建订单接口和结果反馈使用同一套状态与错误语义。',
    summary:
      '补充自购与可售状态校验，使用条件更新避免重复成交，保存商品快照，并覆盖主要异常测试。',
    brief: '',
    changes: [],
    downstreamImpact: [],
    suggestedChecks: [],
    evidenceAndOpen: [],
    sourceIds: [],
    nextStep: '可以开始交易流程联调',
    pendingHighlight: '待联调验证',
    verifiedItems: [
      '5 个测试通过；内存仓储使用补偿恢复，真实系统仍需数据库事务。',
    ],
    pendingItems: [
      '待联调验证',
      '商品已被其他买家购买时，前端提示是否与 ITEM_NOT_AVAILABLE 一致',
    ],
    files: [
      {
        id: 'file-order-service',
        name: 'src/services/orderService.js',
        sizeLabel: '',
        kind: 'code',
      },
      {
        id: 'file-order-api',
        name: '04_订单API接口规范.md',
        sizeLabel: '',
        kind: 'doc',
      },
    ],
    versionDiffs: [
      {
        version: 'v0.3',
        text: '库存不足时提示：商品已售出',
      },
      {
        version: 'v0.4',
        text: '库存不足时提示：暂时无法购买',
        highlight: true,
      },
    ],
    errorCode: {
      code: 'ITEM_NOT_AVAILABLE',
      meaning: '商品已被其他买家购买',
    },
    agentSummaryDraft:
      '补充自购与可售状态校验，使用条件更新避免重复成交，保存商品快照，并覆盖主要异常测试。',
    publishedAt: null,
    receivedAt: null,
    selectedCodeMaterialId: null,
    selectedChatMaterialId: null,
    analysis: null,
    analysisRequestToken: 0,
    analysisStale: false,
    collaborationLog: null,
    riskAcknowledged: false,
    riskNotes: '',
    currentVersionId: null,
    publishedVersions: [],
    revisionRequest: null,
    focusAnnotation: null,
    helpRequest: null,
  };
}

export function createSeedProcessEvents(): ProcessEvent[] {
  return [
    {
      id: HANDOFF_EVENT_EXCEPTION,
      projectId: HANDOFF_PROJECT_ID,
      dateLabel: '11.12',
      title: '异常场景验证 · v0.3',
      statusLabel: '待指导',
      statusTone: 'warning',
      kind: 'stage',
      summary: '库存不足场景，应该补充哪些测试？',
      authorLabel: 'Jordan 提出求助',
      evidence: [
        {
          id: 'ev-ai-inventory',
          kind: 'ai-suggestion',
          label: 'AI 建议',
          summary:
            'AI 基于阶段汇报发现库存并发测试不足，建议补充库存为 0 与多人同时购买用例。',
          at: '11.11 14:18',
          linkLabel: '查看建议原文',
        },
        {
          id: 'ev-edit-error-copy',
          kind: 'student-edit',
          label: '学生修改',
          summary:
            'Alex 将库存不足提示改为「暂时无法购买」，并同步修订接口说明与错误码说明。',
          at: '11.12 10:05',
          linkLabel: '查看关联代码',
        },
        {
          id: 'ev-verify-payment',
          kind: 'verification',
          label: '验证结果',
          summary: '已完成：支付失败回退已验证。待补充：库存不足与并发购买的测试依据。',
          at: '11.12 13:50',
          linkLabel: '查看测试记录',
        },
      ],
    },
    {
      id: HANDOFF_EVENT_RULES,
      projectId: HANDOFF_PROJECT_ID,
      dateLabel: '11.11',
      title: '确认异常返回规则',
      statusLabel: '已回应',
      statusTone: 'success',
      kind: 'stage',
      summary: '保留错误码，前端分别处理。',
      authorLabel: 'Alex · 后端接口',
      evidence: [
        {
          id: 'ev-rules-keep-code',
          kind: 'student-edit',
          label: '学生修改',
          summary: '保留 LISTING_UNAVAILABLE 等错误码，前端按码展示文案。',
          at: '11.11 16:20',
          linkLabel: '查看变更',
        },
      ],
    },
    {
      id: HANDOFF_EVENT_DATA,
      projectId: HANDOFF_PROJECT_ID,
      dateLabel: '11.10',
      title: '完成数据结构调整',
      statusLabel: '已完成',
      statusTone: 'success',
      kind: 'stage',
      summary: '用户、商品与订单关系已更新。',
      authorLabel: 'Alex · 数据库设计',
      evidence: [
        {
          id: 'ev-data-schema',
          kind: 'verification',
          label: '验证结果',
          summary: '订单快照字段与商品状态枚举已对齐验收清单。',
          at: '11.10 18:00',
          linkLabel: '查看模型',
        },
      ],
    },
  ];
}

export function createFinalSubmission(): FinalSubmission {
  return {
    id: HANDOFF_FINAL_SUBMISSION_ID,
    projectId: HANDOFF_PROJECT_ID,
    version: 'v1.0',
    title: '最终提交 · 校园二手交易平台',
    aiSummary: '本次提交补齐两项异常测试，结果见测试报告。',
    files: [
      {
        id: 'final-demo-video',
        name: '项目演示.mp4',
        sizeLabel: '128.4 MB',
        kind: 'doc',
      },
      {
        id: 'final-source',
        name: '源代码.zip',
        sizeLabel: '42.7 MB',
        kind: 'code',
      },
      {
        id: 'final-test-report',
        name: '测试报告.pdf',
        sizeLabel: '2.9 MB',
        kind: 'doc',
      },
    ],
    evidence: [
      {
        id: 'final-ev-ai',
        kind: 'ai-suggestion',
        label: 'AI 建议',
        summary:
          '11.11 14:18 · AI 基于阶段汇报发现库存并发测试不足，建议补充。',
        at: '11.11 14:18',
        linkLabel: '查看建议原文',
      },
      {
        id: 'final-ev-edit',
        kind: 'student-edit',
        label: '学生修改',
        summary:
          '11.12 10:05 · 学生提交 v1.0，新增 2 个测试用例并更新测试报告。',
        at: '11.12 10:05',
        linkLabel: '查看 v1.0 变更',
      },
      {
        id: 'final-ev-verify',
        kind: 'verification',
        label: '验证结果',
        summary:
          '11.12 13:50 · 在 v1.0 上完成验证，库存为 0 时拒绝下单，并发购买仅一笔成功。',
        at: '11.12 13:50',
        linkLabel: '查看测试记录',
      },
    ],
  };
}

export function createPendingAcceptance(): AcceptanceRecord {
  return {
    submissionId: HANDOFF_FINAL_SUBMISSION_ID,
    projectId: HANDOFF_PROJECT_ID,
    status: 'pending',
    note: '',
    acceptedAt: null,
    acceptedById: null,
  };
}

export const EMPTY_FEEDBACKS: TeacherFeedback[] = [];
