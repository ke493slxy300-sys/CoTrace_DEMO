import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  Play,
  Search,
  X,
} from 'lucide-react';
import { fetchMaterialPreview } from '../../api/cotraceApi';
import {
  defaultExpandedPaths,
  findRepoNodeByPath,
  getProjectRepoTree,
  materialMatchesRepoSelection,
  resolveRepoFolderSelection,
  type RepoTreeNode,
} from '../../data/projectRepoTree';
import {
  fileExtensionIcon,
  getMaterialFile,
  getMaterialVersion,
  listMaterialFolders,
  listProjectMaterialFiles,
  MATERIALS_ALL_ID,
  submitterLabel,
  triggerBlobDownload,
  downloadHrefAsNamedFile,
  downloadMaterialFilesAsZip,
  type MaterialFile,
  type MaterialFolderId,
  type MaterialVersion,
} from '../../data/teamMaterials';
import { HANDOFF_PROJECT_NAME } from '../../data/handoffDemoSeed';
import { getSeatflowProjectCard, SEATFLOW_PROJECT_ID } from '../../data/projectLogs';
import {
  hashNodeDetail,
  hashMaterials,
  type MaterialsQuery,
} from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import { StudentTrail } from './StudentTrail';
import './materials.css';

type TeamMaterialsPageProps = {
  projectId: string;
  projectName: string;
  query: MaterialsQuery;
  onNavigate: (place: StudentPlace) => void;
  onOpenHash: (hash: string) => void;
};

function FileGlyph({ name }: { name: string }) {
  const kind = fileExtensionIcon(name);
  if (kind === 'code') return <FileCode2 size={14} strokeWidth={1.75} />;
  return <FileText size={14} strokeWidth={1.75} />;
}

function FolderIcon({ id }: { id: MaterialFolderId }) {
  if (id === 'folder-req') return <Layers size={18} strokeWidth={1.75} />;
  if (id === 'folder-api') return <Code2 size={18} strokeWidth={1.75} />;
  if (id === 'folder-integration') return <Box size={18} strokeWidth={1.75} />;
  return <Play size={18} strokeWidth={1.75} />;
}

const NODE_LABELS: Record<string, string> = {
  'node-requirements': '需求与流程确认',
  'node-database': '数据库设计',
  'node-backend': '后端 API',
  'node-frontend': '前端页面',
  'node-integration': '交易流程联调',
  'node-testing': '集成测试',
  'node-acceptance': '项目验收',
};

function nodeLabel(nodeId: string): string {
  return NODE_LABELS[nodeId] ?? nodeId;
}

async function downloadVersion(version: MaterialVersion): Promise<void> {
  if (version.source.kind === 'href') {
    await downloadHrefAsNamedFile(version.source.href, version.fileName);
    return;
  }
  if (version.source.kind === 'inline') {
    triggerBlobDownload(
      version.source.body,
      version.fileName,
      version.source.mime,
    );
    return;
  }
  const preview = await fetchMaterialPreview(version.source.materialId);
  if (!preview.ok || !preview.data?.preview) {
    throw new Error(preview.ok ? '材料正文为空' : preview.message || '下载失败');
  }
  triggerBlobDownload(preview.data.preview, version.fileName);
}

function RepoTreeBranch({
  nodes,
  depth,
  selectedPath,
  expanded,
  previewFileId,
  onToggle,
  onSelectDir,
  onSelectFile,
}: {
  nodes: RepoTreeNode[];
  depth: number;
  selectedPath: string;
  expanded: Set<string>;
  previewFileId: string | null;
  onToggle: (path: string) => void;
  onSelectDir: (path: string) => void;
  onSelectFile: (node: RepoTreeNode) => void;
}) {
  return (
    <ul className="tm-repo-list" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {nodes.map((node) => {
        const isOpen = node.kind === 'dir' && expanded.has(node.path);
        const isSelected =
          node.kind === 'dir'
            ? selectedPath === node.path
            : Boolean(node.materialFileId && node.materialFileId === previewFileId);
        const hasMaterial = Boolean(node.materialFileId);

        return (
          <li key={node.id}>
            {node.kind === 'dir' ? (
              <div className={`tm-repo-row${isSelected ? ' is-on' : ''}`}>
                <button
                  type="button"
                  className="tm-repo-twist"
                  aria-label={isOpen ? '折叠' : '展开'}
                  onClick={() => onToggle(node.path)}
                >
                  {isOpen ? (
                    <ChevronDown size={14} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={14} strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  className="tm-repo-label"
                  onClick={() => onSelectDir(node.path)}
                >
                  {isOpen ? (
                    <FolderOpen size={14} strokeWidth={1.75} />
                  ) : (
                    <Folder size={14} strokeWidth={1.75} />
                  )}
                  <span>{node.name}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`tm-repo-file${isSelected ? ' is-on' : ''}${
                  hasMaterial ? '' : ' is-muted'
                }`}
                disabled={!hasMaterial}
                title={
                  hasMaterial
                    ? node.path
                    : '这里还没有文件'
                }
                onClick={() => onSelectFile(node)}
              >
                <FileGlyph name={node.name} />
                <span>{node.name}</span>
              </button>
            )}
            {node.kind === 'dir' && isOpen && node.children?.length ? (
              <RepoTreeBranch
                nodes={node.children}
                depth={depth + 1}
                selectedPath={selectedPath}
                expanded={expanded}
                previewFileId={previewFileId}
                onToggle={onToggle}
                onSelectDir={onSelectDir}
                onSelectFile={onSelectFile}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function TeamMaterialsPage({
  projectId,
  projectName,
  query,
  onNavigate,
  onOpenHash,
}: TeamMaterialsPageProps) {
  const folders = useMemo(() => listMaterialFolders(), []);
  const files = useMemo(
    () => listProjectMaterialFiles(projectId),
    [projectId],
  );
  const repoTree = useMemo(() => getProjectRepoTree(projectId), [projectId]);

  const [selectedPath, setSelectedPath] = useState<string>(() => {
    const resolved = resolveRepoFolderSelection(projectId, query.folder);
    return resolved === MATERIALS_ALL_ID ? '' : String(resolved);
  });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(defaultExpandedPaths(repoTree)),
  );
  const [search, setSearch] = useState(query.q ?? '');
  const [previewFileId, setPreviewFileId] = useState<string | null>(
    query.file ?? null,
  );
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(
    query.version ?? null,
  );
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [missingTarget, setMissingTarget] = useState<string | null>(null);

  const displayName =
    projectId === SEATFLOW_PROJECT_ID
      ? getSeatflowProjectCard().name
      : projectName || HANDOFF_PROJECT_NAME;

  const selectionKey = selectedPath || MATERIALS_ALL_ID;

  useEffect(() => {
    const resolved = resolveRepoFolderSelection(projectId, query.folder);
    if (resolved === MATERIALS_ALL_ID) {
      setSelectedPath('');
    } else {
      setSelectedPath(String(resolved));
      setExpanded((prev) => {
        const next = new Set(prev);
        const parts = String(resolved).split('/');
        let acc = '';
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          next.add(acc);
        }
        return next;
      });
    }

    if (query.q != null) setSearch(query.q);

    if (query.file) {
      const hit = getMaterialFile(projectId, query.file);
      if (!hit) {
        setMissingTarget(`文件不存在：${query.file}`);
        setPreviewFileId(null);
        return;
      }
      setPreviewFileId(hit.id);
      if (hit.repoPath) {
        setExpanded((prev) => {
          const next = new Set(prev);
          const parts = hit.repoPath.split('/');
          let acc = '';
          for (const part of parts.slice(0, -1)) {
            acc = acc ? `${acc}/${part}` : part;
            next.add(acc);
          }
          return next;
        });
      }
      if (query.version) {
        const ver = getMaterialVersion(hit, query.version);
        if (!ver) {
          setMissingTarget(`版本不存在：${query.version}`);
          setPreviewVersionId(hit.currentVersionId);
        } else {
          setPreviewVersionId(ver.id);
          setMissingTarget(null);
        }
      } else {
        setPreviewVersionId(hit.currentVersionId);
        setMissingTarget(null);
      }
    } else {
      setPreviewFileId(null);
      setPreviewVersionId(null);
    }
  }, [projectId, query.file, query.folder, query.q, query.version]);

  const syncUrl = (next: {
    folder?: string;
    file?: string | null;
    version?: string | null;
    q?: string;
  }) => {
    const folder = next.folder ?? selectionKey;
    onOpenHash(
      hashMaterials(projectId, {
        folder: folder === MATERIALS_ALL_ID ? undefined : folder,
        file: next.file === undefined ? previewFileId : next.file,
        version:
          next.version === undefined ? previewVersionId : next.version,
        q: (next.q ?? search).trim() || undefined,
        from: query.from,
        retNode: query.retNode,
      }),
    );
  };

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      if (!materialMatchesRepoSelection(file, selectionKey)) return false;
      if (!q) return true;
      const version = getMaterialVersion(file, file.currentVersionId);
      const hay = [
        file.displayName,
        file.repoPath,
        version?.fileName,
        version?.label,
        submitterLabel(version?.submitterId ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [files, search, selectionKey]);

  const previewFile = previewFileId
    ? getMaterialFile(projectId, previewFileId)
    : null;
  const previewVersion = previewFile
    ? getMaterialVersion(previewFile, previewVersionId)
    : null;

  const sectionTitle = useMemo(() => {
    if (!selectedPath) return '全部文件';
    const stage = folders.find((folder) => folder.id === selectedPath);
    if (stage) return stage.name;
    const node = findRepoNodeByPath(repoTree, selectedPath);
    return node?.name || selectedPath;
  }, [folders, repoTree, selectedPath]);

  useEffect(() => {
    let cancelled = false;
    // 依赖版本 ID，不要依赖 getMaterialFile 每次深拷贝出的对象引用，
    // 否则会反复 setPreviewBody(null) 造成预览窗剧烈抖动。
    if (!previewFileId || !previewVersionId) {
      setPreviewBody(null);
      return;
    }
    const file = getMaterialFile(projectId, previewFileId);
    const version = file
      ? getMaterialVersion(file, previewVersionId)
      : null;
    if (!version) {
      setPreviewBody(null);
      return;
    }

    setPreviewBody(null);
    if (version.source.kind === 'inline') {
      setPreviewBody(version.source.body);
      return;
    }
    if (version.source.kind === 'api-material') {
      void fetchMaterialPreview(version.source.materialId).then((result) => {
        if (cancelled) return;
        if (result.ok) setPreviewBody(result.data.preview);
      });
      return () => {
        cancelled = true;
      };
    }
    if (version.source.kind === 'href') {
      const href = version.source.href;
      const lower = version.fileName.toLowerCase();
      const textLike =
        lower.endsWith('.md') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.js') ||
        lower.endsWith('.mjs') ||
        lower.endsWith('.ts') ||
        lower.endsWith('.json');
      if (textLike) {
        void fetch(href)
          .then((response) => (response.ok ? response.text() : ''))
          .then((text) => {
            if (!cancelled && text) setPreviewBody(text.slice(0, 6000));
          });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [previewFileId, previewVersionId, projectId]);

  const openPreview = (file: MaterialFile, versionId?: string) => {
    const version = getMaterialVersion(file, versionId ?? file.currentVersionId);
    setPreviewFileId(file.id);
    setPreviewVersionId(version?.id ?? null);
    setMissingTarget(null);
    syncUrl({
      folder: selectionKey,
      file: file.id,
      version: version?.id ?? null,
    });
  };

  const closePreview = () => {
    setPreviewFileId(null);
    setPreviewVersionId(null);
    setPreviewBody(null);
    onOpenHash(
      hashMaterials(projectId, {
        folder: selectedPath || undefined,
        q: search.trim() || undefined,
        from: query.from,
        retNode: query.retNode,
      }),
    );
  };

  const onDownload = async (version: MaterialVersion) => {
    setDownloadError('');
    try {
      await downloadVersion(version);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : '下载失败');
    }
  };

  const onDownloadAll = async () => {
    if (visibleFiles.length === 0 || downloadingAll) return;
    setDownloadError('');
    setDownloadingAll(true);
    try {
      const safeName = displayName.replace(/[\\/:*?"<>|]+/g, '-').trim();
      const scope =
        selectedPath && selectedPath !== MATERIALS_ALL_ID
          ? selectedPath.replace(/[\\/:*?"<>|]+/g, '-')
          : '全部';
      await downloadMaterialFilesAsZip({
        files: visibleFiles,
        zipName: `${safeName || '材料'}-${scope}.zip`,
        fetchPreview: async (materialId) => {
          const preview = await fetchMaterialPreview(materialId);
          if (!preview.ok) {
            return { ok: false, message: preview.message };
          }
          return { ok: true, data: preview.data };
        },
      });
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : '压缩包下载失败',
      );
    } finally {
      setDownloadingAll(false);
    }
  };

  const selectRoot = () => {
    setSelectedPath('');
    syncUrl({ folder: MATERIALS_ALL_ID, file: null, version: null });
  };

  const selectDir = (path: string) => {
    setSelectedPath(path);
    setExpanded((prev) => new Set(prev).add(path));
    syncUrl({ folder: path, file: null, version: null });
  };

  const selectRepoFile = (node: RepoTreeNode) => {
    if (!node.materialFileId) return;
    const file = getMaterialFile(projectId, node.materialFileId);
    if (!file) return;
    const parent = node.path.includes('/')
      ? node.path.slice(0, node.path.lastIndexOf('/'))
      : '';
    if (parent) {
      setSelectedPath(parent);
      setExpanded((prev) => {
        const next = new Set(prev);
        const parts = parent.split('/');
        let acc = '';
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          next.add(acc);
        }
        return next;
      });
    }
    openPreview(file);
  };

  if (missingTarget && !previewFile) {
    return (
      <StudentShell
        place="materials"
        projectName={displayName}
        onNavigate={onNavigate}
      >
        <div className="tm">
          <div className="tm-main">
            <div className="tm-missing" role="alert">
              <h2>无法打开目标材料</h2>
              <p>{missingTarget}</p>
              <button
                type="button"
                onClick={() =>
                  onOpenHash(hashMaterials(projectId, { from: query.from }))
                }
              >
                返回当前项目
              </button>
            </div>
          </div>
        </div>
      </StudentShell>
    );
  }

  return (
    <StudentShell
      place="materials"
      projectName={displayName}
      onNavigate={onNavigate}
    >
      <div className="tm">
        <aside className="tm-folders" aria-label="项目代码仓">
          <h2>代码仓</h2>
          <button
            type="button"
            className={`tm-repo-root${selectedPath === '' ? ' is-on' : ''}`}
            onClick={selectRoot}
          >
            <FolderOpen size={14} strokeWidth={1.75} />
            <span>仓库根 / 全部</span>
          </button>
          <RepoTreeBranch
            nodes={repoTree.children ?? []}
            depth={0}
            selectedPath={selectedPath}
            expanded={expanded}
            previewFileId={previewFileId}
            onToggle={(path) => {
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
              });
            }}
            onSelectDir={selectDir}
            onSelectFile={selectRepoFile}
          />
        </aside>

        <div className="tm-main">
          <div className="tm-head">
            <div>
              <StudentTrail
                segments={[{ label: displayName }, { label: '材料' }]}
              />
              <h1>材料</h1>
            </div>
            <label className="tm-search">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="搜索文件"
                aria-label="搜索文件"
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                }}
                onBlur={() => syncUrl({ q: search })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') syncUrl({ q: search });
                }}
              />
            </label>
          </div>

          <p className="tm-section-label">
            项目文件夹 <em>({folders.length})</em>
          </p>
          <div className="tm-cards" role="toolbar" aria-label="项目文件夹">
            {folders.map((folder) => {
              const count = files.filter((f) => f.folderId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`tm-card${
                    selectionKey === folder.id ? ' is-on' : ''
                  }`}
                  style={{ background: folder.accent, color: folder.ink }}
                  onClick={() => {
                    setSelectedPath(folder.id);
                    syncUrl({
                      folder: folder.id,
                      file: null,
                      version: null,
                    });
                  }}
                >
                  <span className="tm-card-icon" style={{ color: folder.ink }}>
                    <FolderIcon id={folder.id} />
                  </span>
                  <strong>{folder.name}</strong>
                  <span>{count} 份</span>
                </button>
              );
            })}
          </div>

          <div className="tm-section-row">
            <p className="tm-section-label">
              {sectionTitle} <em>({visibleFiles.length})</em>
            </p>
            <button
              type="button"
              className="tm-dl"
              disabled={visibleFiles.length === 0 || downloadingAll}
              onClick={() => void onDownloadAll()}
            >
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              {downloadingAll ? '下载中…' : '下载所有文件'}
            </button>
          </div>

          <div className="tm-table-wrap">
            <table className="tm-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>仓路径</th>
                  <th>提交人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4}>这里还没有文件</td>
                  </tr>
                ) : (
                  visibleFiles.map((file) => {
                    const version = getMaterialVersion(
                      file,
                      file.currentVersionId,
                    );
                    if (!version) return null;
                    return (
                      <tr
                        key={file.id}
                        className={previewFileId === file.id ? 'is-on' : ''}
                      >
                        <td>
                          <button
                            type="button"
                            className="tm-file-btn"
                            onClick={() => openPreview(file)}
                          >
                            <FileGlyph name={file.displayName} />
                            <span className="tm-file-name">
                              {file.displayName}
                              <span className="tm-ver">{version.label}</span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <code className="tm-path">{file.repoPath}</code>
                        </td>
                        <td>{submitterLabel(version.submitterId)}</td>
                        <td>
                          <button
                            type="button"
                            className="tm-dl"
                            onClick={() => void onDownload(version)}
                          >
                            <Download size={16} strokeWidth={2} aria-hidden="true" />
                            下载
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {downloadError ? (
            <p role="alert" style={{ color: '#ad5d00', marginTop: 12 }}>
              {downloadError}
            </p>
          ) : null}
        </div>
      </div>

      {previewFile && previewVersion ? (
        <div className="tm-preview" role="dialog" aria-modal="true">
          <div className="tm-preview-panel">
            <header>
              <div>
                <h2>{previewFile.displayName}</h2>
                <div className="tm-preview-meta">
                  <span className="tm-ver">{previewVersion.label}</span>
                  <span>
                    提交人 {submitterLabel(previewVersion.submitterId)}
                  </span>
                  <span>下载名 {previewVersion.fileName}</span>
                  <span>{previewFile.repoPath}</span>
                </div>
              </div>
              <button
                type="button"
                className="tm-close"
                aria-label="关闭预览"
                onClick={closePreview}
              >
                <X size={18} />
              </button>
            </header>

            <div className="tm-preview-block">
              <h3>关联节点</h3>
              <ul>
                {previewFile.nodeIds.length === 0 ? (
                  <li>
                    <span style={{ padding: '10px 12px', display: 'block' }}>
                      暂无关联节点
                    </span>
                  </li>
                ) : (
                  previewFile.nodeIds.map((nodeId) => (
                    <li key={nodeId}>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenHash(
                            hashNodeDetail(projectId, {
                              node: nodeId,
                              from: 'materials',
                            }),
                          )
                        }
                      >
                        打开节点详情 · {nodeLabel(nodeId)}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="tm-preview-block">
              <h3>历史版本</h3>
              <ul>
                {[...previewFile.versions].reverse().map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      className={
                        version.id === previewVersion.id ? 'is-on' : ''
                      }
                      onClick={() => {
                        setPreviewVersionId(version.id);
                        syncUrl({
                          file: previewFile.id,
                          version: version.id,
                        });
                      }}
                    >
                      {version.label} · {version.fileName} ·{' '}
                      {submitterLabel(version.submitterId)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tm-preview-slot">
              {previewBody ? (
                <pre className="tm-body-preview">
                  {previewBody.slice(0, 4000)}
                </pre>
              ) : (
                <p className="tm-preview-meta tm-preview-fallback">
                  {previewVersion.source.kind === 'href'
                    ? '二进制 / 文档文件请下载后查看原文。'
                    : '加载预览…'}
                </p>
              )}
            </div>

            <div className="tm-preview-actions">
              <button
                type="button"
                className="is-primary"
                onClick={() => void onDownload(previewVersion)}
              >
                下载此版本
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
