import type { BlueprintNode } from '../types';
import { getDelivery } from './deliveryStore';
import { applyReceivedIntegration } from './deliveryHandoff';
import { HANDOFF_NODE_INTEGRATION } from './handoffDemoSeed';

/** 仅在交付已接收时，把交易流程联调标为进行中。发布本身不改这个节点。 */
export function applyDeliveryToBlueprint(
  nodes: BlueprintNode[],
): BlueprintNode[] {
  return applyReceivedIntegration(nodes, getDelivery());
}

export function markIntegrationInProgress(
  nodes: BlueprintNode[],
  integrationNodeId: string = HANDOFF_NODE_INTEGRATION,
): BlueprintNode[] {
  return nodes.map((node) =>
    node.id === integrationNodeId
      ? { ...node, status: 'in-progress' as const }
      : node,
  );
}
