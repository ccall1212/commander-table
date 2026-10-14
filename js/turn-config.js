/* turn-config.js - relay ("TURN") servers for Commander Table.
 *
 * Players normally connect straight to each other. Some networks (work networks,
 * VPNs, phone hotspots, strict routers) block that, and then the game needs a
 * relay server to pass the traffic along. Paste your relay details below.
 *
 * Get free ones at https://www.metered.ca/tools/openrelay/ (sign up, then copy the
 * "urls", "username" and "credential" values from the dashboard). Every player's
 * browser needs these to connect, so they are public by nature - do not reuse a
 * password from anywhere else here.
 *
 * Leave the list empty to use direct connections only.
 */
window.CT_TURN = [
  // { urls: 'turn:global.relay.metered.ca:80',                username: 'PASTE_USERNAME', credential: 'PASTE_CREDENTIAL' },
  // { urls: 'turn:global.relay.metered.ca:80?transport=tcp',  username: 'PASTE_USERNAME', credential: 'PASTE_CREDENTIAL' },
  // { urls: 'turn:global.relay.metered.ca:443',               username: 'PASTE_USERNAME', credential: 'PASTE_CREDENTIAL' },
  // { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'PASTE_USERNAME', credential: 'PASTE_CREDENTIAL' },
];
