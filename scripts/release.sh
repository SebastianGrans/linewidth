#!/usr/bin/env bash
# Sign the extension and publish it as a GitHub release, along with the
# updates.json that installed copies check (through the update_url in
# manifest.json) to find new versions.
#
# Usage: bump "version" in manifest.json, commit, then run
#   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... scripts/release.sh

set -euo pipefail
cd "$(dirname "$0")/.."

: "${AMO_JWT_ISSUER:?must be set to your addons.mozilla.org API key}"
: "${AMO_JWT_SECRET:?must be set to your addons.mozilla.org API secret}"

version=$(node -p 'require("./manifest.json").version')
addon_id=$(node -p 'require("./manifest.json").browser_specific_settings.gecko.id')
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
tag="v$version"
xpi="web-ext-artifacts/linewidth-$version.xpi"

if [[ -n $(git status --porcelain) ]]; then
  echo "Commit or stash your changes first, so the release matches a commit" >&2
  exit 1
fi
if gh release view "$tag" >/dev/null 2>&1; then
  echo "Release $tag already exists. Bump \"version\" in manifest.json first" >&2
  exit 1
fi

npx web-ext lint

# Mozilla signs each version only once, so reuse the signed file if an
# earlier run of this script got that far
if [[ ! -f $xpi ]]; then
  npx web-ext sign --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
fi
if [[ ! -f $xpi ]]; then
  echo "Signing didn't produce $xpi. Check web-ext-artifacts/" >&2
  exit 1
fi

cat > web-ext-artifacts/updates.json <<EOF
{
  "addons": {
    "$addon_id": {
      "updates": [
        {
          "version": "$version",
          "update_link": "https://github.com/$repo/releases/download/$tag/$(basename "$xpi")"
        }
      ]
    }
  }
}
EOF

git rev-parse --quiet --verify "refs/tags/$tag" >/dev/null || git tag "$tag"
git push origin "$tag"

gh release create "$tag" "$xpi" web-ext-artifacts/updates.json \
  --verify-tag --title "$tag" --generate-notes
