#!/usr/bin/env python3
"""Set the app version everywhere it lives, in one step.

    python tools/bump-version.py 0.7.4

Updates:
  - index.html and admin.html   <meta name="app-version" content="X">
  - both HTML files   ?v=X on every local css/js link (so browsers never mix cached old files with a new page)
  - js/app.js    const APP_VERSION = 'X';
Add the CHANGELOG.md entry yourself.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        print(__doc__)
        return 2
    v = sys.argv[1]
    index = ROOT / "index.html"
    admin = ROOT / "admin.html"
    app = ROOT / "js" / "app.js"
    html = index.read_text(encoding="utf-8")
    admin_html = admin.read_text(encoding="utf-8") if admin.exists() else None
    js = app.read_text(encoding="utf-8")

    html, n_meta = re.subn(r'(<meta name="app-version" content=")[^"]*(">)', rf"\g<1>{v}\g<2>", html)
    # local assets only (css/..., js/...), with or without an existing ?v=
    html, n_assets = re.subn(r'((?:src|href)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"', rf'\g<1>?v={v}"', html)
    js, n_const = re.subn(r"(const APP_VERSION = ')[^']*(';)", rf"\g<1>{v}\g<2>", js)
    n_admin_meta = n_admin_assets = 0
    if admin_html is not None:
        admin_html, n_admin_meta = re.subn(r'(<meta name="app-version" content=")[^"]*(">)', rf"\g<1>{v}\g<2>", admin_html)
        admin_html, n_admin_assets = re.subn(r'((?:src|href)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"', rf'\g<1>?v={v}"', admin_html)
    if n_meta != 1 or n_const != 1 or n_assets < 5 or (admin_html is not None and (n_admin_meta != 1 or n_admin_assets < 3)):
        print(f"Unexpected matches: meta={n_meta} APP_VERSION={n_const} assets={n_assets} admin_meta={n_admin_meta} admin_assets={n_admin_assets}; nothing written.")
        return 1
    index.write_text(html, encoding="utf-8", newline="\n")
    if admin_html is not None:
        admin.write_text(admin_html, encoding="utf-8", newline="\n")
    app.write_text(js, encoding="utf-8", newline="\n")
    print(f"Version set to {v}: meta, APP_VERSION and {n_assets} asset links.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
