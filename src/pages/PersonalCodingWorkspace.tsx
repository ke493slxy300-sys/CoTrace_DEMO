import { useEffect, useMemo, useState } from 'react';
import { Download, FileCode2, MessageSquareText } from 'lucide-react';
import { CodeViewer } from '../components/editor/CodeViewer';
import { CollapsibleResizableColumns } from '../components/layout/CollapsibleResizableColumns';
import {
  StudentShell,
  type StudentPlace,
} from '../next/student/StudentShell';
import '../next/student/nodeWork.css';
import {
  getAnnotationsByNode,
  useNodeCollaborationStore,
} from '../data/nodeCollaborationStore';
import { getSubmission } from '../data/demoSubmission';
import { useActiveMemberId } from '../data/demoRoleStore';
import { getMemberById, getCurrentMember } from '../data/members';
import { resolveWorkbenchContext } from '../data/workbenchContext';
import {
  backendBaselineSnapshot,
  backendDiffMap,
  findCodeFileByPath,
  getBackendBaselineFiles,
  getBackendDefaultFileId,
  getBackendSubmissionFiles,
} from '../datasets/built-in/campus-marketplace/content/backendPack';
import { BACKEND_APP_NODE_ID } from '../datasets/built-in/campus-marketplace/content/packIds';
import { getPresetFilesForTask } from '../data/files';
import type {
  BlueprintNode,
  CodeFile,
  CourseProject,
  LineSelection,
} from '../types';
import type { ProjectAnnotation } from '../types/collaboration';

export type CodingWorkspaceSession = {
  files: CodeFile[];
  activeFileId: string | null;
};

type VersionId = 'baseline' | 'submission' | 'diff';

type PersonalCodingWorkspaceProps = {
  project: CourseProject;
  node: BlueprintNode;
  ownerId: string;
  /** 从其他页返回时恢复选中文件 */
  restoreSession?: CodingWorkspaceSession | null;
  onBack: () => void;
  onNavigate: (place: StudentPlace) => void;
  /** 旧「提交任务」入口：后端演示改为去发布交付 */
  onSubmitTask: (session: CodingWorkspaceSession) => void;
  onOpenDeliveryPublish?: () => void;
};

type AnnoView = {
  annotation: ProjectAnnotation;
  authorLabel: string;
  fileLabel: string | null;
  versionHint: string;
  lineLabel: string | null;
  evidenceLabel: string;
};

function formatAnnoTarget(annotation: ProjectAnnotation): {
  fileLabel: string | null;
  lineLabel: string | null;
  evidenceLabel: string;
} {
  const t = annotation.target;
  if (t.kind === 'file') {
    return {
      fileLabel: t.fileLabel ?? t.fileId,
      lineLabel: null,
      evidenceLabel: `文件 · ${t.fileLabel ?? t.fileId}`,
    };
  }
  if (t.kind === 'lines') {
    return {
      fileLabel: t.fileLabel ?? t.fileId,
      lineLabel: `L${t.lineStart}–L${t.lineEnd}`,
      evidenceLabel: `${t.fileLabel ?? t.fileId} · L${t.lineStart}–L${t.lineEnd}`,
    };
  }
  if (t.kind === 'trace') {
    return {
      fileLabel: null,
      lineLabel: null,
      evidenceLabel: `过程卡片 · ${t.traceTitle ?? t.traceCardId}`,
    };
  }
  return {
    fileLabel: null,
    lineLabel: null,
    evidenceLabel: '节点级批注 · 无具体行段',
  };
}

function buildExplainText(
  file: CodeFile | null,
  version: VersionId,
  annotation: ProjectAnnotation | null,
): string {
  if (annotation) {
    const target = formatAnnoTarget(annotation);
    return [
      `针对批注「${annotation.summary}」：`,
      annotation.content,
      `关联证据：${target.evidenceLabel}。`,
      '我只解释现有材料，帮助你接手；不会生成代码、补丁、测试或命令，也不会执行或写入。',
    ].join('\n\n');
  }
  if (version === 'diff') {
    return '右侧版本差异来自 content pack 的 baseline → submission-v1 变更记录，只读对照。我可以说明变更意图，但不会改仓库或生成补丁。';
  }
  if (file) {
    const source =
      version === 'submission'
        ? 'submission-v1（已提交快照，只读）'
        : 'baseline（工作区基线，只读）';
    return `当前材料「${file.name}」来源：${source}。可对照节点批注与版本差异接手；AI 不执行、不写入、不生成代码。`;
  }
  return '选择左侧材料或批注后，我会基于现有证据做解释，帮助接手。禁止生成代码 / 补丁 / 测试 / 命令。';
}

export function PersonalCodingWorkspace({
  project,
  node,
  ownerId,
  restoreSession = null,
  onNavigate,
  onSubmitTask: _onSubmitTask,
  onOpenDeliveryPublish,
}: PersonalCodingWorkspaceProps) {
  const me = getCurrentMember();
  const activeMemberId = useActiveMemberId();
  const store = useNodeCollaborationStore();
  const context = useMemo(
    () => resolveWorkbenchContext(node, project),
    [node, project],
  );
  const isBackend = node.id === BACKEND_APP_NODE_ID;
  const baselineFiles = useMemo(
    () => (isBackend ? getBackendBaselineFiles() : getPresetFilesForTask(node.id)),
    [isBackend, node.id],
  );
  const submissionFiles = useMemo(
    () => (isBackend ? getBackendSubmissionFiles() : []),
    [isBackend],
  );
  const [version, setVersion] = useState<VersionId>('baseline');
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    if (restoreSession?.activeFileId) return restoreSession.activeFileId;
    if (isBackend) {
      return getBackendDefaultFileId(baselineFiles, backendBaselineSnapshot);
    }
    return baselineFiles[0]?.id ?? null;
  });
  const [selection, setSelection] = useState<LineSelection | null>(null);
  const [activeAnnoId, setActiveAnnoId] = useState<string | null>(null);
  const [scrollNonce, setScrollNonce] = useState(0);

  useEffect(() => {
    if (!restoreSession?.activeFileId) return;
    setActiveFileId(restoreSession.activeFileId);
  }, [restoreSession]);

  const files =
    version === 'submission' && submissionFiles.length > 0
      ? submissionFiles
      : baselineFiles;

  const activeFile = useMemo(() => {
    if (version === 'diff') return null;
    const byId = files.find((file) => file.id === activeFileId);
    if (byId) return byId;
    return files[0] ?? null;
  }, [version, files, activeFileId]);

  // Keep selection across baseline/submission when path matches
  useEffect(() => {
    if (version === 'diff') return;
    if (!activeFileId) return;
    const stillThere = files.some((file) => file.id === activeFileId);
    if (stillThere) return;
    const prevName =
      baselineFiles.find((f) => f.id === activeFileId)?.name ??
      submissionFiles.find((f) => f.id === activeFileId)?.name;
    if (prevName) {
      const hit = files.find((f) => f.name === prevName);
      if (hit) {
        setActiveFileId(hit.id);
        return;
      }
    }
    setActiveFileId(files[0]?.id ?? null);
  }, [version, files, activeFileId, baselineFiles, submissionFiles]);

  const hasSubmission =
    Boolean(getSubmission(node.id, project.id)) || submissionFiles.length > 0;

  const annotations = useMemo(() => {
    const list = getAnnotationsByNode(project.id, node.id).filter((item) => {
      if (!item.visibleAfterSubmissionOnly) return true;
      return hasSubmission;
    });
    return list.map((annotation): AnnoView => {
      const author = getMemberById(annotation.authorId);
      const target = formatAnnoTarget(annotation);
      const versionHint =
        annotation.visibleAfterSubmissionOnly
          ? '关联 submission 后可见'
          : isBackend
            ? '对照 baseline / submission'
            : '节点材料';
      return {
        annotation,
        authorLabel: author?.name ?? annotation.authorId,
        fileLabel: target.fileLabel,
        versionHint,
        lineLabel: target.lineLabel,
        evidenceLabel: target.evidenceLabel,
      };
    });
    // store 订阅驱动刷新
  }, [project.id, node.id, hasSubmission, isBackend, store.annotations]);

  const activeAnno =
    annotations.find((item) => item.annotation.id === activeAnnoId) ?? null;

  const owner = getMemberById(ownerId);
  const ownerLabel = owner?.name ?? '待分配';
  const ownerIsYou = ownerId === activeMemberId;
  const isEmptyRepo = context.repositoryStatus === 'empty' && baselineFiles.length === 0;

  const diffRows = (backendDiffMap.changes ?? []) as Array<{
    id?: string;
    file?: string;
    summary?: string;
  }>;

  function openAnnotation(view: AnnoView) {
    setActiveAnnoId(view.annotation.id);
    const t = view.annotation.target;
    if (t.kind === 'file' || t.kind === 'lines') {
      const path = t.fileLabel ?? t.fileId;
      // 行段证据优先 submission（基线文件可能较短）
      const subHit = findCodeFileByPath(submissionFiles, path);
      const baseHit = findCodeFileByPath(baselineFiles, path);
      const preferSubmission =
        t.kind === 'lines' ? Boolean(subHit) : version === 'submission';
      const hit = preferSubmission ? subHit ?? baseHit : baseHit ?? subHit;
      if (hit) {
        setVersion(
          subHit && (preferSubmission || hit.id === subHit.id)
            ? 'submission'
            : 'baseline',
        );
        setActiveFileId(hit.id);
      }
      if (t.kind === 'lines') {
        setSelection({ lineStart: t.lineStart, lineEnd: t.lineEnd });
        setScrollNonce((n) => n + 1);
      } else {
        setSelection(null);
      }
      return;
    }
    if (t.kind === 'trace') {
      const fromJson = (
        backendDiffMap.changes as Array<{
          file?: string;
          traceIds?: string[];
        }>
      ).find((row) => row.traceIds?.includes(t.traceCardId));
      const filePath = fromJson?.file;
      if (filePath) {
        const hit =
          findCodeFileByPath(baselineFiles, filePath) ??
          findCodeFileByPath(submissionFiles, filePath);
        if (hit) {
          setVersion(
            submissionFiles.some((f) => f.id === hit.id)
              ? 'submission'
              : 'baseline',
          );
          setActiveFileId(hit.id);
        }
      }
      setSelection(null);
      return;
    }
    setSelection(null);
  }

  const explain = buildExplainText(
    activeFile,
    version,
    activeAnno?.annotation ?? null,
  );

  return (
    <StudentShell
      place="work"
      projectName={project.name}
      onNavigate={onNavigate}
    >
      <div className="nw">
        <header className="nw-head">
          <div>
            <p className="nw-kicker">{project.name}</p>
            <h1>{node.name}</h1>
          </div>
          <div className="nw-actions">
            {isBackend && onOpenDeliveryPublish ? (
              <button
                type="button"
                className="nw-primary"
                onClick={onOpenDeliveryPublish}
                title="演示交接：进入新版发布交付"
              >
                去发布交付
              </button>
            ) : null}
            <button
              type="button"
              className="nw-ghost"
              disabled={isEmptyRepo || !activeFile}
              title={
                isEmptyRepo || !activeFile
                  ? '暂无可下载内容'
                  : `下载 ${activeFile.name}`
              }
              onClick={() => {
                if (!activeFile) return;
                const blob = new Blob([activeFile.content], {
                  type: 'text/plain;charset=utf-8',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = activeFile.name.split('/').pop() || activeFile.name;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              下载文件
            </button>
          </div>
        </header>

        <CollapsibleResizableColumns
          storageKey="cotrace-workbench-personal-coding"
          className="nw-work"
          ariaLabel="个人工作区 · 只读材料"
          leftRailLabel="任务材料"
          rightRailLabel="节点批注"
          defaultLeftWidth={220}
          defaultRightWidth={320}
          left={
            <aside className="nw-pane" aria-label="任务材料">
              <div className="nw-pane-head">
                <h2>任务材料</h2>
                <span>只读</span>
              </div>
              {isEmptyRepo ? (
                <div className="nw-empty">
                  <strong>暂无材料</strong>
                  <p>该节点还没有可回看的代码或文档。</p>
                </div>
              ) : (
                <ul className="nw-file-list">
                  {(version === 'submission' && submissionFiles.length > 0
                    ? submissionFiles
                    : baselineFiles
                  ).map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className={`nw-file${
                          activeFile?.name === file.name && version !== 'diff'
                            ? ' is-on'
                            : ''
                        }`}
                        onClick={() => {
                          setVersion(
                            version === 'diff'
                              ? submissionFiles.length > 0
                                ? 'submission'
                                : 'baseline'
                              : version,
                          );
                          setActiveFileId(file.id);
                          setSelection(null);
                          setActiveAnnoId(null);
                        }}
                      >
                        <FileCode2 size={14} strokeWidth={1.5} aria-hidden="true" />
                        <span>{file.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {isBackend ? (
                <p className="nw-source-note">
                  来源：campus-marketplace content pack · baseline / submission-v1
                </p>
              ) : null}
            </aside>
          }
          center={
            <section className="nw-pane nw-main" aria-label="代码版本">
              <div className="nw-pane-head">
                <h2>代码版本</h2>
                <div className="nw-version-tabs" role="tablist" aria-label="版本">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={version === 'baseline'}
                    className={version === 'baseline' ? 'is-on' : undefined}
                    onClick={() => setVersion('baseline')}
                  >
                    baseline
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={version === 'submission'}
                    className={version === 'submission' ? 'is-on' : undefined}
                    disabled={submissionFiles.length === 0}
                    onClick={() => setVersion('submission')}
                  >
                    submission-v1
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={version === 'diff'}
                    className={version === 'diff' ? 'is-on' : undefined}
                    disabled={!isBackend}
                    onClick={() => setVersion('diff')}
                  >
                    版本差异
                  </button>
                </div>
              </div>
              {version === 'diff' ? (
                <div className="nw-diff">
                  <p className="nw-diff-lead">
                    {(backendDiffMap as { fromSnapshotId?: string }).fromSnapshotId ??
                      'baseline'}{' '}
                    →{' '}
                    {(backendDiffMap as { toSnapshotId?: string }).toSnapshotId ??
                      'submission-v1'}{' '}
                    · 只读
                  </p>
                  {diffRows.length === 0 ? (
                    <div className="nw-empty">
                      <strong>暂无版本差异</strong>
                      <p>content pack 未提供 diff 记录。</p>
                    </div>
                  ) : (
                    <ul>
                      {diffRows.map((row) => (
                        <li key={row.id ?? row.file}>
                          <button
                            type="button"
                            className="nw-diff-item"
                            onClick={() => {
                              if (!row.file) return;
                              const hit =
                                findCodeFileByPath(submissionFiles, row.file) ??
                                findCodeFileByPath(baselineFiles, row.file);
                              if (!hit) return;
                              setVersion(
                                submissionFiles.some((f) => f.id === hit.id)
                                  ? 'submission'
                                  : 'baseline',
                              );
                              setActiveFileId(hit.id);
                              setSelection(null);
                            }}
                          >
                            <strong>{row.file ?? '（未标注文件）'}</strong>
                            <span>{row.summary ?? '（无摘要）'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : isEmptyRepo ? (
                <div className="nw-empty">
                  <strong>暂无代码</strong>
                  <p>该任务目前还没有代码仓内容。</p>
                </div>
              ) : (
                <div className="nw-code">
                  <CodeViewer
                    file={activeFile}
                    selection={null}
                    highlightSelection={selection}
                    scrollRequest={
                      activeFile && selection
                        ? {
                            fileId: activeFile.id,
                            lineStart: selection.lineStart,
                            nonce: scrollNonce,
                          }
                        : null
                    }
                    onSelectionChange={() => {
                      /* 只读：忽略划选写入 */
                    }}
                  />
                </div>
              )}
            </section>
          }
          right={
            <aside className="nw-pane nw-side" aria-label="节点批注与解释">
              <div className="nw-pane-head">
                <h2>节点批注</h2>
                <span>{annotations.length}</span>
              </div>
              {annotations.length === 0 ? (
                <div className="nw-empty">
                  <strong>暂无批注</strong>
                  <p>该节点还没有可回看的批注证据。</p>
                </div>
              ) : (
                <ul className="nw-anno-list">
                  {annotations.map((view) => (
                    <li key={view.annotation.id}>
                      <button
                        type="button"
                        className={`nw-anno${
                          activeAnnoId === view.annotation.id ? ' is-on' : ''
                        }`}
                        onClick={() => openAnnotation(view)}
                      >
                        <span className="nw-anno-type">
                          <MessageSquareText
                            size={14}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          {view.annotation.typeLabel}
                        </span>
                        <strong>{view.annotation.summary}</strong>
                        <span className="nw-anno-meta">
                          {view.authorLabel} · {view.evidenceLabel}
                        </span>
                        <span className="nw-anno-meta">{view.versionHint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="nw-ai" aria-label="接手解释">
                <h3>接手解释</h3>
                <p className="nw-ai-body">{explain}</p>
                <p className="nw-ai-lock">
                  AI 只解释现有材料并帮助接手 · 禁止生成代码 / 补丁 / 测试 / 命令 ·
                  禁止执行与写入
                </p>
              </div>
            </aside>
          }
        />

        <footer className="nw-foot">
          <span>
            {isBackend
              ? 'Content Pack 只读 · 外部历史已标明来源 · 不接入真实大模型'
              : '个人工作区 · 本地预置材料 · 不接入真实大模型'}
          </span>
          <span>
            当前视角：{me.name}
            {ownerIsYou ? '' : ` · 节点负责人：${ownerLabel}`}
          </span>
        </footer>
      </div>
    </StudentShell>
  );
}
