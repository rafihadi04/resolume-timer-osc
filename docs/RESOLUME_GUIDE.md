# Resolume Arena Technical Reference Guide

This document provides in-depth technical details on how the timer integrates with **Resolume Arena 7.28+**, covering both the **REST API** and **OSC (Open Sound Control)** protocols.

---

## Table of Contents
1. [Protocol Overview: REST vs. OSC](#1-protocol-overview-rest-vs-osc)
2. [Resolume REST API Architecture](#2-resolume-rest-api-architecture)
   - [Composition Graph Discovery](#composition-graph-discovery)
   - [Parameter Updating via REST](#parameter-updating-via-rest)
   - [Text Block Color Synchronization](#text-block-color-synchronization)
   - [Time's Up Clip & Column Connect Triggers](#times-up-clip--column-connect-triggers)
3. [OSC Routing & Address Layout](#3-osc-routing--address-layout)
   - [OSC Setup in Arena](#osc-setup-in-arena)
   - [Supported OSC Paths](#supported-osc-paths)
4. [Multi-Machine Network Setup (FOH to Stage VJ)](#4-multi-machine-network-setup-foh-to-stage-vj)

---

## 1. Protocol Overview: REST vs. OSC

The application provides a hybrid dual-transport engine:

| Feature | Resolume REST API (Recommended) | Resolume OSC (UDP) |
| --- | --- | --- |
| **Transport** | HTTP over TCP (`8080`) | UDP Datagrams (`7000`) |
| **Feedback / Acknowledgment** | ✅ Full HTTP 200/204 response codes | ❌ Fire-and-forget (No ACK) |
| **Dynamic Discovery** | ✅ Scans composition graph automatically | ❌ Requires manual path guessing |
| **Color Synchronization** | ✅ Supported (`ParamColor` hex updates) | ⚠️ Limited / Unreliable |
| **Verified on Arena 7.28** | ✅ Verified live | ⚠️ UDP send only |

By default, the app is set to **Auto (REST then OSC)**, which prioritizes the REST API and gracefully falls back to OSC if needed.

---

## 2. Resolume REST API Architecture

### Composition Graph Discovery

When you click **Scan composition**, the app executes:

```http
GET /api/v1/composition
Host: 127.0.0.1:8080
Accept: application/json
```

Resolume returns the full active composition JSON tree. The app traverses this graph to locate text-capable parameters:

1. **Text Block Source Clips**:
   - Located at: `clip.video.sourceparams.Text`
   - Description: `clip.video.description === "Text Block"` (or `"Text Animator"`)
   - Parameter type: `ParamText`
   - Target name extracted from: `clip.name.value`
2. **Text Block Effects**:
   - Located at: `clip.video.effects`, `layer.video.effects`, `group.video.effects`, or `composition.video.effects`
   - Matched when `name` or `display_name` contains `"Text"` and parameter `params.Text` exists as `ParamText`.

### Parameter Updating via REST

To push timer strings to Resolume without altering clip playback or introducing lag, the app updates parameters directly by their unique 64-bit integer ID:

```http
PUT /api/v1/parameter/by-id/1793278954342
Content-Type: application/json

{ "value": "00:09:59" }
```

**Response**: `204 No Content` (Instantaneous update without re-triggering the clip).

> [!NOTE]
> Older Resolume builds utilized `/api/v1/param/by-id/{id}/value`. On Resolume Arena 7.28+, this returns a `404 Not Found`. This app automatically uses `/api/v1/parameter/by-id/{id}` with an automated legacy fallback.

---

### Text Block Color Synchronization

When **Update Text Block color** is enabled, the timer app queries the companion `Color` parameter (`ParamColor`) on the same Text Block source or effect:

```http
PUT /api/v1/parameter/by-id/1793347371940
Content-Type: application/json

{ "value": "#00ff66ff" }
```

Values are sent as 8-digit RGBA hex strings (`#rrggbbaa`), dynamically matching your color scheme:
- **Running**: Active countdown color (e.g. `#00ff66ff`)
- **Warning Threshold**: Approaching zero (e.g. `#ffcc00ff`)
- **Time Out**: Zero or Overtime (e.g. `#ff0055ff`)

---

### Time's Up Clip & Column Connect Triggers

When the countdown hits `00:00:00`, the app can optionally fire clip or column triggers in Resolume Arena:

- **Connect Clip**:
  ```http
  POST /api/v1/composition/layers/{layer}/clips/{column}/connect
  ```
- **Connect Column**:
  ```http
  POST /api/v1/composition/columns/{column}/connect
  ```
- **Connect Layer Group Column**:
  ```http
  POST /api/v1/composition/layergroups/{group}/columns/{column}/connect
  ```

Indices are 1-based. No request body is required; the connect action functions identically to clicking the clip or column header in Resolume's GUI.

---

## 3. OSC Routing & Address Layout

### OSC Setup in Arena

To enable OSC input in Resolume:
1. Open **Preferences** (`Ctrl + ,`).
2. Go to **OSC**.
3. Under **OSC Input**, check **Enabled**.
4. Set **Port** to `7000`.

### Supported OSC Paths

The app generates OSC address strings matching Resolume Arena's internal generator and effect naming:

| Target Type | Primary OSC Address |
| --- | --- |
| **Text Block Source** | `/composition/layers/{layer}/clips/{clip}/video/source/blocktextgenerator/text` |
| **Text Animator Source** | `/composition/layers/{layer}/clips/{clip}/video/source/textgenerator/text` |
| **Clip Effect** | `/composition/layers/{layer}/clips/{clip}/video/effects/{effect}/effect/text` |
| **Layer Effect** | `/composition/layers/{layer}/video/effects/{effect}/effect/text` |
| **Composition Effect** | `/composition/video/effects/{effect}/effect/text` |

Legacy fallback paths (e.g. `/source/blocktext/text`) are also included in the payload for compatibility with older Resolume patches.

---

## 4. Multi-Machine Network Setup (FOH to Stage VJ)

If the Timer app runs on a show control laptop (e.g. at Front of House) while Resolume Arena runs on a dedicated media server backstage:

```
[ FOH Show Laptop ] ---------------- Gigabit LAN ----------------> [ Backstage Media Server ]
  Timer Desktop App                                                   Resolume Arena 7.28
  Target IP: 192.168.1.50                                             IP: 192.168.1.50:8080
```

1. On the media server running Resolume Arena:
   - Determine its local IPv4 address (e.g. `192.168.1.50`).
   - In Arena **Preferences** → **Webserver**, make sure the Webserver is enabled on port `8080`.
   - Ensure Windows Firewall on the media server permits incoming connections on port `8080`.
2. On the Timer laptop at FOH:
   - Change **REST Host** from `127.0.0.1` to `192.168.1.50`.
   - Change **OSC Host** to `192.168.1.50`.
   - Click **Scan composition**.
   - The app will retrieve the remote media server's composition graph over the network seamlessly!

