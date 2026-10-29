# Bundled third-party code

| File | What | Version | License |
|---|---|---|---|
| `peerjs.min.js` | [PeerJS](https://peerjs.com), the direct browser-to-browser connection library used as the fallback to the relay | 1.5.4 | MIT (`PEERJS-LICENSE.txt`) |

`peerjs.min.js` is `dist/peerjs.min.js` from the official `peerjs@1.5.4` npm package, unmodified. The package tarball's checksum was verified against npm's published value
(`sha512-yFsoLMnurJKlQbx6kVSBpOp+AlNldY1JQS2BrSsHLKCZnq6t7saHleuHM5svuLNbQkUJXHLF3sKOJB1K0xulOw==`) and the file's own SHA-256 is
`ad5d8870d1e389914f9cba8d35be313c4327c69ee0a221e482e9bf7621136fe5`.

It is kept in the repository instead of loaded from a public CDN so that a compromised or unavailable CDN cannot change or break the game, and so the game still works when `index.html` is opened from a downloaded ZIP.

To update it: download the new version from npm (`npm pack peerjs@X.Y.Z`), check the tarball against `npm view peerjs@X.Y.Z dist.integrity`, copy `dist/peerjs.min.js` here, update this file and the version in the table, and run the multiplayer tests.
