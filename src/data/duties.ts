import type { DutyDefinition, DutyId } from "../types";

import { campusMarketplaceDataset } from "../datasets";

const dutyData = campusMarketplaceDataset.duties;

/** 当前Demo的初始职责目录 */
export const DUTY_CATALOG: DutyDefinition[] = dutyData;

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
