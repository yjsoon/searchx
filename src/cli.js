const { getAuthSettings, login, refresh, status } = require('./auth');
const { API_BASE, DEFAULT_MODEL, extractText, search } = require('./search');

function requireValue(args, flag, index) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseSearchArgs(args) {
  const out = {
    query: null,
    allowed_x_handles: [],
    excluded_x_handles: [],
    from_date: null,
    to_date: null,
    enable_image_understanding: false,
    enable_video_understanding: false,
    json: false,
    model: DEFAULT_MODEL,
    max_output_tokens: 2000,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--query' || a === '-q') out.query = requireValue(args, a, i++);
    else if (a === '--handles' || a === '--allowed') out.allowed_x_handles = requireValue(args, a, i++).split(',').map(s => s.trim());
    else if (a === '--exclude') out.excluded_x_handles = requireValue(args, a, i++).split(',').map(s => s.trim());
    else if (a === '--since' || a === '--from') out.from_date = requireValue(args, a, i++);
    else if (a === '--until' || a === '--to') out.to_date = requireValue(args, a, i++);
    else if (a === '--image' || a === '--images') out.enable_image_understanding = true;
    else if (a === '--video' || a === '--videos') out.enable_video_understanding = true;
    else if (a === '--json') out.json = true;
    else if (a === '--model') out.model = requireValue(args, a, i++);
    else if (a === '--max-output-tokens') out.max_output_tokens = Number.parseInt(requireValue(args, a, i++), 10);
    else if (a === '--help' || a === '-h') {
      printSearchUsage();
      return null;
    }
    else if (!out.query && !a.startsWith('-')) out.query = a;
    else if (out.query && !a.startsWith('-')) out.query += ` ${a}`;
    else throw new Error(`Unknown option: ${a}`);
  }

  if (!out.query) {
    printSearchUsage();
    throw new Error('Missing search query.');
  }
  out.allowed_x_handles = out.allowed_x_handles.filter(Boolean);
  out.excluded_x_handles = out.excluded_x_handles.filter(Boolean);
  if (out.allowed_x_handles.length && out.excluded_x_handles.length) {
    throw new Error('Use either --handles/--allowed or --exclude, not both.');
  }
  for (const [label, value] of [['--since/--from', out.from_date], ['--until/--to', out.to_date]]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${label} must use YYYY-MM-DD.`);
    }
  }
  if (out.from_date && out.to_date && out.from_date > out.to_date) {
    throw new Error('--since/--from must be on or before --until/--to.');
  }
  if (!Number.isFinite(out.max_output_tokens) || out.max_output_tokens <= 0) {
    throw new Error('--max-output-tokens must be a positive integer.');
  }
  return out;
}

function printUsage() {
  console.log('Usage: xsearch <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  login                   Start device-code login');
  console.log('  status                  Show local OAuth token status');
  console.log('  refresh                 Refresh the OAuth token');
  console.log('  search <query>          Search X with xAI x_search');
  console.log('  settings                Show paths, model, endpoint, and environment overrides');
  console.log('  help [command]          Show command help');
  console.log('');
  console.log('Examples:');
  console.log('  xsearch login');
  console.log('  xsearch status');
  console.log('  xsearch search "What are people saying about xAI?"');
  console.log('  xsearch "WWDC reactions from Apple developers" --since 2026-06-01 --handles apple,gruber');
  console.log('  xsearch settings --json');
}

function printSearchUsage() {
  console.log('Usage: xsearch search "your search" [options]');
  console.log('       xsearch "your search" [options]');
  console.log('');
  console.log('Options:');
  console.log('  --query, -q TEXT                  Search query');
  console.log('  --since, --from YYYY-MM-DD        Restrict search from date');
  console.log('  --until, --to YYYY-MM-DD          Restrict search to date');
  console.log('  --handles, --allowed a,b          Only consider these X handles');
  console.log('  --exclude a,b                     Exclude these X handles');
  console.log('  --image, --images                 Enable image understanding');
  console.log('  --video, --videos                 Enable video understanding');
  console.log('  --model MODEL                     Override xAI Responses model');
  console.log('  --max-output-tokens N             Override output token cap');
  console.log('  --json                            Print only the raw Responses API JSON to stdout');
  console.log('');
  console.log('Examples:');
  console.log('  xsearch search "latest posts about Grok"');
  console.log('  xsearch "shipping updates from xAI" --since 2026-06-01');
  console.log('  xsearch "from selected accounts" --handles xai,elonmusk --json');
}

function printAuthUsage() {
  console.log('Usage: xsearch auth [login | status | refresh]');
  console.log('       xsearch login | status | refresh');
  console.log('');
  console.log('Commands:');
  console.log('  login       Start device-code login');
  console.log('  status      Show local OAuth token status');
  console.log('  refresh     Refresh the OAuth token');
  console.log('');
  printEnvironmentHelp();
}

function printSettingsUsage() {
  console.log('Usage: xsearch settings [--json]');
  console.log('');
  console.log('Shows local token path, token presence, API base, default model, and environment overrides.');
  console.log('');
  printEnvironmentHelp();
}

function printEnvironmentHelp() {
  console.log('Environment:');
  console.log('  XAI_OAUTH_CLIENT_ID     Override the shared xAI OAuth client ID');
  console.log('  XAI_OAUTH_SCOPE         Override requested OAuth scopes');
  console.log('  XAI_OAUTH_TOKEN_FILE    Override token file path');
  console.log('  XAI_API_BASE            Override Responses API base URL');
  console.log('  XAI_X_SEARCH_MODEL      Override default search model');
}

function parseJsonFlag(args, usage) {
  let json = false;
  for (const arg of args) {
    if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h' || arg === 'help') {
      usage();
      return null;
    }
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { json };
}

function printSettings(args = []) {
  const opts = parseJsonFlag(args, printSettingsUsage);
  if (!opts) return;

  const auth = getAuthSettings();
  const settings = {
    apiBase: API_BASE,
    defaultModel: DEFAULT_MODEL,
    tokenFile: auth.tokenFile,
    hasToken: auth.hasToken,
    hasRefreshToken: auth.hasRefreshToken,
    expiresAt: auth.expiresAt,
    expired: auth.expired,
    oauth: {
      authBase: auth.authBase,
      clientId: auth.clientId,
      clientIdSource: auth.clientIdSource,
      scope: auth.scope,
      scopeSource: auth.scopeSource,
    },
    environment: {
      XAI_OAUTH_CLIENT_ID: process.env.XAI_OAUTH_CLIENT_ID || null,
      XAI_OAUTH_SCOPE: process.env.XAI_OAUTH_SCOPE || null,
      XAI_OAUTH_TOKEN_FILE: process.env.XAI_OAUTH_TOKEN_FILE || null,
      XAI_API_BASE: process.env.XAI_API_BASE || null,
      XAI_X_SEARCH_MODEL: process.env.XAI_X_SEARCH_MODEL || null,
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  console.log('xsearch settings:');
  console.log(`  API base: ${settings.apiBase}`);
  console.log(`  Default model: ${settings.defaultModel}`);
  console.log(`  Token file: ${settings.tokenFile}`);
  console.log(`  Has token: ${settings.hasToken ? 'yes' : 'no'}`);
  console.log(`  Has refresh token: ${settings.hasRefreshToken ? 'yes' : 'no'}`);
  console.log(`  Expires at: ${settings.expiresAt || '(unknown)'}`);
  console.log(`  Expired: ${settings.expired === null ? '(unknown)' : settings.expired ? 'yes' : 'no'}`);
  console.log(`  OAuth client ID: ${settings.oauth.clientId} (${settings.oauth.clientIdSource})`);
  console.log(`  OAuth scope: ${settings.oauth.scope} (${settings.oauth.scopeSource})`);
  console.log('');
  printEnvironmentHelp();
}

async function runSearch(args) {
  const opts = parseSearchArgs(args);
  if (!opts) return;

  if (!opts.json) {
    console.error(`Searching X via real x_search tool for: "${opts.query}"...\n`);
  }

  try {
    const resp = await search(opts);
    if (opts.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const text = extractText(resp);
    if (text) {
      console.log(text);
    } else if (resp.choices?.[0]?.message?.content) {
      console.log(resp.choices[0].message.content);
    } else {
      console.dir(resp, { depth: 3 });
    }

    if (resp.citations) {
      console.log('\nCitations:');
      console.dir(resp.citations, { depth: 2 });
    }
  } catch (err) {
    console.error('Search failed:', err.message);
    if (err.message.includes('403') || err.message.includes('permission')) {
      console.error('\nThis usually means your X Premium OAuth token does not currently have access to the x_search tool, or the team has no credits for the developer path.');
    }
    process.exit(1);
  }
}

async function runAuth(args) {
  const cmd = args[0] || 'status';
  if (cmd === 'login' || cmd === '--login') return login();
  if (cmd === 'refresh' || cmd === '--refresh') return refresh();
  if (cmd === 'status' || cmd === '--status') return status();
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return printAuthUsage();
  throw new Error(`Unknown auth command: ${cmd}`);
}

async function main(args) {
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    if (cmd === 'help' && args[1]) {
      const topic = args[1];
      if (topic === 'search') return printSearchUsage();
      if (topic === 'auth' || topic === 'login' || topic === 'status' || topic === 'refresh') return printAuthUsage();
      if (topic === 'settings' || topic === 'config') return printSettingsUsage();
      throw new Error(`Unknown help topic: ${topic}`);
    }
    printUsage();
    return;
  }
  if (cmd === 'search') return runSearch(args.slice(1));
  if (cmd === 'auth') return runAuth(args.slice(1));
  if (cmd === 'settings' || cmd === 'config') return printSettings(args.slice(1));
  if (cmd === 'login' || cmd === '--login') return login();
  if (cmd === 'refresh' || cmd === '--refresh') return refresh();
  if (cmd === 'status' || cmd === '--status') return status();

  return runSearch(args);
}

module.exports = {
  main,
  parseSearchArgs,
  printSettings,
  printUsage,
  runSearch,
};
