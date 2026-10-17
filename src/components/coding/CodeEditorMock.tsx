import type { CodeFile } from '../../types';
import { getDisplayLines } from '../../utils/codeLines';
import { renderHighlightedLine } from '../../utils/highlightCode';
import { IdeBottomPanel } from './IdeBottomPanel';

type CodeEditorMockProps = {
  file: CodeFile | null;
  empty?: boolean;
  onSubmitTask?: () => void;
};

/** 个人编码区：只读伪 IDE（高亮 + 行号 + 底栏空壳） */
export function CodeEditorMock({
  file,
  empty = false,
  onSubmitTask,
}: CodeEditorMockProps) {
  if (empty || !file) {
    return (
      <section className="panel editor-panel" aria-label="代码编辑区">
        <div className="panel-header">
          <h2>代码编辑区</h2>
          <span className="badge">暂无文件</span>
        </div>
        <div className="panel-body coding-editor-empty">
          <strong>代码仓暂无内容</strong>
          <p>该任务目前还没有代码仓内容。</p>
          <p>代码文件将在关联项目文件后显示。</p>
        </div>
        {onSubmitTask ? (
          <IdeBottomPanel onSubmitTask={onSubmitTask} submitDisabled />
        ) : null}
      </section>
    );
  }

  const lines = getDisplayLines(file.content);

  return (
    <section className="panel editor-panel coding-ide-panel" aria-label="代码编辑区">
      <div className="panel-header">
        <h2 title={file.name}>{file.name}</h2>
        <span className="badge">只读演示 · 伪 IDE</span>
      </div>
      <div className="panel-body code-viewer-body coding-editor-body">
        <div className="code-viewer">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <div key={lineNumber} className="code-line" data-line={lineNumber}>
                <span className="code-gutter">{lineNumber}</span>
                <code className="code-content">
                  {renderHighlightedLine(line, file.language)}
                </code>
              </div>
            );
          })}
        </div>
      </div>
      {onSubmitTask ? <IdeBottomPanel onSubmitTask={onSubmitTask} /> : null}
    </section>
  );
}
