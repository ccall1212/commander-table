#!/usr/bin/env python3
"""Build js/precons.js: the pre-con Commander decks offered on the start screen.

    python tools/build-precons.py                 # rebuild from MTGJSON (needs internet)
    python tools/build-precons.py --min-year 2016 # the oldest release year to include (default 2016)
    python tools/build-precons.py --cache DIR     # where downloaded deck summaries are kept between runs

Run it when a new Commander product comes out. Only Python 3 is needed (no packages).

What it does
  1. Downloads MTGJSON's deck list and set list (https://mtgjson.com, MIT license) and every "Commander Deck" file. Each file is about
     650 KB because it carries full card data, so only the card NAMES and counts are kept (in the cache, about 2 KB per deck).
  2. Removes duplicates by comparing the real card lists (commander(s) plus the 99), so "Collector's Edition" versions and reprints
     of an older deck (for example the Commander Anthology decks) are dropped. The EARLIEST release of a list is the one kept.
     Duplicates are removed first and the year filter is applied second, so a reprint of a pre-2016 deck can never sneak back in.
  3. Writes js/precons.js with the decks grouped by set and year, newest first.

The output is plain decklists in the same text format the Import box reads, so a pre-con deck is loaded by the normal importer.
"""
import argparse
import collections
import json
import re
import sys
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://mtgjson.com/api/v5/'
HEADERS = {'User-Agent': 'CommanderTable-precon-builder/1.0', 'Accept': 'application/json'}

LICENSE_NOTICE = """MTGJSON (https://mtgjson.com) deck lists are used under the MIT License.
Copyright (c) 2018 - Present, Zach Halpern

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions: the above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."""


def fetch_json(url: str, tries: int = 4):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:  # network hiccup: wait a little and try again
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'could not download {url}: {last}')


def front(name: str) -> str:
    return name.split(' // ')[0].strip()


def deck_summary(cache: Path, meta: dict) -> dict:
    """The compact record of one deck: name, release, commander(s) and the card counts. Downloaded once, then cached."""
    path = cache / (meta['fileName'] + '.json')
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    data = fetch_json(BASE + 'decks/' + meta['fileName'] + '.json')['data']
    main = collections.Counter()
    for card in data.get('mainBoard', []):
        main[card['name']] += card.get('count', 1)
    rec = {
        'file': meta['fileName'], 'name': data['name'], 'code': data['code'], 'date': data['releaseDate'],
        'commanders': [c['name'] for c in data.get('commander', [])],
        'main': sorted(main.items()),
    }
    path.write_text(json.dumps(rec, ensure_ascii=False), encoding='utf-8')
    return rec


def group_label(set_name: str, year: str) -> str:
    """'Final Fantasy Commander' -> 'Final Fantasy: 2025'. A set that already carries its year ('Commander 2016') is left alone, and a
    colon inside the name becomes a dash so there is only one colon in the label."""
    name = 'Secret Lair' if set_name == 'Secret Lair Drop' else set_name
    if name.endswith(' Commander') and len(name) > len(' Commander'):
        name = name[: -len(' Commander')]
    name = name.replace(': ', ' – ')
    return name if year in name else f'{name}: {year}'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--min-year', type=int, default=2016)
    ap.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'commander-table-precon-cache')
    ap.add_argument('--out', type=Path, default=ROOT / 'js' / 'precons.js')
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    print('Downloading the deck list and set list...')
    metas = [d for d in fetch_json(BASE + 'DeckList.json')['data'] if d['type'] == 'Commander Deck']
    sets = {s['code']: s['name'] for s in fetch_json(BASE + 'SetList.json')['data']}
    print(f'{len(metas)} Commander decks listed; fetching any that are not cached yet...')
    with ThreadPoolExecutor(max_workers=6) as pool:
        decks = list(pool.map(lambda m: deck_summary(args.cache, m), metas))

    # Remove exact duplicates (same commander(s) and same 99 cards, printings ignored); keep the earliest release.
    seen = {}
    for d in sorted(decks, key=lambda d: (d['date'], 'Collector' in d['name'], d['file'])):
        key = (tuple(sorted(d['commanders'])), tuple(sorted(map(tuple, d['main']))))
        seen.setdefault(key, d)
    unique = list(seen.values())
    kept = [d for d in unique if d['date'][:4] >= str(args.min_year)]
    print(f'{len(decks)} decks -> {len(unique)} unique -> {len(kept)} from {args.min_year} on')
    problems = [d['name'] for d in kept if len(d['commanders']) + sum(n for _, n in d['main']) != 100 or not d['commanders']]
    if problems:
        print('WARNING: not 100 cards or no commander:', problems, file=sys.stderr)

    # Newest group first; inside a group, by commander name.
    def group_key(d):
        return (d['date'][:4], d['code'])
    order = sorted({group_key(d) for d in kept}, key=lambda k: (k[0], max(x['date'] for x in kept if group_key(x) == k), k[1]), reverse=True)
    rank = {k: i for i, k in enumerate(order)}
    kept.sort(key=lambda d: (rank[group_key(d)], front(d['commanders'][0]).lower()))

    lines = ['/* precons.js - pre-con Commander decks for new players (the dropdown under "Your deck" on the start screen).',
             ' * GENERATED by tools/build-precons.py from MTGJSON deck lists. Do not edit by hand: run the tool again instead.',
             ' * Each deck is a plain decklist (commander block, then the other 99) read by the normal deck import, so it needs no special',
             ' * saved-data format. Duplicates (Collector\'s Edition versions and reprints) have been removed by comparing the card lists.',
             ' *']
    lines += [' * ' + l if l else ' *' for l in LICENSE_NOTICE.split('\n')]
    lines += [' */', 'window.CTPrecons = [']
    for i, d in enumerate(kept):
        names = [front(c) for c in d['commanders']]
        title = ' + '.join(names)
        text = 'Commander\n' + '\n'.join('1 ' + c for c in d['commanders']) + '\n\nDeck\n' + '\n'.join(f'{n} {k}' for k, n in d['main'])
        for bad in ('`', '${', '\\'):
            assert bad not in text, (d['name'], bad)
        entry = {'id': d['file'].lower(), 'name': title, 'commander': title,
                 'group': group_label(sets.get(d['code'], d['code']), d['date'][:4]), 'code': d['code'], 'date': d['date']}
        body = ', '.join(f'{k}: {json.dumps(v, ensure_ascii=False)}' for k, v in entry.items())
        lines.append('  { ' + body + ', text: `' + text + '` }' + (',' if i < len(kept) - 1 else ''))
    lines.append('];')
    args.out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {args.out} ({args.out.stat().st_size // 1024} KB, {len(kept)} decks, {len(order)} groups).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
