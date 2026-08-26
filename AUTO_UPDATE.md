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

3. **Code signing and notarization** — already configured.
   macOS (Squirrel.Mac) only *applies* an update whose bundle is signed with a
   valid **Apple Developer ID** certificate, so `build.mac` sets
   `identity: "Developer ID Application: Emrah Sinekli (75CRHC6QNK)"`,
   `hardenedRuntime: true` and `notarize: true`.

   Notarization needs an Apple **app-specific password** at release time. Store
   it once so you never type it again:

   ```bash
   xcrun notarytool store-credentials notarytool \
     --apple-id "you@example.com" --team-id 75CRHC6QNK --password "xxxx-xxxx-xxxx-xxxx"
   ```

   Otherwise export `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
   `APPLE_TEAM_ID` before releasing.

> ✅ Already done for you: the public repo `convert-everything-releases` exists,
> and **v1.0.0 is published** as the first release (dmg + zip + latest-mac.yml).
> `releaseType: release` means future `npm run release` runs publish directly
> (no draft to un-hide).

## Publishing a new version (every update)

1. Bump the version in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Run:

   ```bash
   ./scripts/release-mac.sh
   ```

   The script refuses to build a version that is already published, runs the
   locale check, takes the GitHub token from your logged-in `gh`, and picks up
   the notarization credentials (keychain profile if present, otherwise it
   prompts). It builds **both architectures** and uploads the arm64 and x64
   `.dmg` / `-mac.zip` files, `latest-mac.yml` and the blockmaps to a new
   release on `convert-everything-releases`.

   `npm run release` does the same build without the guard rails, if you have
   the environment variables set already.

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
- Both `--arm64` and `--x64` are built by default, so Apple Silicon and Intel
  Macs both receive updates. `./scripts/release-mac.sh --arm-only` skips Intel.
- The `latest-mac.yml` file in each release is what the updater reads — don't
  delete it from the release assets.
