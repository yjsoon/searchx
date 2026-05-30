const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN_FILE = process.env.XAI_OAUTH_TOKEN_FILE ||
  path.join(process.env.HOME, '.agents/tools/xai-xsearch/.auth/xai-oauth.json');

const AUTH_BASE = 'https://auth.x.ai';
const DEVICE_CODE_URL = `${AUTH_BASE}/oauth2/device/code`;
const TOKEN_URL = `${AUTH_BASE}/oauth2/token`;

const DEFAULT_CLIENT_ID = process.env.XAI_OAUTH_CLIENT_ID || 'b1a00492-073a-47ea-816f-4c329264a828';
const DEFAULT_SCOPE = process.env.XAI_OAUTH_SCOPE || 'openid profile email offline_access grok-cli:access api:access';

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      method,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'xsearch/0.1',
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
    if (body) req.write(body);
    req.end();
  });
}

function saveTokens(tokens) {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf8', mode: 0o600 });
  console.log(`Saved tokens to ${TOKEN_FILE}`);
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function loadAccessToken() {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('No OAuth token found. Run: xsearch auth login');
  }
  if (tokens.expires_at && Date.now() > tokens.expires_at) {
    throw new Error('Token expired. Run: xsearch auth refresh');
  }
  return tokens.access_token;
}

async function login() {
  console.log('Starting xAI device code login (uses your X Premium account)...\n');

  const params = new URLSearchParams({
    client_id: DEFAULT_CLIENT_ID,
    scope: DEFAULT_SCOPE,
  });

  let deviceResp;
  try {
    deviceResp = await request('POST', DEVICE_CODE_URL, params.toString());
  } catch (e) {
    throw new Error(`Failed to start device flow: ${e.message}\n\nYou may need a different client_id. Set XAI_OAUTH_CLIENT_ID and retry.`);
  }

  const { device_code, user_code, verification_uri, verification_uri_complete, interval = 5, expires_in } = deviceResp;
  let pollInterval = interval;

  console.log('Please open this URL in any browser and enter the code:');
  console.log(verification_uri_complete || `${verification_uri}\nCode: ${user_code}`);
  console.log(`\nThis code expires in ~${Math.floor(expires_in / 60)} minutes.\n`);

  const tokenParamsBase = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code,
    client_id: DEFAULT_CLIENT_ID,
  };

  const start = Date.now();
  const maxWait = (expires_in || 900) * 1000;

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval * 1000));

    try {
      const tokenResp = await request('POST', TOKEN_URL, new URLSearchParams(tokenParamsBase).toString());
      if (tokenResp.access_token) {
        saveTokens({
          access_token: tokenResp.access_token,
          refresh_token: tokenResp.refresh_token,
          token_type: tokenResp.token_type || 'Bearer',
          expires_at: Date.now() + (tokenResp.expires_in || 3600) * 1000,
          scope: tokenResp.scope,
          obtained_at: new Date().toISOString(),
        });
        console.log('\nLogin successful. You can now use real x_search with your X Premium subscription.');
        return;
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('authorization_pending')) {
        process.stdout.write('.');
        continue;
      }
      if (msg.includes('slow_down')) {
        pollInterval += 5;
        continue;
      }
      if (msg.includes('expired_token') || msg.includes('access_denied')) {
        throw new Error('\nDevice code expired or login was denied.');
      }
      throw new Error(`\nUnexpected error during polling: ${msg}`);
    }
  }

  throw new Error('\nTimed out waiting for login.');
}

async function refresh() {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) {
    throw new Error('No refresh_token found. Run: xsearch auth login');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: DEFAULT_CLIENT_ID,
  });

  const newTokens = await request('POST', TOKEN_URL, params.toString());
  saveTokens({
    ...tokens,
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in || 3600) * 1000,
  });
  console.log('Token refreshed successfully.');
}

function status() {
  const tokens = loadTokens();
  if (!tokens) {
    console.log('No tokens stored. Run: xsearch auth login');
    return;
  }
  const expiresIn = Math.max(0, Math.floor((tokens.expires_at - Date.now()) / 1000 / 60));
  console.log('xAI OAuth status:');
  console.log(`  Obtained: ${tokens.obtained_at}`);
  console.log(`  Expires in: ~${expiresIn} minutes`);
  console.log(`  Has refresh_token: ${!!tokens.refresh_token}`);
  console.log(`  Scopes: ${tokens.scope || '(unknown)'}`);
}

module.exports = {
  loadAccessToken,
  login,
  refresh,
  status,
};
