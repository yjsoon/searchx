#!/usr/bin/env node
/**
 * Real xAI x_search using OAuth token from X Premium.
 * 
 * This calls the native server-side x_search tool (same one OpenClaw exposes).
 *
 * Usage examples:
 *   node xai-search.js --query "Siri Apple Intelligence"
 *   node xai-search.js --query "WWDC" --since 2026-05-01 --until 2026-05-30 --handles elonmusk
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN_FILE = process.env.XAI_OAUTH_TOKEN_FILE ||
  path.join(process.env.HOME, '.agents/tools/xai-xsearch/.auth/xai-oauth.json');
const API_BASE = process.env.XAI_API_BASE || 'https://api.x.ai/v1';
const DEFAULT_MODEL = process.env.XAI_X_SEARCH_MODEL || 'grok-4-1-fast-non-reasoning';

function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('No OAuth token found. Run:');
    console.error('  node ~/.agents/tools/xai-xsearch/scripts/xai-oauth.js --login');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  if (data.expires_at && Date.now() > data.expires_at) {
    console.error('Token expired. Run:');
    console.error('  node ~/.agents/tools/xai-xsearch/scripts/xai-oauth.js --refresh');
    process.exit(1);
  }
  return data.access_token;
}

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      method,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'xai-xsearch-skill/0.1',
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
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
  const requireValue = (flag, index) => {
    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
      console.error(`${flag} requires a value.`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--query' || a === '-q') out.query = requireValue(a, i++);
    else if (a === '--handles' || a === '--allowed') out.allowed_x_handles = requireValue(a, i++).split(',').map(s => s.trim());
    else if (a === '--exclude') out.excluded_x_handles = requireValue(a, i++).split(',').map(s => s.trim());
    else if (a === '--since' || a === '--from') out.from_date = requireValue(a, i++);
    else if (a === '--until' || a === '--to') out.to_date = requireValue(a, i++);
    else if (a === '--image' || a === '--images') out.enable_image_understanding = true;
    else if (a === '--video' || a === '--videos') out.enable_video_understanding = true;
    else if (a === '--json') out.json = true;
    else if (a === '--model') out.model = requireValue(a, i++);
    else if (a === '--max-output-tokens') out.max_output_tokens = Number.parseInt(requireValue(a, i++), 10);
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    }
    else if (!out.query && !a.startsWith('-')) out.query = a;
  }
  if (!out.query) {
    printUsage();
    process.exit(1);
  }
  out.allowed_x_handles = out.allowed_x_handles.filter(Boolean);
  out.excluded_x_handles = out.excluded_x_handles.filter(Boolean);
  if (out.allowed_x_handles.length && out.excluded_x_handles.length) {
    console.error('Use either --handles/--allowed or --exclude, not both.');
    process.exit(1);
  }
  for (const [label, value] of [['--since/--from', out.from_date], ['--until/--to', out.to_date]]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      console.error(`${label} must use YYYY-MM-DD.`);
      process.exit(1);
    }
  }
  if (out.from_date && out.to_date && out.from_date > out.to_date) {
    console.error('--since/--from must be on or before --until/--to.');
    process.exit(1);
  }
  if (!Number.isFinite(out.max_output_tokens) || out.max_output_tokens <= 0) {
    console.error('--max-output-tokens must be a positive integer.');
    process.exit(1);
  }
  return out;
}

function printUsage() {
  console.log('Usage: node xai-search.js --query "your search" [options]');
  console.log('');
  console.log('Options:');
  console.log('  --since, --from YYYY-MM-DD       Restrict search from date');
  console.log('  --until, --to YYYY-MM-DD         Restrict search to date');
  console.log('  --handles, --allowed a,b         Only consider these X handles');
  console.log('  --exclude a,b                    Exclude these X handles');
  console.log('  --image, --images                Enable image understanding');
  console.log('  --video, --videos                Enable video understanding');
  console.log('  --model MODEL                    Override xAI Responses model');
  console.log('  --json                           Print only the raw Responses API JSON to stdout');
}

function extractText(resp) {
  if (typeof resp.output_text === 'string' && resp.output_text.trim()) {
    return resp.output_text;
  }

  const parts = [];
  function visit(value) {
    if (!value) return;
    if (typeof value === 'string') {
      parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      if (typeof value.text === 'string') parts.push(value.text);
      else if (typeof value.content === 'string') parts.push(value.content);
      else if (value.content) visit(value.content);
      else if (value.output) visit(value.output);
    }
  }

  visit(resp.output);
  return parts.join('\n').trim();
}

async function main() {
  const opts = parseArgs();
  const token = loadToken();

  const toolCall = {
    type: 'x_search',
    allowed_x_handles: opts.allowed_x_handles.length ? opts.allowed_x_handles : undefined,
    excluded_x_handles: opts.excluded_x_handles.length ? opts.excluded_x_handles : undefined,
    from_date: opts.from_date || undefined,
    to_date: opts.to_date || undefined,
    enable_image_understanding: opts.enable_image_understanding || undefined,
    enable_video_understanding: opts.enable_video_understanding || undefined,
  };

  // Clean undefined
  Object.keys(toolCall).forEach(k => toolCall[k] === undefined && delete toolCall[k]);

  const body = {
    model: opts.model,
    input: [
      {
        role: 'user',
        content: opts.query
      }
    ],
    tools: [toolCall],
    max_output_tokens: opts.max_output_tokens,
  };

  if (!opts.json) {
    console.error(`Searching X via real x_search tool for: "${opts.query}"...\n`);
  }

  try {
    const resp = await request('POST', `${API_BASE.replace(/\/$/, '')}/responses`, body, token);

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

main();
