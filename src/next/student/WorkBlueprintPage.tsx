import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Link2, Minus, Plus, Unlink } from 'lucide-react';
import type { BlueprintNode, BlueprintNodeStatus } from '../../types';
import { BLUEPRINT_STATUS_LABELS } from '../../data/blueprint';
import { getBlueprintNodeDetail } from '../../data/blueprintDetail';
import { handoffStatusLine } from '../../data/deliveryChain';
import { useDelivery } from '../../data/deliveryStore';
import { useDemoRole } from '../../data/demoRoleStore';
import { applyDeliveryToBlueprint } from '../../data/handoffBlueprint';
import {
  HANDOFF_NODE_BACKEND,
  HANDOFF_NODE_INTEGRATION,
  HANDOFF_PROJECT_ID,
} from '../../data/handoffDemoSeed';
import { getMemberById } from '../../data/members';
import { StudentShell, type StudentPlace } from './StudentShell';
import { StudentTrail } from './StudentTrail';
import {
  hashNodeDetail,
  hashPublish,
  hashReceive,
} from './studentRoutes';
import './blueprint.css';

type WorkBlueprintPageProps = {
  nodes: BlueprintNode[];
  projectId: string;
  projectName: string;
  selectedId: string | null;
  onSelect: (nodeId: string | null) => void;
  onNavigate: (place: StudentPlace) => void;
  onOpenNode: (nodeId: string) => void;
};

/** SeatFlow / 无蓝图项目：侧栏仍属当前项目，不跳校园蓝图 */
export function ProjectSpaceUnavailable({
  projectName,
  reason,
  onNavigate,
  place = 'blueprint',
  title = '蓝图',
}: {
  projectName: string;
  reason: string;
  onNavigate: (place: StudentPlace) => void;
  place?: StudentPlace;
  title?: string;
}) {
  return (
    <StudentShell
      place={place}
      projectName={projectName}
      onNavigate={onNavigate}
    >
      <div className="wbp">
        <div className="wbp-title">
          <div className="wbp-head">
            <div>
              <StudentTrail
                segments={[{ label: projectName }, { label: title }]}
              />
              <h1>{title}</h1>
            </div>
          </div>
        </div>
        <div className="wbp-empty" role="status">
          <h2>暂不可用</h2>
          <p>{reason}</p>
          <button type="button" onClick={() => onNavigate('history')}>
            查看记录
          </button>
        </div>
      </div>
    </StudentShell>
  );
}

type DetailBrief = {
  title: string;
  statusLabel: string;
  keyLine: string;
  actionLabel: string;
  onAction: () => void;
  /** 画布/坞内可切到底部交付详情的节点（后端接口、联调） */
  showDeliveryChip: boolean;
};

function ownerFace(ownerId: string | null): { initial: string; name: string } {
  const member = ownerId ? getMemberById(ownerId) : undefined;
  if (!member) return { initial: '?', name: '待分配' };
  return {
    initial: member.initials.slice(0, 1),
    name: member.name,
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduce;
}

/** 画布分区标题；节点归属按既有任务语义，不新增虚构节点 */
const STAGES = [
  { id: 'req', title: '需求', sub: '明确目标与范围', nodeIds: ['node-requirements'] },
  { id: 'design', title: '设计', sub: '形成方案与结构', nodeIds: ['node-database'] },
  {
    id: 'dev',
    title: '开发',
    sub: '实现功能与集成',
    nodeIds: [HANDOFF_NODE_BACKEND, 'node-frontend', HANDOFF_NODE_INTEGRATION],
  },
  {
    id: 'accept',
    title: '验收',
    sub: '验证结果与复盘',
    nodeIds: ['node-testing', 'node-acceptance'],
  },
] as const;

/**
 * 稳定画布坐标（节点左上角）。
 * 依赖仍以 blueprint-nodes.json 的 dependsOn 为准：
 * requirements → database → backend ─┐
 * requirements → frontend ───────────┼→ integration → testing → acceptance
 */
const LAYOUT: Record<string, { x: number; y: number; title?: string }> = {
  'node-requirements': { x: 48, y: 200, title: '需求分析' },
  'node-database': { x: 320, y: 110 },
  // 开发区：后端 / 前端并列，联调在右侧汇合（dependsOn 不变）
  [HANDOFF_NODE_BACKEND]: { x: 580, y: 88, title: '后端接口' },
  'node-frontend': { x: 800, y: 88 },
  [HANDOFF_NODE_INTEGRATION]: { x: 690, y: 280 },
  'node-testing': { x: 960, y: 280 },
  'node-acceptance': { x: 960, y: 420 },
};

const NODE_W = 200;
const NODE_H = 78;
const CANVAS_W = 1180;
const CANVAS_H = 560;
const ZOOM_MIN = 75;
const ZOOM_MAX = 125;
const ZOOM_STEP = 5;

function statusTone(
  node: BlueprintNode,
  integrationLive: boolean,
): 'done' | 'live' | 'todo' {
  if (node.id === HANDOFF_NODE_INTEGRATION && integrationLive) return 'live';
  if (node.status === 'done' || node.status === 'accepted') return 'done';
  if (node.status === 'in-progress') return 'live';
  return 'todo';
}

function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const midX = (x1 + x2) / 2;
  if (Math.abs(y2 - y1) < 8) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

function nodeDisplayName(node: BlueprintNode): string {
  return LAYOUT[node.id]?.title ?? node.name;
}

function prerequisiteLine(node: BlueprintNode, nodes: BlueprintNode[]): string {
  if (node.dependsOn.length === 0) return '无前置依赖，可直接开始';
  const names = node.dependsOn.map((id) => {
    const dep = nodes.find((item) => item.id === id);
    return dep ? nodeDisplayName(dep) : id;
  });
  return `前置：${names.join('、')}`;
}

function outcomeLine(node: BlueprintNode): string {
  const pack =
    node.projectId === HANDOFF_PROJECT_ID ? getBlueprintNodeDetail(node) : null;
  const first = pack?.artifacts?.[0]?.label;
  if (first) return first;
  return node.summary || '可回看本节点成果与材料';
}

export function WorkBlueprintPage({
  nodes,
  projectId,
  projectName,
  selectedId,
  onSelect,
  onNavigate,
  onOpenNode: _onOpenNode,
}: WorkBlueprintPageProps) {
  void _onOpenNode;
  const delivery = useDelivery();
  const role = useDemoRole();
  const live =
    projectId === HANDOFF_PROJECT_ID ? applyDeliveryToBlueprint(nodes) : nodes;

  const waiting = delivery.status === 'published';
  const needsRevision = delivery.status === 'needs-revision';
  const waitingUpstream =
    delivery.status === 'published' || delivery.status === 'needs-revision';
  const received = delivery.status === 'received';
  const selected = selectedId
    ? (live.find((node) => node.id === selectedId) ?? null)
    : null;
  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(selected);
  const [panelOpen, setPanelOpen] = useState(Boolean(selected));
  /** 仅切节点时给内容加 swap，首次打开只做面板进入 */
  const [contentSwap, setContentSwap] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  /** 底部坞展示交付详情（复用 wbp-detail，不用居中弹窗） */
  const [deliveryDockOpen, setDeliveryDockOpen] = useState(false);
  const [deliveryLinkIn, setDeliveryLinkIn] = useState(false);
  const wasReceivedRef = useRef(received);
  const panelOpenRef = useRef(Boolean(selected));
  const shownIdRef = useRef(selected?.id ?? null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef({ top: 0, left: 0 });
  const detailRef = useRef<HTMLElement>(null);
  const lastFocusedNodeId = useRef<string | null>(null);

  useEffect(() => {
    if (received && !wasReceivedRef.current) {
      setDeliveryLinkIn(true);
      const timer = window.setTimeout(() => setDeliveryLinkIn(false), 700);
      wasReceivedRef.current = true;
      return () => window.clearTimeout(timer);
    }
    wasReceivedRef.current = received;
    return undefined;
  }, [received]);

  const closeDetail = useCallback(
    (restoreFocus: boolean) => {
      const focusId = lastFocusedNodeId.current ?? selectedId;
      panelOpenRef.current = false;
      shownIdRef.current = null;
      setDeliveryDockOpen(false);
      setPanelOpen(false);
      setContentSwap(false);
      onSelect(null);
      if (restoreFocus && focusId) {
        requestAnimationFrame(() => {
          const nodeBtn = document.querySelector(
            `.wbp-node[data-node="${focusId}"]`,
          ) as HTMLButtonElement | null;
          nodeBtn?.focus({ preventScroll: true });
        });
      }
    },
    [onSelect, selectedId],
  );

  const openDeliveryDock = useCallback(() => {
    const switching = panelOpenRef.current || deliveryDockOpen;
    setContentSwap(switching && !reduceMotion);
    setDeliveryDockOpen(true);
    panelOpenRef.current = true;
    setPanelOpen(true);
    onSelect(null);
  }, [deliveryDockOpen, onSelect, reduceMotion]);

  useEffect(() => {
    if (selected) {
      setDeliveryDockOpen(false);
      const switching = panelOpenRef.current;
      const idChanged = shownIdRef.current !== selected.id;
      shownIdRef.current = selected.id;
      lastFocusedNodeId.current = selected.id;
      setShown(selected);
      // 仅节点 id 变化时更新 swap；同节点数据刷新不得清掉动画类
      if (idChanged) {
        setContentSwap(switching && !reduceMotion);
      }
      if (switching) return;
      if (reduceMotion) {
        panelOpenRef.current = true;
        setPanelOpen(true);
        return;
      }
      const frame = requestAnimationFrame(() => {
        panelOpenRef.current = true;
        setPanelOpen(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (deliveryDockOpen) {
      panelOpenRef.current = true;
      setPanelOpen(true);
      return;
    }
    panelOpenRef.current = false;
    shownIdRef.current = null;
    setPanelOpen(false);
    setContentSwap(false);
  }, [selectedId, reduceMotion, selected, deliveryDockOpen]);

  useEffect(() => {
    if (!panelOpen && !deliveryDockOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDetail(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, deliveryDockOpen, closeDetail]);

  const openDeliveryPage = useCallback(() => {
    const hash =
      role === 'priya'
        ? hashReceive(projectId, { from: 'blueprint' })
        : hashPublish(projectId, { from: 'blueprint' });
    window.location.hash = hash;
  }, [projectId, role]);

  const enterNode = useCallback(
    (nodeId: string) => {
      window.location.hash = hashNodeDetail(projectId, {
        node: nodeId,
        from: 'blueprint',
      });
    },
    [projectId],
  );

  useLayoutEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    if (wrap.scrollTop !== canvasScrollRef.current.top) {
      wrap.scrollTop = canvasScrollRef.current.top;
    }
    if (wrap.scrollLeft !== canvasScrollRef.current.left) {
      wrap.scrollLeft = canvasScrollRef.current.left;
    }
  }, [selectedId, zoomPercent]);

  /** 仅首次打开详情时，必要时把节点滚进可见区；切节点保持滚动位置 */
  useLayoutEffect(() => {
    if (!selectedId || !panelOpen || contentSwap) return;
    const wrap = canvasWrapRef.current;
    const nodeEl = document.querySelector(
      `.wbp-node[data-node="${selectedId}"]`,
    ) as HTMLElement | null;
    if (!wrap || !nodeEl) return;
    const overlayH = detailRef.current?.offsetHeight ?? 160;
    const wrapRect = wrap.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();
    const visibleBottom = wrapRect.bottom - overlayH - 12;
    if (nodeRect.bottom > visibleBottom) {
      const delta = nodeRect.bottom - visibleBottom;
      wrap.scrollTop += delta;
      canvasScrollRef.current.top = wrap.scrollTop;
    } else if (nodeRect.top < wrapRect.top + 8) {
      wrap.scrollTop += nodeRect.top - wrapRect.top - 8;
      canvasScrollRef.current.top = wrap.scrollTop;
    }
  }, [selectedId, panelOpen, contentSwap]);

  const placed = useMemo(() => {
    return live.map((node) => {
      const layout = LAYOUT[node.id] ?? { x: node.x, y: node.y };
      return {
        ...node,
        x: layout.x,
        y: layout.y,
        displayName: layout.title ?? node.name,
      };
    });
  }, [live]);

  const byId = useMemo(
    () => new Map(placed.map((node) => [node.id, node])),
    [placed],
  );

  const edges = useMemo(() => {
    const lines: Array<{
      key: string;
      fromId: string;
      toId: string;
      path: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isDelivery: boolean;
    }> = [];
    for (const node of placed) {
      for (const depId of node.dependsOn) {
        const from = byId.get(depId);
        if (!from) continue;
        const isDelivery =
          depId === HANDOFF_NODE_BACKEND &&
          node.id === HANDOFF_NODE_INTEGRATION;
        // 交付线：后端底边中点 → 联调顶边中点，避开左右依赖箭头与卡片重叠
        const x1 = isDelivery ? from.x + NODE_W / 2 : from.x + NODE_W;
        const y1 = isDelivery ? from.y + NODE_H : from.y + NODE_H / 2;
        const x2 = isDelivery ? node.x + NODE_W / 2 : node.x;
        const y2 = isDelivery ? node.y : node.y + NODE_H / 2;
        lines.push({
          key: `${depId}->${node.id}`,
          fromId: depId,
          toId: node.id,
          path: edgePath(x1, y1, x2, y2),
          x1,
          y1,
          x2,
          y2,
          isDelivery,
        });
      }
    }
    return lines;
  }, [placed, byId]);

  const relatedEdgeKeys = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const keys = new Set<string>();
    for (const edge of edges) {
      if (edge.fromId === selectedId || edge.toId === selectedId) {
        keys.add(edge.key);
      }
    }
    return keys;
  }, [edges, selectedId]);

  const deliveryEdge = edges.find((edge) => edge.isDelivery);

  const audience = role === 'priya' ? 'receiver' : 'publisher';
  const handoffLine = handoffStatusLine(delivery.status, audience);

  const nodeAction = (node: BlueprintNode): string | null => {
    if (node.id === HANDOFF_NODE_BACKEND && delivery.status === 'draft' && role === 'alex') {
      return '发布交付';
    }
    if (node.id === HANDOFF_NODE_BACKEND && waiting) {
      return handoffLine;
    }
    if (node.id === HANDOFF_NODE_BACKEND && received) {
      return '已确认';
    }
    if (node.id === HANDOFF_NODE_INTEGRATION && waiting) {
      return handoffLine;
    }
    if (node.id === HANDOFF_NODE_INTEGRATION && received) {
      return '联调进行中';
    }
    return null;
  };

  const buildBrief = useCallback(
    (node: BlueprintNode): DetailBrief => {
      const title = nodeDisplayName(node);
      const status: BlueprintNodeStatus =
        node.id === HANDOFF_NODE_INTEGRATION && received
          ? 'in-progress'
          : node.status;
      const statusLabel =
        node.id === HANDOFF_NODE_INTEGRATION && received
          ? '进行中'
          : BLUEPRINT_STATUS_LABELS[node.status];
      const showDeliveryChip =
        projectId === HANDOFF_PROJECT_ID &&
        (node.id === HANDOFF_NODE_BACKEND ||
          node.id === HANDOFF_NODE_INTEGRATION);
      const enter = () => enterNode(node.id);

      // 坞内主 CTA 一律进入节点；交付跳转留给画布徽章 / 交付弹层
      if (projectId === HANDOFF_PROJECT_ID && node.id === HANDOFF_NODE_BACKEND) {
        if (role === 'alex' && delivery.status === 'draft') {
          return {
            title,
            statusLabel,
            keyLine: delivery.usageNote || node.summary,
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
        if (role === 'alex' && needsRevision) {
          const note = delivery.revisionRequest?.note?.trim();
          return {
            title,
            statusLabel: handoffLine,
            keyLine: note && note !== handoffLine ? note : node.summary,
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
        if (waiting) {
          return {
            title,
            statusLabel,
            keyLine: handoffLine,
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
        if (received) {
          return {
            title,
            statusLabel,
            keyLine: '已确认',
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
      }
      if (
        projectId === HANDOFF_PROJECT_ID &&
        node.id === HANDOFF_NODE_INTEGRATION
      ) {
        if (waitingUpstream) {
          return {
            title,
            statusLabel,
            keyLine: handoffLine,
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
        if (received) {
          return {
            title,
            statusLabel,
            keyLine: delivery.nextStep || '联调进行中',
            actionLabel: '进入节点',
            onAction: enter,
            showDeliveryChip,
          };
        }
      }

      if (status === 'done' || status === 'accepted') {
        return {
          title,
          statusLabel,
          keyLine: outcomeLine(node),
          actionLabel: '进入节点',
          onAction: enter,
          showDeliveryChip,
        };
      }
      if (status === 'todo') {
        return {
          title,
          statusLabel,
          keyLine: prerequisiteLine(node, live),
          actionLabel: '进入节点',
          onAction: enter,
          showDeliveryChip,
        };
      }
      return {
        title,
        statusLabel,
        keyLine: node.summary,
        actionLabel: '进入节点',
        onAction: enter,
        showDeliveryChip,
      };
    },
    [
      delivery,
      enterNode,
      live,
      needsRevision,
      projectId,
      handoffLine,
      received,
      role,
      waiting,
      waitingUpstream,
    ],
  );

  const brief = shown ? buildBrief(shown) : null;

  const bumpZoom = (delta: number) => {
    setZoomPercent((current) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current + delta)),
    );
  };

  const scale = zoomPercent / 100;

  return (
    <StudentShell
      place="blueprint"
      projectName={projectName}
      onNavigate={onNavigate}
    >
      <div className="wbp">
        <div className="wbp-title">
          <div className="wbp-head">
            <div>
              <StudentTrail
                segments={[{ label: projectName }, { label: '蓝图' }]}
              />
              <h1>蓝图</h1>
            </div>
          </div>
        </div>

        <div className="wbp-canvas-frame">
        <div
          className="wbp-canvas-wrap"
          ref={canvasWrapRef}
          onScroll={(event) => {
            canvasScrollRef.current = {
              top: event.currentTarget.scrollTop,
              left: event.currentTarget.scrollLeft,
            };
          }}
        >
          <div
            className="wbp-canvas-slot"
            style={{
              width: Math.round(CANVAS_W * scale),
              height: Math.round(CANVAS_H * scale),
            }}
          >
          <div
            className="wbp-canvas"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            aria-label="蓝图画布"
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest('.wbp-node') ||
                target.closest('.wbp-delivery-badge')
              ) {
                return;
              }
              closeDetail(false);
            }}
          >
            <div className="wbp-stages">
              {STAGES.map((stage) => (
                <section key={stage.id} className="wbp-stage" aria-label={stage.title}>
                  <h2 className="wbp-stage-title">{stage.title}</h2>
                  <p className="wbp-stage-sub">{stage.sub}</p>
                </section>
              ))}
            </div>

            <svg className="wbp-edges" aria-hidden="true">
              <defs>
                <marker
                  id="wbp-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" className="wbp-edge-arrow" />
                </marker>
                <marker
                  id="wbp-arrow-on"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path
                    d="M0,0 L6,3 L0,6 Z"
                    className="wbp-edge-arrow is-related"
                  />
                </marker>
              </defs>
              {edges.map((edge) => {
                const related = relatedEdgeKeys.has(edge.key);
                const on = related || edge.isDelivery;
                return (
                  <path
                    key={edge.key}
                    d={edge.path}
                    className={`wbp-edge${related ? ' is-related' : ''}${edge.isDelivery ? ' is-delivery' : ''}`}
                    markerEnd={on ? 'url(#wbp-arrow-on)' : 'url(#wbp-arrow)'}
                  />
                );
              })}
            </svg>

            {projectId === HANDOFF_PROJECT_ID && deliveryEdge ? (
              <button
                type="button"
                className={`wbp-delivery-badge${
                  received ? ' is-linked' : ' is-open-link'
                }${deliveryLinkIn ? ' is-link-in' : ''}`}
                style={{
                  left: (deliveryEdge.x1 + deliveryEdge.x2) / 2,
                  top: (deliveryEdge.y1 + deliveryEdge.y2) / 2 - 18,
                }}
                aria-label={
                  received
                    ? `${delivery.title} ${delivery.version}，Priya 已确认，打开交付详情`
                    : `${delivery.title} ${delivery.version}，还没有交给 Priya，打开交付详情`
                }
                onClick={(event) => {
                  event.stopPropagation();
                  openDeliveryDock();
                }}
              >
                <span className="wbp-delivery-link" aria-hidden="true">
                  {received ? (
                    <Link2 size={14} strokeWidth={2.25} />
                  ) : (
                    <Unlink size={14} strokeWidth={2.25} />
                  )}
                </span>
                <span className="wbp-delivery-label">
                  {delivery.title} {delivery.version}
                </span>
                <span className="wbp-delivery-tip" role="tooltip">
                  {received ? 'Priya 已确认这版' : '还没有交给 Priya'}
                </span>
              </button>
            ) : null}

            {placed.map((node) => {
              const tone = statusTone(node, received);
              const action = nodeAction(node);
              const statusLabel =
                node.id === HANDOFF_NODE_INTEGRATION && received
                  ? '进行中'
                  : BLUEPRINT_STATUS_LABELS[node.status];
              const face = ownerFace(node.ownerId);
              return (
                <button
                  key={node.id}
                  type="button"
                  data-node={node.id}
                  className={`wbp-node${selectedId === node.id ? ' is-on' : ''}${action ? ' is-handoff' : ''}`}
                  style={{ left: node.x, top: node.y, width: NODE_W, minHeight: NODE_H }}
                  aria-pressed={selectedId === node.id}
                  onClick={() => {
                    if (selectedId === node.id) {
                      closeDetail(true);
                      return;
                    }
                    onSelect(node.id);
                  }}
                >
                  <div className="wbp-node-top">
                    <strong>{node.displayName}</strong>
                    <span
                      className={`wbp-node-mark is-${tone}`}
                      aria-hidden="true"
                    >
                      {tone === 'done' ? <Check size={12} strokeWidth={2.5} /> : null}
                    </span>
                  </div>
                  <div className="wbp-node-meta">
                    <span
                      className="wbp-node-face"
                      title={face.name}
                      aria-label={`负责人 ${face.name}`}
                    >
                      {face.initial}
                    </span>
                    <span className={`wbp-node-status is-${tone}`}>{statusLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>

          {/* 叠在画布视口上，不随内容滚动/平移 */}
          <div className="wbp-canvas-tools" role="toolbar" aria-label="画布工具">
            <div className="wbp-zoom">
              <button
                type="button"
                className="wbp-zoom-btn"
                aria-label="缩小画布"
                disabled={zoomPercent <= ZOOM_MIN}
                onClick={() => bumpZoom(-ZOOM_STEP)}
              >
                <Minus size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="wbp-zoom-value" aria-live="polite">
                {zoomPercent}%
              </span>
              <button
                type="button"
                className="wbp-zoom-btn"
                aria-label="放大画布"
                disabled={zoomPercent >= ZOOM_MAX}
                onClick={() => bumpZoom(ZOOM_STEP)}
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`wbp-dock${
            panelOpen && (deliveryDockOpen || (shown && brief)) ? ' is-open' : ''
          }`}
        >
          {deliveryDockOpen || (shown && brief) ? null : (
            <p className="wbp-overview">{handoffLine}</p>
          )}
          {deliveryDockOpen ? (
            <aside
              ref={detailRef}
              className="wbp-detail"
              aria-label="交付详情"
              aria-hidden={!panelOpen}
            >
              <div
                className={`wbp-detail-body${contentSwap ? ' is-swap' : ''}`}
                key="delivery-dock"
              >
                <div className="wbp-detail-copy">
                  <p className="wbp-detail-kicker">交付</p>
                  <h2>
                    {delivery.title} {delivery.version}
                  </h2>
                  <p className="wbp-detail-summary">{handoffLine}</p>
                  {delivery.usageNote ? (
                    <p className="wbp-detail-summary is-muted">
                      {delivery.usageNote}
                    </p>
                  ) : null}
                </div>
                <div className="wbp-detail-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => closeDetail(false)}
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryDockOpen(false);
                      openDeliveryPage();
                    }}
                  >
                    {role === 'priya' && waiting ? '确认这版' : '查看交付'}
                  </button>
                </div>
              </div>
            </aside>
          ) : shown && brief ? (
            <aside
              ref={detailRef}
              className="wbp-detail"
              aria-label="节点详情"
              aria-hidden={!panelOpen}
            >
              <div
                className={`wbp-detail-body${contentSwap ? ' is-swap' : ''}`}
                key={shown.id}
              >
                <div className="wbp-detail-copy">
                  <h2>{brief.title}</h2>
                  {brief.keyLine ? (
                    <p className="wbp-detail-summary">{brief.keyLine}</p>
                  ) : brief.statusLabel ? (
                    <p className="wbp-detail-summary">{brief.statusLabel}</p>
                  ) : null}
                  {brief.showDeliveryChip ? (
                    <button
                      type="button"
                      className="wbp-delivery-chip"
                      onClick={openDeliveryDock}
                    >
                      {delivery.title} {delivery.version}
                    </button>
                  ) : null}
                </div>
                <div className="wbp-detail-actions">
                  <button type="button" onClick={brief.onAction}>
                    {brief.actionLabel}
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
