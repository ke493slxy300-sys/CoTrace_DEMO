import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileCode2, FileText } from "lucide-react";
import {
  AnnotationComposeModal,
  type AnnotationComposeDraft,
} from "../components/nodeDetail/AnnotationComposeModal";
import { AiTraceThemeCards } from "../components/nodeDetail/AiTraceThemeCards";
import { DocumentArtifactViewer } from "../components/nodeDetail/DocumentArtifactViewer";
import { MemberSelectedTraceCards } from "../components/nodeDetail/MemberSelectedTraceCards";
import { AnnotationNoteModal } from "../components/nodeDetail/AnnotationNoteModal";
import { ProjectAnnotationPanel } from "../components/nodeDetail/ProjectAnnotationPanel";
import { TeamDiscussionWindow } from "../components/nodeDetail/TeamDiscussionWindow";
import {
  DiscussionModal,
  type DiscussionDraft,
} from "../components/discussion/DiscussionModal";
import { AnnotationToolbar } from "../components/editor/AnnotationToolbar";
import { CodeViewer } from "../components/editor/CodeViewer";
import { Toast } from "../components/common/Toast";
import { CollapsibleResizableColumns } from "../components/layout/CollapsibleResizableColumns";
import {
  StudentShell,
  type StudentPlace,
} from "../next/student/StudentShell";
import { StudentTrail } from "../next/student/StudentTrail";
import "../next/student/nodeWork.css";
import { getSubmission } from "../data/demoSubmission";
import { getBlueprintNodeDetailData } from "../data/nodeCollaboration";
import { createAnnotation } from "../data/nodeCollaborationStore";
import { EXPERIENCE_MEMBER_ID, getCurrentMember } from "../data/members";
import { useActiveMemberId } from "../data/demoRoleStore";
import { isNodeOwner } from "../data/workspaceEntry";
import {
  backendBaselineSnapshot,
  findCodeFileByPath,
  getBackendDefaultFileId,
  getDocumentIdsForPublishedTrace,
  getFilePathsForPublishedTrace,
  packSharedDocuments,
} from "../datasets/built-in/campus-marketplace/content/backendPack";
import { BACKEND_APP_NODE_ID } from "../datasets/built-in/campus-marketplace/content/packIds";
import {
  findTeammateFileByArtifactPath,
  getTeammateDefaultFileId,
  getTeammateResearchMarkdown,
} from "../datasets/built-in/campus-marketplace/content/teammatePack";
import { DISCUSSION_TYPE_LABELS } from "../utils/discussionLabels";
import type {
  BlueprintNode,
  CourseProject,
  DiscussionType,
  LineSelection,
} from "../types";

type BlueprintNodeDetailPageProps = {
  project: CourseProject;
  node: BlueprintNode;
  nodes: BlueprintNode[];
  /** 进入来源：work | materials | blueprint | null — 影响路径栏目 */
  navFrom?: string | null;
  onNavigate: (place: StudentPlace) => void;
  /** 负责人进入个人工作区 */
  onContinueWork?: () => void;
};

export function BlueprintNodeDetailPage({
  project,
  node,
  onNavigate,
  onContinueWork: _onContinueWork,
  navFrom = null,
}: BlueprintNodeDetailPageProps) {
  const me = getCurrentMember();
  const activeMemberId = useActiveMemberId();
  const submissionKey = getSubmission(node.id, project.id)?.id ?? "none";
  const baseData = useMemo(
    () => getBlueprintNodeDetailData(node, project),
    [node, project, submissionKey],
  );
  const isOwner = isNodeOwner(node, activeMemberId);
  const hasPublicCode =
    baseData.primaryKind === "code" && baseData.viewFiles.length > 0;
  const hasPublicDocs =
    baseData.primaryKind === "document" && baseData.documents.length > 0;
  const hasPublicTraces =
    baseData.teammateTraceCards.length > 0 || baseData.aiTraceCards.length > 0;
  const isUnassigned = !baseData.ownerId;
  const [activeFileId, setActiveFileId] = useState<string | null>(() =>
    resolveDefaultFileId(node.id, baseData),
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(() => {
    const markdownDoc = baseData.documents.find(
      (doc) =>
        doc.mimeType === "text/markdown" || Boolean(doc.markdownKey),
    );
    return markdownDoc?.id ?? baseData.documents[0]?.id ?? null;
  });
  const [selection, setSelection] = useState<LineSelection | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [openDiscussionId, setOpenDiscussionId] = useState<string | null>(null);
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
  const [annotateCardId, setAnnotateCardId] = useState<string | null>(null);
  const [codeDiscussType, setCodeDiscussType] = useState<DiscussionType | null>(
    null,
  );
  const [linkedDocHint, setLinkedDocHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveFileId(resolveDefaultFileId(node.id, baseData));
    setActiveDocId(
      baseData.documents.find(
        (doc) =>
          doc.mimeType === "text/markdown" || Boolean(doc.markdownKey),
      )?.id ??
        baseData.documents[0]?.id ??
        null,
    );
    setActiveCardId(null);
    setSelection(null);
    setOpenDiscussionId(null);
    setOpenAnnotationId(null);
    setCodeDiscussType(null);
    setLinkedDocHint(null);
    setDownloadMenuOpen(false);
  }, [baseData, node.id]);

  const activeFile =
    baseData.viewFiles.find((file) => file.id === activeFileId) ?? null;
  const canDownload =
    (hasPublicCode && Boolean(activeFile)) ||
    (hasPublicDocs && baseData.documents.length > 0);
  const canDownloadZip =
    (hasPublicCode && baseData.viewFiles.length > 0) ||
    (hasPublicDocs && baseData.documents.length > 0);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = downloadMenuRef.current;
      if (root && !root.contains(event.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDownloadMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [downloadMenuOpen]);

  const downloadCurrentFile = () => {
    if (hasPublicCode && activeFile) {
      const blob = new Blob([activeFile.content], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = activeFile.name.split("/").pop() || activeFile.name;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (hasPublicDocs) {
      const doc =
        baseData.documents.find((item) => item.id === activeDocId) ??
        baseData.documents[0];
      if (!doc) return;
      const body =
        doc.id.includes("research") ||
        doc.mimeType === "text/markdown" ||
        Boolean(doc.markdownKey)
          ? getTeammateResearchMarkdown()
          : `${doc.label}\n`;
      const blob = new Blob([body], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.label}.md`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadZipArchive = async () => {
    if (!canDownloadZip) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    if (hasPublicCode) {
      for (const file of baseData.viewFiles) {
        const name = file.name.replace(/^\/+/, "") || file.id;
        zip.file(name, file.content);
      }
    } else if (hasPublicDocs) {
      for (const doc of baseData.documents) {
        const body =
          doc.id.includes("research") ||
          doc.mimeType === "text/markdown" ||
          Boolean(doc.markdownKey)
            ? getTeammateResearchMarkdown()
            : `${doc.label}\n`;
        zip.file(`${doc.label}.md`, body);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseData.title || "node"}-files.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDownloadMenuOpen(false);
  };

  const annotateTheme =
    baseData.teammateTraceCards.find((card) => card.id === annotateCardId)
      ?.displayTitle ??
    baseData.aiTraceCards.find((card) => card.id === annotateCardId)?.theme ??
    "";

  useEffect(() => {
    if (!activeCardId) return;

    if (baseData.usesTeammatePack) {
      const card = baseData.teammateTraceCards.find(
        (item) => item.id === activeCardId,
      );
      const path = card?.affectedArtifacts[0];
      if (path && baseData.primaryKind === "code") {
        const file = findTeammateFileByArtifactPath(baseData.viewFiles, path);
        if (file) {
          setActiveFileId(file.id);
          setSelection(null);
        }
      }
      setLinkedDocHint(null);
      return;
    }

    if (node.id === BACKEND_APP_NODE_ID) {
      const paths = getFilePathsForPublishedTrace(activeCardId);
      const firstPath = paths[0];
      if (firstPath) {
        const file = findCodeFileByPath(baseData.viewFiles, firstPath);
        if (file) {
          setActiveFileId(file.id);
          setSelection(null);
        }
      }
      const docIds = getDocumentIdsForPublishedTrace(activeCardId);
      const titles = docIds
        .map((id) => packSharedDocuments.find((doc) => doc.id === id)?.title)
        .filter((title): title is string => Boolean(title));
      setLinkedDocHint(
        titles.length > 0 ? `关联共享文档：${titles.join("、")}` : null,
      );
      return;
    }

    const card = baseData.aiTraceCards.find((item) => item.id === activeCardId);
    if (!card?.relatedTraceId) return;
    const trace = baseData.aiTraces.find(
      (item) => item.id === card.relatedTraceId,
    );
    if (!trace) return;
    const file = baseData.viewFiles.find((item) => item.id === trace.fileId);
    if (!file) return;
    setActiveFileId(file.id);
    setSelection({
      lineStart: trace.lineStart,
      lineEnd: trace.lineEnd,
    });
  }, [activeCardId, baseData, node.id]);

  function handleSubmitTraceAnnotation(draft: AnnotationComposeDraft) {
    if (!annotateCardId) return;
    const typeLabel = DISCUSSION_TYPE_LABELS[draft.type];
    const content = `【针对「${annotateTheme}」】${draft.content}`;
    const created = createAnnotation(project.id, {
      nodeId: node.id,
      authorId: EXPERIENCE_MEMBER_ID,
      typeLabel,
      summary: draft.content,
      content,
      target: {
        kind: "trace",
        traceCardId: annotateCardId,
        traceTitle: annotateTheme || undefined,
      },
      affectsCode: false,
    });
    setAnnotateCardId(null);
    setOpenAnnotationId(created.id);
    setToast(`${typeLabel}已保存`);
    window.setTimeout(() => setToast(null), 2000);
  }

  function handleSubmitCodeDiscussion(draft: DiscussionDraft) {
    const fileName =
      baseData.viewFiles.find((file) => file.id === draft.fileId)?.name ??
      draft.fileId;
    const typeLabel = DISCUSSION_TYPE_LABELS[draft.type];
    const created = createAnnotation(project.id, {
      nodeId: node.id,
      authorId: EXPERIENCE_MEMBER_ID,
      typeLabel,
      summary: draft.content,
      content: draft.content,
      target: {
        kind: "lines",
        fileId: draft.fileId,
        lineStart: draft.lineStart,
        lineEnd: draft.lineEnd,
        fileLabel: fileName,
      },
      affectsCode: true,
    });
    setCodeDiscussType(null);
    setOpenAnnotationId(created.id);
    setToast(`${typeLabel}已保存`);
    window.setTimeout(() => setToast(null), 2000);
  }

  function openTeammateArtifact(path: string) {
    if (baseData.primaryKind !== "code") return;
    const file = findTeammateFileByArtifactPath(baseData.viewFiles, path);
    if (file) {
      setActiveFileId(file.id);
      setSelection(null);
    }
  }

  const isDocumentPrimary = baseData.primaryKind === "document";
  const fromWork = navFrom === "work";
  const shellPlace: StudentPlace = fromWork
    ? "work"
    : navFrom === "materials"
      ? "materials"
      : "blueprint";
  const trailSection: StudentPlace = fromWork ? "work" : "blueprint";
  const trailSectionLabel = fromWork ? "工作" : "蓝图";

  return (
    <StudentShell
      place={shellPlace}
      projectName={project.name}
      onNavigate={onNavigate}
    >
    <div className="nw">
      <header className="nw-head">
        <div>
          <StudentTrail
            segments={[
              { label: project.name },
              {
                label: trailSectionLabel,
                onClick: () => onNavigate(trailSection),
              },
              { label: baseData.title },
            ]}
          />
          <h1>{baseData.title}</h1>
        </div>
        <div className="nw-actions">
          <div className="nw-download" ref={downloadMenuRef}>
            <button
              type="button"
              className="nw-ghost nw-download-main"
              disabled={!canDownload}
              title={
                hasPublicCode && activeFile
                  ? `下载 ${activeFile.name}`
                  : hasPublicDocs
                    ? "下载当前文档"
                    : "暂无可下载内容"
              }
              onClick={downloadCurrentFile}
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              下载文件
            </button>
            <button
              type="button"
              className="nw-ghost nw-download-caret"
              disabled={!canDownloadZip}
              aria-label="更多下载选项"
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
              title="更多下载选项"
              onClick={() => setDownloadMenuOpen((open) => !open)}
            >
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            {downloadMenuOpen ? (
              <div className="nw-download-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="nw-download-item"
                  onClick={() => void downloadZipArchive()}
                >
                  <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                  下载压缩包
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <CollapsibleResizableColumns
        storageKey="cotrace-workbench-node-detail"
        className="workbench node-collab-layout"
        ariaLabel="节点协作内容"
        leftRailLabel={isDocumentPrimary ? "文档库" : "代码仓"}
        rightRailLabel="AI 溯源"
        left={
          <aside className="panel sidebar-panel" aria-label="产出目录">
            <div className="panel-header">
              <h2>{isDocumentPrimary ? "文档库" : "代码仓"}</h2>
              <span className="panel-meta">只读</span>
            </div>
            <div className="panel-body node-file-list">
              {isDocumentPrimary ? (
                baseData.documents.length > 0 ? (
                  <ul>
                    {baseData.documents.map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          className={`node-file-item${
                            doc.id === activeDocId ? " is-active" : ""
                          }`}
                          onClick={() => setActiveDocId(doc.id)}
                        >
                          <FileText
                            size={14}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          {doc.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="blueprint-detail-note">暂无文档。</p>
                )
              ) : baseData.viewFiles.length > 0 ? (
                <ul>
                  {baseData.viewFiles.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className={`node-file-item${
                          file.id === activeFileId ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setActiveFileId(file.id);
                          setSelection(null);
                        }}
                      >
                        <FileCode2
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        {file.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="blueprint-detail-note">
                  {isUnassigned
                    ? "暂未分配负责人，尚无公开成果。"
                    : "尚无公开成果。可在右侧查看项目标注与团队讨论。"}
                </p>
              )}
            </div>
          </aside>
        }
        center={
          <section className="panel editor-panel" aria-label="代码或文档详细展示">
            {isDocumentPrimary && hasPublicDocs ? (
              <DocumentArtifactViewer
                documents={baseData.documents}
                activeDocId={activeDocId}
                markdownContent={getTeammateResearchMarkdown()}
                onSelectDoc={setActiveDocId}
                embedded
                hideFormatTabs
              />
            ) : activeFile && hasPublicCode ? (
              <CodeViewer
                file={activeFile}
                selection={selection}
                ideChrome
                toolbar={
                  selection ? (
                    <AnnotationToolbar
                      fileName={activeFile.name}
                      selection={selection}
                      onAction={setCodeDiscussType}
                    />
                  ) : null
                }
                onSelectionChange={setSelection}
              />
            ) : (
              <>
                <div className="panel-header">
                  <h2>{isDocumentPrimary ? "文档详细展示" : "代码详细展示"}</h2>
                  <span className="panel-meta">只读</span>
                </div>
                <div className="panel-body coding-editor-empty">
                  <strong>尚无公开成果</strong>
                  <p>
                    {isUnassigned
                      ? "该节点暂未分配负责人，不展示伪造代码或文档。"
                      : isOwner
                        ? "个人工作区中的未提交内容不会出现在此。可通过页头进入个人工作区。"
                        : "负责人尚未确认提交团队可见的代码或文档。"}
                  </p>
                  {baseData.description ? (
                    <p className="blueprint-detail-note">
                      {baseData.description}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        }
        right={
          <aside className="panel right-panel" aria-label="AI 溯源与项目标注">
            <div className="right-split">
              <section className="right-section" aria-label="AI 溯源">
                <div className="panel-header">
                  <h2>AI 溯源</h2>
                  {baseData.fromDemoSubmission ? (
                    <span className="badge">本次公开溯源</span>
                  ) : !baseData.usesTeammatePack ? (
                    <span className="badge">模拟内容</span>
                  ) : null}
                </div>
                <div className="panel-body discussion-panel-body">
                  {linkedDocHint ? (
                    <p className="node-trace-doc-hint">{linkedDocHint}</p>
                  ) : null}
                  {!hasPublicTraces ? (
                    <div className="coding-editor-empty is-compact">
                      <strong>负责人尚未公开溯源记录</strong>
                      <p>
                        AI 溯源由负责人选择协作片段，项目理解 Agent
                        按任务主题整理后才会出现在此。
                      </p>
                    </div>
                  ) : baseData.usesTeammatePack ? (
                    <MemberSelectedTraceCards
                      cards={baseData.teammateTraceCards}
                      memberLabel={baseData.ownerLabel}
                      activeCardId={activeCardId}
                      onSelectCard={setActiveCardId}
                      onOpenArtifact={openTeammateArtifact}
                      onAnnotate={setAnnotateCardId}
                    />
                  ) : (
                    <AiTraceThemeCards
                      cards={baseData.aiTraceCards}
                      activeCardId={activeCardId}
                      onSelectCard={setActiveCardId}
                      onAnnotate={setAnnotateCardId}
                    />
                  )}
                </div>
              </section>
              <section className="right-section" aria-label="项目标注">
                <div className="panel-header">
                  <h2>项目标注</h2>
                </div>
                <div className="panel-body discussion-panel-body">
                  <ProjectAnnotationPanel
                    projectId={project.id}
                    nodeId={node.id}
                    currentUserId={EXPERIENCE_MEMBER_ID}
                    onOpenDiscussion={setOpenDiscussionId}
                    onOpenAnnotation={setOpenAnnotationId}
                  />
                </div>
              </section>
            </div>
          </aside>
        }
      />

      <footer className="app-footer">
        <span>队友视角 · 查看协作与结果 · 不含编程 Agent</span>
        <span>当前视角：{me.name}</span>
      </footer>

      <AnnotationComposeModal
        open={Boolean(annotateCardId)}
        cardTheme={annotateTheme}
        onClose={() => setAnnotateCardId(null)}
        onSubmit={handleSubmitTraceAnnotation}
      />

      {activeFile && selection && codeDiscussType ? (
        <DiscussionModal
          open
          file={activeFile}
          selection={selection}
          initialType={codeDiscussType}
          submitting={false}
          onSubmit={handleSubmitCodeDiscussion}
          onClose={() => setCodeDiscussType(null)}
        />
      ) : null}

      <TeamDiscussionWindow
        open={Boolean(openDiscussionId)}
        discussionId={openDiscussionId}
        currentUserId={EXPERIENCE_MEMBER_ID}
        viewerName={me.name}
        onClose={() => setOpenDiscussionId(null)}
      />

      <AnnotationNoteModal
        open={Boolean(openAnnotationId)}
        annotationId={openAnnotationId}
        projectId={project.id}
        currentUserId={EXPERIENCE_MEMBER_ID}
        onClose={() => setOpenAnnotationId(null)}
        onDiscussionCreated={(discussionId) => {
          setOpenAnnotationId(null);
          setOpenDiscussionId(discussionId);
          setToast("已创建团队讨论");
          window.setTimeout(() => setToast(null), 2000);
        }}
      />

      <Toast message={toast} />
    </div>
    </StudentShell>
  );
}

function resolveDefaultFileId(
  nodeId: string,
  baseData: ReturnType<typeof getBlueprintNodeDetailData>,
): string | null {
  if (nodeId === BACKEND_APP_NODE_ID) {
    if (baseData.viewFiles.length === 0) return null;
    return getBackendDefaultFileId(baseData.viewFiles, backendBaselineSnapshot);
  }
  if (nodeId === "node-frontend") {
    return getTeammateDefaultFileId(
      baseData.viewFiles,
      "src/components/PurchasePanel.jsx",
    );
  }
  if (nodeId === "node-database") {
    return getTeammateDefaultFileId(
      baseData.viewFiles,
      "sql/create_order_transaction.sql",
    );
  }
  return baseData.viewFiles[0]?.id ?? null;
}
