# Double-click background previews — v0.52.1 checks

This Objective #47 refinement shipped through PR #78 after Chris reported “Amazing” and approved publication. For a downloaded copy, extract the ZIP and double-click `index.html`; no terminal or server is needed. The steps below remain useful for checking the feature.

1. Find **Your look → Play area background** on the opening screen. The individual Preview buttons should be gone; a short hint explains click and double-click.
2. Click a thumbnail once: it should select that background without opening a dialog. Double-click a different thumbnail: it should select that background and open its full-size image without the gameplay dark overlay. Try an already-selected thumbnail too.
3. Close with **Close preview**, ×, Escape, or a click outside the dialog. The selected background should remain selected. Double-click the image area and the name beneath it to check both work.
4. With a keyboard, Tab to a different thumbnail and press **Shift+Enter**. It should enlarge without changing your selection. Escape should return focus to that thumbnail. Enter or Space by itself should select it.
5. Upload a JPG, PNG, or WebP background at least 1280 × 720 using **Upload your own images**. Select a preset, then double-click **Your upload**: the saved image should become selected and enlarge. Close and double-click a preset to switch back. Reload the page and check the saved upload can still enlarge.
6. Try desktop windows around 1920 × 1080 and 1366 × 768, a narrow window, and a short landscape window. The image should fit and the close controls should remain reachable. If available, check double-tap on your real phone/tablet; touch-device behavior needs your check.

## Assistant verification

Node syntax checks for both changed JavaScript files and `git diff --check` passed. Chromium over local HTTP double-clicked all ten initially unselected preset backgrounds at 1920 × 1080, 1366 × 768, 390 × 844 and 844 × 390. Each opened the full-size image, selected the clicked background and fit the dialog inside the viewport. Close button, × and Escape worked and returned focus to the thumbnail.

A real file-input upload, switching between saved upload and presets, custom-image preview after reload, Shift+Enter preview without selection, Enter selection and backdrop dismissal passed. No JavaScript page errors occurred. A Luna subagent reviewed the revision and found no actionable issues.

This environment blocks Chromium `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so extract-and-double-click launch still needs Chris's check. The narrow viewport checks used desktop Chromium, not a real touch device. Live multiplayer and Sidebar/Grid gameplay were not rerun for this lobby-only interaction revision.

Tested by Chris: reviewed the supplied test copy, reported “Amazing,” and approved publication. Specific device and interaction coverage was not supplied.
