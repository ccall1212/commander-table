# Older Knight's Vigil background, cache fix — v0.90.4 test copy

To check this copy, extract the ZIP and double-click **index.html**.

1. Open **Your look** and pick **Knight's Vigil**: it should be the older picture (two knights in helmets, a dark reflective floor, an orange sunset behind a castle), not the redraw with the bare-headed knights.
2. Start a game: the same older picture is behind the table.
3. If you still see the redrawn one, tell me which page you opened (the live site or this ZIP) and press Ctrl+F5 once.

## Assistant verification
- The live site's file is the older picture (identical bytes to the restored file). The app now requests it as `knights-vigil.webp?r=2` (and the thumbnail the same way), so a browser's saved copy of the old address can no longer be reused.
- The card-back browser test (which loads the appearance list) passes. **Not tested:** how it looks in your browser.
