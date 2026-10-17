import { useRef, useState } from 'react';
import { FileCode2, LoaderCircle, TriangleAlert, Upload } from 'lucide-react';
import type { CodeFile } from '../../types';
import { FILE_ACCEPT, readLocalCodeFiles } from '../../utils/fileUpload';

type FileNavProps = {
  files: CodeFile[];
  activeFileId: string | null;
  taskId: string;
  onSelectFile: (fileId: string) => void;
  onFilesAdded: (files: CodeFile[]) => void;
};

function truncateName(name: string, max = 34): string {
  if (name.length <= max) return name;
  return `…${name.slice(-(max - 1))}`;
}

export function FileNav({
  files,
  activeFileId,
  taskId,
  onSelectFile,
  onFilesAdded,
}: FileNavProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const { files: nextFiles, errors } = await readLocalCodeFiles(
        fileList,
        taskId,
      );

      if (nextFiles.length > 0) {
        onFilesAdded(nextFiles);
        onSelectFile(nextFiles[0].id);
      }

      if (errors.length > 0) {
        setError(errors.join(' '));
      } else if (nextFiles.length === 0) {
        setError('未读取到可用的代码文件，请重试。');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '读取文件失败，请重试。';
      setError(message);
    } finally {
      setIsLoading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  return (
    <>
      <div className="panel-header">
        <h2>文件</h2>
        <button
          type="button"
          className="icon-btn"
          title="上传本地代码文件"
          aria-label="上传本地代码文件"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
        >
          {isLoading ? (
            <LoaderCircle
              size={16}
              strokeWidth={1.5}
              className="spin"
              aria-hidden="true"
            />
          ) : (
            <Upload size={16} strokeWidth={1.5} />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          hidden
          disabled={isLoading}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      <div className="panel-body file-nav-body">
        {error ? (
          <div className="inline-alert" role="alert">
            <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
            <div className="inline-alert-content">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-ghost btn-compact"
                disabled={isLoading}
                onClick={() => {
                  setError(null);
                  inputRef.current?.click();
                }}
              >
                重试
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="file-nav-status" role="status" aria-live="polite">
            <LoaderCircle
              size={16}
              strokeWidth={1.5}
              className="spin"
              aria-hidden="true"
            />
            <span>正在读取本地文件…</span>
          </div>
        ) : null}

        {files.length === 0 ? (
          <div className="empty-state">
            <FileCode2 size={24} strokeWidth={1.5} aria-hidden="true" />
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              暂无文件
            </strong>
            <p>请上传文本代码文件，或使用任务预设文件。</p>
          </div>
        ) : (
          <ul className="file-list" role="listbox" aria-label="代码文件列表">
            {files.map((file) => {
              const selected = file.id === activeFileId;
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`file-list-item${selected ? ' is-selected' : ''}`}
                    title={file.name}
                    onClick={() => onSelectFile(file.id)}
                  >
                    <FileCode2 size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span className="file-list-name">
                      {truncateName(file.name)}
                    </span>
                    {file.source === 'upload' ? (
                      <span className="file-source-tag">本地</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="file-nav-hint">
          支持 .js / .jsx / .ts / .tsx / .py / .html / .css / .json，仅保存在当前会话。
        </p>
      </div>
    </>
  );
}
