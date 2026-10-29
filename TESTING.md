# Accessibility pass, supported browsers and 1.0 plan — v0.56.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

Almost nothing looks different. Things to try:

1. **Start screen looks the same** as before (cards backs, backgrounds, deck list, buttons, footer).
2. **Choose a deck with the keyboard.** If you have two or more saved decks, press **Tab** until a deck's round button is focused, then use the **Up/Down arrow keys**. The highlighted deck should change. Clicking a deck with the mouse should still work.
3. **Dialogs.** Open **Deck Builder**, then in a game open **☰ → Hotkeys** and **☰ → Display settings…**. Each should open, keep Tab inside it, and close with **Esc**, returning you to where you were.
4. **Practice solo and a normal online game** should play exactly as before.
5. Read the new **Accessibility** section and the new browser line under **What you need** in `docs/GUIDE.md`, and tell us if either is wrong or you would word it differently. In particular: do you agree that Chrome and Edge are the browsers you have tested most?

## Assistant verification

- **Automatic accessibility scanner (axe 4.10) in headless Chromium, opened from file://:** before the changes it found an unlabeled deck radio button (critical), three dialogs without names (serious), nested controls in the Deck Builder's card list (serious) and missing page landmarks (moderate). After the changes the start screen, practice game (Sidebar and Grid), Hotkeys and Display settings dialogs are clean. Still reported: the Deck Builder's nested controls (documented, not fixed) and a harmless landmark note on pop-up menus.
- **Keyboard checks:** Tab order across the start screen and top bar is sensible with visible focus rings; dialogs keep focus inside, close on Esc and return focus to the opener; picking a deck with the arrow keys works. Cards on the table can't be reached by keyboard (documented).
- **Automatic checks:** syntax, version numbers (26 places) and 17 unit-test files pass.
- **Not checked:** a real screen reader, text contrast over the background pictures (the scanner can't measure it), Firefox or Safari (only Chromium is available here), a real iPad.
