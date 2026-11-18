#!/usr/bin/env bash
#
# Build the system archive from the files currently on disk.
#
# Usage:
#   ./scripts/build.sh daggerheart.system
#   ./scripts/build.sh /tmp/builds/daggerheart.system
#
# The output path is taken verbatim from the first argument; relative paths
# resolve against the directory you ran the script from, not the repo root.
#
# The archive is made by `git archive`, like the Release workflow, from a
# throwaway index of the working tree: uncommitted changes are included,
# .gitignore'd files (cache/, node_modules/, .DS_Store) are not, and the paths
# marked `export-ignore` in .gitattributes are left out exactly as on release.

set -euo pipefail

OUTPUT="${1:-}"

if [ -z "$OUTPUT" ] || [ "$OUTPUT" = "-h" ] || [ "$OUTPUT" = "--help" ]; then
  echo "usage: $0 <output-file>" >&2
  exit 1
fi

# Resolve the output against the caller's directory before moving to the repo.
case "$OUTPUT" in
  /*) ;;
   *) OUTPUT="$PWD/$OUTPUT" ;;
esac

cd "$(dirname "$0")/.."

SYSTEM_ID=$(jq -r '.id' manifest.json)
VERSION=$(jq -r '.version' manifest.json)
SYSTEM_VERSION=$(jq -r '.version' system.json)
DOWNLOAD=$(jq -r '.download' manifest.json)
REPO_URL=$(jq -r '.repository' system.json)
EXPECTED_DOWNLOAD="${REPO_URL%/}/releases/download/${VERSION}/${SYSTEM_ID}.system"

# The same consistency the Release workflow demands of a tagged commit.
fail=0
if [ "$SYSTEM_VERSION" != "$VERSION" ]; then
  echo "version mismatch: manifest.json is '${VERSION}', system.json is '${SYSTEM_VERSION}'" >&2
  fail=1
fi
if [ "$DOWNLOAD" != "$EXPECTED_DOWNLOAD" ]; then
  echo "manifest.json download is '${DOWNLOAD}', expected '${EXPECTED_DOWNLOAD}'" >&2
  fail=1
fi
[ "$fail" -eq 0 ] || exit 1

# Stage the working tree into a temporary index, leaving the real one alone.
# Sheets' node_modules/ are never packed, even if .gitignore stops covering them.
export GIT_INDEX_FILE
GIT_INDEX_FILE=$(mktemp)
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
rm -f "$GIT_INDEX_FILE"
git add -A -- . ':(exclude,glob)sheets/*/node_modules/**'
TREE=$(git write-tree)

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT"

git archive --format=zip --output "$OUTPUT" "$TREE"

echo "${SYSTEM_ID} ${VERSION}"
unzip -l "$OUTPUT" | tail -1
ls -lh "$OUTPUT" | awk '{print "  " $5, $NF}'
