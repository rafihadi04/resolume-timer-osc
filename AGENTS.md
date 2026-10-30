# Technical Specification: Resolume Arena Application Timer

## 1. Overview & Goal

The **Resolume Arena Application Timer** is an Electron-based desktop application designed for live visual operators, stage managers, and VJs. It provides precision timer control (countdown, count-up, and overtime counting) and feeds live timer text and formatting directly into **Resolume Arena** using both **Open Sound Control (OSC)** and the **Resolume REST API (`/api/v1/composition`)**.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------+
|                             ELECTRON APP                              |
|                                                                       |
|  +--------------------------+          +---------------------------+  |
|  |     Renderer Process     |          |       Main Process        |  |
|  |  - UI & Controls         |  IPC     |  - OSC UDP Server/Client  |  |
|  |  - Presets & Configs     | <------> |  - REST API Client        |  |
|  |  - Timer Engine          |          |  - Health Check Ping      |  |
|  |  - i18n & QRIS Modal     |          |  - Native OS Controls     |  |
|  +--------------------------+          +-------------+-------------+  |
+------------------------------------------------------+----------------+
                                                       |
                             HTTP REST API & OSC UDP   |
                                                       v
                                         +------------------------------+
                                         |        RESOLUME ARENA        |
                                         | - REST: /api/v1/composition  |
                                         | - Text Block Source          |
                                         | - Text Block Effect          |
                                         +------------------------------+
```

---

## 3. Feature Breakdown & Requirements

### 3.1 Resolume Target Detection (REST API & OSC)
* **REST API Discovery (`/api/v1/composition`)**:
  * Periodically polls or queries `http://<resolume_ip>:<port>/api/v1/composition` to inspect the full active composition graph.
  * Automatically scans the real Resolume 7.28 composition shape:
    * **Text Block Source**: `clip.video.sourceparams.Text` is a `ParamText` parameter and `clip.video.description` is normally `"Text Block"` (or `"Text Animator"` for the animated source).
    * **Text Block Effect**: an entry in `clip.video.effects`, `layer.video.effects`, `group.video.effects`, or `composition.video.effects` whose `name`/`display_name` contains `Text` and whose `params.Text` is a `ParamText` parameter.
    * Layer and clip names are parameter objects, not strings: use `name.value`.
  * Extracts exact parameter IDs to allow direct updates via `PUT /api/v1/parameter/by-id/{id}`. The older `/api/v1/param/by-id/{id}/value` endpoint returns 404 on Arena 7.28 and is kept only as a compatibility fallback.
* **OSC Target Routing & Fallback**:
  * OSC input must be enabled manually in Resolume Preferences > OSC (default port `7000`). The app can send without acknowledgement when it is disabled, but Resolume will ignore the messages.
  * Dynamic target parameter generator for OSC paths (based on the official OSC address layout and Resolume's internal generator/effect names):
    * *Text Block Source*: `/composition/layers/{layer}/clips/{clip}/video/source/blocktextgenerator/text`
    * *Text Animator Source*: `/composition/layers/{layer}/clips/{clip}/video/source/textgenerator/text`
    * *Clip Effect*: `/composition/layers/{layer}/clips/{clip}/video/effects/{effect}/effect/text`
    * *Layer Effect*: `/composition/layers/{layer}/video/effects/{effect}/effect/text`
    * *Composition Effect*: `/composition/video/effects/{effect}/effect/text`
    * Effect keys are `textblock`, `texteffect`, or a slug of the effect name.
    * Source targets also include the legacy `/source/blocktext/text` fallback path, and effect targets include the legacy `/effects/textblock/effect/text` fallback path.
  * REST is the verified transport on Arena 7.28. OSC paths above are derived from the official OSC reference (`/composition/.../video/effects/<name>/<param>`) plus the internal names found in Arena (`blocktextgenerator/text`, `textgenerator/text`, `textblock/effect/text`, `texteffect/effect/text`).
* **Health Check & Ping**:
  * Dual health monitor testing both HTTP REST connection and UDP OSC port.
  * UDP cannot be acknowledged, so OSC health means the last UDP send completed without a local socket error.
  * Displays visual status indicator: 🟢 **Connected** (Green), 🟡 **Degraded/Timeout** (Yellow), 🔴 **Disconnected** (Red).
* **Text Block Color Sync**:
  * Discovers the `Color` (`ParamColor`) parameter on the same Text Block source/effect as the text target.
  * Pushes the active state color (running / warning / timeout) to Resolume via `PUT /api/v1/parameter/by-id/{color-id}` as `#rrggbbaa`.
  * Toggleable in the Resolume output panel.
* **Time's Up Actions**:
  * Optional clip / column / group-column trigger when the timer enters the time-out state.
  * Disabled by default.
  * Uses Resolume REST connect endpoints:
    * Clip: `POST /api/v1/composition/layers/{layer}/clips/{column}/connect`
    * Column: `POST /api/v1/composition/columns/{column}/connect`
    * Group column: `POST /api/v1/composition/layergroups/{group}/columns/{column}/connect`
  * Fires once per timer run; reset the timer to arm it again.

---

### 3.2 Timer Engine & Operating Modes

1. **Countdown Mode ($T_{start} \to 00:00:00$)**:
   * Counts down from a set duration to zero.
2. **Count-Up Mode ($00:00:00 \to T_{target}$ or $\infty$)**:
   * Standard stopwatch or elapsed time tracker.
3. **Countdown then Count-Up Mode (Overtime Mode)**:
   * Counts down to `00:00:00`, triggers the **Time Out** state, and immediately begins counting up to display overtime duration (e.g., `+00:02:15`).

---

### 3.3 Visual Color Schemes & Custom State Highlights

* **State Color Triggers**:
  * **Running State**: Standard active countdown color.
  * **Warning Threshold**: Custom warning color when remaining time drops below a specified limit (e.g., last 2 minutes).
  * **Time Out State**: Highlight color when time expires or enters overtime mode.
  * **Custom User States**: Ability to define custom color presets per event type.

---

### 3.4 Time Remapping & Playback Speed

* **Speed Remapper**:
  * Speed multiplier option ($0.25x$, $0.5x$, $1.0x$, $1.25x$, $1.5x$, $2.0x$, or custom multiplier).
  * Accelerates or decelerates timer playback for rehearsals or sped-up media sync.

---

### 3.5 "Time's Up" Alert & Text Flashing

* **Flash Effect Engine**:
  * Toggleable text flashing animation upon reaching zero.
  * Ability to alternate between remaining/overtime count and custom text strings (e.g., **"TIME'S UP"**, **"WRAP IT UP"**, **"NEXT SPEAKER"**).
  * Variable flash frequency control (Hz).

---

### 3.6 Real-Time Time Adjustments & Manual Input

* **Live Action Buttons (When Running)**:
  * Quick-add or subtract time on the fly without stopping playback:
    * `+1 hr`, `+5 min`, `+1 min`, `+10 sec`
    * `-1 hr`, `-5 min`, `-1 min`, `-10 sec`
* **Direct Manual Input**:
  * Text input box accepting explicit time strings (`HH:MM:SS` or total seconds) with instant **Apply / Sync** functionality.

---

### 3.7 Preset Feature

* **Preset Manager**:
  * Save, edit, load, and export/import configuration presets.
* **Preset Structure Example**:
  ```json
  {
    "id": "preset_keynote_15m",
    "name": "15 Min Keynote + Overtime",
    "durationSeconds": 900,
    "mode": "COUNTDOWN_THEN_COUNTUP",
    "speedMultiplier": 1.0,
    "colorScheme": {
      "running": "#00FF66",
      "warning": "#FFCC00",
      "timeout": "#FF0055"
    },
    "warningThresholdSeconds": 120,
    "timesUpMessage": "PLEASE CONCLUDE"
  }
  ```

---

### 3.8 Multi-Language Support (i18n)

* Base translation system built on `i18next` or JSON translation dictionaries.
* Default language: **English (`en`)**.
* Modular translation folder structure for easy addition of other languages (e.g., Bahasa Indonesia `id`, Spanish `es`).

---

### 3.9 Indonesian QRIS Donation Feature

* **QRIS-only donation**:
  * Header button is labelled **Donate** (not QRIS).
  * Modal clearly states that the donation is **QRIS only** (Indonesian payment QR).
  * No BuyMeACoffee / Ko-fi or other payment links.
  * The QR is generated from a static QRIS payload read from `VITE_QR_STATIC` (or `VITE_QRIS_STATIC`).
  * GitHub Actions passes the repository variable `QR_STATIC` into the Vite build.
  * If the payload is empty, the modal shows a "not configured" message instead of a fake QR.

---

### 3.10 Remote Timer over LAN

* **HTTP remote access**:
  * Main process starts an HTTP server on an OS-assigned free port (`listen(0)`).
  * The remote page displays the live timer, phase, mode, and progress.
  * Remote buttons can start/pause, reset, and adjust the timer by +/- 1 min or +/- 10 sec.
  * The renderer pushes state to the main process every 300 ms via IPC.
  * Remote commands are forwarded from the HTTP server to the renderer via IPC.
  * The **Remote** button opens a modal with a QR code and URL for phone access.
  * Defaults remain OSC `7000` and REST `8080`.
  * Phone must be on the same Wi-Fi/LAN; Windows Firewall may need to allow the app.

---

## 4. Resolume REST API (Verified on Arena 7.28.0)

### Base URL
```text
http://127.0.0.1:8080/api/v1
```

Resolume 7.28 also exposes a local IPC socket used by the official MCP server:

```text
C:\Users\<user>\AppData\Local\Resolume Arena\rest-api.sock
```

The Electron app uses the HTTP endpoint so it can also target another machine on the network.

### Composition Inspection

```http
GET /api/v1/composition
Host: 127.0.0.1:8080
Accept: application/json
```

The response is large. The relevant shape for this app is:

```json
{
  "name": { "valuetype": "ParamString", "id": 1793278948092, "value": "My Composition" },
  "layers": [
    {
      "id": 1791831393161,
      "name": { "valuetype": "ParamString", "id": 1793278951537, "value": "Layer #" },
      "video": {
        "effects": [
          {
            "name": "Transform",
            "display_name": "Transform",
            "params": {
              "Scale": { "id": 1793278952339, "valuetype": "ParamRange", "value": 100 }
            }
          },
          {
            "name": "Text Block",
            "display_name": "Text Block",
            "params": {
              "Text": { "id": 1793278954342, "valuetype": "ParamText", "value": "Hello" }
            }
          }
        ]
      },
      "clips": [
        {
          "id": 1792308911318,
          "name": { "valuetype": "ParamString", "id": 1793278948425, "value": "Text Block" },
          "video": {
            "description": "Text Block",
            "sourceparams": {
              "Text": { "id": 1793278954342, "valuetype": "ParamText", "value": "Hello" }
            },
            "effects": [
              {
                "name": "Transform",
                "display_name": "Transform",
                "params": { "Scale": { "id": 1793278952339, "valuetype": "ParamRange", "value": 100 } }
              }
            ]
          }
        }
      ]
    }
  ],
  "layergroups": [],
  "video": { "effects": [] }
}
```

Important details:

- Layer names and clip names are parameter objects: use `layer.name.value` and `clip.name.value`.
- Text Block **source** lives in `clip.video.sourceparams.Text`, not in a `clip.source` object.
- Text Block **effects** live in `clip.video.effects`, `layer.video.effects`, `group.video.effects`, or `composition.video.effects`.
- The first video effect is normally `Transform`. REST effect indices are 1-based and include Transform. OSC effect paths use the effect's internal name (`textblock`, `texteffect`) rather than its index.
- `ParamText` parameters use JSON string values. `ParamColor` uses `#rrggbbaa`. Choice parameters expose `value`, `index`, and `options`.
- Empty clips have `video: null`; skip them.

### Read a Parameter by ID

```http
GET /api/v1/parameter/by-id/1793278954342
Accept: application/json
```

Response:

```json
{ "id": 1793278954342, "valuetype": "ParamText", "value": "Resolume" }
```

### Update a Parameter by ID

This is the endpoint that works on Arena 7.28:

```http
PUT /api/v1/parameter/by-id/1793278954342
Content-Type: application/json

{ "value": "00:09:59" }
```

Successful response: `204 No Content`.

The OpenAPI schema also accepts a full parameter object. Sending `{ "value": ... }` is the form used by this app. A raw JSON string also worked during testing, but is less explicit.

### Time's Up Trigger Endpoints

The timer's optional time-out action uses the Resolume connect endpoints:

```http
POST /api/v1/composition/layers/{layer}/clips/{column}/connect
POST /api/v1/composition/columns/{column}/connect
POST /api/v1/composition/layergroups/{group}/columns/{column}/connect
```

All indices are 1-based. No request body is required; the connect acts like a short UI click. Successful response: `204 No Content`.

### Text Color

The Text Block `Color` parameter is a `ParamColor`. Update it through the same parameter endpoint using an 8-digit RGBA hex string:

```http
PUT /api/v1/parameter/by-id/1793347371940
Content-Type: application/json

{ "value": "#00ff66ff" }
```

### Legacy Fallback

The older endpoint is documented in some Resolume examples but returns **404** on Arena 7.28:

```http
PUT /api/v1/param/by-id/1793278954342/value
Content-Type: application/json

"00:09:59"
```

Keep it only as a fallback for older builds:

1. Try `PUT /api/v1/parameter/by-id/{id}`.
2. If that returns `404`/`405`, try `PUT /api/v1/param/by-id/{id}/value`.

### Verified Live Example

On this machine, `GET /api/v1/composition` returned a Text Block source at layer 3, column/clip 4:

```text
clip.video.description        = "Text Block"
clip.video.sourceparams.Text  = { id: 1793278954342, valuetype: "ParamText", value: "Resolume" }
```

`PUT /api/v1/parameter/by-id/1793278954342` with `"ORBIT-TIMER-TEST"` returned `204` and the composition immediately reported the new value. The original value was restored afterward.

OSC input was disabled on this machine (`Preferences/osc.xml` has `<Input Enabled="0" Port="7000"/>`), so OSC delivery could not be verified live. REST delivery is verified.

---

## 5. GitHub Actions Workflow Configuration

Automated workflow using `actions/upload-artifact@v4` for dev builds and multi-platform release builds.

```yaml
name: Build Electron App

on:
  push:
    branches:
      - main
      - develop
  release:
    types: [published]

jobs:
  build-dev-windows:
    name: Build Windows Portable (Development)
    if: github.event_name == 'push' || github.event_name == 'pull_request'
    runs-on: windows-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Portable Executable
        run: npm run build:win-portable
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Windows Artifact (v4)
        uses: actions/upload-artifact@v4
        with:
          name: Resolume-Timer-Win-Portable-Dev
          path: dist/*.exe
          retention-days: 7

  build-release:
    name: Build Multi-Platform Release (Windows & macOS)
    if: github.event_name == 'release'
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [windows-latest, macos-latest]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Release Artifacts
        run: npm run build:release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Binaries to Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*.exe
            dist/*.dmg
            dist/*.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`build:release` builds the current runner's platform only (`electron-builder` with no platform flag); the matrix provides Windows and macOS runners separately.

Both build jobs pass the GitHub repository variable `QR_STATIC` into Vite as `VITE_QR_STATIC` and `VITE_QRIS_STATIC` for the donation QR. Set `QR_STATIC` in the repository/environment variables; do not commit a real QRIS payload.

---

## 6. Resolume Arena MCP Server

The official Resolume MCP server is installed at:

```text
C:\Program Files\Resolume Arena\mcp\resolume_arena_mcp_server.exe
```

Project-level opencode configuration: `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "resolume-arena": {
      "type": "local",
      "command": [
        "C:\\Program Files\\Resolume Arena\\mcp\\resolume_arena_mcp_server.exe"
      ],
      "enabled": true
    }
  }
}
```

Notes:

- opencode loads MCP configuration at startup. Restart opencode after editing `opencode.json`.
- The configured path is Windows-specific. On macOS, point `command` at the matching Resolume MCP binary instead.
- The MCP server talks to Arena over Resolume's local REST IPC socket (`rest-api.sock`), not the public HTTP port.
- Always call `status { action: "instructions" }` (or `injected: true`) before using other tools in a fresh MCP session.
- Useful read-only calls:
  - `status { action: "get" }`
  - `composition { action: "get" }`
  - `layer { action: "list" }`
  - `clip { action: "list" }`
  - `effect { action: "list", target: "clip", layer: 1, column: 1 }`
  - `parameter { action: "get", id: 1793278954342 }`
  - `catalog { action: "sources", search: "text" }`
  - `catalog { action: "effects", search: "text" }`
- The MCP server can modify the live composition. Never save, clear, create, or delete content without explicit user confirmation.
- The MCP server was used to verify the real `GET /api/v1/composition` shape and the Text Block parameter IDs documented above.

---

## 7. Directory Structure

```text
resolume-arena-timer/
├── .github/
│   └── workflows/
│       └── build.yml
├── assets/
│   ├── icon.ico
│   └── qris-donation.png
├── src/
│   ├── main/
│   │   ├── index.js          # Electron main process + LAN remote server
│   │   ├── preload.js        # contextBridge IPC API
│   │   ├── osc-client.js     # OSC UDP handling
│   │   ├── remote.html       # Phone browser remote timer page
│   │   └── rest-client.js    # Resolume REST discovery/update
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx
│   │   ├── styles.css
│   │   ├── i18n.js
│   │   ├── hooks/
│   │   │   └── useTimer.js
│   │   ├── lib/
│   │   │   ├── qr.js
│   │   │   └── time.js
│   │   ├── components/
│   │   │   ├── TimerDisplay.jsx
│   │   │   ├── TimeControls.jsx
│   │   │   ├── OscSettings.jsx
│   │   │   ├── PresetManager.jsx
│   │   │   ├── QrisDonateModal.jsx
│   │   │   └── RemoteAccessModal.jsx
│   │   └── locales/
│   │       ├── en.json
│   │       └── id.json
├── package.json
├── electron-builder.json
├── opencode.json
├── PROGRESS.md
└── README.md
```
