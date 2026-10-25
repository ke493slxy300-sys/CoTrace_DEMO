/**
 * 团队共享文档库。
 * 预置条目来自 Content Pack；PDF 位于 public/docs/。
 */

import { packSharedDocuments } from "../datasets/built-in/campus-marketplace/content/backendPack";
import { toAppNodeId } from "../datasets/built-in/campus-marketplace/content/packIds";
import { getMemberById } from "./members";

export const SHARED_DOC_ICON_SRC = "/icons/code/file-code.svg";

export type SharedDocSource = "preset" | "upload";

export type SharedDoc = {
  id: string;
  title: string;
  description: string;
  source: SharedDocSource;
  /** 预置为站点路径；上传为 blob: URL */
  href: string;
  ownerLabel: string;
  statusLabel: string;
  nodeIds: string[];
  version?: string;
};

const DOC_STATUS_LABELS: Record<string, string> = {
  confirmed: "已确认",
  reviewed: "已审阅",
  submitted: "已提交",
  pending: "进行中",
  "pending-integration": "待联调",
  unassigned: "待分配",
};

function formatOwnerLabel(ownerIds: string[]): string {
  if (ownerIds.length === 0) return "待分配";
  if (ownerIds.includes("team")) return "团队";
  return ownerIds.map((id) => getMemberById(id)?.name ?? id).join("、");
}

function pdfHrefFromPackPath(pdfPath: string): string {
  const fileName = pdfPath.split("/").pop() ?? pdfPath;
  return `/docs/${fileName}`;
}

export const PRESET_SHARED_DOCS: SharedDoc[] = packSharedDocuments.map(
  (doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.summary,
    source: "preset" as const,
    href: pdfHrefFromPackPath(doc.pdfPath),
    ownerLabel: formatOwnerLabel(doc.ownerIds),
    statusLabel: DOC_STATUS_LABELS[doc.status] ?? doc.status,
    nodeIds: doc.nodeIds.map(toAppNodeId),
    version: doc.version,
  }),
);
