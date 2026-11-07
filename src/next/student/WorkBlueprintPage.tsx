import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { BlueprintNode, BlueprintNodeStatus } from '../../types';
import { BLUEPRINT_STATUS_LABELS } from '../../data/blueprint';
import { getBlueprintNodeDetail } from '../../data/blueprintDetail';
import { useDelivery } from '../../data/deliveryStore';
import { useDemoRole } from '../../data/demoRoleStore';
import { applyDeliveryToBlueprint } from '../../data/handoffBlueprint';
import {
  HANDOFF_NODE_BACKEND,
  HANDOFF_NODE_INTEGRATION,
  HANDOFF_PROJECT_ID,
} from '../../data/handoffDemoSeed';
import { StudentShell, type StudentPlace } from './StudentShell';
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
}: {
  projectName: string;
  reason: string;
  onNavigate: (place: StudentPlace) => void;
}) {
  return (
    <StudentShell
      place="blueprint"
      projectName={projectName}
      onNavigate={onNavigate}
    >
      <div className="wbp">
        <p className="wbp-kicker">{projectName}</p>
        <div className="wbp-head">
          <h1>工作蓝图</h1>
        </div>
        <div className="wbp-empty" role="status">
          <h2>暂无工作蓝图</h2>
          <p>{reason}</p>
          <button type="button" onClick={() => onNavigate('history')}>
            查看项目记忆
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
};

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
  onOpenNode,
}: WorkBlueprintPageProps) {
  const delivery = useDelivery();
  const role = useDemoRole();
  const live =
    projectId === HANDOFF_PROJECT_ID ? applyDeliveryToBlueprint(nodes) : nodes;

  const waiting = delivery.status === 'published';
  const needsRevision = delivery.status === 'needs-revision';
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
  const panelOpenRef = useRef(Boolean(selected));
  const shownIdRef = useRef(selected?.id ?? null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef({ top: 0, left: 0 });
  const detailRef = useRef<HTMLElement>(null);
  const lastFocusedNodeId = useRef<string | null>(null);

  const closeDetail = useCallback(
    (restoreFocus: boolean) => {
      const focusId = lastFocusedNodeId.current ?? selectedId;
      panelOpenRef.current = false;
      shownIdRef.current = null;
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

  useEffect(() => {
    if (selected) {
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
    panelOpenRef.current = false;
    shownIdRef.current = null;
    setPanelOpen(false);
    setContentSwap(false);
  }, [selectedId, reduceMotion, selected]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDetail(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closeDetail]);

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

  const nodeAction = (node: BlueprintNode): string | null => {
    if (node.id === HANDOFF_NODE_BACKEND && delivery.status === 'draft' && role === 'alex') {
      return '发布交付';
    }
    if (node.id === HANDOFF_NODE_BACKEND && waiting) {
      return '已发布 · 等待确认接收';
    }
    if (node.id === HANDOFF_NODE_BACKEND && received) {
      return `已交接 ${delivery.version}`;
    }
    if (node.id === HANDOFF_NODE_INTEGRATION && waiting) {
      return `等待确认接收 · ${delivery.version}`;
    }
    if (node.id === HANDOFF_NODE_INTEGRATION && received) {
      return '联调进行中';
    }
    return null;
  };

  const buildBrief = useCallback(
    (node: BlueprintNode): DetailBrief => {
      const title =
        projectId === HANDOFF_PROJECT_ID && node.id === HANDOFF_NODE_BACKEND
          ? `后端接口 · ${delivery.title} ${delivery.version}`
          : nodeDisplayName(node);
      const status: BlueprintNodeStatus =
        node.id === HANDOFF_NODE_INTEGRATION && received
          ? 'in-progress'
          : node.status;
      const statusLabel =
        node.id === HANDOFF_NODE_INTEGRATION && received
          ? '进行中'
          : BLUEPRINT_STATUS_LABELS[node.status];

      // 交付相关：突出当前可执行的发布 / 接收 / 查看
      if (projectId === HANDOFF_PROJECT_ID && node.id === HANDOFF_NODE_BACKEND) {
        if (role === 'alex' && delivery.status === 'draft') {
          return {
            title,
            statusLabel,
            keyLine: delivery.usageNote || node.summary,
            actionLabel: '上传并发布',
            onAction: () => onNavigate('publish'),
          };
        }
        if (role === 'alex' && needsRevision) {
          return {
            title,
            statusLabel: '待修改',
            keyLine:
              delivery.revisionRequest?.note ||
              `按 Priya 意见修订 ${delivery.version} 后重发`,
            actionLabel: '修订并重发',
            onAction: () => onNavigate('publish'),
          };
        }
        if (waiting) {
          // Alex 看发送方回执；Priya 必须进接收页才能确认，避免落在「等待 Priya」回执
          return {
            title,
            statusLabel,
            keyLine: `已发布 ${delivery.version} · 等待确认接收`,
            actionLabel:
              role === 'priya' ? `打开并确认接收 ${delivery.version}` : '查看已发布交付',
            onAction: () =>
              onNavigate(role === 'priya' ? 'receive' : 'publish'),
          };
        }
        if (received) {
          return {
            title,
            statusLabel,
            keyLine: `已交接 ${delivery.version} · 可回看交付材料`,
            actionLabel: '查看交付',
            onAction: () =>
              onNavigate(role === 'priya' ? 'receive' : 'publish'),
          };
        }
      }
      if (
        projectId === HANDOFF_PROJECT_ID &&
        node.id === HANDOFF_NODE_INTEGRATION
      ) {
        if (waiting) {
          return {
            title,
            statusLabel,
            keyLine: `等待确认接收 ${delivery.title} ${delivery.version}`,
            actionLabel:
              role === 'priya'
                ? `确认接收 ${delivery.version}`
                : '查看等待确认接收',
            onAction: () => onNavigate('receive'),
          };
        }
        if (received) {
          return {
            title,
            statusLabel,
            keyLine: delivery.nextStep || '联调进行中',
            actionLabel: '查看已接收交付',
            onAction: () => onNavigate('receive'),
          };
        }
      }

      if (status === 'done' || status === 'accepted') {
        return {
          title,
          statusLabel,
          keyLine: outcomeLine(node),
          actionLabel: '回看成果',
          onAction: () => onOpenNode(node.id),
        };
      }
      if (status === 'todo') {
        return {
          title,
          statusLabel,
          keyLine: prerequisiteLine(node, live),
          actionLabel: '查看任务说明',
          onAction: () => onOpenNode(node.id),
        };
      }
      return {
        title,
        statusLabel,
        keyLine: node.summary,
        actionLabel: '进入个人工作',
        onAction: () => onOpenNode(node.id),
      };
    },
    [
      delivery,
      live,
      needsRevision,
      onNavigate,
      onOpenNode,
      projectId,
      received,
      role,
      waiting,
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
        <p className="wbp-kicker">{projectName}</p>
        <div className="wbp-head">
          <h1>工作蓝图</h1>
        </div>

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
            aria-label="任务蓝图画布"
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest('.wbp-node') ||
                target.closest('.wbp-zoom') ||
                target.closest('.wbp-canvas-tools')
              ) {
                return;
              }
              onSelect(null);
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
              <div
                className="wbp-delivery-badge"
                style={{
                  left: (deliveryEdge.x1 + deliveryEdge.x2) / 2,
                  top: (deliveryEdge.y1 + deliveryEdge.y2) / 2 - 18,
                }}
                aria-label={`${delivery.title} ${delivery.version} 交付标识`}
              >
                {delivery.title} {delivery.version}
                <em>
                  · {delivery.status === 'draft'
                    ? 'Alex → Priya'
                    : delivery.status === 'published'
                      ? '已发布 · 待 Priya'
                      : 'Alex → Priya 已接手'}
                </em>
              </div>
            ) : null}

            {placed.map((node) => {
              const tone = statusTone(node, received);
              const action = nodeAction(node);
              const statusLabel =
                node.id === HANDOFF_NODE_INTEGRATION && received
                  ? '进行中'
                  : BLUEPRINT_STATUS_LABELS[node.status];
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
                  <span className={`wbp-node-status is-${tone}`}>{statusLabel}</span>
                  {action ? <em className="wbp-node-action">{action}</em> : null}
                </button>
              );
            })}
          </div>
          </div>

          {/* 固定在画布框架底部工具条，不随画布内容平移/缩放 */}
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

        <div className={`wbp-dock${panelOpen ? ' is-open' : ''}`}>
          <p className="wbp-overview">
            点击节点查看目标、进展或成果。交付和进入工作都在节点详情里。
          </p>
          {shown && brief ? (
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
                  <p className="wbp-detail-kicker">{brief.statusLabel}</p>
                  <h2>{brief.title}</h2>
                  <p className="wbp-detail-summary">{brief.keyLine}</p>
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
