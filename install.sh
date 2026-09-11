#!/bin/bash
set -e

echo "Installing searchx..."

CANONICAL_DIR="$HOME/.agents/tools/searchx"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SEARCHX_BIN_DIR:-$HOME/.local/bin}"

# Default recommended clone location
DEFAULT_TARGET="$HOME/Developer/personal-projects/searchx"

# Create canonical location
mkdir -p "$CANONICAL_DIR"
mkdir -p "$CANONICAL_DIR/.auth"
mkdir -p "$BIN_DIR"

archive_legacy_skill() {
    local target_dir="$1"

    if [ -e "$target_dir" ] || [ -L "$target_dir" ]; then
        if command -v trash >/dev/null 2>&1; then
            trash "$target_dir"
            echo "✓ Legacy skill archived from $target_dir"
        else
            mv "$target_dir" "$target_dir.legacy.$(date +%Y%m%d%H%M%S)"
            echo "✓ Legacy skill moved from $target_dir"
        fi
    fi
}

# Migrate from a legacy xai-xsearch install, if present
LEGACY_DIR="$HOME/.agents/tools/xai-xsearch"

if [ -f "$LEGACY_DIR/.auth/xai-oauth.json" ] && [ ! -f "$CANONICAL_DIR/.auth/xai-oauth.json" ]; then
  cp -p "$LEGACY_DIR/.auth/xai-oauth.json" "$CANONICAL_DIR/.auth/xai-oauth.json"
  echo "✓ Migrated OAuth token from $LEGACY_DIR/.auth/xai-oauth.json"
fi

if [ -L "$BIN_DIR/xsearch" ]; then
  if command -v trash >/dev/null 2>&1; then
    trash "$BIN_DIR/xsearch"
  else
    mv "$BIN_DIR/xsearch" "$BIN_DIR/xsearch.bak.$(date +%Y%m%d%H%M%S)"
  fi
  echo "✓ Removed legacy symlink at $BIN_DIR/xsearch"
fi

archive_legacy_skill "$HOME/.grok/skills/xsearch"
archive_legacy_skill "$HOME/.grok/skills/xai-xsearch"
archive_legacy_skill "$HOME/.agents/skills/xsearch"
archive_legacy_skill "$HOME/.agents/skills/xai-xsearch"
archive_legacy_skill "$HOME/.claude/skills/xsearch"
archive_legacy_skill "$HOME/.claude/skills/xai-xsearch"

replace_with_symlink() {
  local source="$1"
  local target="$2"

  if [ -L "$target" ] || [ -e "$target" ]; then
    if command -v trash >/dev/null 2>&1; then
      trash "$target"
    else
      mv "$target" "$target.bak.$(date +%Y%m%d%H%M%S)"
    fi
  fi
  ln -s "$source" "$target"
}

replace_with_symlink "$REPO_DIR/scripts" "$CANONICAL_DIR/scripts"
replace_with_symlink "$REPO_DIR/src" "$CANONICAL_DIR/src"
replace_with_symlink "$REPO_DIR/bin" "$CANONICAL_DIR/bin"
replace_with_symlink "$REPO_DIR/package.json" "$CANONICAL_DIR/package.json"
replace_with_symlink "$REPO_DIR/README.md" "$CANONICAL_DIR/README.md"
if [ -f "$REPO_DIR/AGENTS.md" ]; then
  replace_with_symlink "$REPO_DIR/AGENTS.md" "$CANONICAL_DIR/AGENTS.md"
fi
replace_with_symlink "$REPO_DIR/bin/searchx.js" "$BIN_DIR/searchx"
chmod +x "$REPO_DIR/bin/searchx.js"
chmod +x "$REPO_DIR/scripts/xai-oauth.js" "$REPO_DIR/scripts/xai-search.js"

echo "✓ Scripts linked to $CANONICAL_DIR/scripts"
echo "✓ CLI linked to $BIN_DIR/searchx"
echo "✓ README linked to $CANONICAL_DIR/README.md"
if [ -f "$REPO_DIR/AGENTS.md" ]; then
  echo "✓ AGENTS linked to $CANONICAL_DIR/AGENTS.md"
fi

# Create thin skill pointers (best effort)
create_thin_skill() {
    local target_dir="$1"
    local name="$2"

    if [ -d "$(dirname "$target_dir")" ]; then
        mkdir -p "$target_dir"
        cat > "$target_dir/SKILL.md" << EOF
---
name: searchx
description: Real native X search using X Premium OAuth. Canonical implementation lives in ~/.agents/tools/searchx/
---

# searchx

Real implementation: \`~/.agents/tools/searchx/\`

Commands:
- \`searchx auth login\`
- \`searchx search "..."\`

See the README in the canonical directory for full details.
EOF
        echo "✓ Thin skill created at $target_dir"
    fi
}

create_thin_skill "$HOME/.grok/skills/searchx" "grok"
create_thin_skill "$HOME/.agents/skills/searchx" "agents"
create_thin_skill "$HOME/.claude/skills/searchx" "claude"

echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Authenticate with your X Premium account:"
echo "     searchx auth login"
echo ""
echo "  2. Test it:"
echo "     searchx search \"Siri\""
echo ""
echo "The tool is now available to all your agent systems from one place."
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "Note: $BIN_DIR is not currently on PATH. Add it to your shell profile to run searchx directly."
fi
echo ""
echo "Note: $LEGACY_DIR can be removed once the new install works."
