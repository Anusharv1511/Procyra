# Wrapping Procyra as a native app (Capacitor)

Phase 1 is architected so wrapping is additive: the PWA already has a manifest, icons, a service worker, and cookie-based auth that works in a webview.

## Path

1. Deploy the web app first (see DEPLOYMENT.md). Capacitor will load your production URL.
2. In a fresh folder (or the repo):
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init Procyra com.yourdomain.procyra --web-dir=public
   ```
3. In `capacitor.config.ts`, point the app at the deployed site:
   ```ts
   const config: CapacitorConfig = {
     appId: "com.yourdomain.procyra",
     appName: "Procyra",
     webDir: "public",
     server: { url: "https://your-app.vercel.app", cleartext: false },
   };
   ```
   (Server-URL mode is right for a server-rendered Next.js app; a static export is not required.)
4. Add platforms and open the native IDEs:
   ```bash
   npx cap add ios && npx cap add android
   npx cap open ios     # Xcode: set signing team, bundle id
   npx cap open android # Android Studio: set applicationId, signing
   ```
5. Icons/splash: `npm i -D @capacitor/assets` then `npx capacitor-assets generate` (reuse `public/icons/icon-512.png`).
6. Store submission (your part): Apple Developer / Google Play accounts, screenshots, privacy policy URL, review notes. Note that Apple can reject thin webview wrappers — the guided playbooks, offline reading, and installable behavior are the "app-like" substance to point at; adding a native plugin (e.g. push notifications via `@capacitor/push-notifications`, tied to the alert engine) further strengthens the case and is the natural Phase 2/3 pairing.

## Gotchas

- Cookies: the session cookie is `SameSite=Lax` and `Secure` in production — fine for a webview pointed at your HTTPS domain.
- Deep links: configure `apple-app-site-association` / Android App Links if you want `https://` links to open the app.
- Offline: the same service worker runs inside the webview; offline entry remains a roadmap item there too.
