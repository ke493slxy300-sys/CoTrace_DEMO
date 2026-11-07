import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  FileSearch,
  Plus,
  Trash2,
  UserRoundPen,
} from 'lucide-react';
import { BlueprintAiAssistant } from '../components/blueprint/BlueprintAiAssistant';
import { BlueprintBottomDock } from '../components/blueprint/BlueprintBottomDock';
import { AppHeader } from '../components/layout/AppHeader';
import { PageTitleBar } from '../components/layout/PageTitleBar';
import {
  BLUEPRINT_OWNER_PENDING_LABEL,
  BLUEPRINT_STATUS_LABELS,
  formatBlueprintOwnerLabel,
} from '../data/blueprint';
import {
  getBlueprintNodeDetail,
  getNodeArtifactCount,
  resolveArtifactEmptyKind,
} from '../data/blueprintDetail';
import { DEMO_LOCKED_MESSAGE, isPresetBlueprintNode } from '../data/demoLock';
import {
  EXPERIENCE_MEMBER_ID,
  getCurrentMember,
  getExperienceMember,
  getMemberById,
} from '../data/members';
import { INITIAL_TEAM_PENDING_ITEMS } from '../data/personalTodos';
import { PRESET_SHARED_DOCS, type SharedDoc } from '../data/sharedDocs';
import {
  buildEntryFromBlueprintNode,
  buildEntryFromPersonalTodo,
  type WorkspaceEntry,
} from '../data/workspaceEntry';
import { TeamDiscussionWindow } from '../components/nodeDetail/TeamDiscussionWindow';
import type { HandoffDockAction } from '../components/blueprint/BlueprintBottomDock';
import { useDelivery } from '../data/deliveryStore';
import { useDemoRole } from '../data/demoRoleStore';
import {
  getAllFeedbacks,
  subscribeProcessEvents,
} from '../data/processEventStore';
import type { BlueprintNode, CourseProject } from '../types';

type BlueprintPageProps = {
  project: CourseProject;
  nodes: BlueprintNode[];
  /** 从提交页返回时尽量恢复选中节点 */
  preferredSelectedNodeId?: string | null;
  onBack: () => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onAddBlankNode: () => string;
  onAssignOwner: (nodeId: string, ownerId: string | null) => void;
  onRenameBlankNode: (nodeId: string, name: string) => void;
  onDeleteBlankNode: (nodeId: string) => void;
  onOpenWorkspace: (entry: WorkspaceEntry) => void;
  onOpenDeliveryPublish: () => void;
  onOpenDeliveryReceive: () => void;
  onToast: (message: string) => void;
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 96;
const DRAG_THRESHOLD = 4;

export function BlueprintPage({
  project,
  nodes,
  preferredSelectedNodeId = null,
  onBack,
  onMoveNode,
  onAddBlankNode,
  onAssignOwner,
  onRenameBlankNode,
  onDeleteBlankNode,
  onOpenWorkspace,
  onOpenDeliveryPublish,
  onOpenDeliveryReceive,
  onToast,
}: BlueprintPageProps) {
  const experienceMember = getExperienceMember();
  const me = getCurrentMember();
  const role = useDemoRole();
  const delivery = useDelivery();
  const teacherFeedbacks = useSyncExternalStore(
    subscribeProcessEvents,
    getAllFeedbacks,
    getAllFeedbacks,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => preferredSelectedNodeId,
  );

  useEffect(() => {
    if (!preferredSelectedNodeId) return;
    if (!nodes.some((node) => node.id === preferredSelectedNodeId)) return;
    setSelectedId(preferredSelectedNodeId);
  }, [preferredSelectedNodeId, nodes]);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [docs, setDocs] = useState<SharedDoc[]>(PRESET_SHARED_DOCS);
  const [pendingItems] = useState(INITIAL_TEAM_PENDING_ITEMS);
  const [openDiscussionId, setOpenDiscussionId] = useState<string | null>(null);
  const uploadUrlsRef = useRef<string[]>([]);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    wasAlreadySelected: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      for (const url of uploadUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedDetail = selected
    ? getBlueprintNodeDetail(selected)
    : null;

  const ownedNodes = useMemo(
    () => nodes.filter((node) => node.ownerId === experienceMember.id),
    [nodes, experienceMember.id],
  );

  const handoffActions = useMemo<HandoffDockAction[]>(() => {
    const actions: HandoffDockAction[] = [];
    if (role === 'alex') {
      actions.push({
        id: 'handoff-publish',
        title: `${delivery.title} ${delivery.version}`,
        meta:
          delivery.status === 'draft'
            ? '发布给 Priya'
            : delivery.status === 'published'
              ? '已发布 · 等待接收'
              : '已完成交接',
        statusLabel:
          delivery.status === 'draft'
            ? '待发布'
            : delivery.status === 'published'
              ? '等待接收'
              : '已接收',
        onOpen: onOpenDeliveryPublish,
      });
    }
    if (role === 'priya' && delivery.status !== 'draft') {
      actions.push({
        id: 'handoff-receive',
        title: `接收 ${delivery.title} ${delivery.version}`,
        meta:
          delivery.status === 'received'
            ? delivery.nextStep
            : '确认接收后开始联调',
        statusLabel: delivery.status === 'received' ? '已接收' : '待接收',
        onOpen: onOpenDeliveryReceive,
      });
    }
    return actions;
  }, [role, delivery, onOpenDeliveryPublish, onOpenDeliveryReceive]);

  const unassignedCount = useMemo(
    () => nodes.filter((node) => !node.ownerId).length,
    [nodes],
  );

  const ownerCandidates = useMemo(
    () =>
      project.collaborators
        .map((item) => getMemberById(item.memberId))
        .filter((member): member is NonNullable<typeof member> =>
          Boolean(member),
        ),
    [project.collaborators],
  );

  const canvasSize = useMemo(() => {
    let maxX = 1020;
    let maxY = 560;
    for (const node of nodes) {
      maxX = Math.max(maxX, node.x + NODE_WIDTH + 48);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT + 48);
    }
    return { width: maxX, height: maxY };
  }, [nodes]);

  const edges = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const lines: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [];
    for (const node of nodes) {
      for (const depId of node.dependsOn) {
        const from = byId.get(depId);
        if (!from) continue;
        lines.push({
          key: `${depId}->${node.id}`,
          x1: from.x + NODE_WIDTH,
          y1: from.y + NODE_HEIGHT / 2,
          x2: node.x,
          y2: node.y + NODE_HEIGHT / 2,
        });
      }
    }
    return lines;
  }, [nodes]);

  function selectNode(nodeId: string) {
    setSelectedId(nodeId);
    setOwnerPickerOpen(false);
  }

  function clearSelection() {
    setSelectedId(null);
    setOwnerPickerOpen(false);
  }

  function openSelectedNodeDetail(node: BlueprintNode) {
    onOpenWorkspace(buildEntryFromBlueprintNode(project, node));
  }

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    node: BlueprintNode,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false,
      wasAlreadySelected: selectedId === node.id,
    };
    selectNode(node.id);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.currentTarget.dataset.nodeId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    drag.moved = true;
    const nextX = Math.max(0, drag.originX + dx);
    const nextY = Math.max(0, drag.originY + dy);
    onMoveNode(drag.id, nextX, nextY);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const nodeId = event.currentTarget.dataset.nodeId;
    if (drag && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // 第二次单击（已选中且未拖拽）→ 一律进入节点详情
    if (drag && !drag.moved && drag.wasAlreadySelected && nodeId) {
      const node = nodes.find((item) => item.id === nodeId);
      if (node) openSelectedNodeDetail(node);
    }

    dragRef.current = null;
  }

  function handleUploadDocs(files: FileList) {
    const next: SharedDoc[] = [];
    for (const file of Array.from(files)) {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        onToast('仅支持上传 PDF 文件。');
        continue;
      }
      const href = URL.createObjectURL(file);
      uploadUrlsRef.current.push(href);
      next.push({
        id: `doc-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: file.name.replace(/\.pdf$/i, ''),
        description: '本会话上传，刷新后不会保留。',
        source: 'upload',
        href,
        ownerLabel: '本会话',
        statusLabel: '上传',
        nodeIds: [],
      });
    }
    if (next.length > 0) {
      setDocs((current) => [...current, ...next]);
    }
  }

  function handleLockedFieldAttempt() {
    onToast(DEMO_LOCKED_MESSAGE);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <PageTitleBar
        title="任务蓝图"
        subtitle={`${project.name} · 模拟 AI 初始理解结果（可分配负责人 / 新增空白节点）`}
        leading={
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            返回项目列表
          </button>
        }
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const id = onAddBlankNode();
              if (id) selectNode(id);
              setOwnerPickerOpen(true);
            }}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            新增空白节点
          </button>
        }
      />

      <main className="blueprint-layout" aria-label="任务蓝图工作区">
        <section
          className="blueprint-canvas-panel"
          aria-label="蓝图画布"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              clearSelection();
            }
          }}
        >
          <div
            className="blueprint-canvas"
            style={{ width: canvasSize.width, height: canvasSize.height }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                clearSelection();
              }
            }}
          >
            <svg
              className="blueprint-edges"
              aria-hidden="true"
              onPointerDown={clearSelection}
            >
              {edges.map((edge) => (
                <line
                  key={edge.key}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  className="blueprint-edge"
                />
              ))}
            </svg>
            {nodes.map((node) => {
              const active = node.id === selectedId;
              const ownerLabel = formatBlueprintOwnerLabel(node.ownerId);
              const artifactCount = getNodeArtifactCount(node);
              return (
                <button
                  key={node.id}
                  type="button"
                  data-node-id={node.id}
                  className={`blueprint-node${active ? ' is-active' : ''}${
                    !node.ownerId ? ' is-unassigned' : ''
                  }${node.isBlank ? ' is-blank' : ''}`}
                  style={{ left: node.x, top: node.y }}
                  onPointerDown={(event) => handlePointerDown(event, node)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <span className="blueprint-node-name">
                    {node.name.trim() || '未命名任务'}
                  </span>
                  <span className={`status-chip status-node-${node.status}`}>
                    {BLUEPRINT_STATUS_LABELS[node.status]}
                  </span>
                  <span className="blueprint-node-owner">
                    负责人：{ownerLabel}
                  </span>
                  <span className="blueprint-node-artifacts">
                    关联产出 {artifactCount}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="blueprint-detail-panel" aria-label="节点详情">
          <div className="panel-header">
            <h2>{selected ? '节点详情' : 'AI 项目理解助手'}</h2>
          </div>
          <div className="panel-body blueprint-detail-body">
            {selected && selectedDetail ? (
              <>
                <div className="blueprint-sim-badge">
                  {selected.isBlank ? '负责人新增节点' : '模拟 AI 内容'}
                </div>

                {selected.isBlank ? (
                  <label className="blueprint-name-field">
                    <span>节点名称</span>
                    <input
                      type="text"
                      value={selected.name}
                      maxLength={40}
                      onChange={(event) =>
                        onRenameBlankNode(selected.id, event.target.value)
                      }
                    />
                  </label>
                ) : (
                  <h3
                    title={DEMO_LOCKED_MESSAGE}
                    onDoubleClick={handleLockedFieldAttempt}
                  >
                    {selected.name}
                  </h3>
                )}

                <section className="blueprint-detail-block">
                  <h4>任务背景</h4>
                  <p
                    className="blueprint-detail-summary"
                    onDoubleClick={
                      isPresetBlueprintNode(selected)
                        ? handleLockedFieldAttempt
                        : undefined
                    }
                  >
                    {selectedDetail.background}
                  </p>
                </section>

                <section className="blueprint-detail-block">
                  <h4>任务目标</h4>
                  <p
                    className="blueprint-detail-summary"
                    onDoubleClick={
                      isPresetBlueprintNode(selected)
                        ? handleLockedFieldAttempt
                        : undefined
                    }
                  >
                    {selectedDetail.goal}
                  </p>
                </section>

                <div className="entry-meta">
                  <div className="entry-meta-row">
                    <span>状态</span>
                    <span>{BLUEPRINT_STATUS_LABELS[selected.status]}</span>
                  </div>
                  <div className="entry-meta-row">
                    <span>负责人</span>
                    <span>
                      {selected.ownerId
                        ? `${formatBlueprintOwnerLabel(selected.ownerId)}${
                            selected.ownerId === me.id ? ' · 你' : ''
                          }`
                        : BLUEPRINT_OWNER_PENDING_LABEL}
                    </span>
                  </div>
                  <div className="entry-meta-row">
                    <span>关联产出</span>
                    <span>{selectedDetail.artifacts.length}</span>
                  </div>
                </div>

                <section className="blueprint-detail-block">
                  <div className="blueprint-detail-block-head">
                    <h4>负责人分配</h4>
                    <button
                      type="button"
                      className="btn btn-ghost btn-compact"
                      onClick={() => setOwnerPickerOpen((open) => !open)}
                    >
                      <UserRoundPen size={14} strokeWidth={1.5} />
                      {ownerPickerOpen ? '收起' : '指定负责人'}
                    </button>
                  </div>

                  {ownerPickerOpen ? (
                    <div className="blueprint-owner-picker">
                      <button
                        type="button"
                        className={`blueprint-owner-option${
                          selected.ownerId === null ? ' is-active' : ''
                        }`}
                        onClick={() => {
                          onAssignOwner(selected.id, null);
                          setOwnerPickerOpen(false);
                        }}
                      >
                        待分配（清空负责人）
                      </button>
                      {ownerCandidates.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className={`blueprint-owner-option${
                            selected.ownerId === member.id ? ' is-active' : ''
                          }`}
                          onClick={() => {
                            onAssignOwner(selected.id, member.id);
                            setOwnerPickerOpen(false);
                          }}
                        >
                          {member.name}
                          {member.id === me.id ? ' · 你' : ''}
                          <span>{member.roleLabel}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="blueprint-detail-block">
                  <h4>验收标准</h4>
                  <ul
                    className="blueprint-acceptance"
                    onDoubleClick={
                      isPresetBlueprintNode(selected)
                        ? handleLockedFieldAttempt
                        : undefined
                    }
                  >
                    {selected.acceptance.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="blueprint-detail-block">
                  <h4>前置依赖</h4>
                  {selected.dependsOn.length > 0 ? (
                    <ul
                      className="blueprint-acceptance"
                      onDoubleClick={
                        isPresetBlueprintNode(selected)
                          ? handleLockedFieldAttempt
                          : undefined
                      }
                    >
                      {selected.dependsOn.map((depId) => {
                        const dep = nodes.find((node) => node.id === depId);
                        return (
                          <li key={depId}>{dep?.name ?? depId}</li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p
                      className="blueprint-detail-note"
                      onDoubleClick={
                        isPresetBlueprintNode(selected)
                          ? handleLockedFieldAttempt
                          : undefined
                      }
                    >
                      无前置依赖。
                    </p>
                  )}
                </section>

                <section className="blueprint-detail-block">
                  <h4>关联代码、文档和测试记录</h4>
                  {selectedDetail.artifacts.length > 0 ? (
                    <ul className="blueprint-artifact-list">
                      {selectedDetail.artifacts.map((item) => (
                        <li key={item.id}>
                          <span className="blueprint-artifact-kind">
                            {item.kind === 'code'
                              ? '代码'
                              : item.kind === 'doc'
                                ? '文档'
                                : '测试'}
                          </span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ArtifactEmptyState
                      kind={resolveArtifactEmptyKind(selected)}
                      onAssignOwner={() => setOwnerPickerOpen(true)}
                    />
                  )}
                </section>

                <section className="blueprint-detail-block">
                  <h4>待处理问题和讨论</h4>
                  {selectedDetail.openIssues.length > 0 ? (
                    <ul className="blueprint-acceptance">
                      {selectedDetail.openIssues.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="blueprint-detail-note">暂无待处理问题。</p>
                  )}
                </section>

                <section className="blueprint-detail-block">
                  <h4>任务演进记录</h4>
                  <ul className="blueprint-acceptance">
                    {selectedDetail.evolution.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => openSelectedNodeDetail(selected)}
                >
                  <FileSearch
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  查看节点详情
                </button>

                {selected.isBlank ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      onDeleteBlankNode(selected.id);
                      clearSelection();
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                    删除空白节点
                  </button>
                ) : null}
              </>
            ) : (
              <BlueprintAiAssistant
                project={project}
                unassignedCount={unassignedCount}
                ownedCount={ownedNodes.length}
                onOpenNode={selectNode}
              />
            )}
          </div>
        </aside>
      </main>

      {teacherFeedbacks.length > 0 ? (
        <div
          className="blueprint-teacher-feedback-strip"
          role="status"
          style={{
            margin: '0 16px 8px',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#2a3e56',
            color: '#e6eaf2',
            fontSize: 13,
          }}
        >
          <strong>教师反馈 · </strong>
          {teacherFeedbacks[teacherFeedbacks.length - 1]?.content}
        </div>
      ) : null}

      <BlueprintBottomDock
        ownedNodes={ownedNodes}
        pendingItems={pendingItems}
        docs={docs}
        handoffActions={handoffActions}
        onJumpToNode={selectNode}
        onOpenPersonalCoding={(nodeId) => {
          const node = nodes.find((item) => item.id === nodeId);
          if (!node) return;
          onOpenWorkspace(
            buildEntryFromPersonalTodo(project, node, experienceMember.id),
          );
        }}
        onOpenPendingDiscussion={setOpenDiscussionId}
        onUploadDocs={handleUploadDocs}
      />

      <TeamDiscussionWindow
        open={Boolean(openDiscussionId)}
        discussionId={openDiscussionId}
        currentUserId={EXPERIENCE_MEMBER_ID}
        viewerName={experienceMember.name}
        onClose={() => setOpenDiscussionId(null)}
      />

      <footer className="app-footer">
        <span>蓝图为模拟 AI 初始理解 · 非最终确认事实</span>
        <span>当前视角：{me.name}</span>
      </footer>
    </div>
  );
}

function ArtifactEmptyState({
  kind,
  onAssignOwner,
}: {
  kind: ReturnType<typeof resolveArtifactEmptyKind>;
  onAssignOwner: () => void;
}) {
  if (kind === 'unassigned') {
    return (
      <div className="blueprint-empty-block">
        <strong>Oops，还没有指定负责人！</strong>
        <p>
          这个任务已经进入项目蓝图，
          <br />
          但还没有人正式接手。
        </p>
        <div className="blueprint-empty-actions">
          <button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={onAssignOwner}
          >
            <UserRoundPen size={14} strokeWidth={1.5} />
            指定负责人
          </button>
        </div>
      </div>
    );
  }

  if (kind === 'maya-working') {
    return (
      <div className="blueprint-empty-block">
        <strong>负责人还在努力工作……</strong>
        <p>
          这个任务已经交给 Maya Chen，
          <br />
          但目前还没有代码产出。
        </p>
      </div>
    );
  }

  return (
    <div className="blueprint-empty-block">
      <p className="blueprint-detail-note">暂无代码产出、讨论或核验记录。</p>
    </div>
  );
}
