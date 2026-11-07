/**
 * CoTrace Electron desktop shell.
 *
 * Loads the already-running Vite/demo server full-bleed in a BrowserWindow
 * whose *logical* layout is 1440×960 CSS pixels — matching design shots under
 * newuichange/_shots/. No BrowserView letterboxing; no black side gutters.
 *
 * Scaling approach (window layer):
 *   1. Prefer content size = 1440×960 (useContentSize), but shrink to fit the
 *      display workArea (taskbar / DPI) so the outer frame is never clipped.
 *   2. Page loads directly in the window (full-bleed, edge-to-edge).
 *   3. Window aspect locked to 1440:960 so resize never introduces bars.
 *   4. webContents.setZoomFactor(contentW/1440) keeps CSS layout at 1440×960
 *      while pixels fill the window 100%.
 *   5. Window is centered inside screen.workArea.
 *
 * Default URL: http://localhost:5173 (vite.config.ts server.port).
 * Override: COTRACE_DESKTOP_URL
 *
 * No API keys here — AI stays on the CoTrace/Vite server via /api/*.
 */

import { app, BrowserWindow, dialog, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  WORK_AREA_MARGIN,
  DEFAULT_DEV_URL,
} from './config.mjs';

const ASPECT = LOGICAL_WIDTH / LOGICAL_HEIGHT;

/** Matches vite.config.ts `server.port` (and demo verify scripts). */
const APP_URL = (process.env.COTRACE_DESKTOP_URL || DEFAULT_DEV_URL).replace(
  /\/$/,
  '',
);

const VERIFY =
  process.env.COTRACE_DESKTOP_VERIFY === '1' ||
  process.env.COTRACE_DESKTOP_VERIFY === 'true';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
/** Avoid feedback loops while we correct aspect on resize. */
let enforcingAspect = false;
/** Last fitted content size (updated by fitWindowToWorkArea). */
let fittedContent = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

function applyCanvasZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [contentWidth] = mainWindow.getContentSize();
  const scale = Math.max(0.25, contentWidth / LOGICAL_WIDTH);
  mainWindow.webContents.setZoomFactor(scale);
}

function measureWindowChrome(win) {
  const [frameW, frameH] = win.getSize();
  const [contentW, contentH] = win.getContentSize();
  return {
    chromeW: Math.max(0, frameW - contentW),
    chromeH: Math.max(0, frameH - contentH),
  };
}

/**
 * Shrink content size (keeping 3:2) so outer window + margin fits workArea.
 * Prefer full 1440×960 when it fits; never crop by overflowing the screen.
 */
function computeFittedContentSize(workArea, chromeW, chromeH) {
  const usableW = Math.max(1, workArea.width - WORK_AREA_MARGIN * 2);
  const usableH = Math.max(1, workArea.height - WORK_AREA_MARGIN * 2);
  const maxContentW = Math.max(1, usableW - chromeW);
  const maxContentH = Math.max(1, usableH - chromeH);

  const scale = Math.min(
    1,
    maxContentW / LOGICAL_WIDTH,
    maxContentH / LOGICAL_HEIGHT,
  );
  let contentW = Math.max(1, Math.floor(LOGICAL_WIDTH * scale));
  let contentH = Math.max(1, Math.round(contentW / ASPECT));

  if (contentH > maxContentH) {
    contentH = maxContentH;
    contentW = Math.max(1, Math.round(contentH * ASPECT));
  }
  if (contentW > maxContentW) {
    contentW = maxContentW;
    contentH = Math.max(1, Math.round(contentW / ASPECT));
  }

  return {
    width: contentW,
    height: contentH,
    scale: contentW / LOGICAL_WIDTH,
  };
}

function centerWindowInWorkArea(win, workArea) {
  const [ww, wh] = win.getSize();
  let x = Math.round(workArea.x + (workArea.width - ww) / 2);
  let y = Math.round(workArea.y + (workArea.height - wh) / 2);
  // Clamp so the outer frame stays inside workArea when possible.
  const maxX = workArea.x + Math.max(0, workArea.width - ww);
  const maxY = workArea.y + Math.max(0, workArea.height - wh);
  x = Math.min(Math.max(workArea.x, x), maxX);
  y = Math.min(Math.max(workArea.y, y), maxY);
  win.setPosition(x, y);
}

/**
 * Fit + center the window for the display that currently owns it.
 * Returns the applied content size / scale for logging & verify.
 */
function fitWindowToWorkArea(win = mainWindow) {
  if (!win || win.isDestroyed()) return null;

  const bounds = win.getBounds();
  const display =
    screen.getDisplayMatching(bounds) || screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const { chromeW, chromeH } = measureWindowChrome(win);
  const fitted = computeFittedContentSize(workArea, chromeW, chromeH);

  enforcingAspect = true;
  try {
    win.setContentSize(fitted.width, fitted.height);
  } finally {
    enforcingAspect = false;
  }

  // Re-measure chrome after resize (Windows title-bar metrics can shift).
  const chromeAfter = measureWindowChrome(win);
  const refit = computeFittedContentSize(
    workArea,
    chromeAfter.chromeW,
    chromeAfter.chromeH,
  );
  if (refit.width !== fitted.width || refit.height !== fitted.height) {
    enforcingAspect = true;
    try {
      win.setContentSize(refit.width, refit.height);
    } finally {
      enforcingAspect = false;
    }
  }

  centerWindowInWorkArea(win, workArea);
  applyCanvasZoom();

  const [cw, ch] = win.getContentSize();
  const [ww, wh] = win.getSize();
  fittedContent = { width: cw, height: ch };
  const scale = cw / LOGICAL_WIDTH;

  console.log(
    `[cotrace-desktop] fit workArea ${workArea.width}×${workArea.height}` +
      ` chrome ${chromeAfter.chromeW}×${chromeAfter.chromeH}` +
      ` → content ${cw}×${ch} (zoom ${scale.toFixed(3)})` +
      ` outer ${ww}×${wh}`,
  );

  return {
    width: cw,
    height: ch,
    scale,
    contentSize: { width: cw, height: ch },
    windowSize: { width: ww, height: wh },
    workArea: {
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
    },
    chrome: chromeAfter,
  };
}

/**
 * Keep content aspect exactly 1440:960 so the zoomed page always fills
 * edge-to-edge (no pillarbox/letterbox gutters).
 */
function enforceAspectFromWidth() {
  if (!mainWindow || mainWindow.isDestroyed() || enforcingAspect) return;
  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  const targetHeight = Math.max(1, Math.round(contentWidth / ASPECT));
  if (contentHeight === targetHeight) {
    applyCanvasZoom();
    return;
  }
  enforcingAspect = true;
  try {
    mainWindow.setContentSize(contentWidth, targetHeight);
  } finally {
    enforcingAspect = false;
  }
  applyCanvasZoom();
}

function showLoadFailure(detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'CoTrace Desktop',
    message: 'Could not load the CoTrace demo server.',
    detail:
      detail ||
      `Expected a running Vite/demo server at ${APP_URL}.\n` +
        'Start it first (e.g. npm run dev), then relaunch Electron.',
  });
}

function createWindow() {
  // Seed size from primary workArea so first paint already fits (then refine).
  const primaryWork = screen.getPrimaryDisplay().workArea;
  const seedChromeW = process.platform === 'win32' ? 16 : 0;
  const seedChromeH = process.platform === 'win32' ? 40 : 28;
  const seed = computeFittedContentSize(primaryWork, seedChromeW, seedChromeH);

  mainWindow = new BrowserWindow({
    title: 'CoTrace Demo',
    width: seed.width,
    height: seed.height,
    useContentSize: true,
    minWidth: Math.round(LOGICAL_WIDTH * 0.4),
    minHeight: Math.round(LOGICAL_HEIGHT * 0.4),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Exact logical canvas when it fits; otherwise scaled 3:2 content.
  fitWindowToWorkArea(mainWindow);
  // Platform aspect lock when available; resize handler is the fallback.
  if (typeof mainWindow.setAspectRatio === 'function') {
    mainWindow.setAspectRatio(ASPECT);
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = aborted
    console.error(`[cotrace-desktop] load failed (${code}): ${desc} @ ${url}`);
    showLoadFailure(`${desc} (${code})\nURL: ${url}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    applyCanvasZoom();
  });

  mainWindow.webContents
    .loadURL(APP_URL)
    .catch((err) => {
      console.error('[cotrace-desktop] loadURL error:', err);
      showLoadFailure(String(err?.message || err));
    });

  mainWindow.on('will-resize', (event, newBounds) => {
    // Keep outer resize on-aspect using content-size math where possible.
    if (enforcingAspect) return;
    const frame = mainWindow.getSize();
    const content = mainWindow.getContentSize();
    const chromeW = frame[0] - content[0];
    const chromeH = frame[1] - content[1];
    const nextContentW = Math.max(1, newBounds.width - chromeW);
    const nextContentH = Math.max(1, Math.round(nextContentW / ASPECT));
    const corrected = {
      ...newBounds,
      width: nextContentW + chromeW,
      height: nextContentH + chromeH,
    };
    if (
      corrected.width !== newBounds.width ||
      corrected.height !== newBounds.height
    ) {
      event.preventDefault();
      enforcingAspect = true;
      try {
        mainWindow.setBounds(corrected);
      } finally {
        enforcingAspect = false;
      }
      applyCanvasZoom();
    }
  });

  mainWindow.on('resize', () => {
    enforceAspectFromWidth();
  });
  mainWindow.on('maximize', () => {
    // Maximized rarely matches 3:2; leave maximize free then re-fit on restore.
    applyCanvasZoom();
  });
  mainWindow.on('unmaximize', () => {
    fitWindowToWorkArea(mainWindow);
  });
  mainWindow.on('enter-full-screen', applyCanvasZoom);
  mainWindow.on('leave-full-screen', () => {
    fitWindowToWorkArea(mainWindow);
  });

  mainWindow.once('ready-to-show', () => {
    const fit = fitWindowToWorkArea(mainWindow);
    applyCanvasZoom();
    const [cw, ch] = mainWindow.getContentSize();
    console.log(
      `[cotrace-desktop] content size ${cw}×${ch}` +
        ` (logical ${LOGICAL_WIDTH}×${LOGICAL_HEIGHT}` +
        `, scale ${((fit && fit.scale) || cw / LOGICAL_WIDTH).toFixed(3)})`,
    );
    mainWindow.show();
    if (VERIFY) {
      void runVerifyCapture(fit);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * One-shot acceptance capture (COTRACE_DESKTOP_VERIFY=1):
 * content size, zoom, edge pixel sample (black-bar detect), PNG screenshot.
 * OK when the window fits workArea, keeps 3:2, and zoom matches contentW/1440.
 */
async function runVerifyCapture(fitInfo) {
  const outDir = path.join(__dirname, '_verify');
  fs.mkdirSync(outDir, { recursive: true });
  try {
    // Allow first paint after show.
    await new Promise((r) => setTimeout(r, 1200));
    if (!mainWindow || mainWindow.isDestroyed()) {
      app.exit(1);
      return;
    }
    const fit = fitInfo || fitWindowToWorkArea(mainWindow);
    applyCanvasZoom();
    const [cw, ch] = mainWindow.getContentSize();
    const [ww, wh] = mainWindow.getSize();
    const [wx, wy] = mainWindow.getPosition();
    const zoom = mainWindow.webContents.getZoomFactor();
    const expectedZoom = cw / LOGICAL_WIDTH;
    const aspectOk = Math.abs(cw / ch - ASPECT) < 0.01;
    const workArea = fit?.workArea || screen.getPrimaryDisplay().workArea;
    const fitsWorkArea =
      wx >= workArea.x - 1 &&
      wy >= workArea.y - 1 &&
      wx + ww <= workArea.x + workArea.width + 1 &&
      wy + wh <= workArea.y + workArea.height + 1;

    const metrics = await mainWindow.webContents.executeJavaScript(`(async () => {
      let apiHealth = null;
      try {
        const res = await fetch('/api/health');
        apiHealth = { status: res.status, body: await res.json() };
      } catch (e) {
        apiHealth = { error: String(e && e.message ? e.message : e) };
      }
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        href: location.href,
        readyState: document.readyState,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        rootChildCount: document.body?.children?.length ?? 0,
        apiHealth,
      };
    })()`);

    const image = await mainWindow.webContents.capturePage();
    const size = image.getSize();
    const pngPath = path.join(outDir, 'desktop-1440x960.png');
    fs.writeFileSync(pngPath, image.toPNG());

    // Sample left/right edge columns for near-black pillarbox gutters.
    const bitmap = image.toBitmap();
    const { width, height } = size;
    const bytesPerPixel = 4; // BGRA on most platforms
    function avgLumaAtX(x) {
      let sum = 0;
      const samples = 20;
      for (let i = 0; i < samples; i++) {
        const y = Math.floor(((i + 0.5) / samples) * height);
        const idx = (y * width + x) * bytesPerPixel;
        const b = bitmap[idx];
        const g = bitmap[idx + 1];
        const r = bitmap[idx + 2];
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      return sum / samples;
    }
    const leftEdge = avgLumaAtX(2);
    const rightEdge = avgLumaAtX(Math.max(0, width - 3));
    const mid = avgLumaAtX(Math.floor(width / 2));
    // Near-black edge while mid is clearly brighter => classic letterbox/pillarbox.
    const blackThreshold = 18;
    const hasBlackSideBars =
      leftEdge < blackThreshold &&
      rightEdge < blackThreshold &&
      mid > blackThreshold + 40;

    const report = {
      ok:
        aspectOk &&
        fitsWorkArea &&
        !hasBlackSideBars &&
        Math.abs(zoom - expectedZoom) < 0.05,
      contentSize: { width: cw, height: ch },
      windowSize: { width: ww, height: wh },
      windowPosition: { x: wx, y: wy },
      fittedContent,
      workArea,
      fitsWorkArea,
      aspectOk,
      zoomFactor: zoom,
      expectedZoom,
      captureSize: size,
      edgeLuma: { left: leftEdge, right: rightEdge, mid },
      hasBlackSideBars,
      metrics,
      screenshot: pngPath,
      url: APP_URL,
      ts: new Date().toISOString(),
    };
    const reportPath = path.join(outDir, 'desktop-verify.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('[cotrace-desktop] verify report:', reportPath);
    console.log(JSON.stringify(report, null, 2));
    app.exit(report.ok ? 0 : 2);
  } catch (err) {
    console.error('[cotrace-desktop] verify failed:', err);
    app.exit(1);
  }
}

app.whenReady().then(() => {
  createWindow();

  // Re-fit if the user plugs in a different monitor / changes DPI / taskbar.
  screen.on('display-metrics-changed', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
      applyCanvasZoom();
      return;
    }
    fitWindowToWorkArea(mainWindow);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
