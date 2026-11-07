import { useRef, useState } from 'react';
import { FileUp, ListTodo, Library } from 'lucide-react';
import {
  BLUEPRINT_STATUS_LABELS,
  formatBlueprintOwnerLabel,
} from '../../data/blueprint';
import { getNodeArtifactCount } from '../../data/blueprintDetail';
import {
  PERSONAL_TODO_STATUS_LABELS,
  type TeamPendingItem,
} from '../../data/personalTodos';
import {
  SHARED_DOC_ICON_SRC,
  type SharedDoc,
} from '../../data/sharedDocs';
import type { BlueprintNode } from '../../types';

export type HandoffDockAction = {
  id: string;
  title: string;
  meta: string;
  statusLabel: string;
  onOpen: () => void;
};

type BlueprintBottomDockProps = {
  ownedNodes: BlueprintNode[];
  pendingItems: TeamPendingItem[];
  docs: SharedDoc[];
  handoffActions?: HandoffDockAction[];
  onJumpToNode: (nodeId: string) => void;
  /** 第二次单击我负责的任务 → 个人编码工作区 */
  onOpenPersonalCoding: (nodeId: string) => void;
  /** 第二次单击团队待办 → 打开关联团队讨论 */
  onOpenPendingDiscussion: (discussionId: string) => void;
  onUploadDocs: (files: FileList) => void;
};

export function BlueprintBottomDock({
  ownedNodes,
  pendingItems,
  docs,
  handoffActions = [],
  onJumpToNode,
  onOpenPersonalCoding,
  onOpenPendingDiscussion,
  onUploadDocs,
}: BlueprintBottomDockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const hasTodoCards =
    ownedNodes.length > 0 ||
    pendingItems.length > 0 ||
    handoffActions.length > 0;

  return (
    <section className="blueprint-bottom-dock" aria-label="个人待办与共享文档">
      <div className="blueprint-dock-pane" aria-label="个人待办">
        <div className="blueprint-dock-head">
          <ListTodo size={15} strokeWidth={1.5} aria-hidden="true" />
          <h2>个人待办</h2>
          <span>私密 · 单击选中，再单击进入（任务/讨论）</span>
        </div>
        <div className="blueprint-dock-body blueprint-dock-body-cards">
          {hasTodoCards ? (
            <div
              className="blueprint-dock-scroller"
              role="list"
              aria-label="待办卡片，可左右滚动"
            >
              {handoffActions.map((action) => {
                const selected = selectedTodoId === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="listitem"
                    className={`blueprint-todo-card${selected ? ' is-selected' : ''}`}
                    title={
                      selected ? '再次单击打开交接页' : '单击选中交接待办'
                    }
                    onClick={() => {
                      if (selectedTodoId === action.id) {
                        action.onOpen();
                        return;
                      }
                      setSelectedTodoId(action.id);
                    }}
                  >
                    <span className="blueprint-todo-card-kind">交接演示</span>
                    <span className="blueprint-todo-card-title">
                      {action.title}
                    </span>
                    <span className="status-chip status-node-in-progress blueprint-todo-card-status">
                      {action.statusLabel}
                    </span>
                    <span className="blueprint-todo-card-meta">
                      {action.meta}
                    </span>
                  </button>
                );
              })}

              {ownedNodes.map((node) => {
                const selected = selectedTodoId === node.id;
                return (
                  <button
                    key={`owned-${node.id}`}
                    type="button"
                    role="listitem"
                    className={`blueprint-todo-card${selected ? ' is-selected' : ''}`}
                    title={
                      selected
                        ? '再次单击进入个人编码工作区'
                        : '单击选中待办'
                    }
                    onClick={() => {
                      if (selectedTodoId === node.id) {
                        onOpenPersonalCoding(node.id);
                        return;
                      }
                      setSelectedTodoId(node.id);
                      onJumpToNode(node.id);
                    }}
                  >
                    <span className="blueprint-todo-card-kind">我负责</span>
                    <span className="blueprint-todo-card-title">
                      {node.name.trim() || '未命名任务'}
                    </span>
                    <span
                      className={`status-chip status-node-${node.status} blueprint-todo-card-status`}
                    >
                      {BLUEPRINT_STATUS_LABELS[node.status]}
                    </span>
                    <span className="blueprint-todo-card-meta">
                      {formatBlueprintOwnerLabel(node.ownerId)} · 你
                    </span>
                    <span className="blueprint-todo-card-meta">
                      关联产出 {getNodeArtifactCount(node)}
                    </span>
                  </button>
                );
              })}

              {pendingItems.map((item) => {
                const todoKey = `pending-${item.id}`;
                const selected = selectedTodoId === todoKey;
                const clickable = Boolean(
                  item.relatedNodeId || item.relatedDiscussionId,
                );
                return (
                  <button
                    key={todoKey}
                    type="button"
                    role="listitem"
                    className={`blueprint-todo-card is-pending${
                      item.track === 'later' ? ' is-later' : ''
                    }${selected ? ' is-selected' : ''}`}
                    disabled={!clickable}
                    title={
                      selected && item.relatedDiscussionId
                        ? '再次单击打开团队讨论'
                        : selected
                          ? '再次单击跳转相关节点'
                          : '单击选中待办'
                    }
                    onClick={() => {
                      if (selected) {
                        if (item.relatedDiscussionId) {
                          onOpenPendingDiscussion(item.relatedDiscussionId);
                          return;
                        }
                        if (item.relatedNodeId) {
                          onJumpToNode(item.relatedNodeId);
                        }
                        return;
                      }
                      setSelectedTodoId(todoKey);
                      if (item.relatedNodeId) {
                        onJumpToNode(item.relatedNodeId);
                      }
                    }}
                  >
                    <span className="blueprint-todo-card-kind">待处理</span>
                    <span className="blueprint-todo-card-title">
                      {item.title}
                    </span>
                    <span className="blueprint-todo-card-status-text">
                      {PERSONAL_TODO_STATUS_LABELS[item.status]}
                      {item.track === 'later' ? ' · 后续阶段' : ''}
                      {item.relatedDiscussionId ? ' · 可开讨论' : ''}
                    </span>
                    <span className="blueprint-todo-card-meta">
                      {item.fromMemberName}
                    </span>
                    <span className="blueprint-todo-card-summary">
                      {item.summary}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="blueprint-dock-empty">暂无个人待办事项。</p>
          )}
        </div>
      </div>

      <div className="blueprint-dock-pane" aria-label="团队共享文档库">
        <div className="blueprint-dock-head">
          <Library size={15} strokeWidth={1.5} aria-hidden="true" />
          <h2>共享文档库</h2>
          <span>团队可见</span>
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={14} strokeWidth={1.5} aria-hidden="true" />
            上传 PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) {
                onUploadDocs(event.target.files);
                event.target.value = '';
              }
            }}
          />
        </div>
        <div className="blueprint-dock-body blueprint-dock-body-cards">
          {docs.length > 0 ? (
            <div
              className="blueprint-dock-scroller"
              role="list"
              aria-label="共享文档卡片，可左右滚动"
            >
              {docs.map((doc) => (
                <a
                  key={doc.id}
                  role="listitem"
                  className="blueprint-doc-card"
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  title={doc.title}
                >
                  <span
                    className="blueprint-doc-card-icon-wrap"
                    aria-hidden="true"
                  >
                    <span
                      className="blueprint-doc-card-glyph"
                      style={{
                        WebkitMaskImage: `url(${SHARED_DOC_ICON_SRC})`,
                        maskImage: `url(${SHARED_DOC_ICON_SRC})`,
                      }}
                    />
                  </span>
                  <span className="blueprint-doc-card-title">{doc.title}</span>
                  <span className="blueprint-doc-card-meta">
                    {doc.ownerLabel} · {doc.statusLabel}
                  </span>
                  <span className="blueprint-doc-card-meta">
                    {doc.source === 'preset' ? '预置' : '本会话上传'} · PDF
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="blueprint-dock-empty">暂无共享文档。</p>
          )}
        </div>
      </div>
    </section>
  );
}
