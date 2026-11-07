/**
 * 校园二手交易平台交付材料目录（前端可见元数据）。
 * 正文只在 server/materials/bodies 解析，禁止前端改写。
 */

export type MaterialKind = 'code' | 'ai-chat';

/** 后台标注：用于 mock 判定与验收材料分组；不传给模型作验收标签 */
export type MaterialFixtureTag =
  | 'correct'
  | 'wrong-version'
  | 'irrelevant'
  | 'no-test';

export type DemoMaterialMeta = {
  id: string;
  title: string;
  kind: MaterialKind;
  versionLabel: string;
  description: string;
  fixtureTag: MaterialFixtureTag;
};

export const DEMO_MATERIALS: DemoMaterialMeta[] = [
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

export function listDemoMaterials(): DemoMaterialMeta[] {
  return DEMO_MATERIALS.map((item) => ({ ...item }));
}

export function getDemoMaterialMeta(id: string): DemoMaterialMeta | null {
  return DEMO_MATERIALS.find((item) => item.id === id) ?? null;
}

export function listCodeMaterials(): DemoMaterialMeta[] {
  return listDemoMaterials().filter((item) => item.kind === 'code');
}

export function listChatMaterials(): DemoMaterialMeta[] {
  return listDemoMaterials().filter((item) => item.kind === 'ai-chat');
}
