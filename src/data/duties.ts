import type { DutyDefinition, DutyId } from '../types';

/** 预置职责目录（注册分配 + 后续蓝图节点映射） */
export const DUTY_CATALOG: DutyDefinition[] = [
  {
    id: 'project-owner',
    label: '项目负责人',
    assignable: false,
    lockedToExperience: true,
  },
  {
    id: 'backend-api',
    label: '后端 API',
    assignable: false,
    lockedToExperience: true,
  },
  {
    id: 'database-design',
    label: '数据库设计',
    assignable: true,
  },
  {
    id: 'frontend-pages',
    label: '前端页面',
    assignable: true,
  },
  {
    id: 'test-acceptance',
    label: '测试与验收',
    assignable: true,
  },
  {
    id: 'trade-integration',
    label: '交易流程联调',
    assignable: true,
  },
  {
    id: 'product-analysis',
    label: '产品与需求分析',
    assignable: true,
  },
];

/** 可选成员可分配的职责（不含 Maya 固定项） */
export const ASSIGNABLE_DUTIES: DutyDefinition[] = DUTY_CATALOG.filter(
  (duty) => duty.assignable,
);

export const DUTY_LABELS: Record<DutyId, string> = DUTY_CATALOG.reduce(
  (acc, duty) => {
    acc[duty.id] = duty.label;
    return acc;
  },
  {} as Record<DutyId, string>,
);

export function getDutyById(id: DutyId): DutyDefinition | undefined {
  return DUTY_CATALOG.find((duty) => duty.id === id);
}

export function formatDutyLabels(
  primaryDutyId: DutyId,
  additionalDutyId: DutyId | null,
): string {
  if (!additionalDutyId) return DUTY_LABELS[primaryDutyId];
  return `${DUTY_LABELS[primaryDutyId]}、${DUTY_LABELS[additionalDutyId]}`;
}
