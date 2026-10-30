# Resolume Arena Timer

Precision show timer for live visual operators. Runs a countdown, a count-up stopwatch, or a countdown that rolls into overtime, and pushes the live time into Resolume Arena as a Text Block, either over REST or OSC.

Built with Electron + React + Vite. Verified against **Resolume Arena 7.28** on Windows.

---

## Features

- **Three timer modes** — countdown, count-up, countdown then overtime (`+00:02:15`).
- **Live Resolume output** — finds Text Block sources and Text Block effects anywhere in the composition and streams the timer text to them.
- **REST + OSC** — Auto / REST only / OSC only. REST is the verified transport; OSC is a fallback and is sent only when enabled in Resolume preferences.
- **Color sync** — pushes the running / warning / timeout color to the Text Block `Color` parameter.
- **Time's up actions** — optionally triggers a clip, a column, or a group column when the timer hits zero. Disabled by default.
- **Warning threshold and flashing message** — swaps the display between the overtime count and a custom message (e.g. `TIME'S UP`) at a configurable rate.
- **Live adjustments** — `+1 hr` … `-10 sec` without stopping the timer, plus a manual `HH:MM:SS` input.
- **Speed remapping** — 0.25x to 2.0x or a custom multiplier.
- **Presets** — save, edit, load, delete, export, import.
- **Languages** — English and Bahasa Indonesia.
- **Phone remote** — an HTTP server on a free LAN port with a QR code, so a phone can start/pause/reset and adjust the timer.
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
- The remote page mirrors the timer (text, phase, mode, progress) and can start/pause, reset, and adjust by ±1 min / ±10 sec.
- If more than one network interface exists, the modal lists the alternate addresses.

---

## Project layout

```text
src/
├── main/
│   ├── index.js          Electron main process, IPC, LAN remote server
│   ├── preload.js        contextBridge API
│   ├── osc-client.js     OSC UDP encoder
│   ├── remote.html       Phone remote page
│   └── rest-client.js    Resolume discovery and updates
└── renderer/
    ├── main.jsx          React entry point
    ├── App.jsx           UI and state
    ├── styles.css
    ├── i18n.js
    ├── hooks/useTimer.js
    ├── lib/              time formatting, QR helper
    ├── components/       Timer, controls, Resolume panel, presets, modals
    └── locales/          en.json, id.json
```

`dist-renderer/` is the Vite output and is packaged into `app.asar`. `dist/` is electron-builder output and is excluded from the asar.

---

## Notes

- Saving or destructive changes to a live Resolume composition always require explicit confirmation; the app only writes the text/color parameters and, if enabled, fires the connect endpoints.
- OSC health in the app means "the last UDP send completed locally", not confirmed receipt.
- `assets/icon.ico` is currently a PNG, so packaged builds use the default Electron icon.
