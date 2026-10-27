# Touch mode (Beta) menu label — v0.55.2 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

1. Enter a name, pick or import a deck, and click **Practice solo**.
2. Click the **☰** menu at the top right. The item should now read **Touch mode (Beta): Off**.
3. Click it. A message says Touch mode is on, and reopening the menu should read **Touch mode (Beta): On**. Click it again to turn it off.
4. Everything else in the menu should look and work as before. Check that the longer label is not cut off or wrapped awkwardly on your screen. If you have an iPhone or iPad, look at it in portrait and landscape.

## Assistant verification (headless Chromium, opened from file://)

At 1600×900 and at phone sizes (390×844 portrait, 844×390 landscape) the menu item reads "Touch mode (Beta): Off", is fully on screen, and flips to "On" when clicked, with no page errors. Not checked on a real iPhone or iPad.
