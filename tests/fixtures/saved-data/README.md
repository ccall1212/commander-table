# Saved-data fixtures

Each `vX.Y.Z.json` file is what a **real** older release of the game saved in a browser: two decks (one with a commander, a double-faced card, an adventure card, a planeswalker and tokens; one without a commander), a practice game in progress (a tapped card, a card with counters, a face-down card, life and poison), and, for releases from v0.39.0 on, a backup file made by that release. The card data is made up; only the way each release stored it is real.

They are used by two tests that prove today's game still opens what older releases saved:

- `tests/test_saved_data_upgrade.cjs` runs in the automatic checks on every pull request (no browser needed).
- `tests/test_saved_data_upgrade_browser.cjs` opens each one in a real browser, resumes the saved game and starts new games from the old decks.

**Do not edit or delete a fixture to make a test pass.** A failing fixture means a player's saved data would break; fix the game or write a migration instead.

To add one (do this from the last release before a change that alters what is saved, for example the deck format, the saved game, backups or preferences):

```
NODE_PATH=<folder with playwright> node tools/make-saved-data-fixture.cjs vX.Y.Z
```

The tool unpacks that release from git, runs it in headless Chromium with no internet, and writes `tests/fixtures/saved-data/vX.Y.Z.json`. A saved game older than 24 hours is not offered for resuming, so the browser test refreshes each saved game's timestamp before loading it.
