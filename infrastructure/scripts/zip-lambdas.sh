#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$0")/../terraform/modules/lambdas"

echo "📦 Zipping Lambda functions..."

for fn in upload list download delete; do
  zip -j "$ROOT/${fn}.zip" "$ROOT/$fn/main.py"
  echo "✅ Zipped $fn -> ${fn}.zip"
done

echo "🎉 All Lambda zips created."
