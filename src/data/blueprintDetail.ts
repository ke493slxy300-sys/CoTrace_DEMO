import type { BlueprintNode } from "../types";
import { EXPERIENCE_MEMBER_ID } from "./members";

import blueprintDetailData from "./blueprint-details.json";

export type BlueprintArtifact = {
  id: string;
  label: string;
  kind: "code" | "doc" | "test";
};

export type BlueprintNodeDetail = {
  background: string;
  goal: string;
  artifacts: BlueprintArtifact[];
  openIssues: string[];
  evolution: string[];
};

const DETAIL_BY_NODE_ID = blueprintDetailData as unknown as Record<
  string,
  BlueprintNodeDetail
>;

export function getBlueprintNodeDetail(
  node: BlueprintNode | string,
): BlueprintNodeDetail {
  const nodeId = typeof node === "string" ? node : node.id;
  const isBlank = typeof node === "string" ? false : Boolean(node.isBlank);
  const editHistory = typeof node === "string" ? [] : (node.editHistory ?? []);

  const base: BlueprintNodeDetail = isBlank
    ? {
        background: "这是负责人新增的空白任务节点，尚未补充完整说明。",
        goal: "待补充任务目标。",
        artifacts: [],
        openIssues: [],
        evolution: [],
      }
    : (DETAIL_BY_NODE_ID[nodeId] ?? {
        background: "该任务节点已进入项目蓝图。",
        goal: "待补充任务目标。",
        artifacts: [],
        openIssues: [],
        evolution: ["模拟 AI 初始理解。"],
      });

  return {
    ...base,
    evolution: [...base.evolution, ...editHistory],
  };
}

export function getNodeArtifactCount(node: BlueprintNode | string): number {
  return getBlueprintNodeDetail(node).artifacts.length;
}

export type ArtifactEmptyKind = "unassigned" | "maya-working" | "none";

export function resolveArtifactEmptyKind(
  node: BlueprintNode,
): ArtifactEmptyKind | null {
  const detail = getBlueprintNodeDetail(node.id);
  if (detail.artifacts.length > 0) return null;
  if (!node.ownerId) return "unassigned";
  if (node.ownerId === EXPERIENCE_MEMBER_ID) return "maya-working";
  return "none";
}
