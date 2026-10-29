#!/usr/bin/env bash
# Runs every automatic check that needs nothing installed beyond Node and Python.
#   bash tests/run_checks.sh
# GitHub runs this on every pull request (see .github/workflows/tests.yml).
# Not covered here: the *_browser.cjs tests (they need a browser) and test_room_vault.cjs (needs miniflare).
cd "$(dirname "$0")/.." || exit 1
failed=0

echo "== JavaScript syntax"
for f in js/*.js; do
  node --check "$f" || { echo "FAIL syntax: $f"; failed=1; }
done

echo "== Python syntax"
python3 -m py_compile tools/bump-version.py tests/test_relay_protocol.py tests/check_versions.py || failed=1

echo "== Version numbers match everywhere"
python3 tests/check_versions.py || failed=1

echo "== Unit tests (no browser or packages needed)"
count=0
for f in tests/*.cjs; do
  if grep -q -E "playwright|puppeteer|chromium|miniflare" "$f"; then continue; fi
  count=$((count + 1))
  if out=$(timeout 120 node "$f" 2>&1); then
    echo "PASS $f"
  else
    echo "FAIL $f"; echo "$out" | tail -15; failed=1
  fi
done
echo "ran $count unit test files"

if [ "$failed" -ne 0 ]; then echo "SOME CHECKS FAILED"; exit 1; fi
echo "ALL CHECKS PASSED"
