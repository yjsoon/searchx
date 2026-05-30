#!/bin/bash
set -e

echo "Installing xai-xsearch..."

CANONICAL_DIR="$HOME/.agents/tools/xai-xsearch"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${XSEARCH_BIN_DIR:-$HOME/.local/bin}"

# Default recommended clone location
DEFAULT_TARGET="$HOME/Developer/personal-projects/xai-xsearch"

# Create canonical location
mkdir -p "$CANONICAL_DIR"
mkdir -p "$CANONICAL_DIR/.auth"
mkdir -p "$BIN_DIR"

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
replace_with_symlink "$REPO_DIR/bin/xsearch.js" "$BIN_DIR/xsearch"
chmod +x "$REPO_DIR/bin/xsearch.js"
chmod +x "$REPO_DIR/scripts/xai-oauth.js" "$REPO_DIR/scripts/xai-search.js"

echo "✓ Scripts linked to $CANONICAL_DIR/scripts"
echo "✓ CLI linked to $BIN_DIR/xsearch"
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
name: xsearch
description: Real native X search using X Premium OAuth. Canonical implementation lives in ~/.agents/tools/xai-xsearch/
---

# xsearch

Real implementation: \`~/.agents/tools/xai-xsearch/\`

Commands:
- \`xsearch auth login\`
- \`xsearch search "..."\`

See the README in the canonical directory for full details.
EOF
        echo "✓ Thin skill created at $target_dir"
    fi
}

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

create_thin_skill "$HOME/.grok/skills/xsearch" "grok"
create_thin_skill "$HOME/.agents/skills/xsearch" "agents"
create_thin_skill "$HOME/.claude/skills/xsearch" "claude"

archive_legacy_skill "$HOME/.grok/skills/xai-xsearch"
archive_legacy_skill "$HOME/.agents/skills/xai-xsearch"
archive_legacy_skill "$HOME/.claude/skills/xai-xsearch"

echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Authenticate with your X Premium account:"
echo "     xsearch auth login"
echo ""
echo "  2. Test it:"
echo "     xsearch search \"Siri\""
echo ""
echo "The tool is now available to all your agent systems from one place."
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "Note: $BIN_DIR is not currently on PATH. Add it to your shell profile to run xsearch directly."
fi
