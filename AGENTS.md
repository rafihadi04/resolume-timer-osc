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
  * Automatically scans for layers, clips, and effects that contain **Text Block Sources** (`/source/blocktext`) or **Text Block Effects** (`/effect/blocktext`).
  * Extracts exact parameter IDs to allow direct updates via `PUT /api/v1/param/by-id/{id}/value`.
* **OSC Target Routing & Fallback**:
  * Dynamic target parameter generator for OSC paths:
    * *Source Path*: `/composition/layers/{layer}/clips/{clip}/source/blocktext/text`
    * *Effect Path*: `/composition/layers/{layer}/clips/{clip}/effects/textblock/effect/text`
* **Health Check & Ping**:
  * Dual health monitor testing both HTTP REST connection and UDP OSC port.
  * Displays visual status indicator: 🟢 **Connected** (Green), 🟡 **Degraded/Timeout** (Yellow), 🔴 **Disconnected** (Red).

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

* **QRIS Payment Integration**:
  * Embedded modal dialog displaying an Indonesian QRIS barcode image/payload for developer support.
  * Optional link buttons for international support (BuyMeACoffee, Ko-fi).

---

## 4. Resolume REST API Payload Structure

### Composition Inspection Request
```http
GET /api/v1/composition
Host: 127.0.0.1:8080
Accept: application/json
```

### Parameter Update Request
```http
PUT /api/v1/param/by-id/1601239999/value
Content-Type: application/json

"00:09:59"
```

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

---

## 6. Directory Structure

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
│   │   ├── index.js          # Electron main process
│   │   ├── osc-client.js     # OSC UDP handling
│   │   └── rest-client.js    # Resolume REST API client
│   ├── renderer/
│   │   ├── index.html
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── TimerDisplay.jsx
│   │   │   ├── TimeControls.jsx
│   │   │   ├── OscSettings.jsx
│   │   │   ├── PresetManager.jsx
│   │   │   └── QrisDonateModal.jsx
│   │   └── locales/
│   │       ├── en.json
│   │       └── id.json
├── package.json
└── electron-builder.json
```
