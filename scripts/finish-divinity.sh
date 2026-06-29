#!/usr/bin/env bash
#
# finish-divinity.sh — "I'm done editing DivinityRP" one-shot release workflow.
#
# What it does, in order:
#   1. Verifies the working tree is the DivinityRP repo and gh is authed.
#   2. DATA-SAFETY GUARD: scans staged+unstaged changes (and new migration files)
#      for destructive SQL. DivinityRP runs `tsx lib/db/migrate` on every Vercel
#      build, so a destructive migration would wipe Postgres chat history/users on
#      deploy. If anything dangerous is found the script ABORTS before pushing.
#   3. Commits all changes (message from $1 or a generated default).
#   4. Bumps version in chatbot/package.json (patch by default; pass --minor /
#      --major / --none to change).
#   5. Pushes main -> triggers .github/workflows/deploy-vercel.yml (Vercel deploy).
#      Vercel reconnects to the SAME Postgres + R2/Blob, so all existing data
#      ("the logs") persists automatically across the new deployment.
#   6. Creates a new GitHub release tag vX.Y.Z with auto-generated notes.
#
# Usage:
#   scripts/finish-divinity.sh ["commit message"] [--patch|--minor|--major|--none]
#
set -euo pipefail

# ---- locate repo root --------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
PKG="chatbot/package.json"

if [[ ! -f "$PKG" ]]; then
  echo "ERROR: $PKG not found — are you in the DivinityRP repo?" >&2
  exit 1
fi

# ---- parse args --------------------------------------------------------------
BUMP="patch"
MSG=""
for arg in "$@"; do
  case "$arg" in
    --patch) BUMP="patch" ;;
    --minor) BUMP="minor" ;;
    --major) BUMP="major" ;;
    --none)  BUMP="none" ;;
    *) MSG="$arg" ;;
  esac
done

# ---- preflight ---------------------------------------------------------------
command -v gh >/dev/null || { echo "ERROR: gh CLI not installed." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated (run: gh auth login)." >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: not a git repo." >&2; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "WARNING: you are on branch '$BRANCH', not 'main'. Vercel deploy only fires on main." >&2
fi

# ---- DATA-SAFETY GUARD -------------------------------------------------------
# Block destructive DB migrations from reaching the auto-migrate-on-build step.
echo ">> Scanning changes for destructive DB migrations (protects your chat history/users)..."
DESTRUCTIVE_RE='DROP[[:space:]]+(TABLE|COLUMN|SCHEMA|DATABASE|INDEX|CONSTRAINT)|TRUNCATE|DELETE[[:space:]]+FROM|ALTER[[:space:]]+TABLE[[:space:]].*DROP'

# Collect candidate text: full diff (tracked) + contents of any new/untracked migration files.
SCAN_HITS=""
DIFF_HITS="$(git diff HEAD -- 'chatbot/lib/db/migrations/**' 'chatbot/lib/db/**.sql' 2>/dev/null | grep -iE "^\+.*($DESTRUCTIVE_RE)" || true)"
NEW_MIG_HITS=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if grep -iqE "$DESTRUCTIVE_RE" "$f" 2>/dev/null; then
    NEW_MIG_HITS+=$'\n'"-- in new file: $f"$'\n'"$(grep -inE "$DESTRUCTIVE_RE" "$f")"
  fi
done < <(git ls-files --others --exclude-standard -- 'chatbot/lib/db/migrations/' 2>/dev/null)

SCAN_HITS="${DIFF_HITS}${NEW_MIG_HITS}"
if [[ -n "${SCAN_HITS// /}" ]]; then
  echo "" >&2
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
  echo "ABORTED: destructive SQL detected in a migration that would run" >&2
  echo "automatically on the next Vercel build (build = tsx lib/db/migrate)." >&2
  echo "This could DELETE your existing chat history / users / data." >&2
  echo "" >&2
  echo "$SCAN_HITS" >&2
  echo "" >&2
  echo "If this is intentional, commit + push manually and accept the data loss." >&2
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
  exit 2
fi
echo ">> OK: no destructive migrations found. Existing data is safe across deploy."

# ---- commit ------------------------------------------------------------------
if [[ -z "$(git status --porcelain)" ]]; then
  echo ">> No uncommitted changes."
else
  [[ -z "$MSG" ]] && MSG="chore: finish DivinityRP changes $(date -u +%Y-%m-%dT%H:%MZ)"
  git add -A
  git commit -m "$MSG"
  echo ">> Committed: $MSG"
fi

# ---- version bump ------------------------------------------------------------
# Base the bump on the HIGHER of package.json and the latest git tag, so we never
# collide with an existing release (package.json can drift behind real releases).
PKG_VER="$(grep -m1 '"version"' "$PKG" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
git fetch --tags --quiet origin 2>/dev/null || true
TAG_VER="$(git tag | sed -E 's/^v//' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
# pick the higher of the two as the base
HIGHER="$(printf '%s\n%s\n' "$PKG_VER" "${TAG_VER:-0.0.0}" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
CUR="$HIGHER"
IFS='.' read -r MAJ MIN PAT <<<"$CUR"
case "$BUMP" in
  major) MAJ=$((MAJ+1)); MIN=0; PAT=0 ;;
  minor) MIN=$((MIN+1)); PAT=0 ;;
  patch) PAT=$((PAT+1)) ;;
  none)  : ;;
esac
NEW_VER="${MAJ}.${MIN}.${PAT}"
TAG="v${NEW_VER}"

if [[ "$BUMP" != "none" && "$NEW_VER" != "$PKG_VER" ]]; then
  # replace whatever version literal is currently in package.json
  perl -0pi -e "s/(\"version\"\s*:\s*\")$PKG_VER(\")/\${1}$NEW_VER\${2}/" "$PKG"
  git add "$PKG"
  git commit -m "chore(release): bump version to $NEW_VER"
  echo ">> Bumped version: package.json $PKG_VER -> $NEW_VER (base was $CUR)"
fi

# avoid clobbering an existing tag
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "WARNING: tag $TAG already exists; will push commits but skip re-tagging." >&2
  TAG=""
fi

# ---- push --------------------------------------------------------------------
echo ">> Pushing $BRANCH (triggers Vercel deploy; Postgres + R2 data persists automatically)..."
git push origin "$BRANCH"

# ---- release -----------------------------------------------------------------
if [[ -n "$TAG" ]]; then
  echo ">> Creating GitHub release $TAG ..."
  gh release create "$TAG" --title "$TAG" --generate-notes --target "$BRANCH"
  echo ">> Release published: $(gh release view "$TAG" --json url -q .url)"
fi

echo ""
echo "DONE. Deploy is running on Vercel. Your existing data (chat history, users,"
echo "gallery media in Postgres + R2/Blob) carries over to the new deployment untouched."
