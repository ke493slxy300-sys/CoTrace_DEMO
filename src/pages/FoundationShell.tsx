/**
 * 项目基础结构页：仅展示桌面工作台壳层与独立滚动区域。
 * 本阶段不包含项目注册、任务蓝图、代码编辑或讨论业务。
 */

export function FoundationShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            CT
          </span>
          <span>CoTrace</span>
        </div>
        <div className="app-header-meta">基础结构 · 桌面工作台壳层</div>
      </header>

      <div className="page-title-bar">
        <div>
          <h1>工作台壳层</h1>
          <p className="subtitle">
            固定高度 100vh · 禁止整页滚动 · 三栏独立滚动
          </p>
        </div>
      </div>

      <main className="workbench" aria-label="工作台三栏布局">
        <aside className="panel sidebar-panel" aria-label="文件区">
          <div className="panel-header">
            <h2>文件区</h2>
          </div>
          <div className="panel-body foundation-scroll-demo">
            {Array.from({ length: 24 }, (_, index) => (
              <div key={`file-${index}`} className="foundation-scroll-item">
                文件占位 {index + 1}
              </div>
            ))}
          </div>
        </aside>

        <section className="panel editor-panel" aria-label="代码区">
          <div className="panel-header">
            <h2>代码区</h2>
          </div>
          <div className="panel-body code-viewer-body foundation-scroll-demo">
            {Array.from({ length: 40 }, (_, index) => (
              <div key={`code-${index}`} className="foundation-code-line">
                <span className="code-gutter">{index + 1}</span>
                <code className="code-content">
                  {'  '.repeat(index % 3)}
                  // 代码区占位行 {index + 1} — 可在此区域独立上下/左右滚动
                </code>
              </div>
            ))}
          </div>
          <div className="annotation-toolbar">
            <div className="annotation-toolbar-inner">
              <div className="annotation-toolbar-meta">
                <span>底部工具栏占位（固定在代码区底部）</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel right-panel" aria-label="右侧内容区">
          <div className="right-split">
            <section className="right-section" aria-label="右侧上区">
              <div className="panel-header">
                <h2>右侧上区</h2>
              </div>
              <div className="panel-body foundation-scroll-demo">
                {Array.from({ length: 16 }, (_, index) => (
                  <div key={`right-top-${index}`} className="foundation-scroll-item">
                    上区占位 {index + 1}
                  </div>
                ))}
              </div>
            </section>
            <section className="right-section" aria-label="右侧下区">
              <div className="panel-header">
                <h2>右侧下区</h2>
              </div>
              <div className="panel-body foundation-scroll-demo">
                {Array.from({ length: 16 }, (_, index) => (
                  <div
                    key={`right-bottom-${index}`}
                    className="foundation-scroll-item"
                  >
                    下区占位 {index + 1}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <span>CoTrace Demo · 基础结构阶段</span>
        <span>业务功能尚未接入</span>
      </footer>
    </div>
  );
}
