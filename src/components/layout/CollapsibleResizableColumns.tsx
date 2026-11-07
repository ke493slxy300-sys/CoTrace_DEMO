import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ColumnPrefs = {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
};

type CollapsibleResizableColumnsProps = {
  storageKey: string;
  className?: string;
  ariaLabel?: string;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  leftRailLabel?: string;
  rightRailLabel?: string;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  minCenterWidth?: number;
};

const COLLAPSED_RAIL = 14;
const HANDLE = 6;
const DEFAULT_LEFT = 216;
const DEFAULT_RIGHT = 412;

function readPrefs(storageKey: string, defaults: ColumnPrefs): ColumnPrefs {
  if (typeof window === "undefined" || !window.sessionStorage) return defaults;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ColumnPrefs>;
    return {
      leftWidth:
        typeof parsed.leftWidth === "number" && parsed.leftWidth > 0
          ? parsed.leftWidth
          : defaults.leftWidth,
      rightWidth:
        typeof parsed.rightWidth === "number" && parsed.rightWidth > 0
          ? parsed.rightWidth
          : defaults.rightWidth,
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
    };
  } catch {
    return defaults;
  }
}

function writePrefs(storageKey: string, prefs: ColumnPrefs) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function CollapsibleResizableColumns({
  storageKey,
  className = "",
  ariaLabel,
  left,
  center,
  right,
  leftRailLabel = "展开左侧",
  rightRailLabel = "展开右侧",
  defaultLeftWidth = DEFAULT_LEFT,
  defaultRightWidth = DEFAULT_RIGHT,
  minLeftWidth = 160,
  minRightWidth = 260,
  minCenterWidth = 280,
}: CollapsibleResizableColumnsProps) {
  const defaults: ColumnPrefs = {
    leftWidth: defaultLeftWidth,
    rightWidth: defaultRightWidth,
    leftCollapsed: false,
    rightCollapsed: false,
  };
  const [prefs, setPrefs] = useState<ColumnPrefs>(() =>
    readPrefs(storageKey, defaults),
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    writePrefs(storageKey, prefs);
  }, [prefs, storageKey]);

  const updatePrefs = useCallback((patch: Partial<ColumnPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const onPointerDown = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startWidth = side === "left" ? prefs.leftWidth : prefs.rightWidth;
      dragRef.current = { side, startX: event.clientX, startWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [prefs.leftWidth, prefs.rightWidth],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      const root = rootRef.current;
      if (!drag || !root) return;
      const total = root.getBoundingClientRect().width;
      const delta = event.clientX - drag.startX;
      const handles = HANDLE * 2;

      if (drag.side === "left") {
        const other = prefs.rightCollapsed ? COLLAPSED_RAIL : prefs.rightWidth;
        const max = Math.max(
          minLeftWidth,
          total - other - minCenterWidth - handles,
        );
        const next = Math.round(
          Math.min(max, Math.max(minLeftWidth, drag.startWidth + delta)),
        );
        updatePrefs({ leftWidth: next, leftCollapsed: false });
        return;
      }

      const other = prefs.leftCollapsed ? COLLAPSED_RAIL : prefs.leftWidth;
      const max = Math.max(
        minRightWidth,
        total - other - minCenterWidth - handles,
      );
      const next = Math.round(
        Math.min(max, Math.max(minRightWidth, drag.startWidth - delta)),
      );
      updatePrefs({ rightWidth: next, rightCollapsed: false });
    },
    [
      minCenterWidth,
      minLeftWidth,
      minRightWidth,
      prefs.leftCollapsed,
      prefs.leftWidth,
      prefs.rightCollapsed,
      prefs.rightWidth,
      updatePrefs,
    ],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const leftCol = prefs.leftCollapsed
    ? `${COLLAPSED_RAIL}px`
    : `${prefs.leftWidth}px`;
  const rightCol = prefs.rightCollapsed
    ? `${COLLAPSED_RAIL}px`
    : `${prefs.rightWidth}px`;

  const style = {
    gridTemplateColumns: `${leftCol} ${HANDLE}px minmax(0, 1fr) ${HANDLE}px ${rightCol}`,
  } as CSSProperties;

  return (
    <main
      ref={rootRef}
      className={`workbench-columns ${className}`.trim()}
      aria-label={ariaLabel}
      style={style}
    >
      <div
        className={`workbench-col workbench-col-left${
          prefs.leftCollapsed ? " is-collapsed" : ""
        }`}
      >
        {prefs.leftCollapsed ? (
          <button
            type="button"
            className="workbench-rail-btn is-left"
            aria-label={`展开${leftRailLabel}`}
            title={`展开${leftRailLabel}`}
            onClick={() => updatePrefs({ leftCollapsed: false })}
          >
            <ChevronRight
              className="workbench-rail-arrow"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        ) : (
          <>
            <div className="workbench-col-body">{left}</div>
            <button
              type="button"
              className="workbench-collapse-btn is-left"
              aria-label="折叠左侧"
              title="折叠左侧"
              onClick={() => updatePrefs({ leftCollapsed: true })}
            >
              <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        className={`workbench-resize-handle${
          prefs.leftCollapsed ? " is-disabled" : ""
        }`}
        aria-label="拖动调整左侧宽度"
        title={prefs.leftCollapsed ? undefined : "拖动调整宽度"}
        disabled={prefs.leftCollapsed}
        onPointerDown={(e) => onPointerDown("left", e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="workbench-col workbench-col-center">
        <div className="workbench-col-body">{center}</div>
      </div>

      <button
        type="button"
        className={`workbench-resize-handle${
          prefs.rightCollapsed ? " is-disabled" : ""
        }`}
        aria-label="拖动调整右侧宽度"
        title={prefs.rightCollapsed ? undefined : "拖动调整宽度"}
        disabled={prefs.rightCollapsed}
        onPointerDown={(e) => onPointerDown("right", e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div
        className={`workbench-col workbench-col-right${
          prefs.rightCollapsed ? " is-collapsed" : ""
        }`}
      >
        {prefs.rightCollapsed ? (
          <button
            type="button"
            className="workbench-rail-btn is-right"
            aria-label={`展开${rightRailLabel}`}
            title={`展开${rightRailLabel}`}
            onClick={() => updatePrefs({ rightCollapsed: false })}
          >
            <ChevronLeft
              className="workbench-rail-arrow"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        ) : (
          <>
            <div className="workbench-col-body">{right}</div>
            <button
              type="button"
              className="workbench-collapse-btn is-right"
              aria-label="折叠右侧"
              title="折叠右侧"
              onClick={() => updatePrefs({ rightCollapsed: true })}
            >
              <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </main>
  );
}
