# Auto-Update Guide (private code → public auto-updates)

The app updates itself with `electron-updater`. Your **source code stays
private**; only the built release files live in a **separate public repo**, so
every user's app can fetch updates with no token and no access to your code.

## One-time setup

1. **Create a public GitHub repo** for releases (code is NOT pushed here — only
   build artifacts):

   ```
   emrahsinekli/convert-everything-releases   (Public)
   ```

   This name is already wired in `package.json → build.publish`.

2. **Create a GitHub Personal Access Token** (classic) with the `repo` scope,
   which can write to the releases repo. Keep it private. Export it before
   releasing:

   ```bash
   export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

3. **Code signing (REQUIRED for macOS auto-update).**
   macOS (Squirrel.Mac) will only *apply* an update whose app bundle is signed
   with a valid **Apple Developer ID** certificate. The current build is
   unsigned, so it can download an update but cannot install it. Before
   releasing to real users you must sign + notarize (also required to sell the
   app without Gatekeeper warnings). Once you have a Developer ID:

   - set `build.mac.identity` to your "Developer ID Application: …" name
     (remove the `identity: null`), enable `hardenedRuntime: true`, and
   - add notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
     env vars + `afterSign` notarize, or electron-builder's `notarize: true`).

   I can wire this up the moment you have the certificate.

> ✅ Already done for you: the public repo `convert-everything-releases` exists,
> and **v1.0.0 is published** as the first release (dmg + zip + latest-mac.yml).
> `releaseType: release` means future `npm run release` runs publish directly
> (no draft to un-hide).

## Publishing a new version (every update)

1. Bump the version in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Run (the token comes straight from your logged-in `gh`):

   ```bash
   export GH_TOKEN=$(gh auth token)
   npm run release
   ```

   This builds the Mac app and uploads `Convert Everything-x.y.z-arm64.dmg`,
   `-arm64-mac.zip`, `latest-mac.yml`, and the blockmap to a new release on
   `convert-everything-releases`.

3. Publish/keep the GitHub release (electron-builder creates it as a draft by
   default — set it to published, or it auto-publishes with `--publish always`).

That's it. Within a few hours (or on next launch) every installed app:
- checks the public repo,
- downloads the new version in the background,
- shows a "Restart" toast, and
- installs on restart / next quit.

## How it behaves in the app
- Checks on launch (4s after start) and every 6 hours (`app.isPackaged` only).
- `autoDownload: true` → silent background download.
- `autoInstallOnAppQuit: true` → applies on quit even if the user ignores the toast.
- A toast offers an immediate **Restart** (`quitAndInstall`).

## Notes
- Intel users: also build/publish `--x64` (or a universal build) so they get
  updates too. Currently arm64-only.
- The `latest-mac.yml` file in each release is what the updater reads — don't
  delete it from the release assets.
