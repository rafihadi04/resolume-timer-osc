# Resolume Arena Timer - Progress Report

Last updated: 2026-10-30
Repo: `E:\Project\Resolume-Timer`
Branch: `main` (working tree modified, not committed)

---

## 1. Current Status

The app is now a working Electron application matching most of `AGENTS.md`.

The previously blank packaged app is fixed. A locally built portable exe was launched and verified with a real screenshot:

- `dist/Resolume Timer 1.0.0.exe`
- Renderer entry loads from `dist-renderer/index.html` inside `app.asar`
- UI renders, timer runs, and Resolume REST/OSC output was validated against both a mock server and the live Resolume Arena 7.28 instance on this laptop
- Live REST discovery found the real Text Block source and successfully pushed timer text to it (original value restored afterward)

---

## 2. Root Causes of the Blank UI

Two separate problems existed:

1. **No React mount**
   - `src/renderer/App.jsx` only exported the `App` component.
   - Nothing called `createRoot(...).render(<App />)`, so the page body stayed empty.
   - Fixed by adding `src/renderer/main.jsx` and pointing `src/renderer/index.html` at it.

2. **Renderer output collided with electron-builder output**
   - Vite originally built into `dist/`, which is also electron-builder's output directory.
   - electron-builder excludes its own output directory from `app.asar`, so the packaged app had no renderer HTML.
   - Fixed by building the renderer into `dist-renderer/` and explicitly including it in `electron-builder.json`.

An earlier intermediate fix made text exist in the DOM, but the text was dark-on-dark and still looked blank. The final rebuild uses a styled dark UI with light text.

---

## 3. Main Files Changed

### Main process

- `src/main/index.js`
  - Creates the BrowserWindow with preload + context isolation.
  - Loads Vite dev server in dev and `dist-renderer/index.html` in production.
  - Registers IPC handlers.
  - Starts the LAN remote HTTP server on an OS-assigned port (`listen(0)`).
  - Opens external links in the system browser.
  - Logs renderer load failures.

- `src/main/remote.html` (new)
  - Phone-facing remote page served by the main process.
  - Renders live timer text, phase, mode, and progress; polls `/api/state` every 500 ms.
  - Buttons: start/pause/resume, reset, +/- 1 min, +/- 10 sec (POST `/api/command`).

- `src/main/preload.js` (new)
  - Exposes `window.api`:
    - `discover(settings)`
    - `health(settings)`
    - `pushText(payload)`
    - `pushColor(payload)`
    - `triggerResolume(payload)`
    - `remoteInfo()`
    - `remoteUpdateState(state)`
    - `onRemoteCommand(callback)`
    - `openExternal(url)`
    - `version()`

- `src/main/osc-client.js`
  - Custom OSC UDP encoder using `dgram` (no `osc` dependency).
  - Sends string arguments to one or more OSC addresses.
  - Tracks last send status for health display.

- `src/main/rest-client.js`
  - Resolume REST client using Node `fetch`.
  - `GET /api/v1/composition`
  - `GET /api/v1/parameter/by-id/{id}`
  - `PUT /api/v1/parameter/by-id/{id}` (verified `204` on Arena 7.28)
  - Legacy fallback `PUT /api/v1/param/by-id/{id}/value` only when `/parameter/...` returns 404/405.
  - Scans the real Arena 7.28 shape: `clip.video.sourceparams.Text`, `clip.video.effects`, `layer.video.effects`, `group.video.effects`, `composition.video.effects`.
  - Uses parameter objects for names (`layer.name.value`, `clip.name.value`).
  - Extracts the text parameter ID and OSC paths.
  - Extracts the sibling `Color` (`ParamColor`) parameter and its ID for color sync.
  - `trigger(settings, path)` POSTs to the Resolume connect endpoints.

### Renderer

- `src/renderer/main.jsx` (new)
- `src/renderer/App.jsx`
- `src/renderer/styles.css` (new)
- `src/renderer/i18n.js` (new)
- `src/renderer/lib/time.js` (new)
- `src/renderer/hooks/useTimer.js` (new)
- `src/renderer/components/TimerDisplay.jsx`
- `src/renderer/components/TimeControls.jsx`
- `src/renderer/components/OscSettings.jsx`
- `src/renderer/components/PresetManager.jsx`
- `src/renderer/components/QrisDonateModal.jsx`
- `src/renderer/locales/en.json`
- `src/renderer/locales/id.json`

### Build/config

- `vite.config.js`
  - Renderer output: `dist-renderer/`
  - `publicDir`: `assets/` so `qris-donation.png` is copied into the renderer build.
  - Fixed dev port 5173.

- `electron-builder.json`
  - Packages `dist-renderer/**/*`, `src/main/**/*`, `assets/**/*`, `package.json`.

- `package.json`
  - Removed unused `osc` and `axios` dependencies.
  - Added `wait-on`.
  - Added local packaging script:
    - `npm run build:win-portable:local`

- `.gitignore`
  - Added `dist-renderer/`.

---

## 4. Implemented Features

### Timer engine

- Countdown
- Count up
- Countdown then overtime count-up
- Start / pause / resume / reset / restart
- Speed multipliers: `0.25x`, `0.5x`, `1x`, `1.25x`, `1.5x`, `2x`, custom
- Warning threshold
- Running / warning / timeout colors
- Progress bar
- Elapsed / remaining / overtime stats

### Controls

- Quick adjust: `+/- 1 hr`, `5 min`, `1 min`, `10 sec`
- Manual time input: `HH:MM:SS` or total seconds
- Time's-up flashing:
  - Toggle on/off
  - Alternate message
  - Frequency in Hz

### Presets

- Save
- Update existing preset with current settings
- Load
- Delete
- Export JSON
- Import JSON
- Stored in `localStorage`

### i18n

- English (`en`)
- Bahasa Indonesia (`id`)
- Language selector in header
- Persisted in `localStorage`

### QRIS donation

- Header button labelled **Donate**, opens a QRIS-only modal.
- No Buy Me a Coffee / Ko-fi or other payment links.
- QR is generated at runtime from `VITE_QR_STATIC` (fallback `VITE_QRIS_STATIC`).
- GitHub Actions passes the repository variable `QR_STATIC` into both env names at build time.
- Empty payload shows a "not configured" message instead of a fake QR.
- Escape/overlay close.

### Resolume output

- REST composition discovery
- Text Block source/effect target list
- Parameter ID extraction
- REST update via `PUT /api/v1/parameter/by-id/{id}` (with legacy fallback)
- OSC fallback / OSC-only mode
- Send modes: Auto, REST only, OSC only
- Test send
- REST + OSC health indicators
- Automatic live timer text push when enabled
- Text Block color sync (`ParamColor`, `#rrggbbaa`) toggleable
- Time's up actions (clip / column / group-column) via REST connect, disabled by default
- LAN remote timer page on a random free HTTP port with QR access
- QRIS-only Donate modal generated from `VITE_QR_STATIC` / `QR_STATIC`

OSC paths generated (official OSC layout + Arena internal names):

- Text Block source:
  `/composition/layers/{layer}/clips/{clip}/video/source/blocktextgenerator/text`
- Text Animator source:
  `/composition/layers/{layer}/clips/{clip}/video/source/textgenerator/text`
- Clip effect:
  `/composition/layers/{layer}/clips/{clip}/video/effects/{effect}/effect/text`
- Layer effect:
  `/composition/layers/{layer}/video/effects/{effect}/effect/text`
- Composition effect:
  `/composition/video/effects/{effect}/effect/text`
- Effect keys: `textblock`, `texteffect`, or a slug of the effect name.
- Legacy fallback paths are also sent for compatibility with the original spec.

---

## 5. Verification Performed (on this laptop)

Packaged app tested directly, not just `npm run dev`.

### Visual verification

- Built portable exe.
- Launched it with remote debugging.
- Captured and inspected screenshots.
- Confirmed the UI renders with root content, timer text, and visible labels.

### Functional verification

- Timer start/pause
- Quick time adjustment
- Overtime count-up
- Flashing between overtime text and `TIME'S UP`
- QRIS modal opened and image loaded (`naturalWidth = 1200`)
- Language switch to Indonesian
- Preset save and persistence
- Reset/restart behavior

### Resolume mock verification

Used a temporary local mock server (not in the repo) with:

- HTTP composition endpoint on `127.0.0.1:18081`
- UDP OSC listener on `127.0.0.1:17001`
- Mock composition matching the real Arena 7.28 shape

Results:

- Discovery found 4 targets: layer effect, Text Block source, clip effect, composition effect.
- REST update arrived at:
  - `PUT /api/v1/parameter/by-id/1601239999`
  - Body: `{"value":"00:15:00"}`
- OSC messages arrived at:
  - `/composition/layers/1/clips/1/video/source/blocktextgenerator/text`
  - legacy `/composition/layers/1/clips/1/source/blocktext/text`
- Clip effect path tested:
  - `/composition/layers/1/clips/1/video/effects/textblock/effect/text`
- Layer/comp effect path generation tested through the same scanner.

### Live Resolume Arena 7.28 verification

Resolume Arena was running on this laptop while testing.

- The official Resolume MCP server was used to inspect the live composition and catalog.
- `GET /api/v1/composition` returned the expected shape:
  - `layer.name` and `clip.name` are parameter objects.
  - Text Block source uses `clip.video.description = "Text Block"` and `clip.video.sourceparams.Text` as `ParamText`.
  - Text Block effects live in `video.effects` arrays, not `clip.effects`.
- `/api/v1/param/by-id/{id}/value` returned **404** on Arena 7.28.
- `/api/v1/parameter/by-id/{id}` returned **200** for reads and **204** for writes.
- The packaged app's scan found the live target:
  - Layer 3 / clip 4
  - Parameter ID `1793278954342`
  - Source type `Text Block`
  - OSC path `/composition/layers/3/clips/4/video/source/blocktextgenerator/text`
- Enabling Resolume output in the packaged app set the live text to `00:15:00`.
- The original value `"Resolume"` was restored immediately afterward via `PUT /api/v1/parameter/by-id/1793278954342`.
- OSC input is disabled in Resolume preferences (`osc.xml`: `<Input Enabled="0" Port="7000"/>`), so live OSC delivery could not be verified. The paths are derived from the official OSC list plus internal names found in `Arena.exe`.

### Feature verification (2026-10-30)

Tested in the packaged exe via Chrome DevTools Protocol, against a mock Resolume server and the live Arena instance.

- **Color sync**
  - Scanner found `colorParamId` on both live targets:
    - source `1793347371926` / color `1793347371940`
    - clip effect `1793347372129` / color `1793347372143`
  - Mock run logged `SET 1601249999 {"value":"#00ff66ff"}` and `{"value":"#ff0055ff"}` on timeout.
  - Live run set `#00ff66ff`, verified it in `GET /api/v1/composition`, then restored `#ffffffff`.
- **Time's up trigger**
  - Defaults disabled; enabling it and selecting Column 2 produced
    `TRIGGER /api/v1/composition/columns/2/connect`.
  - Clip and group-column paths returned `204` against the mock.
  - Fires once per run; a reset re-arms it.
- **Donate modal**
  - Header buttons are exactly `Remote` and `Donate`.
  - Modal title `Donate via QRIS` with the QRIS-only notice.
  - Without `VITE_QR_STATIC` it shows the "not configured" message.
  - With `VITE_QR_STATIC` set at build time it renders a 420 px QR image.
- **LAN remote**
  - Server picked a free port (`31541` in one run) and reported `http://192.168.18.86:31541/`.
  - Remote modal rendered a 380 px QR plus the alternate `169.254.x.x` address.
  - `GET /` served the remote page; `GET /api/state` returned live state.
  - `POST /api/command {"action":"start"}` returned `204` and the timer started;
    `{"action":"reset"}` returned `204` and the timer returned to `00:15:00`.

---

## 6. Build and Run Commands

```powershell
npm install
npm run dev
npm run build
npm run build:win-portable
npm run build:win-portable:local
```

### Local packaging caveat

On this laptop, normal `electron-builder --win portable` fails while extracting `winCodeSign` because the session lacks symbolic-link privilege:

```text
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
```

Workaround used:

```powershell
npm run build:win-portable:local
```

This passes:

```text
--config.win.signAndEditExecutable=false
```

GitHub Actions `windows-latest` should not need this workaround.

### Donation QR payload

The Donate QR is compiled into the renderer. Pass the QRIS payload at build time:

```powershell
$env:VITE_QR_STATIC = '00020101021126...'
npm run build
```

In GitHub Actions this comes from the repository variable `QR_STATIC`, which the workflow maps to both `VITE_QR_STATIC` and `VITE_QRIS_STATIC`. Never commit a real payload; `.env*` files are git-ignored.

---

## 7. Known Issues / Follow-ups

1. **MCP restart**
   - `opencode.json` was added with the Resolume Arena MCP server.
   - opencode loads MCP config only at startup, so restart opencode to expose the MCP tools in a normal session.
   - The server was probed manually over stdio and used to verify the live API shape.

2. **QRIS asset**
   - `assets/qris-donation.png` is a 1200x630 banner image and is no longer used by the app.
   - The Donate modal now generates the QR from `VITE_QR_STATIC`; set `QR_STATIC` in GitHub repository variables for release builds.
   - `assets/qris-donation.png` can be deleted once the env-based flow is confirmed in CI.

3. **App icon**
   - `assets/icon.ico` is actually a PNG file (1200x630), not a valid ICO.
   - electron-builder currently uses the default Electron icon.
   - Replace with a real `.ico` / `.icns` when available.

4. **OSC health semantics**
   - UDP has no acknowledgement.
   - OSC health currently means "last UDP send succeeded", not confirmed Resolume receipt.

5. **No automated tests**
   - Verification was performed manually through CDP and a mock Resolume server.
   - No test framework is configured.

6. **Layout**
   - At 1280x880 the page scrolls vertically because the right control column is taller.
   - This is intentional/acceptable but could be compacted later.

---

## 8. Git State

- Changes are **not committed**.
- Run `git status --short` to see the full list.
- New files include:
  - `src/main/preload.js`
  - `src/main/remote.html`
  - `src/renderer/hooks/useTimer.js`
  - `src/renderer/lib/time.js`
  - `src/renderer/lib/qr.js`
  - `src/renderer/main.jsx`
  - `src/renderer/styles.css`
  - `src/renderer/i18n.js`
  - `src/renderer/components/RemoteAccessModal.jsx`
  - `opencode.json`
  - `PROGRESS.md`
- Dependencies added: `qrcode` (renderer QR generation).
- `AGENTS.md` was updated with the verified Arena 7.28 REST shape, correct endpoint, color-sync and trigger endpoints, LAN remote, QRIS env flow, and MCP usage.
- `build:release` now builds the current platform only; the GitHub Actions matrix supplies the OS.

---

## 9. Quick Resume Notes for a Future Session

1. Read this file and `AGENTS.md` first.
2. Run `npm install` if `node_modules` is missing.
3. Use `npm run build` to verify renderer compilation.
4. Use `npm run build:win-portable:local` on this laptop.
5. Launch `dist/Resolume Timer 1.0.0.exe` to test the packaged app.
6. Set `VITE_QR_STATIC` before building if you need a working Donate QR; CI reads `QR_STATIC`.
7. Remote timer runs on a random free port; open the **Remote** modal to get the phone URL/QR.
8. Color sync and time's-up triggers only act when Resolume output is enabled and a target is selected.
9. Restart opencode to load the Resolume Arena MCP server from `opencode.json`.
10. In a fresh MCP session call `status { action: "instructions", injected: true }` before other tools.
11. For Resolume testing with Arena not running, use a mock HTTP/UDP server.
12. Do not modify the live composition or save it without explicit user confirmation.
13. Do not commit unless explicitly requested.


---

## 10. Feature Updates (2026-10-30)

### 1. NDI Output
- Added native NDI streaming support using `@stagetimerio/grandiose` (NewTek/Vizrt NDI 6 SDK bindings).
- `src/main/ndi-service.js`: Manages NDI video streaming pipeline using an offscreen Chromium BrowserWindow (`webPreferences: { offscreen: true }`) capturing frames in `BGRA` format directly into the NDI sender with zero-copy overhead.
- Configurable stream name, framerate (30 / 60 FPS), transparent background (alpha channel), and optional notes inclusion.
- Packaged configuration in `electron-builder.json` unpacks `grandiose.node` and `Processing.NDI.Lib.x64.dll` from asar.

### 2. Website Timer Output with Notes (`/output`)
- Created `src/main/output.html` served at `http://<lan-ip>:<port>/output` (also aliases `/stage`, `/timer`, `/view`).
- Displays a clean, full-screen stage timer with oversized numbers, mode and phase pills, speed indicator, progress bar, and formatted speaker/stage notes.
- Query parameters support:
  - `?transparent=1` / `?bg=transparent`: Enables transparent background for OBS and Resolume video overlays.
  - `?notes=hide`: Hides notes section.
  - `?top=hide` / `?progress=hide`: Customizes layout visibility.
- Updated `RemoteAccessModal.jsx` with tabs for both **Remote Controller (Phone)** and **Web Timer Output (Stage / OBS)**, including QR code, copy URL, and open browser buttons.

### 3. Notes Output (Two Modes)
- Added live notes editing to `TimeControls.jsx` and `App.jsx`.
- **Mode 1 (`\n` on timer)**: Appends notes to the timer string separated by a newline (`\n`), sending both timer and notes to the same Resolume Text Block.
- **Mode 2 (Separate Text Block)**: Allows selecting a separate Text Block target from the scanned composition specifically for speaker notes, streaming notes independently.

### 4. Synchronize with Remotes (Speed & Notes)
- Updated `src/main/remote.html` with:
  - Playback speed controls (`0.5x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Stage notes editor allowing phone operators to update notes sent to the stage and Resolume.
- Main process `/api/command` updated to handle `setSpeed` and `setNotes`.
- Renderer state synchronization reflects remote adjustments instantaneously.

### 5. Background Running (Uninterrupted Timer)
- Added Chromium flags to prevent timer throttling and backgrounding:
  - `disable-background-timer-throttling`
  - `disable-renderer-backgrounding`
  - `disable-backgrounding-occluded-windows`
- Set `backgroundThrottling: false` in `BrowserWindow` `webPreferences`.
- Integrated Electron `powerSaveBlocker` to prevent OS sleep/suspension while the timer is running.
- Upgraded `useTimer.js` with a dual-loop engine: combining `requestAnimationFrame` for smooth foreground rendering with a 50ms interval heartbeat and timestamp delta accumulation (`performance.now()`), guaranteeing continuous and exact timekeeping when the window is minimized.
