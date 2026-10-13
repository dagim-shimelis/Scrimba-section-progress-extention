#!/bin/sh
set -eu
cd "$(dirname "$0")"

version=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json)
test -n "$version"
mkdir -p build
temporary=$(mktemp -d build/.package.XXXXXX)
trap 'rm -f "$temporary/extension.zip"; rmdir "$temporary"' EXIT

zip -q -X "$temporary/extension.zip" manifest.json progress.js progress.css icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
mv "$temporary/extension.zip" "build/scrimba-section-progress-$version.zip"
