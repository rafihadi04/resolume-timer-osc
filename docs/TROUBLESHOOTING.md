# Troubleshooting & Frequently Asked Questions (FAQ)

This guide covers common issues and questions when setting up and running the Resolume Arena Application Timer.

---

## Table of Contents
1. [Resolume Connection Issues](#1-resolume-connection-issues)
   - [Health Indicator Shows "Degraded" or "Disconnected"](#health-indicator-shows-degraded-or-disconnected)
   - ["Scan composition" Returns 0 Targets](#scan-composition-returns-0-targets)
   - [Timer Runs in App, but Resolume Text Does Not Change](#timer-runs-in-app-but-resolume-text-does-not-change)
2. [Mobile Remote & Web Output Issues](#2-mobile-remote--web-output-issues)
   - [Phone Cannot Connect or QR Code Doesn't Load Page](#phone-cannot-connect-or-qr-code-doesnt-load-page)
   - [Firewall Troubleshooting on Windows](#firewall-troubleshooting-on-windows)
3. [NDI Video Output Issues](#3-ndi-video-output-issues)
   - [NDI Output Toggle Says "Unavailable"](#ndi-output-toggle-says-unavailable)
   - [Stream Not Appearing in OBS, vMix, or Resolume](#stream-not-appearing-in-obs-vmix-or-resolume)
4. [Timer Accuracy & Background Execution](#4-timer-accuracy--background-execution)
   - [Does the Timer Stop or Drift When Minimized?](#does-the-timer-stop-or-drift-when-minimized)
5. [Frequently Asked Questions (FAQ)](#5-frequently-asked-questions-faq)

---

## 1. Resolume Connection Issues

### Health Indicator Shows "Degraded" or "Disconnected"

- **Check 1: Is Resolume Arena Running?**  
  Resolume must be actively open and running.
- **Check 2: Is the Resolume Webserver Turned On?**  
  In Resolume, go to **Arena** → **Preferences** → **Webserver**. Ensure the **Enabled** checkbox is checked, and verify the port is set to `8080`.
- **Check 3: Is Another Application Using Port 8080?**  
  Tools like Apache, Tomcat, or certain web proxies may also listen on `8080`. If you change the Webserver port in Resolume (e.g. to `8090`), make sure to update **REST Port** in the Timer app to match.
- **Check 4: Testing the Connection in a Browser**  
  Open your web browser and navigate to `http://127.0.0.1:8080/api/v1/composition`. If you see a wall of JSON text, Resolume's REST API is working correctly.

---

### "Scan composition" Returns 0 Targets

If you click **Scan composition** and the dropdown says `0 targets found`:

- **Did you add a Text Block?**  
  The scan looks specifically for **Text Block** (or **Text Animator**) sources or effects. Ensure at least one Text Block generator clip or effect exists in your composition.
- **Is the clip empty?**  
  Empty slots in Resolume have `video: null`. Drag a generator from **Sources** → **Generators** → **Text Block** into a slot.
- **Layer & Clip Naming**:  
  Renaming your clips or layers in Resolume helps identify them quickly in the dropdown (e.g., "Stage Timer - Layer 3").

---

### Timer Runs in App, but Resolume Text Does Not Change

- **Verify "Send timer text to Resolume" is Checked**:  
  Ensure the top checkbox in the **Resolume Output** panel is enabled.
- **Verify a Target is Selected**:  
  In the **Text Block Target** dropdown, make sure you selected your specific Text Block clip.
- **Click "Send test text"**:  
  Clicking this button immediately sends `"TEST"` to Resolume. If this works, your connection is verified.
- **Is the Resolume Clip Active on an Output?**  
  Ensure the layer opacity is up and the clip is triggered (playing), otherwise Resolume will receive the text parameter, but you won't see it on your stage screen.

---

## 2. Mobile Remote & Web Output Issues

### Phone Cannot Connect or QR Code Doesn't Load Page

- **Are both devices on the same Wi-Fi?**  
  Your smartphone must be connected to the exact same Wi-Fi network or VLAN as the computer running the timer. Cellular data (4G/5G) will not reach your computer's local IP.
- **Multiple Network Adapters**:  
  If your computer has multiple network connections (e.g., Ethernet + Wi-Fi, or VPN adapters like Tailscale/ZeroTier), click the **Remote** button and check if alternate LAN IP addresses are listed in the modal.
- **Router "AP Isolation" / "Client Isolation"**:  
  Many hotel, conference, and guest networks block wireless devices from talking to each other. For show stability, always use a dedicated local production router or access point.

---

### Firewall Troubleshooting on Windows

If the phone browser says "Connection Timed Out":

1. Press `Windows Key + R`, type `firewall.cpl`, and press **Enter**.
2. Click **Allow an app or feature through Windows Defender Firewall** on the left.
3. Click **Change settings** (administrator).
4. Find **Resolume Timer** in the list.
5. Check both **Private** and **Public** checkboxes.
6. Click **OK** and try loading the remote URL again on your phone.

---

## 3. NDI Video Output Issues

### NDI Output Toggle Says "Unavailable"

If the NDI toggle says "NDI is not available on this system":
- The app uses native NDI 6 libraries. On Windows, ensure you have the **NDI 6 Runtime** (or NDI Tools) installed from [ndi.video/tools](https://ndi.video/tools/).
- Ensure your CPU supports AVX instructions (all modern Intel Core and AMD Ryzen processors support this).

---

### Stream Not Appearing in OBS, vMix, or Resolume

- **Is NDI Broadcasting Enabled?**  
  Ensure the **Broadcast NDI stream** checkbox is checked and the badge says **🟢 Broadcasting via NDI**.
- **mDNS / Multicast Discovery**:  
  NDI uses mDNS (multicast) to announce streams. If OBS or Resolume does not see the stream:
  - Check that Windows network profile is set to **Private Network** (not Public).
  - Ensure Windows Firewall allows `mDNS` and UDP port `5353`.
  - In OBS, verify the **OBS-NDI** plugin is up to date.

---

## 4. Timer Accuracy & Background Execution

### Does the Timer Stop or Drift When Minimized?

**No.** The app includes a multi-layered background persistence engine:

1. **Chromium Throttling Disabled**: App command-line flags disable background timer throttling and occlusion backgrounding.
2. **OS Sleep Prevention**: When running, the app invokes an OS-level `powerSaveBlocker` to prevent Windows from sleeping or suspending the process.
3. **Delta Timestamp Accumulator**: The timer engine tracks wall-clock delta time (`performance.now()`). Even if the window is hidden, minimized, or placed on another virtual desktop, the countdown will remain accurate to the millisecond with zero drift.

---

## 5. Frequently Asked Questions (FAQ)

#### Q: Can I run this without an active internet connection?
**A:** Yes! The entire app, including the Resolume REST connection, OSC output, LAN web confidence monitor, and NDI stream, operates entirely over local offline networks. No internet connection is ever required.

#### Q: Does this modify or save my Resolume composition file?
**A:** No. The app only writes live text and color strings to the active runtime parameters. It never saves, deletes, or alters your composition on disk.

#### Q: Can I run the timer on macOS?
**A:** Yes, the project supports building on macOS. In Resolume Preferences, the same REST API (port `8080`) and OSC paths apply.

#### Q: How can I donate or support development?
**A:** Click the **Donate** button in the app header to view the Indonesian **QRIS** donation code. Any Indonesian e-wallet or mobile banking app (GoPay, OVO, DANA, BCA, Mandiri, etc.) can scan it.

