import type { TeammateDocumentRef } from "../../datasets/built-in/campus-marketplace/content/teammateTypes";

type DocumentArtifactViewerProps = {
  documents: TeammateDocumentRef[];
  activeDocId: string | null;
  markdownContent: string;
  onSelectDoc: (docId: string) => void;
  /** 已由外层 editor-panel 包裹时使用，避免双重 panel */
  embedded?: boolean;
};

export function DocumentArtifactViewer({
  documents,
  activeDocId,
  markdownContent,
  onSelectDoc,
  embedded = false,
}: DocumentArtifactViewerProps) {
  const active =
    documents.find((doc) => doc.id === activeDocId) ?? documents[0] ?? null;

  const inner = (
    <>
      <div className="panel-header">
        <h2>{active?.label ?? "文档"}</h2>
        <span className="panel-meta">只读</span>
      </div>
      <div className="panel-body document-artifact-body">
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

        {active?.mimeType === "application/pdf" && active.href ? (
          <iframe
            className="document-artifact-frame"
            title={active.label}
            src={active.href}
          />
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
