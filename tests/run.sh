#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/srs.test.js
node tests/content.test.js
echo "all tests passed"
