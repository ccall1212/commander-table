/* net-config.js - how browsers reach each other for online games.
 *
 * relayUrl: the Cloudflare relay (relay/SETUP.md). It's a public address, not a secret.
 *           Leave '' to use direct browser-to-browser connections (PeerJS) only.
 * mode:     'auto'  - relay first, fall back to direct if the relay can't be reached
 *           'relay' - relay only
 *           'p2p'   - direct (PeerJS) only
 * Add ?net=relay or ?net=p2p to the page address to override the mode for testing.
 */
window.CT_NET = {
  relayUrl: '',
  mode: 'auto'
};
