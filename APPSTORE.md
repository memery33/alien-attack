# Shipping SUBSTRATA to the App Store (and Google Play)

The game is a self-contained HTML5/canvas app. To put it on the **Apple App
Store** it must be wrapped in a native shell — we use **Capacitor**, which loads
the exact web build inside a native WebView and produces real Xcode / Android
Studio projects you submit.

You do the account + final Xcode upload (needs a Mac); everything else is wired.

---

## 0. One-time prerequisites
- **Node.js 18+** and **npm**.
- **Apple Developer Program** membership — **$99/year** (https://developer.apple.com/programs/). Required to ship to the store.
- A **Mac with Xcode** (App Store uploads must come from Xcode/Transporter). No Mac? Use a cloud Mac CI (Codemagic, EAS Build, MacStadium).
- (Android) **Android Studio** + a Google Play Developer account ($25 one-time).

## 1. Install dependencies
```bash
cd alien-attack
npm install
```

## 2. Build the web bundle
```bash
npm run build:web      # assembles ./www from index.html, css/, js/, assets/
```

## 3. Add native platforms (first time only)
```bash
npx cap add ios
npx cap add android
```

## 4. Open in the native IDE
```bash
npm run ios            # build:web + cap sync + open Xcode
npm run android        # build:web + cap sync + open Android Studio
```
After any code change, just re-run `npm run ios` / `npm run android` (it re-syncs `www/`).

---

## 5. App icons & splash (recommended)
Generate native icon/splash sets from a single source image with the official tool:
```bash
npx @capacitor/assets generate --iconBackgroundColor '#05070d' --splashBackgroundColor '#05070d'
```
Put a 1024×1024 `assets/appicon.png` (and optional `assets/splash.png`) in an
`assets/` source folder first (see the tool's docs). We already ship
`assets/icon-512.png` you can upscale, or drop in your Grok-made key art.

## 6. iOS settings to set in Xcode (App target)
- **Display Name:** SUBSTRATA · **Bundle ID:** `com.substrata.game` (must match `capacitor.config.json`).
- **Deployment target:** iOS 14+.
- **Device Orientation:** check **Landscape Left** and **Landscape Right** only (uncheck Portrait) — the game is landscape.
- **Signing & Capabilities:** select your Apple Developer Team (automatic signing).
- Status bar is handled in-app; "black-translucent" + `viewport-fit=cover` are already set.

## 7. Android orientation (one line)
In `android/app/src/main/AndroidManifest.xml`, on the `<activity>` tag add:
```xml
android:screenOrientation="sensorLandscape"
```

## 8. Test on a device
- iOS: pick your iPhone in Xcode, press ▶. (Free Apple ID works for on-device testing; the $99 program is only needed to submit.)
- Android: `npx cap run android`.

## 9. Submit
1. In **App Store Connect**, create a new app (Bundle ID `com.substrata.game`).
2. In Xcode: **Product ▸ Archive ▸ Distribute App ▸ App Store Connect**.
3. Fill in: screenshots (6.7" + 5.5" required), description, keywords, age rating, and a **privacy "nutrition label"** — SUBSTRATA collects **no data** (all saves are local `localStorage`), so declare "Data Not Collected".
4. Submit for review.

### Apple review notes that apply to us
- **Guideline 4.2 (minimum functionality):** a real game with progression — fine.
- The app works fully **offline** (service worker + local saves) — reviewers like this.
- No login, no ads, no external purchases to explain. Keep it that way for the smoothest review.

---

## What's already wired for you
- `package.json` scripts: `build:web`, `ios`, `android`, `cap:sync`, `test`.
- `capacitor.config.json`: app id/name, dark theme background, splash + status-bar config.
- `tools/build-web.js`: dependency-free assembler → `./www`.
- `js/main.js → initNative()`: hides the native splash and styles the status bar when running inside Capacitor (no-ops in a browser).
- `www/`, `ios/`, `android/` are git-ignored (build artifacts).
