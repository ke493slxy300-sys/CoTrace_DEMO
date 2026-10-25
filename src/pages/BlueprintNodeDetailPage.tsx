import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Code2, FileCode2, FileText } from "lucide-react";
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
import { AppHeader } from "../components/layout/AppHeader";
import { PageTitleBar } from "../components/layout/PageTitleBar";
import { Toast } from "../components/common/Toast";
import { BLUEPRINT_STATUS_LABELS } from "../data/blueprint";
import { getSubmission } from "../data/demoSubmission";
import { getBlueprintNodeDetailData } from "../data/nodeCollaboration";
import { createAnnotation } from "../data/nodeCollaborationStore";
import { EXPERIENCE_MEMBER_ID, getExperienceMember } from "../data/members";
import { getOwnerWorkspaceCtaLabel, isNodeOwner } from "../data/workspaceEntry";
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
import {
  DISCUSSION_TYPE_LABELS,
  formatRelativeTime,
} from "../utils/discussionLabels";
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
  onBack: () => void;
  /** 负责人进入个人工作区 */
  onContinueWork?: () => void;
};

export function BlueprintNodeDetailPage({
  project,
  node,
  onBack,
  onContinueWork,
}: BlueprintNodeDetailPageProps) {
  const me = getExperienceMember();
  const submissionKey = getSubmission(node.id, project.id)?.id ?? "none";
  const baseData = useMemo(
    () => getBlueprintNodeDetailData(node, project),
    [node, project, submissionKey],
  );
  const isOwner = isNodeOwner(node, me.id);
  const ownerCtaLabel = getOwnerWorkspaceCtaLabel(node.id, project.id);
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
  const [activeDocId, setActiveDocId] = useState<string | null>(
    () => baseData.documents[0]?.id ?? null,
  );
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

  useEffect(() => {
    setActiveFileId(resolveDefaultFileId(node.id, baseData));
    setActiveDocId(baseData.documents[0]?.id ?? null);
    setActiveCardId(null);
    setSelection(null);
    setOpenDiscussionId(null);
    setOpenAnnotationId(null);
    setCodeDiscussType(null);
    setLinkedDocHint(null);
  }, [baseData, node.id]);

  const activeFile =
    baseData.viewFiles.find((file) => file.id === activeFileId) ?? null;
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

  return (
    <div className="app-shell">
      <AppHeader />
      <PageTitleBar
        title={baseData.title}
        subtitle={`${project.name} · 节点协作记录（只读）`}
        leading={
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            返回任务蓝图
          </button>
        }
        actions={
          isOwner && onContinueWork ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onContinueWork}
            >
              <Code2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {ownerCtaLabel}
            </button>
          ) : null
        }
      />

      <div className="node-detail-summary is-compact" aria-label="节点摘要">
        <div className="node-detail-summary-title">
          <h2>{baseData.title}</h2>
          <span className={`status-chip status-node-${baseData.status}`}>
            {BLUEPRINT_STATUS_LABELS[baseData.status]}
          </span>
        </div>
        <div className="node-detail-summary-meta">
          <span>
            负责人 {isUnassigned ? "暂未分配" : baseData.ownerLabel}
            {isOwner ? " · 你" : ""}
          </span>
          <span>更新 {baseData.updatedAt}</span>
        </div>
        {baseData.fromDemoSubmission ? (
          <div className="node-detail-summary-subs">
            {baseData.submissions.map((item) => (
              <span key={item.id} className="node-detail-sub-chip">
                Demo 提交 · {item.title} · {item.author} ·{" "}
                {formatRelativeTime(item.createdAt)}
              </span>
            ))}
          </div>
        ) : node.id === BACKEND_APP_NODE_ID ? (
          <div className="node-detail-summary-subs">
            <span className="node-detail-sub-chip is-muted">
              尚无公开成果 · 提交后展示工作区内容
            </span>
          </div>
        ) : baseData.usesTeammatePack ? (
          <div className="node-detail-summary-subs">
            <span className="node-detail-sub-chip is-muted">
              节点演示内容 · 非提交状态
            </span>
          </div>
        ) : baseData.submissions.length > 0 ? (
          <div className="node-detail-summary-subs">
            {baseData.submissions.map((item) => (
              <span key={item.id} className="node-detail-sub-chip">
                提交 · {item.title} · {item.author} ·{" "}
                {formatRelativeTime(item.createdAt)}
              </span>
            ))}
          </div>
        ) : (
          <div className="node-detail-summary-subs">
            <span className="node-detail-sub-chip is-muted">
              {isUnassigned ? "暂未分配 · 尚无公开成果" : "暂无公开成果"}
            </span>
          </div>
        )}
      </div>

      <main className="workbench node-collab-layout" aria-label="节点协作内容">
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

        {/* LAYOUT-02：中间 = 只读代码/文档详情（必须包在 editor-panel 内，否则会打散三栏网格） */}
        <section className="panel editor-panel" aria-label="代码或文档详细展示">
          {isDocumentPrimary && hasPublicDocs ? (
            <DocumentArtifactViewer
              documents={baseData.documents}
              activeDocId={activeDocId}
              markdownContent={getTeammateResearchMarkdown()}
              onSelectDoc={setActiveDocId}
              embedded
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

        {/* LAYOUT-02：右侧 = AI 溯源（上）+ 项目标注（下） */}
        <aside className="panel right-panel" aria-label="AI 溯源与项目标注">
          <div className="right-split">
            <section className="right-section" aria-label="AI 溯源">
              <div className="panel-header">
                <h2>AI 溯源</h2>
                <span className="badge">
                  {baseData.fromDemoSubmission
                    ? "本次公开溯源"
                    : baseData.usesTeammatePack
                      ? "队友选取片段"
                      : "模拟内容"}
                </span>
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
                ) : baseData.usesTeammatePack && baseData.teammateTraceMeta ? (
                  <MemberSelectedTraceCards
                    cards={baseData.teammateTraceCards}
                    sourcePolicy={baseData.teammateTraceMeta.sourcePolicy}
                    organizedBy={baseData.teammateTraceMeta.organizedBy}
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
      </main>

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
