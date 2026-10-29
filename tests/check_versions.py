#!/usr/bin/env python3
"""Check that the app version is the same everywhere it lives.

    python tests/check_versions.py

tools/bump-version.py sets these in one step. This catches a hand edit or a
forgotten bump, which would let browsers mix cached old files with a new page.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PAGES = ["index.html", "admin.html"]


def main() -> int:
    versions = {}  # where it was found -> version
    app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
    m = re.search(r"const APP_VERSION = '([^']+)'", app)
    if not m:
        print("FAIL: APP_VERSION not found in js/app.js")
        return 1
    versions["js/app.js APP_VERSION"] = m.group(1)

    for page in HTML_PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        meta = re.search(r'<meta name="app-version" content="([^"]*)">', html)
        if meta:
            versions[f"{page} app-version meta"] = meta.group(1)
        # local css/js links only (css/..., js/...), not CDN links
        links = re.findall(r'(?:src|href)="((?:css|js)/[^"?]+)\?v=([^"]*)"', html)
        for path, version in links:
            versions[f"{page} {path}"] = version
        unversioned = re.findall(r'(?:src|href)="((?:css|js)/[^"?]+\.(?:css|js))"', html)
        for path in unversioned:
            versions[f"{page} {path} (no ?v=)"] = "MISSING"

    expected = versions["js/app.js APP_VERSION"]
    bad = {where: v for where, v in versions.items() if v != expected}
    if bad:
        print(f"FAIL: expected version {expected} everywhere, but found:")
        for where, v in sorted(bad.items()):
            print(f"  {where}: {v}")
        return 1
    print(f"PASS: version {expected} is the same in {len(versions)} places")
    return 0


if __name__ == "__main__":
    sys.exit(main())
