#!/usr/bin/env bash
# Sovern ERP — sync the off-repo skills/lessons into the repo and push.
#
# RUN THIS ON THE DESKTOP (the machine that already has the files).
# After it pushes, the laptop can `git pull` and it's done forever.
#
# Usage:
#   bash scripts/sync-skills-to-repo.sh                          # auto-detect
#   bash scripts/sync-skills-to-repo.sh /path/to/source-folder   # explicit
#
# The script expects the source to contain:
#   International Trade Company/lessons.md
#   International Trade Company/Instructions & Skills/<19 .md files>
#   Website/DESIGN.md

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
echo "Repo:   $REPO_ROOT"

# ---------- 1. Find the source folder ----------
SRC="${1:-}"
CANDIDATES=(
  "$REPO_ROOT/.."                        # sibling of repo
  "$HOME/Documents/Claude/Projects"      # common Cowork projects root
  "$HOME/Documents"
  "$HOME/Desktop"
)
if [ -z "$SRC" ]; then
  for base in "${CANDIDATES[@]}"; do
    if [ -d "$base/International Trade Company" ]; then
      SRC="$base"
      break
    fi
  done
fi
if [ -z "$SRC" ] || [ ! -d "$SRC/International Trade Company" ]; then
  echo
  echo "ERROR: could not find 'International Trade Company/' folder."
  echo "Pass the parent path explicitly, e.g.:"
  echo "  bash scripts/sync-skills-to-repo.sh \"\$HOME/Documents/Claude/Projects\""
  exit 1
fi
echo "Source: $SRC"
echo

# ---------- 2. Copy into the repo ----------
echo "Copying International Trade Company/ ..."
rsync -a --exclude='.DS_Store' "$SRC/International Trade Company/" \
                               "$REPO_ROOT/International Trade Company/"

if [ -f "$SRC/Website/DESIGN.md" ]; then
  echo "Copying Website/DESIGN.md ..."
  mkdir -p "$REPO_ROOT/Website"
  cp -p "$SRC/Website/DESIGN.md" "$REPO_ROOT/Website/DESIGN.md"
else
  echo "WARNING: $SRC/Website/DESIGN.md not found. Skipping."
fi
echo

# ---------- 3. Verify all expected files exist ----------
EXPECTED=(
  "International Trade Company/lessons.md"
  "International Trade Company/Instructions & Skills/erp-debug.md"
  "International Trade Company/Instructions & Skills/erp-qa.md"
  "International Trade Company/Instructions & Skills/erp-qa-engineer.md"
  "International Trade Company/Instructions & Skills/erp-devops.md"
  "International Trade Company/Instructions & Skills/erp-feature-directive.md"
  "International Trade Company/Instructions & Skills/erp-whitelabel.md"
  "International Trade Company/Instructions & Skills/erp-whitelabel-pm.md"
  "International Trade Company/Instructions & Skills/trade-backend.md"
  "International Trade Company/Instructions & Skills/trade-frontend.md"
  "International Trade Company/Instructions & Skills/trade-ux.md"
  "International Trade Company/Instructions & Skills/trade-ui-audit.md"
  "International Trade Company/Instructions & Skills/trade-product.md"
  "International Trade Company/Instructions & Skills/trade-security.md"
  "International Trade Company/Instructions & Skills/trade-cto.md"
  "International Trade Company/Instructions & Skills/trade-compliance.md"
  "International Trade Company/Instructions & Skills/trade-attorney.md"
  "International Trade Company/Instructions & Skills/trade-email-rules.md"
  "International Trade Company/Instructions & Skills/trade-polish.md"
)
MISSING=0
for f in "${EXPECTED[@]}"; do
  if [ ! -f "$REPO_ROOT/$f" ]; then
    echo "  MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done
if [ "$MISSING" -gt 0 ]; then
  echo
  echo "ERROR: $MISSING expected file(s) are not present after copy. Aborting before commit."
  exit 1
fi
echo "All 19 skill files + lessons.md present."
echo

# ---------- 4. Git add / commit / push ----------
git add "International Trade Company" "Website/DESIGN.md" 2>/dev/null || true

if git diff --cached --quiet; then
  echo "Nothing to commit — repo already has these files."
  exit 0
fi

echo "Staged changes:"
git diff --cached --stat
echo

git commit -m "chore: vendor International Trade Company skills + Website/DESIGN.md into repo

Previously these files were referenced by CLAUDE.md but lived on a single
desktop. Vendoring them so a fresh laptop is one git pull away from a
fully working setup.

Includes:
  International Trade Company/lessons.md  (L-XXX corrections log)
  International Trade Company/Instructions & Skills/  (19 role/skill md files)
  Website/DESIGN.md  (brand/design reference)
"

echo
echo "Pushing to origin/main ..."
git push origin main

echo
echo "Done. On the laptop now run: git pull"
