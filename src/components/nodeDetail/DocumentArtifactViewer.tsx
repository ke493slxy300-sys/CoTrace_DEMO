import { Download, ExternalLink } from "lucide-react";
import type { TeammateDocumentRef } from "../../datasets/built-in/campus-marketplace/content/teammateTypes";

type DocumentArtifactViewerProps = {
  documents: TeammateDocumentRef[];
  activeDocId: string | null;
  markdownContent: string;
  onSelectDoc: (docId: string) => void;
  /** 已由外层 editor-panel 包裹时使用，避免双重 panel */
  embedded?: boolean;
  /** 左侧目录已承担格式切换时，隐藏正文区重复 tabs */
  hideFormatTabs?: boolean;
};

export function DocumentArtifactViewer({
  documents,
  activeDocId,
  markdownContent,
  onSelectDoc,
  embedded = false,
  hideFormatTabs = false,
}: DocumentArtifactViewerProps) {
  const active =
    documents.find((doc) => doc.id === activeDocId) ?? documents[0] ?? null;
  const isPdf = active?.mimeType === "application/pdf" && Boolean(active.href);

  const inner = (
    <>
      <div className="panel-header">
        <h2>{active?.label ?? "文档"}</h2>
        <span className="panel-meta">只读</span>
      </div>
      <div className="panel-body document-artifact-body">
        {hideFormatTabs ? null : (
          <div className="document-artifact-tabs" role="tablist">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                role="tab"
                aria-selected={doc.id === active?.id}
                className={`document-artifact-tab${
                  doc.id === active?.id ? " is-active" : ""
                }`}
                onClick={() => onSelectDoc(doc.id)}
              >
                {doc.label}
              </button>
            ))}
          </div>
        )}

        {isPdf && active.href ? (
          <>
            <div className="document-artifact-pdf-bar" role="status">
              <p>
                当前环境无法内嵌显示 PDF，已改用 Markdown
                源文预览。完整版请新窗口打开。
              </p>
              <div className="document-artifact-pdf-actions">
                <a
                  className="document-artifact-pdf-link"
                  href={active.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                  新窗口打开 PDF
                </a>
                <a
                  className="document-artifact-pdf-link is-ghost"
                  href={active.href}
                  download
                >
                  <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                  下载 PDF
                </a>
              </div>
            </div>
            <pre className="document-artifact-markdown">{markdownContent}</pre>
          </>
        ) : (
          <pre className="document-artifact-markdown">{markdownContent}</pre>
        )}
      </div>
    </>
  );

  if (embedded) return inner;

  return (
    <section className="panel editor-panel" aria-label="文档详细展示">
      {inner}
    </section>
  );
}
