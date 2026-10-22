# Remove saved appearance images — Objective #42, v0.45.0

Includes published v0.44.0 Host Game setup and v0.43.0 readiness roster. Extract the ZIP and double-click **index.html**; no terminal or installation is needed.

## Click list

1. In **Your look**, open **Upload your own images** and upload a card back and background (or use ones already saved in this browser). Close the upload panel. Each **Your upload** tile now has a visible **Remove** button beneath it.
2. Press Remove for the card back, then **Keep image** or Esc. The saved image stays selected and available. Confirming **Remove** deletes only the card back, removes its upload tile and selects your previous preset. The saved background and decks stay intact.
3. Try the same with the background. Also try selecting a preset first, leaving the upload saved but inactive, then removing it. Your chosen preset stays selected.
4. Reload: removed upload tiles stay gone. Upload again: the saved tile and Remove button return. The older removal buttons inside the upload panel still work, with the same confirmation.
5. Check at 1920×1080 and 1366×768. Tab to Remove and use Enter; cancellation returns focus to Remove, while confirmation moves focus to the selected preset. Bundled presets remain available.

## Verification

- Actual Chromium checks over localhost HTTP passed at 1920×1080 and 1366×768: valid PNG uploads for both kinds, visible Remove controls with the panel closed, active-image cancellation with Esc and Keep image, inactive-background removal preserving the active card back, active-card-back removal with preset fallback, unchanged 12/10 bundled preset counts and reload persistence. Accessible button names, Enter opening the confirmation, Esc/cancel focus restoration, focus on the preset after removal and the older removal controls were checked. Settled confirmation screenshots for both upload types were visually reviewed. Practice solo used the preset background after deletion. No page errors.
- Changed JavaScript syntax, collection backup's 12 checks, player-color checks, all 21 version/cache links and diff checks pass. Source review found no material issues.
- This is browser-local appearance UI; no multiplayer transport or relay/protocol code changed. Assistant checks use HTTP; no file:// or real-device Safari result is claimed. Chris has not tested this change yet; publication awaits his approval. Draft PR #11 remains paused and untouched.
