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

const TOKEN_FILE = path.join(process.env.HOME, '.agents/tools/xai-xsearch/.auth/xai-oauth.json');
const API_BASE = 'https://api.x.ai';

function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('No OAuth token found. Run:');
    console.error('  node ~/.grok/skills/xai-xsearch/scripts/xai-oauth.js --login');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  if (data.expires_at && Date.now() > data.expires_at) {
    console.error('Token expired. Run:');
    console.error('  node ~/.grok/skills/xai-xsearch/scripts/xai-oauth.js --refresh');
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
  const out = { query: null, allowed_x_handles: [], excluded_x_handles: [], from_date: null, to_date: null };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--query' || a === '-q') out.query = args[++i];
    else if (a === '--handles' || a === '--allowed') out.allowed_x_handles = args[++i].split(',').map(s => s.trim());
    else if (a === '--exclude') out.excluded_x_handles = args[++i].split(',').map(s => s.trim());
    else if (a === '--since' || a === '--from') out.from_date = args[++i];
    else if (a === '--until' || a === '--to') out.to_date = args[++i];
    else if (!out.query && !a.startsWith('-')) out.query = a;
  }
  if (!out.query) {
    console.error('Usage: node xai-search.js --query "your search" [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--handles user1,user2]');
    process.exit(1);
  }
  return out;
}

async function main() {
  const token = loadToken();
  const opts = parseArgs();

  const toolCall = {
    type: 'x_search',
    query: opts.query,
    allowed_x_handles: opts.allowed_x_handles.length ? opts.allowed_x_handles : undefined,
    excluded_x_handles: opts.excluded_x_handles.length ? opts.excluded_x_handles : undefined,
    from_date: opts.from_date || undefined,
    to_date: opts.to_date || undefined,
    // enable_image_understanding: true,   // uncomment if you want image analysis
    // enable_video_understanding: true,
  };

  // Clean undefined
  Object.keys(toolCall).forEach(k => toolCall[k] === undefined && delete toolCall[k]);

  const body = {
    model: 'grok-4.3',           // or a fast variant if you prefer
    input: [
      {
        role: 'user',
        content: `Use the x_search tool to answer: ${opts.query}`
      }
    ],
    tools: [toolCall],
    max_output_tokens: 2000,
  };

  console.log(`Searching X via real x_search tool for: "${opts.query}"...\n`);

  try {
    const resp = await request('POST', `${API_BASE}/v1/responses`, body, token);

    // The response shape depends on whether it used the tool or not.
    // In practice with native tools, the final output will be in the last message or `output`.
    if (resp.output) {
      console.log(resp.output);
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
