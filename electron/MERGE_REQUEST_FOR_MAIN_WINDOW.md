# MERGE REQUEST FOR MAIN WINDOW

Desktop entry files live under `electron/` + `scripts/electron-dev.mjs`.
Root `package.json` should expose `desktop` / `desktop:dev` scripts and an
`electron` devDependency (applied on the main workspace).

## Applied on main workspace

- `electron/main.mjs` — full-bleed BrowserWindow, content size 1440×960,
  aspect locked; `setZoomFactor` keeps CSS at 1440×960 with no letterbox bars
- `electron/config.mjs` — shared constants
- `scripts/electron-dev.mjs` — launcher
- Root scripts: `desktop`, `desktop:dev`
- Root devDependency: `electron@^36.0.0`

## Runtime

| Item | Value |
|------|--------|
| Dev URL | `http://localhost:5173` |
| Override | `COTRACE_DESKTOP_URL` or `node scripts/electron-dev.mjs <url>` |
| API | Same-origin `/api/*` on that server; keys stay server-side |
| Logical size | 1440×960 CSS px (content area fills window edge-to-edge) |

## How to run

```bash
npm install
npm run dev
# other terminal:
npm run desktop
```

If Electron binary download fails (common in CN):

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install -D electron@^36.0.0
```

Do **not** put DeepSeek keys in Electron or Vite `define` / `envPrefix`.
