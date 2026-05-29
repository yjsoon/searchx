#!/usr/bin/env node
/**
 * xAI OAuth Device Code Helper
 * 
 * Allows using your X Premium / SuperGrok subscription for real x_search
 * (the same path OpenClaw and other tools use).
 *
 * Usage:
 *   node xai-oauth.js --login
 *   node xai-oauth.js --status
 *   node xai-oauth.js --refresh
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN_FILE = path.join(process.env.HOME, '.agents/tools/xai-xsearch/.auth/xai-oauth.json');

const AUTH_BASE = 'https://auth.x.ai';
const DEVICE_CODE_URL = `${AUTH_BASE}/oauth2/device/code`;
const TOKEN_URL = `${AUTH_BASE}/oauth2/token`;

// Common client used by CLI tools for Grok / xAI (this is the shared one many tools use)
const DEFAULT_CLIENT_ID = process.env.XAI_OAUTH_CLIENT_ID || 'grok-cli';

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      method,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'xai-xsearch-skill/0.1',
        ...headers,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function saveTokens(tokens) {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  console.log(`Saved tokens to ${TOKEN_FILE}`);
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

async function deviceLogin() {
  console.log('Starting xAI device code login (uses your X Premium account)...\n');

  // Step 1: Request device code
  const params = new URLSearchParams({
    client_id: DEFAULT_CLIENT_ID,
    scope: 'openid profile email offline_access grok-cli:access api:access',
  });

  let deviceResp;
  try {
    deviceResp = await request('POST', DEVICE_CODE_URL, params.toString());
  } catch (e) {
    console.error('Failed to start device flow:', e.message);
    console.error('\nYou may need a different client_id. Check OpenClaw or Hermes Agent source for the current shared client.');
    process.exit(1);
  }

  const { device_code, user_code, verification_uri, verification_uri_complete, interval = 5, expires_in } = deviceResp;

  console.log('Please open this URL in any browser and enter the code:');
  console.log(verification_uri_complete || `${verification_uri}\nCode: ${user_code}`);
  console.log(`\nThis code expires in ~${Math.floor(expires_in / 60)} minutes.\n`);

  // Step 2: Poll for token
  const tokenParamsBase = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code,
    client_id: DEFAULT_CLIENT_ID,
  };

  const start = Date.now();
  const maxWait = (expires_in || 900) * 1000;

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval * 1000));

    const body = new URLSearchParams(tokenParamsBase).toString();

    try {
      const tokenResp = await request('POST', TOKEN_URL, body);
      if (tokenResp.access_token) {
        const toSave = {
          access_token: tokenResp.access_token,
          refresh_token: tokenResp.refresh_token,
          token_type: tokenResp.token_type || 'Bearer',
          expires_at: Date.now() + (tokenResp.expires_in || 3600) * 1000,
          scope: tokenResp.scope,
          obtained_at: new Date().toISOString(),
        };
        saveTokens(toSave);
        console.log('\n✅ Login successful! You can now use real x_search with your X Premium subscription.');
        return;
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('authorization_pending')) {
        process.stdout.write('.');
        continue;
      }
      if (msg.includes('slow_down')) {
        // increase interval slightly
        continue;
      }
      if (msg.includes('expired_token') || msg.includes('access_denied')) {
        console.error('\nDevice code expired or login was denied.');
        process.exit(1);
      }
      console.error('\nUnexpected error during polling:', msg);
      process.exit(1);
    }
  }

  console.error('\nTimed out waiting for login.');
  process.exit(1);
}

async function refresh() {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) {
    console.error('No refresh_token found. Run --login first.');
    process.exit(1);
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: DEFAULT_CLIENT_ID,
  });

  try {
    const newTokens = await request('POST', TOKEN_URL, params.toString());
    const updated = {
      ...tokens,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + (newTokens.expires_in || 3600) * 1000,
    };
    saveTokens(updated);
    console.log('Token refreshed successfully.');
  } catch (e) {
    console.error('Refresh failed:', e.message);
    process.exit(1);
  }
}

function status() {
  const tokens = loadTokens();
  if (!tokens) {
    console.log('No tokens stored. Run with --login');
    return;
  }
  const expiresIn = Math.max(0, Math.floor((tokens.expires_at - Date.now()) / 1000 / 60));
  console.log('xAI OAuth status:');
  console.log(`  Obtained: ${tokens.obtained_at}`);
  console.log(`  Expires in: ~${expiresIn} minutes`);
  console.log(`  Has refresh_token: ${!!tokens.refresh_token}`);
  console.log(`  Scopes: ${tokens.scope || '(unknown)'}`);
}

const cmd = process.argv[2] || '--status';

if (cmd === '--login' || cmd === 'login') {
  deviceLogin();
} else if (cmd === '--refresh' || cmd === 'refresh') {
  refresh();
} else if (cmd === '--status' || cmd === 'status') {
  status();
} else {
  console.log('Usage: node xai-oauth.js [--login | --status | --refresh]');
}
