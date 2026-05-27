#!/usr/bin/env bash
# Generate PWA install icons from assets/icons/icon.svg
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/assets/icons/icon.svg"
OUT="$ROOT/assets/icons"

for size in 192 512; do
  rsvg-convert -w "$size" -h "$size" "$SVG" -o "$OUT/icon-${size}.png"
  echo "Wrote icon-${size}.png"
done

rsvg-convert -w 180 -h 180 "$SVG" -o "$OUT/apple-touch-icon.png"
echo "Wrote apple-touch-icon.png"

rsvg-convert -w 512 -h 512 "$SVG" -o "$OUT/icon-maskable-512.png"
echo "Wrote icon-maskable-512.png"

rsvg-convert -w 32 -h 32 "$SVG" -o "$OUT/favicon-32.png"
echo "Wrote favicon-32.png"
