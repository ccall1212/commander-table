# iPhone Touch mode menu access — v0.46.1 test copy

Extract the ZIP and double-click **index.html**; no terminal or local server is needed. This change has not been published.

1. On an iPhone, open a saved game or enter Practice solo. In portrait, the **☰** menu button should be visible at the top right. Tap it and choose **Touch mode: Off**. It should switch on and show **Touch mode: On** when you reopen the menu.
2. Rotate to landscape. The **☰** button should still be visible and usable; turn Touch mode off and on again. Confirm you can reach the menu both before and after switching modes.
3. If you play with others, check the same in a joined room. Try Sidebar and Grid if available. On a desktop-width browser, check that the top bar still works normally.

Please tell me which iPhone/browser and orientations you tried. Chris reported that the hamburger was unreachable on iPhone in both orientations before this fix; no post-fix iPhone test has been reported yet.

## Assistant verification

Mobile Chromium reproduced the old problem: the menu began around x=1,200 on 390px portrait and 844px landscape screens. After the fix, the button was inside 320×690 and 390×844 portrait and 844×390 landscape viewports; opening the menu and toggling Touch mode both on and off worked with no page errors. The portrait landscape tip stayed below the top bar. A desktop-width control also worked at 1366×768. Tests used localhost HTTP because file:// access is blocked by this environment’s browser policy. Real iPhone Safari and multiplayer remain to be checked by Chris. Paused draft PR #11 is untouched.
