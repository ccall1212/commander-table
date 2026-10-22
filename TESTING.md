# Background previews — v0.52.0 test copy (Objective #47)

Download the PR's exact-commit ZIP, extract it, and double-click `index.html`. No terminal or server is needed. This is a test copy awaiting Chris's review; the published game remains v0.51.0.

1. On the opening screen, find **Your look → Play area background**. Click **Preview** below any background. The complete, larger image should appear without the gameplay dark overlay. Previewing must leave the selected thumbnail unchanged.
2. Close with **Close preview**, ×, Escape, or a click outside the dialog. Reopen another preview. Try keyboard Tab and Enter too; closing should return focus to the preview button.
3. Click a background thumbnail itself. It should still select the background. Preview a different image and close it: the thumbnail you selected should stay selected. Start Practice with an existing deck and check your chosen background is used.
4. Open **Upload your own images** and upload a landscape JPG, PNG, or WebP at least 1280 × 720. Its **Your upload** tile should have its own Preview button. Choose a preset, preview Your upload, and confirm the preset remains selected. Select Your upload, preview a preset, and confirm Your upload remains selected. Reopen the page and confirm the saved upload still previews.
5. Try a maximized desktop window, roughly 1920 × 1080 and 1366 × 768, then a narrow window and landscape phone if available. The full image should fit without cropping or stretching, and the close controls should be reachable. Background preview is on the opening screen; normal Sidebar and Grid gameplay should retain their usual background rendering.

## Assistant verification

- Node syntax checks for both changed JavaScript files and `git diff --check` passed.
- Chromium over local HTTP: all ten preset images loaded from full-size assets at 1920 × 1080, 1366 × 768, 390 × 844 and 844 × 390. Dialog and image stayed within each viewport; previewing preserved stored appearance settings.
- A real file-input upload was optimized and saved by the app, then previewed while a preset was selected. Previewing a preset while the custom background was active also preserved the selection. Close button, ×, Escape and backdrop dismissal worked.
- Focus returned to the preview button after keyboard dismissal. A deliberately failed image request showed the readable error message and could be dismissed.
- A Luna subagent reviewed the implementation and found no actionable issues.
- Chromium blocks `file://` navigation here with `ERR_BLOCKED_BY_ADMINISTRATOR`; double-click launch still needs Chris's check. Real-device touch testing and live multiplayer were not performed for this lobby change.
