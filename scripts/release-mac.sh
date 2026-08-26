#!/usr/bin/env bash
#
# Build, sign, notarize and publish a macOS release.
#
# Notarization needs an Apple app-specific password. This script prefers a
# stored notarytool keychain profile so the password is typed once, ever:
#
#   xcrun notarytool store-credentials notarytool \
#     --apple-id "you@example.com" --team-id 75CRHC6QNK --password "xxxx-xxxx-xxxx-xxxx"
#
# Without that profile it prompts for the password and keeps it in memory only.
#
# Usage:  ./scripts/release-mac.sh              (Apple Silicon + Intel)
#         ./scripts/release-mac.sh --arm-only    (Apple Silicon only)

set -euo pipefail
cd "$(dirname "$0")/.."

APPLE_TEAM_ID="${APPLE_TEAM_ID:-75CRHC6QNK}"
# Both architectures by default: an arm64-only release leaves every Intel Mac
# stuck on its installed version, with no visible error.
ARCHES="--arm64 --x64"
[ "${1:-}" = "--arm-only" ] && ARCHES="--arm64"

VERSION=$(node -p "require('./package.json').version")
echo "==> Releasing Convert Everything v${VERSION} (${ARCHES})"

# Refuse to build a version that is already published, which would either fail
# on upload or ship an update nobody receives.
if gh release view "v${VERSION}" --repo emrahsinekli/convert-everything-releases >/dev/null 2>&1; then
  echo "ERROR: v${VERSION} is already published. Bump the version in package.json first." >&2
  exit 1
fi

# Locale integrity: a half-translated build must not ship.
npm run check-locales

echo "==> GitHub token"
export GH_TOKEN="${GH_TOKEN:-$(gh auth token)}"

echo "==> Apple notarization credentials"
if xcrun notarytool history --keychain-profile notarytool >/dev/null 2>&1; then
  echo "    using stored keychain profile 'notarytool'"
  export APPLE_KEYCHAIN_PROFILE="notarytool"
else
  if [ -z "${APPLE_ID:-}" ]; then
    read -r -p "    Apple ID (email): " APPLE_ID
    export APPLE_ID
  fi
  if [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]; then
    read -r -s -p "    App-specific password (xxxx-xxxx-xxxx-xxxx): " APPLE_APP_SPECIFIC_PASSWORD
    echo
    export APPLE_APP_SPECIFIC_PASSWORD
  fi
  export APPLE_TEAM_ID
fi

echo "==> Building, signing, notarizing and publishing (this takes a while)"
npm run build
npx electron-builder --mac $ARCHES --publish always

echo
echo "==> Done. v${VERSION} is published."
echo "    Installed apps pick it up on next launch or within 6 hours."
gh release view "v${VERSION}" --repo emrahsinekli/convert-everything-releases --json name,assets \
  --jq '.name, (.assets[].name)' 2>/dev/null || true
