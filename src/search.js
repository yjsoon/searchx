const https = require('https');
const { loadAccessToken } = require('./auth');

const API_BASE = process.env.XAI_API_BASE || 'https://api.x.ai/v1';
const DEFAULT_MODEL = process.env.XAI_X_SEARCH_MODEL || 'grok-4-1-fast-non-reasoning';

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
        'User-Agent': 'searchx/0.1',
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

async function search(opts) {
  const token = loadAccessToken();
  const toolCall = {
    type: 'x_search',
    allowed_x_handles: opts.allowed_x_handles.length ? opts.allowed_x_handles : undefined,
    excluded_x_handles: opts.excluded_x_handles.length ? opts.excluded_x_handles : undefined,
    from_date: opts.from_date || undefined,
    to_date: opts.to_date || undefined,
    enable_image_understanding: opts.enable_image_understanding || undefined,
    enable_video_understanding: opts.enable_video_understanding || undefined,
  };

  Object.keys(toolCall).forEach(k => toolCall[k] === undefined && delete toolCall[k]);

  const body = {
    model: opts.model || DEFAULT_MODEL,
    input: [
      {
        role: 'user',
        content: opts.query,
      },
    ],
    tools: [toolCall],
    max_output_tokens: opts.max_output_tokens || 2000,
  };

  return request('POST', `${API_BASE.replace(/\/$/, '')}/responses`, body, token);
}

module.exports = {
  API_BASE,
  DEFAULT_MODEL,
  extractText,
  search,
};
