/**
 * Shared desktop constants (imported by launch helpers / docs).
 * Keep in sync with electron/main.mjs defaults.
 */

/** Logical canvas the demo is designed against (design shots 1440×960). */
export const LOGICAL_WIDTH = 1440;
export const LOGICAL_HEIGHT = 960;

/**
 * Inset (CSS/DIP px) kept inside screen.workArea so the outer frame
 * (title bar + borders) never sits flush against taskbar / screen edges.
 */
export const WORK_AREA_MARGIN = 8;

/**
 * Default Vite/demo origin from vite.config.ts `server.port: 5173`.
 * Frontend continues to call same-origin `/api/*`; keys stay on the server.
 */
export const DEFAULT_DEV_URL = 'http://localhost:5173';

export const ENV_URL_KEY = 'COTRACE_DESKTOP_URL';
