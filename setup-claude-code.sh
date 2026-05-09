#!/usr/bin/env bash
# Sovern ERP — Claude Code setup for a new laptop
# Run this from inside the Sovern repo: bash setup-claude-code.sh

set -e

echo "==> Sovern ERP / Claude Code setup"
echo

# 1. Sanity checks
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Install Node 18+ first (brew install node)."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm not found."; exit 1; }
echo "node: $(node --version)"
echo "npm:  $(npm --version)"
echo

# 2. Install Claude Code globally
if command -v claude >/dev/null 2>&1; then
  echo "claude already installed at $(command -v claude) ($(claude --version 2>/dev/null || echo '?'))"
else
  echo "Installing @anthropic-ai/claude-code globally..."
  npm install -g @anthropic-ai/claude-code
fi
echo

# 3. Show what to do next
cat <<'NEXT'
==> Next steps (do these manually)

1. Log in:
     claude
   then run /login inside the TUI and authenticate as Alex (vendettadaogames@gmail.com).

2. From the Sovern repo root, run:
     cd "$(pwd)" && claude
   It will auto-load CLAUDE.md and SESSION.md.

3. MISSING FILES — these are referenced by CLAUDE.md but are NOT in the git repo
   and must be brought over from the desktop machine separately:
     International Trade Company/lessons.md
     International Trade Company/Instructions & Skills/erp-debug.md
     International Trade Company/Instructions & Skills/erp-qa.md
     International Trade Company/Instructions & Skills/erp-qa-engineer.md
     International Trade Company/Instructions & Skills/erp-devops.md
     International Trade Company/Instructions & Skills/erp-feature-directive.md
     International Trade Company/Instructions & Skills/erp-whitelabel.md
     International Trade Company/Instructions & Skills/erp-whitelabel-pm.md
     International Trade Company/Instructions & Skills/trade-backend.md
     International Trade Company/Instructions & Skills/trade-frontend.md
     International Trade Company/Instructions & Skills/trade-ux.md
     International Trade Company/Instructions & Skills/trade-ui-audit.md
     International Trade Company/Instructions & Skills/trade-product.md
     International Trade Company/Instructions & Skills/trade-security.md
     International Trade Company/Instructions & Skills/trade-cto.md
     International Trade Company/Instructions & Skills/trade-compliance.md
     International Trade Company/Instructions & Skills/trade-attorney.md
     International Trade Company/Instructions & Skills/trade-email-rules.md
     International Trade Company/Instructions & Skills/trade-polish.md
     Website/DESIGN.md

   Easiest options:
     a. On the desktop, commit & push them into the repo (recommended so future
        laptops just `git pull`).
     b. Or rsync from the desktop:
          rsync -av desktop:/path/to/'International Trade Company' ./
     c. Or zip them on desktop, AirDrop / iCloud Drive, unzip here.

4. Optional: install Anthropic example skills locally
     mkdir -p ~/.claude/skills
     # then drop or symlink any shared skill folders here

Done.
NEXT
