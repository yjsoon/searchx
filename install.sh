#!/bin/bash
set -e

echo "Installing xai-xsearch..."

CANONICAL_DIR="$HOME/.agents/tools/xai-xsearch"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default recommended clone location
DEFAULT_TARGET="$HOME/Developer/personal-projects/xai-xsearch"

# Create canonical location
mkdir -p "$CANONICAL_DIR"
mkdir -p "$CANONICAL_DIR/.auth"

# Symlink the scripts directory
if [ -L "$CANONICAL_DIR/scripts" ] || [ -e "$CANONICAL_DIR/scripts" ]; then
  rm -rf "$CANONICAL_DIR/scripts"
fi
ln -s "$REPO_DIR/scripts" "$CANONICAL_DIR/scripts"

echo "✓ Scripts linked to $CANONICAL_DIR/scripts"

# Create thin skill pointers (best effort)
create_thin_skill() {
    local target_dir="$1"
    local name="$2"

    if [ -d "$(dirname "$target_dir")" ]; then
        mkdir -p "$target_dir"
        cat > "$target_dir/SKILL.md" << EOF
---
name: xai-xsearch
description: Real native X search using X Premium OAuth. Canonical implementation lives in ~/.agents/tools/xai-xsearch/
---

# xAI X Search (Shared)

Real implementation: \`~/.agents/tools/xai-xsearch/\`

Scripts:
- \`scripts/xai-oauth.js --login\`
- \`scripts/xai-search.js --query "..."\`

See the README in the canonical directory for full details.
EOF
        echo "✓ Thin skill created at $target_dir"
    fi
}

create_thin_skill "$HOME/.grok/skills/xai-xsearch" "grok"
create_thin_skill "$HOME/.agents/skills/xai-xsearch" "agents"
create_thin_skill "$HOME/.claude/skills/xai-xsearch" "claude"

echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Authenticate with your X Premium account:"
echo "     node ~/.agents/tools/xai-xsearch/scripts/xai-oauth.js --login"
echo ""
echo "  2. Test it:"
echo "     node ~/.agents/tools/xai-xsearch/scripts/xai-search.js --query \"Siri\""
echo ""
echo "The tool is now available to all your agent systems from one place."
