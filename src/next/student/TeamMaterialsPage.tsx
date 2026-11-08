import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Code2,
  Download,
  FileCode2,
  FileText,
  Layers,
  Play,
  Search,
  X,
} from 'lucide-react';
import { fetchMaterialPreview } from '../../api/cotraceApi';
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
  type MaterialFile,
  type MaterialFolderId,
  type MaterialsTreeId,
  type MaterialVersion,
} from '../../data/teamMaterials';
import { HANDOFF_PROJECT_NAME } from '../../data/handoffDemoSeed';
import { getSeatflowProjectCard, SEATFLOW_PROJECT_ID } from '../../data/projectLogs';
import {
  hashBlueprint,
  hashFromNavHint,
  hashMaterials,
  type MaterialsQuery,
} from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import './materials.css';

type TeamMaterialsPageProps = {
  projectId: string;
  projectName: string;
  query: MaterialsQuery;
  onNavigate: (place: StudentPlace) => void;
  onOpenHash: (hash: string) => void;
};

function FolderIcon({ id }: { id: MaterialFolderId }) {
  if (id === 'folder-req') return <Layers size={18} strokeWidth={1.75} />;
  if (id === 'folder-api') return <Code2 size={18} strokeWidth={1.75} />;
  if (id === 'folder-integration') return <Box size={18} strokeWidth={1.75} />;
  return <Play size={18} strokeWidth={1.75} />;
}

function FileGlyph({ name }: { name: string }) {
  const kind = fileExtensionIcon(name);
  if (kind === 'code') return <FileCode2 size={16} strokeWidth={1.75} />;
  return <FileText size={16} strokeWidth={1.75} />;
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
    // 拉取后按展示文件名保存，避免 .mjs/.pdf 被浏览器当导航打开
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

  const folderFromUrl = query.folder as MaterialsTreeId | null;
  const fileFromUrl = query.file;
  const versionFromUrl = query.version;

  const [selectedFolder, setSelectedFolder] = useState<MaterialsTreeId>(
    folderFromUrl && folderFromUrl !== MATERIALS_ALL_ID
      ? (folderFromUrl as MaterialFolderId)
      : folderFromUrl === MATERIALS_ALL_ID
        ? MATERIALS_ALL_ID
        : MATERIALS_ALL_ID,
  );
  const [search, setSearch] = useState(query.q ?? '');
  const [previewFileId, setPreviewFileId] = useState<string | null>(
    fileFromUrl ?? null,
  );
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(
    versionFromUrl ?? null,
  );
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [missingTarget, setMissingTarget] = useState<string | null>(null);

  const displayName =
    projectId === SEATFLOW_PROJECT_ID
      ? getSeatflowProjectCard().name
      : projectName || HANDOFF_PROJECT_NAME;

  // URL → 本地选中态
  useEffect(() => {
    if (query.folder === MATERIALS_ALL_ID || !query.folder) {
      setSelectedFolder(MATERIALS_ALL_ID);
    } else if (folders.some((folder) => folder.id === query.folder)) {
      setSelectedFolder(query.folder as MaterialFolderId);
    } else if (query.folder) {
      setMissingTarget(`目录不存在：${query.folder}`);
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
  }, [folders, projectId, query.file, query.folder, query.q, query.version]);

  const syncUrl = (next: {
    folder?: MaterialsTreeId;
    file?: string | null;
    version?: string | null;
    q?: string;
  }) => {
    const folder = next.folder ?? selectedFolder;
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
      if (
        selectedFolder !== MATERIALS_ALL_ID &&
        file.folderId !== selectedFolder
      ) {
        return false;
      }
      if (!q) return true;
      const version = getMaterialVersion(file, file.currentVersionId);
      const hay = [
        file.displayName,
        version?.fileName,
        version?.label,
        submitterLabel(version?.submitterId ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [files, search, selectedFolder]);

  const previewFile = previewFileId
    ? getMaterialFile(projectId, previewFileId)
    : null;
  const previewVersion = previewFile
    ? getMaterialVersion(previewFile, previewVersionId)
    : null;

  useEffect(() => {
    let cancelled = false;
    setPreviewBody(null);
    if (!previewVersion) return;
    if (previewVersion.source.kind === 'inline') {
      setPreviewBody(previewVersion.source.body);
      return;
    }
    if (previewVersion.source.kind === 'api-material') {
      void fetchMaterialPreview(previewVersion.source.materialId).then(
        (result) => {
          if (cancelled) return;
          if (result.ok) setPreviewBody(result.data.preview);
        },
      );
      return () => {
        cancelled = true;
      };
    }
    if (previewVersion.source.kind === 'href') {
      const href = previewVersion.source.href;
      const lower = previewVersion.fileName.toLowerCase();
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
  }, [previewVersion]);

  const openPreview = (file: MaterialFile, versionId?: string) => {
    const version = getMaterialVersion(file, versionId ?? file.currentVersionId);
    setPreviewFileId(file.id);
    setPreviewVersionId(version?.id ?? null);
    setMissingTarget(null);
    syncUrl({
      folder: selectedFolder,
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
        folder:
          selectedFolder === MATERIALS_ALL_ID ? undefined : selectedFolder,
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
        <aside className="tm-folders" aria-label="文件夹">
          <h2>文件夹</h2>
          <ul className="tm-tree">
            <li>
              <button
                type="button"
                className={selectedFolder === MATERIALS_ALL_ID ? 'is-on' : ''}
                onClick={() => {
                  setSelectedFolder(MATERIALS_ALL_ID);
                  syncUrl({ folder: MATERIALS_ALL_ID, file: null, version: null });
                }}
              >
                全部材料
              </button>
              <ul>
                {folders.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      className={selectedFolder === folder.id ? 'is-on' : ''}
                      onClick={() => {
                        setSelectedFolder(folder.id);
                        syncUrl({
                          folder: folder.id,
                          file: null,
                          version: null,
                        });
                      }}
                    >
                      {folder.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </aside>

        <div className="tm-main">
          <p className="tm-crumb">
            {displayName} / 材料
          </p>
          {query.from === 'blueprint' || query.from === 'work' || query.from === 'history' ? (
            <p style={{ margin: '0 0 10px' }}>
              <button
                type="button"
                className="tm-dl"
                onClick={() =>
                  onOpenHash(
                    hashFromNavHint(query.from, projectId, {
                      retNode: query.retNode,
                      folder:
                        selectedFolder === MATERIALS_ALL_ID
                          ? undefined
                          : selectedFolder,
                      q: search.trim() || undefined,
                    }),
                  )
                }
              >
                ← 返回
                {query.from === 'blueprint'
                  ? query.retNode
                    ? '蓝图节点'
                    : '蓝图'
                  : query.from === 'work'
                    ? '工作'
                    : '项目记录'}
              </button>
            </p>
          ) : null}
          <div className="tm-head">
            <h1>团队材料</h1>
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
          <div className="tm-cards">
            {folders.map((folder) => {
              const count = files.filter((f) => f.folderId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`tm-card${selectedFolder === folder.id ? ' is-on' : ''}`}
                  style={{ background: folder.accent, color: folder.ink }}
                  onClick={() => {
                    setSelectedFolder(folder.id);
                    syncUrl({ folder: folder.id, file: null, version: null });
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

          <p className="tm-section-label">
            {selectedFolder === MATERIALS_ALL_ID
              ? '全部文件'
              : folders.find((f) => f.id === selectedFolder)?.name || '文件'}{' '}
            <em>({visibleFiles.length})</em>
          </p>

          <div className="tm-table-wrap">
            <table className="tm-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>版本</th>
                  <th>提交人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4}>本目录暂无文件</td>
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
                            {file.displayName}
                          </button>
                        </td>
                        <td>
                          <span className="tm-ver">{version.label}</span>
                        </td>
                        <td>{submitterLabel(version.submitterId)}</td>
                        <td>
                          <button
                            type="button"
                            className="tm-dl"
                            onClick={() => void onDownload(version)}
                          >
                            <Download size={14} strokeWidth={2} aria-hidden="true" />
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
                            hashBlueprint(projectId, {
                              node: nodeId,
                              from: 'materials',
                            }),
                          )
                        }
                      >
                        打开蓝图节点 · {nodeLabel(nodeId)}
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

            {previewBody ? (
              <pre className="tm-body-preview">{previewBody.slice(0, 4000)}</pre>
            ) : previewVersion.source.kind === 'href' ? (
              <p className="tm-preview-meta">
                二进制 / 文档文件请下载后查看原文。
              </p>
            ) : null}

            <div className="tm-preview-actions">
              <button
                type="button"
                className="is-primary"
                onClick={() => void onDownload(previewVersion)}
              >
                下载此版本
              </button>
              <button type="button" onClick={closePreview}>
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
