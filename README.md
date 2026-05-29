# xai-xsearch

Real native X (Twitter) search using your X Premium or SuperGrok subscription via OAuth.

This gives you the same high-quality `x_search` tool that powers Grok inside the X app and tools like OpenClaw — without needing separate xAI API credits.

## Features

- Uses your existing X Premium subscription (OAuth)
- Calls the real server-side `x_search` tool via the xAI Responses API
- Supports filters: date ranges, allowed/excluded handles, image/video understanding
- Works from the terminal or from any agent

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/xai-xsearch.git ~/repos/xai-xsearch
cd ~/repos/xai-xsearch
```

### 2. Install / link it

Run the install script:

```bash
./install.sh
```

This will:
- Create `~/.agents/tools/xai-xsearch`
- Symlink the scripts there
- Create thin skill pointers in common agent locations

You can also do it manually:

```bash
mkdir -p ~/.agents/tools/xai-xsearch
ln -s ~/repos/xai-xsearch/scripts ~/.agents/tools/xai-xsearch/scripts
```

### 3. Authenticate with X Premium (one time)

```bash
node ~/.agents/tools/xai-xsearch/scripts/xai-oauth.js --login
```

Complete the device code flow in your browser.

## Usage

### From the terminal

```bash
# Basic search
node ~/.agents/tools/xai-xsearch/scripts/xai-search.js --query "Siri Apple Intelligence"

# With filters
node ~/.agents/tools/xai-xsearch/scripts/xai-search.js \
  --query "WWDC" \
  --since 2026-05-01 \
  --handles elonmusk,apple
```

### From any agent

Tell your agent:

> "Use the shared xai-xsearch tool to do a real X search for: ..."

The agent should run the scripts from `~/.agents/tools/xai-xsearch/scripts/`.

## Structure

```
xai-xsearch/
├── README.md
├── install.sh
├── scripts/
│   ├── xai-oauth.js       # Device code login + token management
│   └── xai-search.js      # Real x_search calls
├── skills/
│   ├── grok/              # Thin pointer for Grok Build TUI
│   ├── claude/            # Thin pointer for Claude Code / Cursor
│   └── agents/            # Thin pointer for ~/.agents/skills
└── .gitignore
```

## Thin Skills

After install, thin skill files are created (or symlinked) at:

- `~/.grok/skills/xai-xsearch/`
- `~/.claude/skills/xai-xsearch/`
- `~/.agents/skills/xai-xsearch/`

These are just lightweight pointers. The real logic lives in this repo.

## Token Storage

Tokens are stored at:

```
~/.agents/tools/xai-xsearch/.auth/xai-oauth.json
```

This file is gitignored.

## Updating

```bash
cd ~/repos/xai-xsearch
git pull
./install.sh
```

## Making it Global (Optional)

Add the scripts to your PATH for easier access:

```bash
echo 'export PATH="$HOME/.agents/tools/xai-xsearch/scripts:$PATH"' >> ~/.zshrc
```

Then you can run:

```bash
xai-search --query "..."
xai-oauth --login
```

## Future Ideas

- Proper MCP server version (so it appears as a native tool)
- Automatic token refresh
- Better structured JSON output
- Packaging as an npm binary

## Credits

Loosely based on patterns from OpenClaw's excellent bundled xAI provider (`extensions/xai/`).

Official docs: https://docs.x.ai/developers/tools/x-search

## License

MIT
