# Resolume Arena Timer

Precision show timer for live visual operators. Runs a countdown, a count-up stopwatch, or a countdown that rolls into overtime, and pushes the live time into Resolume Arena as a Text Block, either over REST or OSC.

Built with Electron + React + Vite. Verified against **Resolume Arena 7.28** on Windows.

---

## Features

- **Three timer modes** — countdown, count-up, countdown then overtime (`+00:02:15`).
- **Live Resolume output** — finds Text Block sources and Text Block effects anywhere in the composition and streams the timer text to them.
- **Notes Output with 2 modes**:
  - **Mode 1 (`\n` on timer)** — Appends speaker/stage notes to the timer string separated by a newline on the same Text Block.
  - **Mode 2 (Separate Text Block)** — Scans the composition and pushes notes to a separate Text Block target in Resolume.
- **NDI Output** — Broadcasts the live timer, color state, and notes as a high-definition NDI network video stream (NDI 6 SDK native addon) for OBS Studio, vMix, Tricaster, or Resolume Arena. Supports transparency and configurable framerates.
- **Website Timer Output with notes (`/output`)** — Full-screen responsive web display for stage confidence monitors, presenter displays, or OBS/Resolume browser sources. Supports `?transparent=1` for video overlays.
- **Synchronized Phone Remote** — LAN remote controller now synchronizes both playback speed (0.5x–2.0x) and live stage notes editing between mobile devices and desktop.
- **Rock-solid Background Running** — Timer never stops, freezes, or desyncs when minimized or running in the background. Configured with Chromium background throttling bypass, timestamp delta tracking, and OS sleep prevention.
- **REST + OSC** — Auto / REST only / OSC only. REST is the verified transport; OSC is a fallback and is sent only when enabled in Resolume preferences.
- **Color sync** — pushes the running / warning / timeout color to the Text Block `Color` parameter.
- **Time's up actions** — optionally triggers a clip, a column, or a group column when the timer hits zero. Disabled by default.
- **Warning threshold and flashing message** — swaps the display between the overtime count and a custom message (e.g. `TIME'S UP`) at a configurable rate.
- **Live adjustments** — `+1 hr` … `-10 sec` without stopping the timer, plus a manual `HH:MM:SS` input.
- **Speed remapping** — 0.25x to 2.0x or a custom multiplier.
- **Presets** — save, edit, load, delete, export, import.
- **Languages** — English and Bahasa Indonesia.
- **Donate** — QRIS-only donation QR.

---

## Requirements

- Node.js 20+
- Resolume Arena (tested on 7.28) with the REST API enabled
- Resolume OSC input enabled if you want OSC delivery (Preferences → OSC → Input, default port `7000`)

---

## Development

```powershell
npm install
npm run dev
```

`npm run dev` starts Vite on port `5173` and launches Electron against the dev server.

## Build

```powershell
npm run build              # renderer only -> dist-renderer/
npm run build:win-portable # Windows portable exe
npm run build:release      # current platform only
```

On a machine without the Windows symlink privilege, electron-builder fails while extracting `winCodeSign`. Use:

```powershell
npm run build:win-portable:local
```

Artifacts land in `dist/`.

---

## Resolume setup

1. In Resolume enable **Preferences → Webserver / REST API** (default port `8080`).
2. Add a **Text Block** source clip or a **Text Block** effect to the composition.
3. In the app, open the Resolume panel, keep host `127.0.0.1` and REST port `8080`, then press **Scan composition**.
4. Pick the target and enable **Send timer text**.

Defaults:

| Setting | Default |
| --- | --- |
| REST host | `127.0.0.1` |
| REST port | `8080` |
| OSC host | `127.0.0.1` |
| OSC port | `7000` |

Text is written with `PUT /api/v1/parameter/by-id/{id}`. If you point the app at another machine, use that machine's LAN IP for both REST and OSC.

### OSC paths

OSC input must be enabled in Resolume, otherwise messages are silently ignored — UDP has no acknowledgement.

| Target | Path |
| --- | --- |
| Text Block source | `/composition/layers/{layer}/clips/{clip}/video/source/blocktextgenerator/text` |
| Text Animator source | `/composition/layers/{layer}/clips/{clip}/video/source/textgenerator/text` |
| Clip effect | `/composition/layers/{layer}/clips/{clip}/video/effects/{effect}/effect/text` |
| Layer effect | `/composition/layers/{layer}/video/effects/{effect}/effect/text` |
| Composition effect | `/composition/video/effects/{effect}/effect/text` |

---

## Donation QR (QRIS)

The Donate button opens a modal that renders a QR from a static QRIS payload compiled into the renderer. The payload is **never committed**; it is read at build time from an environment variable.

Local builds read `.env.local` (git-ignored):

```ini
VITE_QR_STATIC=00020101021126610014COM.GO-JEK.WWW...
VITE_QRIS_STATIC=00020101021126610014COM.GO-JEK.WWW...
```

Or set it inline before building:

```powershell
$env:VITE_QR_STATIC = '0002010102112661...'
npm run build:win-portable:local
```

GitHub Actions reads the repository variable **`QR_STATIC`** and passes it to Vite as both `VITE_QR_STATIC` and `VITE_QRIS_STATIC`. Add it under **Settings → Secrets and variables → Actions → Variables** so release builds ship a working QR. If the payload is empty, the modal shows "Donation QRIS is not configured in this build" instead of a fake QR.

The donation is QRIS only — an Indonesian payment QR. No other payment methods are supported.

---

## Support this project

If this timer saves you time on a show, you can support continued development with a QRIS donation. Any Indonesian banking or e-wallet app that supports QRIS can scan this.

<p align="center">
  <img src="assets/donate-qris.png" alt="QRIS donation QR code" width="320" />
</p>

<p align="center"><strong>QRIS only</strong> — scan with GoPay, OVO, DANA, ShopeePay, LinkAja, or any Indonesian mobile banking app.</p>

---

---

## Remote timer (phone)

The main process starts an HTTP server on an OS-assigned free port and the **Remote** button shows a QR plus the LAN URL.

- Phone must be on the same Wi-Fi / LAN as the computer.
- Allow the app through Windows Firewall if the page does not load.
- The remote page mirrors the timer (text, phase, mode, progress, speed, notes) and can start/pause, reset, adjust by ±1 min / ±10 sec, change playback speed, and edit stage notes live.
- If more than one network interface exists, the modal lists alternate addresses.
- The **Remote Access Modal** includes tabs for both the **Remote Controller** (`/`) and the **Website Timer Output** (`/output`).

---

## Website Timer Output (`/output`)

The application serves a dedicated, full-screen stage and confidence monitor display at `http://<lan-ip>:<port>/output` (or `/stage`, `/timer`, `/view`):

- **Clean stage display** — Large high-contrast digits, active color indication, mode/phase badge, progress bar, and speaker notes section.
- **Video switcher & OBS overlay** — Append `?transparent=1` for a transparent background.
- **Customizable view** — Use `?notes=hide` to hide notes, or `?top=hide` for minimal timer only.

---

## NDI Output

Broadcasts the timer and notes as an NDI video feed across the local network:

- Enabled in the **Resolume Output** panel under **NDI Output**.
- Uses native Vizrt/NewTek NDI 6 SDK.
- Automatically detected by Resolume Arena, OBS Studio, vMix, and Tricaster as a network video source.
- Configurable stream name, framerate (30 / 60 FPS), and alpha transparency.

---

## Project layout

```text
src/
├── main/
│   ├── index.js          Electron main process, IPC, LAN remote server, power saver
│   ├── preload.js        contextBridge API
│   ├── ndi-service.js    NDI 6 SDK broadcast service & offscreen renderer
│   ├── osc-client.js     OSC UDP encoder
│   ├── remote.html       Phone remote controller page (with speed & notes)
│   ├── output.html       Full-screen web timer output with notes
│   └── rest-client.js    Resolume discovery and updates
└── renderer/
    ├── main.jsx          React entry point
    ├── App.jsx           UI and state management
    ├── styles.css
    ├── i18n.js
    ├── hooks/useTimer.js Background-safe precision timer hook
    ├── lib/              time formatting, QR helper
    ├── components/       Timer, controls, Resolume & NDI settings, presets, modals
    └── locales/          en.json, id.json
```

`dist-renderer/` is the Vite output and is packaged into `app.asar`. `dist/` is electron-builder output and is excluded from the asar.

---

## Notes

- Saving or destructive changes to a live Resolume composition always require explicit confirmation; the app only writes the text/color parameters and, if enabled, fires the connect endpoints.
- OSC health in the app means "the last UDP send completed locally", not confirmed receipt.
- `assets/icon.ico` is currently a PNG, so packaged builds use the default Electron icon.
